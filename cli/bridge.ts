import { ArtNetListener } from '../app/artnet'
import { DmxOutputEngine } from '../app/dmxOutput'
import type { Store } from '../shared/store'

export interface Bridge {
  listener: ArtNetListener
  engine: DmxOutputEngine
  shutdown: () => Promise<void>
}

const RECONNECT_INTERVAL_MS = 5000

/**
 * Electron'suz köprüleme — app/main.ts'teki app.whenReady() bloğunun
 * (BrowserWindow/registerIpc/preview HARİÇ) aynısı: dinleyiciyi başlat,
 * kayıtlı+enabled rotaları otomatik başlat. Hem `run` hem `configure`
 * alt-komutu bunu kullanır.
 *
 * Ayrıca USB cihazı kopup yeniden takıldığında (ör. sahne arkasında kablo
 * oynaması) insan müdahalesi olmadan toparlanabilsin diye periyodik bir
 * gözetim döngüsü çalıştırır: etkin ama `active:false` durumundaki rotaları
 * sessizce yeniden başlatmayı dener (hata yutulur, bir sonraki turda tekrar
 * denenir). app/dmxOutput.ts'in kendisi değiştirilmez.
 */
export async function startBridge(
  store: Store,
  onFrame?: (universe: number, data: Buffer) => void
): Promise<Bridge> {
  const listener = new ArtNetListener()
  const engine = new DmxOutputEngine(
    (u) => listener.frameOf(u),
    () => store.settings
  )
  listener.start(onFrame)
  for (const r of store.routes) {
    if (r.enabled) await engine.start(r).catch(() => {})
  }

  const reconnectTimer = setInterval(() => {
    void (async () => {
      for (const r of store.routes) {
        if (!r.enabled) continue
        if (!engine.statusOf(r).active) await engine.start(r).catch(() => {})
      }
    })()
  }, RECONNECT_INTERVAL_MS)

  return {
    listener,
    engine,
    shutdown: async () => {
      clearInterval(reconnectTimer)
      await engine.stopAll()
      listener.stop()
    }
  }
}
