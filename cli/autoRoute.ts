import type { OutputProtocol, RouteConfig, SeenUniverse, UsbDevice } from '../shared/types'

export interface AutoRouteMatch {
  universe: number
  deviceUid: string
}

export interface AutoRouteError {
  error: string
}

/**
 * Decision logic for the "auto" command: matches when exactly 1 universe + 1 USB
 * device have been seen, otherwise returns an error explaining which side is
 * ambiguous — the caller then directs the user to `configure` in this case.
 */
export function pickAutoRoute(universes: SeenUniverse[], devices: UsbDevice[]): AutoRouteMatch | AutoRouteError {
  if (universes.length === 0 && devices.length === 0) {
    return { error: 'No Art-Net universe and no USB device detected. Connect your DMX interface and ensure Art-Net traffic is reaching this machine, then retry.' }
  }
  if (universes.length === 0) {
    return { error: 'No Art-Net universe detected. Ensure a controller is broadcasting Art-Net on this network, then retry.' }
  }
  if (devices.length === 0) {
    return { error: 'No USB serial device detected. Connect your DMX interface, then retry.' }
  }
  if (universes.length > 1) {
    const list = universes.map((u) => u.universe).join(', ')
    return { error: `${universes.length} Art-Net universes detected (${list}) — "auto" only handles a single universe. Use "configure" to pick one manually.` }
  }
  if (devices.length > 1) {
    const list = devices.map((d) => d.path).join(', ')
    return { error: `${devices.length} USB devices detected (${list}) — "auto" only handles a single device. Use "configure" to pick one manually.` }
  }
  return { universe: universes[0].universe, deviceUid: devices[0].uid }
}

/**
 * "auto" only actually auto-detects universe+deviceUid.
 * If no CLI flag was explicitly given for protocol/hz/channelOffset (the opts
 * field is undefined), the previously saved "auto" route's value is preserved —
 * otherwise, on every restart (systemd Restart=always, boot, etc.) a manually
 * configured channelOffset/protocol would silently reset to the default.
 */
export function resolveAutoRouteFields(
  existing: RouteConfig | undefined,
  opts: { protocol?: OutputProtocol; hz?: number; channelOffset?: number }
): { protocol: OutputProtocol; hz: number; channelOffset: number } {
  return {
    protocol: opts.protocol ?? existing?.protocol ?? 'open-dmx',
    hz: opts.hz ?? existing?.hz ?? 40,
    channelOffset: opts.channelOffset ?? existing?.channelOffset ?? 0
  }
}
