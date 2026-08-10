import type { RouteConfig, UsbDevice } from '../shared/types'
import { buildFixCommand, FALLBACK_SERIAL_GROUP, type SerialAccessProblem } from '../shared/serialPermissions'

export interface DoctorIssue {
  level: 'error' | 'warning'
  message: string
}

/**
 * Groups that legitimately own USB serial devices across distros. Membership
 * advice is deliberately limited to these: /dev/ttyS* (legacy COM ports, present
 * on almost every PC) are owned by root, and telling anyone to join the `root`
 * group would be actively harmful.
 */
export const KNOWN_SERIAL_GROUPS = ['dialout', 'uucp', 'plugdev', 'serial']

/**
 * Whether a listed port looks like a USB interface. serialport only reports
 * vendorId/productId for USB devices, so legacy /dev/ttyS* are excluded — they
 * exist on virtually every machine and would otherwise flood `doctor` with
 * irrelevant failures. Pure — unit tested.
 */
export function isUsbSerialCandidate(p: { path: string; vendorId?: string; productId?: string }): boolean {
  if (p.vendorId || p.productId) return true
  return /(ttyUSB|ttyACM|tty\.usb|cu\.usb|ttyAMA)/i.test(p.path)
}

/** Per-device preflight facts gathered by the caller (all I/O happens there). */
export interface DevicePreflight {
  path: string
  uid: string
  /** Device node is present on disk. */
  exists: boolean
  /** This user can read AND write the node. */
  accessible: boolean
  /** Group owning the node (Linux). */
  group?: string
  /** Current process is a member of that group. */
  inGroup?: boolean
  /** Result of actually opening the port — detects a port held by another process. */
  openProblem?: SerialAccessProblem | null
}

export interface PreflightInput {
  platform: NodeJS.Platform
  username: string
  devices: DevicePreflight[]
}

/**
 * Preflight half of `doctor`: environment and permission checks that are
 * independent of the saved config. Pure — the caller performs the filesystem
 * and serial probing and passes the findings in, so this stays unit tested.
 */
export function runPreflightChecks(input: PreflightInput): DoctorIssue[] {
  const issues: DoctorIssue[] = []

  if (input.devices.length === 0) {
    issues.push({
      level: 'error',
      message: 'No USB serial device found. Connect your DMX interface (it should appear as /dev/ttyUSB* or /dev/ttyACM* on Linux).'
    })
    return issues
  }

  for (const d of input.devices) {
    if (!d.exists) {
      issues.push({ level: 'error', message: `${d.path}: device node no longer exists (unplugged?).` })
      continue
    }

    if (!d.accessible) {
      const group = d.group ?? FALLBACK_SERIAL_GROUP
      // On Linux this is almost always group membership, and it has a one-command fix.
      if (input.platform === 'linux') {
        issues.push({
          level: 'error',
          message:
            `${d.path}: permission denied — your user cannot open this port.\n` +
            `    Your user is not in the "${group}" group, which owns the device.\n` +
            `    Run: ${buildFixCommand(group, input.username)}\n` +
            '    Then log out and log back in (or reboot). Do not run ArtNet2USB with sudo.'
        })
      } else {
        issues.push({ level: 'error', message: `${d.path}: permission denied — your user cannot open this port.` })
      }
      continue
    }

    // Group membership can be false while access still succeeds (ACLs, udev
    // rules). Worth flagging — but only for groups that actually manage serial
    // devices; never advise joining `root`.
    if (input.platform === 'linux' && d.inGroup === false && d.group && KNOWN_SERIAL_GROUPS.includes(d.group)) {
      issues.push({
        level: 'warning',
        message: `${d.path}: your user is not in the "${d.group}" group, though access currently works (udev rule or ACL). This may break after a reboot.`
      })
    }

    if (d.openProblem) {
      // Only the two conditions the probe exists to detect are failures. A
      // device can legitimately refuse the probe's baud rate (Open DMX runs at
      // 250000), and calling that an error would be a false alarm.
      if (d.openProblem.kind === 'busy') {
        issues.push({
          level: 'error',
          message: `${d.path}: port is already open in another process. Close other DMX software (or a second ArtNet2USB instance).`
        })
      } else if (d.openProblem.kind === 'permission') {
        issues.push({
          level: 'error',
          message: `${d.path}: opening the port was denied — ${d.openProblem.detail ?? 'permission denied'}.`
        })
      } else {
        issues.push({
          level: 'warning',
          message: `${d.path}: test open did not succeed — ${d.openProblem.detail ?? d.openProblem.kind}. This can be normal for some interfaces and does not necessarily mean the device is faulty.`
        })
      }
    }
  }

  return issues
}

/**
 * Decision logic for the `doctor` command: cross-checks the enabled routes in
 * config.json against the USB devices currently connected. Pure — actual
 * filesystem/hardware access happens on the caller's side (cli/index.ts).
 */
export function runDoctorChecks(routes: RouteConfig[], devices: UsbDevice[]): DoctorIssue[] {
  const issues: DoctorIssue[] = []
  const connectedUids = new Set(devices.map((d) => d.uid))
  const enabled = routes.filter((r) => r.enabled)

  for (const r of enabled) {
    if (!connectedUids.has(r.deviceUid)) {
      issues.push({ level: 'error', message: `Route "${r.id}" (universe ${r.universe}): device ${r.deviceUid} is not currently connected.` })
    }
    if (!Number.isInteger(r.hz) || r.hz < 1 || r.hz > 44) {
      issues.push({ level: 'error', message: `Route "${r.id}": hz ${r.hz} is out of range (1-44).` })
    }
    const offset = r.channelOffset ?? 0
    if (!Number.isInteger(offset) || offset < -511 || offset > 511) {
      issues.push({ level: 'error', message: `Route "${r.id}": channelOffset ${offset} is out of range (-511 to 511).` })
    }
  }

  const byUniverse = new Map<number, RouteConfig[]>()
  for (const r of enabled) byUniverse.set(r.universe, [...(byUniverse.get(r.universe) ?? []), r])
  for (const [universe, list] of byUniverse) {
    if (list.length > 1) {
      issues.push({ level: 'warning', message: `Universe ${universe} is routed by ${list.length} enabled routes: ${list.map((r) => r.id).join(', ')}.` })
    }
  }

  const byDevice = new Map<string, RouteConfig[]>()
  for (const r of enabled) byDevice.set(r.deviceUid, [...(byDevice.get(r.deviceUid) ?? []), r])
  for (const [deviceUid, list] of byDevice) {
    if (list.length > 1) {
      issues.push({ level: 'warning', message: `Device ${deviceUid} is targeted by ${list.length} enabled routes: ${list.map((r) => r.id).join(', ')}.` })
    }
  }

  return issues
}
