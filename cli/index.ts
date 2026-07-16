#!/usr/bin/env node
import { Store } from '../shared/store'
import { defaultConfigDir } from './configDir'
import { startBridge } from './bridge'
import { ArtNetListener } from '../app/artnet'
import { DmxOutputEngine } from '../app/dmxOutput'
import type { OutputProtocol } from '../shared/types'

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

async function runBridge(configDir: string): Promise<void> {
  const store = new Store(configDir)
  if (store.routes.length === 0) {
    console.log('No routes configured. Run `artnet2usb-cli configure` first.')
    return
  }
  console.log(`[${ts()}] config: ${configDir}`)
  console.log(`[${ts()}] starting bridge...`)
  const bridge = await startBridge(store)
  const enabled = store.routes.filter((r) => r.enabled)
  console.log(`[${ts()}] ${enabled.length}/${store.routes.length} route(s) enabled.`)

  const statusInterval = setInterval(() => {
    for (const r of store.routes) {
      if (!r.enabled) continue
      const status = bridge.engine.statusOf(r)
      const line = status.active
        ? `OK — ${status.framesSent} frames sent${status.frozen ? ' (frozen)' : ''}`
        : `ERROR: ${status.error ?? 'device not connected'}`
      console.log(`[${ts()}] universe ${r.universe} -> ${r.deviceUid} (${r.protocol}, ${r.hz}Hz): ${line}`)
    }
  }, 2000)

  let shuttingDown = false
  const shutdown = async () => {
    if (shuttingDown) return
    shuttingDown = true
    clearInterval(statusInterval)
    console.log(`\n[${ts()}] shutting down...`)
    await bridge.shutdown()
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown())
  process.on('SIGTERM', () => void shutdown())
  // setInterval + açık UDP soket süreci ayakta tutar — Ctrl+C/SIGTERM'e kadar bekler.
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

  store.upsertRoute({
    id: `route-${Date.now()}`,
    universe,
    deviceUid: deviceUid as string,
    protocol: protocol as OutputProtocol,
    hz: Number(hzStr),
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
        `Current routes:\n${routes.map((r) => `  ${r.enabled ? '●' : '○'} universe ${r.universe} -> ${r.deviceUid} (${r.protocol}, ${r.hz}Hz)`).join('\n')}`
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
    .version('0.1.0')

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
    .action(async (opts: { config?: string }) => {
      await runBridge(opts.config ?? defaultConfigDir())
    })

  program
    .command('configure')
    .description('Interactively add/remove routes (terminal wizard)')
    .option('--config <dir>', 'Config directory override (default: shared with the desktop app)')
    .action(async (opts: { config?: string }) => {
      await runConfigure(clack, opts.config ?? defaultConfigDir())
    })

  await program.parseAsync(process.argv)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
