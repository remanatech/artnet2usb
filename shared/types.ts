/** Ana süreç ↔ renderer ortak tipleri. */

/** Ağda görülen bir Art-Net DMX yayını (universe bazında). */
export interface SeenUniverse {
  /** Art-Net 15-bit port adresi: Net<<8 | SubUni */
  universe: number
  sourceIp: string
  /** Son ~2 sn'deki ölçülen kare hızı */
  fps: number
  lastAt: number
  channels: number
}

/** ArtPollReply ile bulunan node. */
export interface ArtNetNode {
  ip: string
  shortName: string
  longName: string
}

/** USB seri cihaz — uid kalıcı kimliktir (port yolu değişse de sabit kalır). */
export interface UsbDevice {
  /** vendorId:productId:serialNumber (serial yoksa port yolu) */
  uid: string
  path: string
  manufacturer?: string
  vendorId?: string
  productId?: string
  serialNumber?: string
  /** Kullanıcının verdiği ad (cihaz hafızasından) */
  name?: string
  connected: boolean
}

export type OutputProtocol = 'enttec-pro' | 'open-dmx'

/** Yönlendirme kuralı: kaynak universe → adlandırılmış cihaz + protokol + hız. */
export interface RouteConfig {
  id: string
  universe: number
  deviceUid: string
  protocol: OutputProtocol
  hz: number
  enabled: boolean
}

export interface RouteStatus extends RouteConfig {
  /** Cihaz şu an takılı ve port açık mı */
  active: boolean
  error: string | null
  framesSent: number
}

export interface AppSettings {
  /** Sinyal kesilince: son kareyi tut ya da karart */
  onSignalLoss: 'hold' | 'blackout'
  /** Kaç ms sinyal gelmezse kayıp sayılır */
  signalLossMs: number
}

export interface AppState {
  universes: SeenUniverse[]
  nodes: ArtNetNode[]
  devices: UsbDevice[]
  routes: RouteStatus[]
  settings: AppSettings
}
