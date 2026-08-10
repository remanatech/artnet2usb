import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import { ArtNetListener } from './artnet'
import { DmxOutputEngine } from './dmxOutput'
import { Store } from './store'
import {
  checkSerialAccess,
  describeSerialProblem,
  planPermissionFix,
  FALLBACK_SERIAL_GROUP,
  RELOGIN_NOTICE
} from '../shared/serialPermissions'
import { spawn } from 'node:child_process'
import { userInfo } from 'node:os'
import type { AppState, RouteConfig, RouteStatus, UsbDevice } from '../shared/types'

/** os.userInfo() throws when the uid has no passwd entry (some containers). */
function currentUsername(): string {
  try {
    return userInfo().username
  } catch {
    return process.env.USER ?? process.env.LOGNAME ?? 'your-user'
  }
}

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

  /**
   * Serial permission flow. Uses the SAME shared/serialPermissions utility as
   * the CLI — there is deliberately no second implementation here.
   */
  ipcMain.handle('serial:diagnose', async () => {
    const devices = await engine.listDevices()
    const blocked = devices.find((d) => d.accessible === false)
    if (!blocked) return { needsFix: false as const }
    const access = checkSerialAccess(blocked.path)
    const described = describeSerialProblem(
      blocked.accessProblem ?? { kind: 'permission', path: blocked.path, group: access.group },
      { platform: process.platform, username: currentUsername() }
    )
    return {
      needsFix: true as const,
      path: blocked.path,
      group: access.group ?? FALLBACK_SERIAL_GROUP,
      // Only Linux group membership has an in-app fix; elsewhere we can only explain.
      canFix: process.platform === 'linux',
      title: described.title,
      lines: described.lines,
      fixCommand: described.fixCommand
    }
  })

  ipcMain.handle('serial:fixPermissions', async () => {
    const devices = await engine.listDevices()
    const blocked = devices.find((d) => d.accessible === false)
    const access = blocked ? checkSerialAccess(blocked.path) : null
    const plan = planPermissionFix({
      platform: process.platform,
      username: currentUsername(),
      group: access?.group,
      inGroup: access?.inGroup,
      // pkexec elevates ONLY usermod — the app itself keeps running unprivileged.
      elevator: 'pkexec'
    })
    if (!plan.needed) return { ok: true as const, changed: false, message: plan.reason }
    if (!plan.argv) return { ok: false as const, message: `Run this manually:\n${plan.display}` }

    const code = await new Promise<number>((resolve) => {
      const child = spawn(plan.argv![0]!, plan.argv!.slice(1), { stdio: 'ignore' })
      child.on('error', () => resolve(127))
      child.on('close', (c) => resolve(c ?? 1))
    })
    if (code === 0) return { ok: true as const, changed: true, message: RELOGIN_NOTICE }
    // 126/127 = polkit dialog dismissed or pkexec missing.
    return {
      ok: false as const,
      message:
        code === 126 || code === 127
          ? `Authorization was cancelled or pkexec is unavailable. Run this in a terminal:\n${plan.display}`
          : `Could not update permissions (exit ${code}). Run this in a terminal:\n${plan.display}`
    }
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
