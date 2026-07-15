import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import { ArtNetListener } from './artnet'
import { DmxOutputEngine } from './dmxOutput'
import { Store } from './store'
import type { AppState, RouteConfig, RouteStatus, UsbDevice } from '../shared/types'

let win: BrowserWindow | null = null
const listener = new ArtNetListener()
let store: Store
let engine: DmxOutputEngine

/** Önizleme aboneliği: renderer hangi universe'ü izliyorsa kareler ona akar (throttle'lı). */
let previewUniverse: number | null = null
let lastPreviewPush = 0

function createWindow(): void {
  win = new BrowserWindow({
    width: 980,
    height: 680,
    minWidth: 760,
    minHeight: 520,
    backgroundColor: '#101d22',
    title: 'Relackout ArtNet 2 USB',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.setMenuBarVisibility(false)
  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
}

async function buildState(): Promise<AppState> {
  const names = store.deviceNames
  const connected = await engine.listDevices()
  const devices: UsbDevice[] = connected.map((d) => ({ ...d, name: names[d.uid] }))
  // Hafızadaki ama şu an takılı olmayan cihazlar da listelenir (adlarıyla)
  for (const [uid, name] of Object.entries(names)) {
    if (!devices.some((d) => d.uid === uid)) {
      devices.push({ uid, path: '—', name, connected: false })
    }
  }
  const routes: RouteStatus[] = store.routes.map((r) => ({ ...r, ...engine.statusOf(r) }))
  return {
    universes: listener.list(),
    nodes: listener.listNodes(),
    devices,
    routes,
    settings: store.settings
  }
}

function registerIpc(): void {
  ipcMain.handle('state:get', () => buildState())

  ipcMain.handle('devices:rename', (_e, uid: string, name: string) => {
    store.setDeviceName(uid, name)
    return buildState()
  })

  ipcMain.handle('routes:upsert', async (_e, route: RouteConfig) => {
    store.upsertRoute(route)
    // Aktifse yeni ayarlarla yeniden başlat
    if (engine.isActive(route.id)) {
      await engine.stop(route.id)
      if (route.enabled) await engine.start(route).catch(() => {})
    }
    return buildState()
  })

  ipcMain.handle('routes:remove', async (_e, id: string) => {
    await engine.stop(id)
    store.removeRoute(id)
    return buildState()
  })

  ipcMain.handle('routes:start', async (_e, id: string) => {
    const route = store.routes.find((r) => r.id === id)
    if (!route) throw new Error('Rota bulunamadı')
    try {
      await engine.start(route)
      store.upsertRoute({ ...route, enabled: true })
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : String(err))
    }
    return buildState()
  })

  ipcMain.handle('routes:stop', async (_e, id: string) => {
    await engine.stop(id)
    const route = store.routes.find((r) => r.id === id)
    if (route) store.upsertRoute({ ...route, enabled: false })
    return buildState()
  })

  ipcMain.handle('settings:set', (_e, s: AppState['settings']) => {
    store.setSettings(s)
    return buildState()
  })

  ipcMain.handle('preview:set', (_e, universe: number | null) => {
    previewUniverse = universe
    // Anında bir kare gönder (varsa) — kullanıcı beklemesin
    if (universe != null) {
      const fr = listener.frameOf(universe)
      if (fr) win?.webContents.send('preview:frame', universe, [...fr.data])
    }
    return true
  })

  ipcMain.handle('app:openExternal', (_e, url: string) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
  })
}

void app.whenReady().then(async () => {
  store = new Store()
  engine = new DmxOutputEngine(
    (u) => listener.frameOf(u),
    () => store.settings
  )
  listener.start((universe, data) => {
    // Önizleme: izlenen universe'ün karelerini ~20fps ile renderer'a akıt
    if (universe === previewUniverse && win && Date.now() - lastPreviewPush > 50) {
      lastPreviewPush = Date.now()
      win.webContents.send('preview:frame', universe, [...data])
    }
  })
  registerIpc()
  createWindow()
  // Kayıtlı ve enabled rotaları otomatik başlat (cihaz takılıysa)
  for (const r of store.routes) {
    if (r.enabled) await engine.start(r).catch(() => {})
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  void engine?.stopAll()
  listener.stop()
  app.quit()
})
