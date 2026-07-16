import { ArtNetListener } from '../app/artnet'
import { DmxOutputEngine } from '../app/dmxOutput'
import type { Store } from '../shared/store'

export interface Bridge {
  listener: ArtNetListener
  engine: DmxOutputEngine
  shutdown: () => Promise<void>
}

/**
 * Electron'suz köprüleme — app/main.ts'teki app.whenReady() bloğunun
 * (BrowserWindow/registerIpc/preview HARİÇ) aynısı: dinleyiciyi başlat,
 * kayıtlı+enabled rotaları otomatik başlat. Hem `run` hem `configure`
 * alt-komutu bunu kullanır.
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
  return {
    listener,
    engine,
    shutdown: async () => {
      await engine.stopAll()
      listener.stop()
    }
  }
}
