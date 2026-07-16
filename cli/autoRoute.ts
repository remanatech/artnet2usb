import type { SeenUniverse, UsbDevice } from '../shared/types'

export interface AutoRouteMatch {
  universe: number
  deviceUid: string
}

export interface AutoRouteError {
  error: string
}

/**
 * "auto" komutunun karar mantığı: tam olarak 1 universe + 1 USB cihaz
 * görülmüşse eşleştirir, aksi halde hangi tarafın belirsiz olduğunu
 * açıklayan bir hata döner — çağıran taraf bu durumda `configure`'a yönlendirir.
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
