#!/usr/bin/env node
import { Store } from '../shared/store'
import { resolveConfigDir } from './configDir'
import { startBridge } from './bridge'
import { ArtNetListener } from '../app/artnet'
import { DmxOutputEngine } from '../app/dmxOutput'
import { pickAutoRoute, resolveAutoRouteFields } from './autoRoute'
import {
  isUsbSerialCandidate,
  runDoctorChecks,
  runPreflightChecks,
  KNOWN_SERIAL_GROUPS,
  type DevicePreflight
} from './doctor'
import { registerRouteCommands } from './routeCommands'
import { registerServiceCommands } from './serviceInstall'
import {
  checkSerialAccess,
  planPermissionFix,
  probeSerialOpen,
  RELOGIN_NOTICE,
  FALLBACK_SERIAL_GROUP
} from '../shared/serialPermissions'
import { spawn } from 'node:child_process'
import { userInfo } from 'node:os'
import type { OutputProtocol, RouteConfig } from '../shared/types'
import type { Command } from 'commander'

// commander + @clack/prompts are pure ESM packages ("type":"module", .mjs only) — this CLI
// compiles to CommonJS (so it can import app/artnet.ts + app/dmxOutput.ts directly, WITHOUT
// MODIFYING them, with their extensionless imports). Dynamic import() from CJS to ESM is a
// standard and safe Node.js interop pattern — that's why both are loaded dynamically rather than statically.
type ClackModule = typeof import('@clack/prompts')
type CommanderModule = typeof import('commander')

function ts(): string {
  return new Date().toISOString().slice(11, 19)
}

/**
 * Injected by scripts/build-standalone.mjs via `esbuild --define` for the pkg
 * binary. Declared, not imported, so the dev/tsc paths still compile.
 */
declare const __CLI_VERSION__: string | undefined

/**
 * The version was previously hardcoded here and silently drifted from
 * package.json on every release (0.3.0 artifacts reporting `--version 0.2.0`).
 * Resolved from package.json instead, across all three run modes:
 * pkg binary (define), `tsx cli/index.ts` (../), published dist-cli (../../).
 */
function cliVersion(): string {
  if (typeof __CLI_VERSION__ === 'string' && __CLI_VERSION__) return __CLI_VERSION__
  for (const rel of ['../package.json', '../../package.json']) {
    try {
      const v = (require(rel) as { version?: string }).version
      if (v) return v
    } catch {
      // try the next layout
    }
  }
  return '0.0.0-dev'
}

/** os.userInfo() throws when the uid has no passwd entry (some containers). */
function currentUsername(): string {
  try {
    return userInfo().username
  } catch {
    return process.env.USER ?? process.env.LOGNAME ?? 'your-user'
  }
}

/**
 * `fix-permissions` — adds the user to the group that owns the serial device.
 *
 * Only the `usermod` call is elevated; ArtNet2USB itself is never expected to
 * run as root, and this command deliberately never tells anyone to run the CLI
 * under sudo. On non-Linux platforms it does nothing.
 */
