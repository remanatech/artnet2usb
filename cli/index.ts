#!/usr/bin/env node
import { Store } from '../shared/store'
import { defaultConfigDir } from './configDir'
import { startBridge } from './bridge'
import { ArtNetListener } from '../app/artnet'
import { DmxOutputEngine } from '../app/dmxOutput'
import { pickAutoRoute, resolveAutoRouteFields } from './autoRoute'
import { runDoctorChecks } from './doctor'
import { registerRouteCommands } from './routeCommands'
import { registerServiceCommands } from './serviceInstall'
import type { OutputProtocol, RouteConfig } from '../shared/types'
import type { Command } from 'commander'

// commander + @clack/prompts saf ESM paketler ("type":"module", sadece .mjs) — bu CLI
// CommonJS'e derleniyor (app/artnet.ts + app/dmxOutput.ts'i DEĞİŞTİRMEDEN, extensionless
// import'larıyla, doğrudan içe aktarabilmek için). CJS'ten ESM'e dinamik import() standart
// ve güvenli bir Node.js interop deseni — bu yüzden ikisi de statik değil dinamik alınıyor.
type ClackModule = typeof import('@clack/prompts')
type CommanderModule = typeof import('commander')

function ts(): string {
  return new Date().toISOString().slice(11, 19)
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
  const line = status.active
    ? `OK — ${status.framesSent} frames sent${status.frozen ? ' (frozen)' : ''}`
    : `ERROR: ${status.error ?? 'device not connected'}`
  return `[${nowTs}] universe ${r.universe} -> ${r.deviceUid} (${r.protocol}, ${r.hz}Hz): ${line}`
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
  // setInterval + açık UDP soket süreci ayakta tutar — Ctrl+C/SIGTERM'e kadar bekler.
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

  // Argümansız çalıştırma → doğrudan interaktif sihirbaz (commander'ın "default command"
  // ayarlarıyla uğraşmak yerine en basit ve öngörülebilir yol).
  if (process.argv.length <= 2) {
    await runConfigure(clack, defaultConfigDir())
    return
  }

  const program = new Command()
  program
    .name('artnet2usb-cli')
    .description('Headless Art-Net -> USB DMX bridge (shares config with the desktop app)')
    .version('0.2.0')

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
      await runBridge(opts.config ?? defaultConfigDir(), { json: opts.json })
    })

  program
    .command('configure')
    .description('Interactively add/remove routes (terminal wizard)')
    .option('--config <dir>', 'Config directory override (default: shared with the desktop app)')
    .action(async (opts: { config?: string }) => {
      await runConfigure(clack, opts.config ?? defaultConfigDir())
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
      // Bayrak elle verilmediyse (sadece commander varsayılanı uygulandıysa) undefined geçilir —
      // runAuto() bu durumda mevcut "auto" rotasının değerini korur (bkz. runAuto yorumu).
      const explicit = (key: string) => command.getOptionValueSource(key) === 'cli'
      await runAuto(opts.config ?? defaultConfigDir(), {
        protocol: explicit('protocol') ? protocol : undefined,
        hz: explicit('hz') ? hz : undefined,
        channelOffset: explicit('channelOffset') ? channelOffset : undefined,
        start: opts.start,
        json: opts.json
      })
    })

  program
    .command('doctor')
    .description('Check the saved config for common problems (disconnected devices, conflicting routes)')
    .option('--config <dir>', 'Config directory override (default: shared with the desktop app)')
    .action(async (opts: { config?: string }) => {
      const configDir = opts.config ?? defaultConfigDir()
      const store = new Store(configDir)
      const engine = new DmxOutputEngine(
        () => null,
        () => store.settings
      )
      const devices = await engine.listDevices()
      const issues = runDoctorChecks(store.routes, devices)
      console.log(`config: ${configDir}`)
      console.log(`${store.routes.length} route(s), ${store.routes.filter((r) => r.enabled).length} enabled.`)
      if (issues.length === 0) {
        console.log('No issues found.')
        return
      }
      for (const issue of issues) console.log(`  ${issue.level === 'error' ? '✗' : '⚠'} ${issue.message}`)
      if (issues.some((i) => i.level === 'error')) process.exitCode = 1
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
