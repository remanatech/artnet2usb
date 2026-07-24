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

/** Preview subscription: frames stream to the renderer for whichever universe it's watching (throttled). */
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
  // Devices remembered but not currently connected are also listed (with their names)
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
    // If active, restart it with the new settings
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
    if (!route) throw new Error('route_not_found')
    try {
      await engine.start(route)
      store.upsertRoute({ ...route, enabled: true })
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : String(err))
    }
    return buildState()
  })

  ipcMain.handle('routes:freeze', (_e, id: string) => {
    const route = store.routes.find((r) => r.id === id)
    if (!route) throw new Error('route_not_found')
    engine.toggleFreeze(route)
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
    // Send a frame immediately (if available) — don't make the user wait
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
    // Preview: stream frames of the watched universe to the renderer at ~20fps
    if (universe === previewUniverse && win && Date.now() - lastPreviewPush > 50) {
      lastPreviewPush = Date.now()
      win.webContents.send('preview:frame', universe, [...data])
    }
  })
  registerIpc()
  createWindow()
  // Automatically start saved routes that are enabled (if the device is connected)
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