async function runFixPermissions(opts: { assumeYes?: boolean } = {}): Promise<void> {
  const username = currentUsername()

  if (process.platform !== 'linux') {
    console.log(`Nothing to do: serial group permissions only apply on Linux (this is ${process.platform}).`)
    return
  }

  // Prefer the group that actually owns a connected device over guessing.
  const engine = new DmxOutputEngine(
    () => null,
    () => ({ onSignalLoss: 'hold', signalLossMs: 3000 })
  )
  // Only USB interfaces matter here. Legacy /dev/ttyS* are root-owned, and
  // deriving the group from one of those would advise joining `root` — which
  // must never happen.
  const devices = (await engine.listDevices()).filter((d) => isUsbSerialCandidate(d))
  if (devices.length === 0) {
    console.log('No USB serial device detected. Connect your DMX interface and run this again.')
    return
  }
  const checks = devices.map((d) => checkSerialAccess(d.path))
  const blocked = checks.find((c) => !c.accessible)
  const candidate = blocked ?? checks[0]
  const group =
    candidate?.group && KNOWN_SERIAL_GROUPS.includes(candidate.group) ? candidate.group : FALLBACK_SERIAL_GROUP
  const inGroup = candidate?.inGroup

  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0
  const plan = planPermissionFix({
    platform: 'linux',
    username,
    group,
    inGroup,
    elevator: isRoot ? 'none' : 'sudo',
    isRoot
  })

  if (!plan.needed) {
    console.log(plan.reason)
    if (devices.length > 0 && checks.every((c) => c.accessible)) console.log('All detected serial ports are accessible.')
    return
  }

  console.log(plan.reason)
  console.log(`This will run: ${plan.argv?.join(' ') ?? plan.display}`)
  if (!opts.assumeYes) {
    const ok = await confirmTty('Proceed? [y/N] ')
    if (!ok) {
      console.log(`Aborted. You can run it yourself:\n  ${plan.display}`)
      return
    }
  }

  const code = await runCommand(plan.argv!)
  if (code === 0) {
    console.log(RELOGIN_NOTICE)
    return
  }
  console.error(`Command failed (exit ${code}). You can run it yourself:\n  ${plan.display}`)
  process.exitCode = 1
}

function confirmTty(question: string): Promise<boolean> {
  // Non-interactive (piped/CI) input must not silently count as consent.
  if (!process.stdin.isTTY) return Promise.resolve(false)
  return new Promise((resolve) => {
    process.stdout.write(question)
    process.stdin.setEncoding('utf8')
    process.stdin.once('data', (chunk) => {
      process.stdin.pause()
      resolve(/^y(es)?$/i.test(String(chunk).trim()))
    })
    process.stdin.resume()
  })
}

function runCommand(argv: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(argv[0]!, argv.slice(1), { stdio: 'inherit' })
    child.on('error', () => resolve(127))
    child.on('close', (code) => resolve(code ?? 1))
  })
}

async function listPorts(): Promise<void> {
  const engine = new DmxOutputEngine(
    () => null,
    () => ({ onSignalLoss: 'hold', signalLossMs: 3000 })
  )
  const devices = await engine.listDevices()
  if (devices.length === 0) {
    console.log('No USB serial devices found.')
    return
  }
  console.log(`${devices.length} device(s) found:\n`)
  for (const d of devices) {
    const extra = [d.manufacturer, d.serialNumber ? `SN:${d.serialNumber}` : null].filter(Boolean).join(', ')
    console.log(`  ${d.path}  (uid: ${d.uid})${extra ? `  — ${extra}` : ''}`)
  }
}

interface RunOpts {
  json?: boolean
}

function statusLine(nowTs: string, r: RouteConfig, status: ReturnType<import('../app/dmxOutput').DmxOutputEngine['statusOf']>, json?: boolean): string {
  if (json) {
    return JSON.stringify({
      ts: nowTs,
      type: 'status',
      routeId: r.id,
      universe: r.universe,
      deviceUid: r.deviceUid,
      protocol: r.protocol,
      hz: r.hz,
      active: status.active,
      error: status.error,
      framesSent: status.framesSent,
      frozen: status.frozen
    })
  }
  const head = `[${nowTs}] universe ${r.universe} -> ${r.deviceUid} (${r.protocol}, ${r.hz}Hz)`
  if (status.active) {
    return `${head}: OK — ${status.framesSent} frames sent${status.frozen ? ' (frozen)' : ''}`
  }
  // The engine reports permission/busy failures as multi-line text (cause +
  // remedy). Keep every line — collapsing it back into a one-liner is exactly
  // how a permission problem used to masquerade as "device not connected".
  const reason = status.error ?? 'device_not_connected'
  const [first, ...rest] = reason.split('\n')
  const detail = rest.length > 0 ? `\n${rest.map((l) => (l ? `    ${l}` : '')).join('\n')}` : ''
  return `${head}: ERROR: ${first}${detail}`
}

