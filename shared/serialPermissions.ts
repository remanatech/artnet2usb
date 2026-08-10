import { accessSync, constants, readFileSync, statSync } from 'node:fs'

/**
 * Serial port permission handling — the SINGLE source of truth for both the CLI
 * and the Electron GUI. Neither side implements its own check.
 *
 * Why this exists: on Linux the device node (/dev/ttyUSB0, /dev/ttyACM0) is
 * usually owned by root and a group like `dialout`. A user outside that group
 * still SEES the device in SerialPort.list() but cannot open it — the open
 * fails with EACCES. Reporting that as "device not connected" sends people
 * looking for a cable fault instead of the real, one-command fix.
 */

/** Group that owns serial device nodes when we cannot read it from the filesystem. */
export const FALLBACK_SERIAL_GROUP = 'dialout'

export type SerialProblemKind =
  /** Device node exists but this user may not open it (EACCES/EPERM). */
  | 'permission'
  /** Another process holds the port (EBUSY / lock file). */
  | 'busy'
  /** Path is gone — device unplugged between listing and opening. */
  | 'missing'
  | 'unknown'

/** Classifies a serialport/fs error. Pure — unit tested. */
export function classifySerialError(err: unknown): SerialProblemKind {
  const code = typeof err === 'object' && err !== null ? String((err as { code?: unknown }).code ?? '') : ''
  const message = err instanceof Error ? err.message : String(err ?? '')
  const haystack = `${code} ${message}`.toUpperCase()

  if (haystack.includes('EACCES') || haystack.includes('EPERM')) return 'permission'
  if (haystack.includes('EBUSY') || haystack.includes('RESOURCE BUSY') || haystack.includes('CANNOT LOCK PORT')) return 'busy'
  if (haystack.includes('ENOENT') || haystack.includes('ENXIO') || haystack.includes('ENODEV')) return 'missing'
  return 'unknown'
}

export interface SerialAccessProblem {
  kind: SerialProblemKind
  /** Device node the problem refers to. */
  path: string
  /** Group that owns the device node (Linux), when known. */
  group?: string
  /** Raw error text, preserved so the real cause is never lost. */
  detail?: string
}

/**
 * User-facing explanation + remedy. Pure — unit tested.
 * Returns plain lines so the CLI can print them and the GUI can render them.
 */
export function describeSerialProblem(
  problem: SerialAccessProblem,
  ctx: { platform: NodeJS.Platform; username: string }
): { title: string; lines: string[]; fixCommand: string | null } {
  const group = problem.group ?? FALLBACK_SERIAL_GROUP
  switch (problem.kind) {
    case 'permission': {
      // Group membership is a Linux concept; on macOS/Windows a denial means something else.
      const fixCommand = ctx.platform === 'linux' ? buildFixCommand(group, ctx.username) : null
      const lines = [
        `Device detected at ${problem.path} but permission was denied.`,
        ...(problem.detail ? [problem.detail] : [])
      ]
      if (ctx.platform === 'linux') {
        lines.push(
          '',
          `Your user is not in the "${group}" group, which owns the serial device.`,
          'Run:',
          `  ${fixCommand}`,
          '',
          'Then log out and log back in (or reboot) for the group to take effect.',
          'Do not run ArtNet2USB itself with sudo.'
        )
      }
      return { title: 'Serial port permission denied', lines, fixCommand }
    }
    case 'busy':
      return {
        title: 'Serial port is busy',
        lines: [
          `${problem.path} is already open in another process.`,
          ...(problem.detail ? [problem.detail] : []),
          '',
          'Close any other DMX software (or a second ArtNet2USB instance) using this port.'
        ],
        fixCommand: null
      }
    case 'missing':
      return {
        title: 'Serial port disappeared',
        lines: [
          `${problem.path} no longer exists — the device was probably unplugged.`,
          ...(problem.detail ? [problem.detail] : [])
        ],
        fixCommand: null
      }
    default:
      return {
        title: 'Serial port could not be opened',
        lines: [`${problem.path} could not be opened.`, ...(problem.detail ? [problem.detail] : [])],
        fixCommand: null
      }
  }
}

/** The exact command that fixes group membership. Pure — unit tested. */
export function buildFixCommand(group: string, username: string): string {
  return `sudo usermod -aG ${group} ${username}`
}

/** Maps a numeric gid to a group name using /etc/group. Pure — unit tested. */
export function groupNameFromEtcGroup(etcGroup: string, gid: number): string | null {
  for (const line of etcGroup.split('\n')) {
    // name:password:gid:members
    const parts = line.split(':')
    if (parts.length < 3) continue
    if (Number(parts[2]) === gid) return parts[0] ?? null
    }
  return null
}

export interface SerialAccessResult {
  path: string
  /** Device node exists. */
  exists: boolean
  /** This user can open the port for reading and writing. */
  accessible: boolean
  /** Group owning the device node (Linux). */
  group?: string
  /** Whether the current process is a member of that group. */
  inGroup?: boolean
  problem: SerialAccessProblem | null
}

