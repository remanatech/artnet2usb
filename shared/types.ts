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
  /**
   * Kanal başlangıç (patch) offset'i, -511..511. Varsayılan 0 (kayma yok).
   * Universe'i 512 kanal içinde DAİRESEL kaydırır — veri kaybı olmaz, bir
   * uçtan taşan kanallar diğer uca sarar (ör. offset=-1: kaynak kanal 1
   * atılmaz, cihazın kanal 512'sine sarar; kaynak kanal 2 → cihaz kanal 1).
   * Dış donanımın (fikstür patch adresi, konsol kanal etiketleme farkı vb.)
   * kendi kaymasını yazılımdan telafi etmek için — sahada hem pozitif hem
   * negatif yönün gerekebildiği, veri kaybının kabul edilemez olduğu
   * doğrulandı (dotka@192.168.1.242 canlı testleri).
   */
  channelOffset?: number
}

export interface RouteStatus extends RouteConfig {
  /** Cihaz şu an takılı ve port açık mı */
  active: boolean
  error: string | null
  framesSent: number
  /** Çıkış donduruldu mu — o anki kare sabit basılır, canlı veri yok sayılır */
  frozen: boolean
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