async function runBridge(configDir: string, opts: RunOpts = {}): Promise<void> {
  const store = new Store(configDir)
  if (store.routes.length === 0) {
    if (opts.json) console.log(JSON.stringify({ ts: ts(), type: 'error', message: 'no_routes_configured' }))
    else console.log('No routes configured. Run `artnet2usb-cli configure` first.')
    return
  }
  if (opts.json) {
    console.log(JSON.stringify({ ts: ts(), type: 'startup', configDir }))
  } else {
    console.log(`[${ts()}] config: ${configDir}`)
    console.log(`[${ts()}] starting bridge...`)
  }
  const bridge = await startBridge(store)
  const enabled = store.routes.filter((r) => r.enabled)
  if (opts.json) console.log(JSON.stringify({ ts: ts(), type: 'summary', enabled: enabled.length, total: store.routes.length }))
  else console.log(`[${ts()}] ${enabled.length}/${store.routes.length} route(s) enabled.`)

  const statusInterval = setInterval(() => {
    for (const r of store.routes) {
      if (!r.enabled) continue
      console.log(statusLine(ts(), r, bridge.engine.statusOf(r), opts.json))
    }
  }, 2000)

  let shuttingDown = false
  const shutdown = async () => {
    if (shuttingDown) return
    shuttingDown = true
    clearInterval(statusInterval)
    if (opts.json) console.log(JSON.stringify({ ts: ts(), type: 'shutdown' }))
    else console.log(`\n[${ts()}] shutting down...`)
    await bridge.shutdown()
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown())
  process.on('SIGTERM', () => void shutdown())
  // The setInterval + open UDP socket keep the process alive — it waits until Ctrl+C/SIGTERM.
}

async function runAuto(
  configDir: string,
  opts: { protocol?: OutputProtocol; hz?: number; channelOffset?: number; start: boolean; json?: boolean }
): Promise<void> {
  const store = new Store(configDir)
  const listener = new ArtNetListener()
  listener.start()
  await new Promise((r) => setTimeout(r, 3000))
  const universes = listener.list()
  listener.stop()

  const engine = new DmxOutputEngine(
    () => null,
    () => store.settings
  )
  const devices = await engine.listDevices()

  const result = pickAutoRoute(universes, devices)
  if ('error' in result) {
    console.error(result.error)
    process.exitCode = 1
    return
  }

  const existing = store.routes.find((r) => r.id === 'auto')
  const { protocol, hz, channelOffset } = resolveAutoRouteFields(existing, opts)

  store.upsertRoute({
    id: 'auto',
    universe: result.universe,
    deviceUid: result.deviceUid,
    protocol,
    hz,
    channelOffset,
    enabled: true
  })
  console.log(
    `Route saved: universe ${result.universe} -> ${result.deviceUid} (${protocol}, ${hz}Hz${channelOffset ? `, offset ${channelOffset > 0 ? '+' : ''}${channelOffset}` : ''})`
  )

  if (opts.start) await runBridge(configDir, { json: opts.json })
}

async function listNodes(): Promise<void> {
  const listener = new ArtNetListener()
  listener.start()
  await new Promise((r) => setTimeout(r, 3000))
  const nodes = listener.listNodes()
  listener.stop()
  if (nodes.length === 0) {
    console.log('No Art-Net nodes found (listened for 3s).')
    return
  }
  console.log(`${nodes.length} node(s) found:\n`)
  for (const n of nodes) {
    console.log(`  ${n.ip}  ${n.shortName}${n.longName && n.longName !== n.shortName ? ` — ${n.longName}` : ''}`)
  }
}

async function promptManualUniverse(clack: ClackModule): Promise<number | undefined> {
  const v = await clack.text({
    message: 'Universe number (0-32767)',
    validate: (s) => {
      const n = Number(s)
      return Number.isInteger(n) && n >= 0 && n <= 32767 ? undefined : 'Enter a valid universe number'
    }
  })
  if (clack.isCancel(v)) return undefined
  return Number(v)
}