/**
 * Non-invasive access check: inspects the device node's permissions WITHOUT
 * opening it, so a port already streaming DMX is never disturbed. Use
 * probeSerialOpen() when you deliberately want to test an actual open.
 */
export function checkSerialAccess(path: string, platform: NodeJS.Platform = process.platform): SerialAccessResult {
  // Only POSIX device nodes carry the ownership model this check relies on.
  if (platform === 'win32') {
    return { path, exists: true, accessible: true, problem: null }
  }

  let gid: number | undefined
  try {
    gid = statSync(path).gid
  } catch (err) {
    if (classifySerialError(err) === 'missing') {
      return {
        path,
        exists: false,
        accessible: false,
        problem: { kind: 'missing', path, detail: errText(err) }
      }
    }
    // stat can fail for reasons other than absence; fall through to the access test.
  }

  const group = gid === undefined ? undefined : lookupGroupName(gid) ?? undefined
  const inGroup = gid === undefined ? undefined : currentProcessGids().includes(gid)

  try {
    accessSync(path, constants.R_OK | constants.W_OK)
    return { path, exists: true, accessible: true, group, inGroup, problem: null }
  } catch (err) {
    const kind = classifySerialError(err)
    return {
      path,
      exists: kind !== 'missing',
      accessible: false,
      group,
      inGroup,
      problem: { kind: kind === 'unknown' ? 'permission' : kind, path, group, detail: errText(err) }
    }
  }
}

/** gids of the current process, including supplementary groups. */
function currentProcessGids(): number[] {
  const gids: number[] = []
  try {
    if (typeof process.getgid === 'function') {
      const g = process.getgid()
      if (typeof g === 'number') gids.push(g)
    }
    if (typeof process.getgroups === 'function') gids.push(...process.getgroups())
  } catch {
    // Not available on this platform — membership stays unknown.
  }
  return gids
}

function lookupGroupName(gid: number): string | null {
  try {
    return groupNameFromEtcGroup(readFileSync('/etc/group', 'utf8'), gid)
  } catch {
    return null
  }
}

function errText(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err ?? '')
}

/**
 * Deliberately opens and immediately closes the port. This is the only way to
 * learn whether another process holds it (EBUSY), so it is used by `doctor`
 * only — never during normal listing, which must not disturb live output.
 */
export async function probeSerialOpen(path: string): Promise<SerialAccessProblem | null> {
  const { SerialPort } = (await import('serialport')) as typeof import('serialport')
  const port = new SerialPort({ path, baudRate: 57600, autoOpen: false })
  try {
    await new Promise<void>((resolve, reject) => port.open((err) => (err ? reject(err) : resolve())))
  } catch (err) {
    const access = checkSerialAccess(path)
    return { kind: classifySerialError(err), path, group: access.group, detail: errText(err) }
  }
  await new Promise<void>((resolve) => port.close(() => resolve()))
  return null
}

export type Elevator = 'pkexec' | 'sudo' | 'none'

export interface PermissionFixPlan {
  /** Nothing to do — either not Linux, or the user is already in the group. */
  needed: boolean
  reason: string
  group: string
  username: string
  /** argv to execute; null when nothing should run. */
  argv: string[] | null
  /** Command string to show the user (never asks them to run the app as root). */
  display: string | null
}

/**
 * Decides what — if anything — should be run to fix group membership.
 * Pure, so both the CLI and the GUI make the identical decision and it is
 * unit tested without touching the system.
 */
export function planPermissionFix(input: {
  platform: NodeJS.Platform
  username: string
  group?: string
  /** Result of checkSerialAccess for the affected device, when one is known. */
  inGroup?: boolean
  elevator: Elevator
  /** Whether the current process is already root (uid 0). */
  isRoot?: boolean
}): PermissionFixPlan {
  const group = input.group ?? FALLBACK_SERIAL_GROUP
  const username = input.username
  const display = buildFixCommand(group, username)

  if (input.platform !== 'linux') {
    return {
      needed: false,
      reason: 'Serial group permissions only apply on Linux; nothing to do on this platform.',
      group,
      username,
      argv: null,
      display: null
    }
  }
  if (input.inGroup === true) {
    return {
      needed: false,
      reason: `User "${username}" is already in the "${group}" group.`,
      group,
      username,
      argv: null,
      display: null
    }
  }

  // Only the group change is elevated — the app itself keeps running as the normal user.
  const usermod = ['usermod', '-aG', group, username]
  const argv =
    input.isRoot === true
      ? usermod
      : input.elevator === 'pkexec'
        ? ['pkexec', ...usermod]
        : input.elevator === 'sudo'
          ? ['sudo', ...usermod]
          : null

  return {
    needed: true,
    reason: `User "${username}" is not in the "${group}" group.`,
    group,
    username,
    argv,
    display
  }
}

/** Shown verbatim after a successful fix — the group only applies to new sessions. */
export const RELOGIN_NOTICE = 'Permission updated successfully.\nPlease log out and log back in, or restart your computer.'

