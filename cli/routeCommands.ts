import type { Command } from 'commander'
import { Store } from '../shared/store'
import { defaultConfigDir } from './configDir'
import type { OutputProtocol, RouteConfig } from '../shared/types'

function formatRoute(r: RouteConfig): string {
  const offset = r.channelOffset ? `, offset ${r.channelOffset > 0 ? '+' : ''}${r.channelOffset}` : ''
  return `  ${r.enabled ? '●' : '○'} [${r.id}] universe ${r.universe} -> ${r.deviceUid} (${r.protocol}, ${r.hz}Hz${offset})`
}

/**
 * `route add/list/remove` — configure sihirbazını atlayıp scriptle
 * (Ansible/shell) toplu rota kurulumu yapabilmek için. GUI ile paylaşılan
 * aynı config.json'ı okur/yazar (shared/store.ts üzerinden).
 */
export function registerRouteCommands(program: Command): void {
  const route = program.command('route').description('Manage routes non-interactively (scriptable)')

  route
    .command('add')
    .description('Add or update a route')
    .requiredOption('--universe <n>', 'Art-Net universe number (0-32767)')
    .requiredOption('--device <uid>', 'Target device uid (see list-ports)')
    .option('--protocol <protocol>', 'enttec-pro or open-dmx', 'open-dmx')
    .option('--hz <hz>', 'Output rate in Hz (1-44)', '40')
    .option(
      '--channel-offset <n>',
      'Channel start (patch) offset, -511 to 511. Rotates the universe circularly — no data is dropped, channels that fall off one end wrap to the other.',
      '0'
    )
    .option('--disabled', 'Save the route disabled (not started automatically)')
    .option('--id <id>', 'Route id — reuses/updates an existing route if it already exists')
    .option('--config <dir>', 'Config directory override (default: shared with the desktop app)')
    .action(
      (opts: {
        universe: string
        device: string
        protocol: string
        hz: string
        channelOffset: string
        disabled?: boolean
        id?: string
        config?: string
      }) => {
        const universe = Number(opts.universe)
        if (!Number.isInteger(universe) || universe < 0 || universe > 32767) {
          console.error(`Invalid --universe: ${opts.universe}`)
          process.exitCode = 1
          return
        }
        const hz = Number(opts.hz)
        if (!Number.isInteger(hz) || hz < 1 || hz > 44) {
          console.error(`Invalid --hz: ${opts.hz}`)
          process.exitCode = 1
          return
        }
        const channelOffset = Number(opts.channelOffset)
        if (!Number.isInteger(channelOffset) || channelOffset < -511 || channelOffset > 511) {
          console.error(`Invalid --channel-offset: ${opts.channelOffset} (expected an integer between -511 and 511)`)
          process.exitCode = 1
          return
        }
        const protocol = opts.protocol as OutputProtocol
        if (protocol !== 'enttec-pro' && protocol !== 'open-dmx') {
          console.error(`Invalid --protocol: ${opts.protocol} (expected enttec-pro or open-dmx)`)
          process.exitCode = 1
          return
        }
        const store = new Store(opts.config ?? defaultConfigDir())
        const id = opts.id ?? `route-${Date.now()}`
        store.upsertRoute({ id, universe, deviceUid: opts.device, protocol, hz, channelOffset, enabled: !opts.disabled })
        console.log(`Saved route "${id}".`)
      }
    )

  route
    .command('list')
    .description('List saved routes')
    .option('--config <dir>', 'Config directory override (default: shared with the desktop app)')
    .action((opts: { config?: string }) => {
      const store = new Store(opts.config ?? defaultConfigDir())
      if (store.routes.length === 0) {
        console.log('No routes configured.')
        return
      }
      for (const r of store.routes) console.log(formatRoute(r))
    })

  route
    .command('remove <id>')
    .description('Remove a saved route by id')
    .option('--config <dir>', 'Config directory override (default: shared with the desktop app)')
    .action((id: string, opts: { config?: string }) => {
      const store = new Store(opts.config ?? defaultConfigDir())
      store.removeRoute(id)
      console.log(`Removed route "${id}" (if it existed).`)
    })
}