async function addRouteFlow(clack: ClackModule, store: Store): Promise<void> {
  const listener = new ArtNetListener()
  const sp = clack.spinner()
  sp.start('Listening for Art-Net traffic (3s)...')
  listener.start()
  await new Promise((r) => setTimeout(r, 3000))
  const seen = listener.list()
  listener.stop()
  sp.stop(`${seen.length} universe(s) detected.`)

  let universe: number | undefined
  if (seen.length > 0) {
    const picked = await clack.select({
      message: 'Select a universe',
      options: [
        ...seen.map((u) => ({ value: u.universe, label: `Universe ${u.universe}`, hint: `${u.fps}fps, ${u.sourceIp}` })),
        { value: -1, label: 'Enter manually...' }
      ]
    })
    if (clack.isCancel(picked)) return
    universe = picked === -1 ? await promptManualUniverse(clack) : picked
  } else {
    universe = await promptManualUniverse(clack)
  }
  if (universe == null) return

  const engine = new DmxOutputEngine(
    () => null,
    () => store.settings
  )
  const sp2 = clack.spinner()
  sp2.start('Scanning USB devices...')
  const devices = await engine.listDevices()
  sp2.stop(`${devices.length} device(s) found.`)
  if (devices.length === 0) {
    clack.log.error('No USB serial device found — connect your DMX interface and try again.')
    return
  }
  const deviceUid = await clack.select({
    message: 'Select a device',
    options: devices.map((d) => ({ value: d.uid, label: store.deviceNames[d.uid] ?? d.path, hint: d.manufacturer }))
  })
  if (clack.isCancel(deviceUid)) return

  const protocol = await clack.select({
    message: 'Protocol',
    options: [
      { value: 'enttec-pro', label: 'Enttec DMX USB Pro' },
      { value: 'open-dmx', label: 'Open DMX (raw FTDI)' }
    ]
  })
  if (clack.isCancel(protocol)) return

  const hzStr = await clack.text({
    message: 'Output rate (Hz, 1-44)',
    initialValue: '40',
    validate: (v) => {
      const n = Number(v)
      return Number.isInteger(n) && n >= 1 && n <= 44 ? undefined : 'Enter an integer between 1 and 44'
    }
  })
  if (clack.isCancel(hzStr)) return

  const channelOffsetStr = await clack.text({
    message: 'Channel start (patch) offset, -511 to 511 (rotates circularly — no data is dropped)',
    initialValue: '0',
    validate: (v) => {
      const n = Number(v)
      return Number.isInteger(n) && n >= -511 && n <= 511 ? undefined : 'Enter an integer between -511 and 511'
    }
  })
  if (clack.isCancel(channelOffsetStr)) return

  store.upsertRoute({
    id: `route-${Date.now()}`,
    universe,
    deviceUid: deviceUid as string,
    protocol: protocol as OutputProtocol,
    hz: Number(hzStr),
    channelOffset: Number(channelOffsetStr),
    enabled: true
  })
  clack.log.success('Route saved.')
}

async function removeRouteFlow(clack: ClackModule, store: Store): Promise<void> {
  const id = await clack.select({
    message: 'Select a route to remove',
    options: store.routes.map((r) => ({ value: r.id, label: `universe ${r.universe} -> ${r.deviceUid}` }))
  })
  if (clack.isCancel(id)) return
  store.removeRoute(id as string)
  clack.log.success('Route removed.')
}

async function runConfigure(clack: ClackModule, configDir: string): Promise<void> {
  clack.intro('artnet2usb-cli — configure')
  const store = new Store(configDir)

  for (;;) {
    const routes = store.routes
    if (routes.length > 0) {
      clack.log.info(
        `Current routes:\n${routes
          .map(
            (r) =>
              `  ${r.enabled ? '●' : '○'} universe ${r.universe} -> ${r.deviceUid} (${r.protocol}, ${r.hz}Hz${r.channelOffset ? `, offset ${r.channelOffset > 0 ? '+' : ''}${r.channelOffset}` : ''})`
          )
          .join('\n')}`
      )
    } else {
      clack.log.info('No routes configured yet.')
    }

    const action = await clack.select({
      message: 'What would you like to do?',
      options: [
        { value: 'add', label: 'Add a route' },
        ...(routes.length > 0 ? [{ value: 'remove', label: 'Remove a route' }] : []),
        ...(routes.length > 0 ? [{ value: 'start', label: 'Start routes and exit' }] : []),
        { value: 'exit', label: 'Exit (keep saved, do not start)' }
      ]
    })
    if (clack.isCancel(action) || action === 'exit') break
    if (action === 'add') await addRouteFlow(clack, store)
    if (action === 'remove') await removeRouteFlow(clack, store)
    if (action === 'start') {
      clack.outro('Starting routes — press Ctrl+C to stop.')
      await runBridge(configDir)
      return
    }
  }
  clack.outro('Bye!')
}

