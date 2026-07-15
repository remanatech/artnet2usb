import { SerialPort } from 'serialport'
import type { AppSettings, OutputProtocol, RouteConfig, RouteStatus, UsbDevice } from '../shared/types'

/**
 * USB DMX çıkış motoru. Her aktif rota kendi zamanlayıcısında (hz) döner:
 * kaynak universe'ün son karesini alır ve seçili protokolle porta yazar.
 *  - enttec-pro: Enttec DMX USB Pro çerçevesi (0x7E, label 6, len LE, veri, 0xE7)
 *  - open-dmx:   FTDI ham DMX — 250000 baud 8N2, break + MAB + startcode + 512
 * Cihaz kimliği (uid) port yolundan bağımsızdır: rota, cihaz yeniden
 * takıldığında yeni yolunu kendisi bulur.
 */

/** Enttec Pro "Output Only Send DMX" paketi. (Saf — test edilir.) */
export function buildEnttecFrame(dmx: Buffer): Buffer {
  const payload = Buffer.alloc(513)
  payload[0] = 0 // start code
  dmx.copy(payload, 1, 0, Math.min(dmx.length, 512))
  const frame = Buffer.alloc(payload.length + 5)
  frame[0] = 0x7e
  frame[1] = 6 // label: Output Only Send DMX
  frame.writeUInt16LE(payload.length, 2)
  payload.copy(frame, 4)
  frame[frame.length - 1] = 0xe7
  return frame
}

/** serialport list kaydından kalıcı cihaz kimliği. (Saf — test edilir.) */
export function deviceUid(p: { vendorId?: string; productId?: string; serialNumber?: string; path: string }): string {
  const vid = (p.vendorId ?? '?').toLowerCase()
  const pid = (p.productId ?? '?').toLowerCase()
  return p.serialNumber ? `${vid}:${pid}:${p.serialNumber}` : `${vid}:${pid}:${p.path}`
}

interface ActiveOutput {
  port: SerialPort
  timer: NodeJS.Timeout
  framesSent: number
  error: string | null
  writing: boolean
  /** Dondurulmuş kare — doluysa canlı veri yerine bu basılır */
  frozenFrame: Buffer | null
}

export class DmxOutputEngine {
  private active = new Map<string, ActiveOutput>() // routeId -> output
  private lastFrames = new Map<string, Buffer>() // routeId -> son gönderilen kare

  constructor(
    private getFrame: (universe: number) => { data: Buffer; lastAt: number } | null,
    private getSettings: () => AppSettings
  ) {}

  async listDevices(): Promise<Omit<UsbDevice, 'name'>[]> {
    const ports = await SerialPort.list()
    return ports.map((p) => ({
      uid: deviceUid(p),
      path: p.path,
      manufacturer: p.manufacturer,
      vendorId: p.vendorId,
      productId: p.productId,
      serialNumber: p.serialNumber,
      connected: true
    }))
  }

  isActive(routeId: string): boolean {
    return this.active.has(routeId)
  }

  statusOf(route: RouteConfig): Pick<RouteStatus, 'active' | 'error' | 'framesSent' | 'frozen'> {
    const a = this.active.get(route.id)
    return {
      active: !!a && !a.error,
      error: a?.error ?? null,
      framesSent: a?.framesSent ?? 0,
      frozen: !!a?.frozenFrame
    }
  }

  /** Freeze: o anki kareyi sabitle; ikinci çağrı canlıya döndürür. Döner: yeni frozen durumu. */
  toggleFreeze(route: RouteConfig): boolean {
    const out = this.active.get(route.id)
    if (!out) return false
    if (out.frozenFrame) {
      out.frozenFrame = null
      return false
    }
    // O anki çıkış karesi: canlı veri, yoksa son basılan kare, yoksa karanlık
    const fr = this.getFrame(route.universe)
    out.frozenFrame = Buffer.from(fr?.data ?? this.lastFrames.get(route.id) ?? Buffer.alloc(512))
    return true
  }

  /** Rotayı başlat: cihazın güncel port yolunu uid ile bul, portu aç, döngüyü kur. */
  async start(route: RouteConfig): Promise<void> {
    await this.stop(route.id)
    const devices = await this.listDevices()
    const dev = devices.find((d) => d.uid === route.deviceUid)
    if (!dev) throw new Error('Cihaz takılı değil')
    const baud = route.protocol === 'open-dmx' ? 250000 : 57600
    const port = new SerialPort({
      path: dev.path,
      baudRate: baud,
      dataBits: 8,
      stopBits: 2,
      parity: 'none',
      autoOpen: false
    })
    await new Promise<void>((resolve, reject) => {
      port.open((err) => (err ? reject(err) : resolve()))
    })
    const hz = Math.max(1, Math.min(44, route.hz))
    const out: ActiveOutput = { port, timer: null as unknown as NodeJS.Timeout, framesSent: 0, error: null, writing: false, frozenFrame: null }
    out.timer = setInterval(() => void this.tick(route, out), Math.round(1000 / hz))
    port.on('error', (err) => {
      out.error = err.message
    })
    port.on('close', () => {
      out.error = out.error ?? 'Port kapandı'
    })
    this.active.set(route.id, out)
  }

  private currentFrame(route: RouteConfig): Buffer | null {
    const settings = this.getSettings()
    const fr = this.getFrame(route.universe)
    const fresh = fr && Date.now() - fr.lastAt <= settings.signalLossMs
    if (fresh) {
      this.lastFrames.set(route.id, fr.data)
      return fr.data
    }
    // Sinyal yok: ayara göre son kareyi tut ya da karart
    if (settings.onSignalLoss === 'blackout') return Buffer.alloc(512)
    return this.lastFrames.get(route.id) ?? null
  }

  private async tick(route: RouteConfig, out: ActiveOutput): Promise<void> {
    if (out.writing || !out.port.isOpen) return
    const dmx = out.frozenFrame ?? this.currentFrame(route)
    if (!dmx) return
    out.writing = true
    try {
      if (route.protocol === 'enttec-pro') {
        await new Promise<void>((resolve, reject) =>
          out.port.write(buildEnttecFrame(dmx), (err) => (err ? reject(err) : resolve()))
        )
      } else {
        // Open DMX: break (~1ms) + MAB + kare. serialport set({brk}) ile.
        await new Promise<void>((resolve, reject) => out.port.set({ brk: true }, (e) => (e ? reject(e) : resolve())))
        await new Promise((r) => setTimeout(r, 1))
        await new Promise<void>((resolve, reject) => out.port.set({ brk: false }, (e) => (e ? reject(e) : resolve())))
        const frame = Buffer.alloc(513)
        frame[0] = 0
        dmx.copy(frame, 1, 0, Math.min(dmx.length, 512))
        await new Promise<void>((resolve, reject) => out.port.write(frame, (err) => (err ? reject(err) : resolve())))
        await new Promise<void>((resolve, reject) => out.port.drain((err) => (err ? reject(err) : resolve())))
      }
      out.framesSent++
      out.error = null
    } catch (err) {
      out.error = err instanceof Error ? err.message : String(err)
    } finally {
      out.writing = false
    }
  }

  async stop(routeId: string): Promise<void> {
    const out = this.active.get(routeId)
    if (!out) return
    clearInterval(out.timer)
    this.active.delete(routeId)
    this.lastFrames.delete(routeId)
    if (out.port.isOpen) {
      await new Promise<void>((resolve) => out.port.close(() => resolve()))
    }
  }

  async stopAll(): Promise<void> {
    for (const id of [...this.active.keys()]) await this.stop(id)
  }
}

export type { OutputProtocol }
