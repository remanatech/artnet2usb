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
 * Bridging without Electron — the same thing as the app.whenReady() block in
 * app/main.ts (EXCLUDING BrowserWindow/registerIpc/preview): start the
 * listener, auto-start the saved+enabled routes. Both the `run` and
 * `configure` sub-commands use this.
 *
 * It also runs a periodic watchdog loop so that when a USB device disconnects
 * and reconnects (e.g. a cable getting jostled backstage), it can recover
 * without human intervention: it silently retries starting any enabled route
 * that is currently `active:false` (errors are swallowed and retried on the
 * next tick). app/dmxOutput.ts itself is never modified.
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