async function main(): Promise<void> {
  const { Command } = (await import('commander')) as CommanderModule
  const clack = (await import('@clack/prompts')) as ClackModule

  // Running with no arguments → go straight to the interactive wizard (the simplest and
  // most predictable approach, instead of dealing with commander's "default command" setup).
  if (process.argv.length <= 2) {
    await runConfigure(clack, resolveConfigDir())
    return
  }

  const program = new Command()
  program
    .name('artnet2usb-cli')
    .description('Headless Art-Net -> USB DMX bridge (shares config with the desktop app)')
    .version(cliVersion())

  program
    .command('list-ports')
    .description('List connected USB serial devices')
    .action(async () => {
      await listPorts()
    })

  program
    .command('run')
    .description('Start the bridge using saved routes and run until stopped (Ctrl+C)')
    .option('--config <dir>', 'Config directory override (default: shared with the desktop app)')
    .option('--json', 'Emit newline-delimited JSON status instead of human-readable text')
    .action(async (opts: { config?: string; json?: boolean }) => {
      await runBridge(opts.config ?? resolveConfigDir(), { json: opts.json })
    })

  program
    .command('configure')
    .description('Interactively add/remove routes (terminal wizard)')
    .option('--config <dir>', 'Config directory override (default: shared with the desktop app)')
    .action(async (opts: { config?: string }) => {
      await runConfigure(clack, opts.config ?? resolveConfigDir())
    })

  program
    .command('auto')
    .description('Auto-detect a single Art-Net universe and USB device, save the route, and start it (unless --no-start)')
    .option('--protocol <protocol>', 'enttec-pro or open-dmx', 'open-dmx')
    .option('--hz <hz>', 'Output rate in Hz (1-44)', '40')
    .option(
      '--channel-offset <n>',
      'Channel start (patch) offset, -511 to 511. Rotates the universe circularly — no data is dropped, channels that fall off one end wrap to the other.',
      '0'
    )
    .option('--config <dir>', 'Config directory override (default: shared with the desktop app)')
    .option('--no-start', 'Only detect and save the route, do not start the bridge')
    .option('--json', 'Emit newline-delimited JSON status instead of human-readable text')
    .action(async (opts: { protocol: string; hz: string; channelOffset: string; config?: string; start: boolean; json?: boolean }, command: Command) => {
      const protocol = opts.protocol as OutputProtocol
      if (protocol !== 'enttec-pro' && protocol !== 'open-dmx') {
        console.error(`Invalid --protocol: ${opts.protocol} (expected enttec-pro or open-dmx)`)
        process.exitCode = 1
        return
      }
      const hz = Number(opts.hz)
      if (!Number.isInteger(hz) || hz < 1 || hz > 44) {
        console.error(`Invalid --hz: ${opts.hz} (expected an integer between 1 and 44)`)
        process.exitCode = 1
        return
      }
      const channelOffset = Number(opts.channelOffset)
      if (!Number.isInteger(channelOffset) || channelOffset < -511 || channelOffset > 511) {
        console.error(`Invalid --channel-offset: ${opts.channelOffset} (expected an integer between -511 and 511)`)
        process.exitCode = 1
        return
      }
      // If the flag was not explicitly passed (only commander's default applied), undefined is passed through —
      // in that case runAuto() preserves the existing "auto" route's value (see the runAuto comment).
      const explicit = (key: string) => command.getOptionValueSource(key) === 'cli'
      await runAuto(opts.config ?? resolveConfigDir(), {
        protocol: explicit('protocol') ? protocol : undefined,
        hz: explicit('hz') ? hz : undefined,
        channelOffset: explicit('channelOffset') ? channelOffset : undefined,
        start: opts.start,
        json: opts.json
      })
    })

  program
    .command('doctor')
    .description('Preflight: check serial port permissions, device access, and the saved config')
    .option('--config <dir>', 'Config directory override (default: shared with the desktop app)')
    .option('--no-probe', 'Skip opening each port (the open probe is what detects a port held by another process)')
    .action(async (opts: { config?: string; probe: boolean }) => {
      const configDir = opts.config ?? resolveConfigDir()
      const store = new Store(configDir)
      const engine = new DmxOutputEngine(
        () => null,
        () => store.settings
      )
      // Port enumeration itself can fail: serialport shells out to `udevadm` on
      // Linux, which is absent on minimal/headless images. Reporting that as a
      // bare "spawn udevadm ENOENT" tells the user nothing actionable.
      let devices: Awaited<ReturnType<typeof engine.listDevices>>
      try {
        devices = await engine.listDevices()
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err)
        console.log(`platform: ${process.platform}  user: ${currentUsername()}`)
        console.log(`config: ${configDir}`)
        console.log(`  ✗ Could not enumerate serial ports: ${detail}`)
        if (process.platform === 'linux' && /udevadm/.test(detail)) {
          console.log('    serialport uses udevadm to list ports. On a minimal or container image, install it:')
          console.log('      sudo apt-get install -y udev      # Debian/Ubuntu')
        }
        process.exitCode = 1
        return
      }

      // Legacy /dev/ttyS* exist on nearly every PC and are root-owned; probing
      // them would bury the real USB-DMX diagnosis under irrelevant failures.
      const usbDevices = devices.filter((d) => isUsbSerialCandidate(d))

      // I/O happens here; the decision logic in cli/doctor.ts stays pure.
      const preflightDevices: DevicePreflight[] = []
      for (const d of usbDevices) {
        const access = checkSerialAccess(d.path)
        // Only probe when the node is actually usable — probing an inaccessible
        // port just re-reports the permission error we already have.
        const openProblem = opts.probe && access.accessible ? await probeSerialOpen(d.path) : null
        preflightDevices.push({
          path: d.path,
          uid: d.uid,
          exists: access.exists,
          accessible: access.accessible,
          group: access.group,
          inGroup: access.inGroup,
          openProblem
        })
      }

      const issues = [
        ...runPreflightChecks({ platform: process.platform, username: currentUsername(), devices: preflightDevices }),
        ...runDoctorChecks(store.routes, devices)
      ]

      console.log(`platform: ${process.platform}  user: ${currentUsername()}`)
      console.log(`config: ${configDir}`)
      console.log(`${usbDevices.length} USB serial device(s) detected (${devices.length} serial port(s) total).`)
      for (const d of preflightDevices) {
        // Group membership is only the deciding factor on Linux; elsewhere it is noise.
        const grp = process.platform === 'linux' && d.group ? `, group ${d.group}${d.inGroup === false ? ' (not a member)' : ''}` : ''
        console.log(`  ${d.accessible ? '✓' : '✗'} ${d.path}${grp}`)
      }
      console.log(`${store.routes.length} route(s), ${store.routes.filter((r) => r.enabled).length} enabled.`)
      if (issues.length === 0) {
        console.log('No issues found.')
        return
      }
      for (const issue of issues) console.log(`  ${issue.level === 'error' ? '✗' : '⚠'} ${issue.message}`)
      if (issues.some((i) => i.level === 'error')) process.exitCode = 1
    })

  program
    .command('fix-permissions')
    .description('Linux only: add your user to the serial device group so ArtNet2USB can open the port')
    .option('--yes', 'Do not ask for confirmation')
    .action(async (opts: { yes?: boolean }) => {
      await runFixPermissions({ assumeYes: opts.yes })
    })

  program
    .command('list-nodes')
    .description('Listen for Art-Net nodes on the network (~3s) and list them')
    .action(async () => {
      await listNodes()
    })

  registerRouteCommands(program)
  registerServiceCommands(program)

  await program.parseAsync(process.argv)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
