import fs from 'node:fs'
import path from 'node:path'
import type { AppSettings, RouteConfig } from './types'

/**
 * Basit JSON kalıcılık — Electron'dan bağımsız temel sınıf. Electron GUI
 * (app/store.ts) ve CLI (cli/index.ts) AYNI config.json'ı okur/yazar; tek
 * fark config dizininin nereden geldiği (Electron: app.getPath('userData'),
 * CLI: cli/configDir.ts — ikisi de aynı OS-standart yolu hesaplar).
 *  - deviceNames: cihaz hafızası — uid → kullanıcı adı (port değişse de kalıcı)
 *  - routes: yönlendirme tablosu
 *  - settings: sinyal kaybı davranışı
 */

export interface PersistedState {
  deviceNames: Record<string, string>
  routes: RouteConfig[]
  settings: AppSettings
}

const DEFAULTS: PersistedState = {
  deviceNames: {},
  routes: [],
  settings: { onSignalLoss: 'hold', signalLossMs: 3000 }
}

export class Store {
  private file: string
  private state: PersistedState

  constructor(configDir: string) {
    this.file = path.join(configDir, 'config.json')
    this.state = this.load()
  }

  private load(): PersistedState {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8')) as Partial<PersistedState>
      return {
        deviceNames: raw.deviceNames ?? {},
        routes: Array.isArray(raw.routes) ? raw.routes : [],
        settings: { ...DEFAULTS.settings, ...(raw.settings ?? {}) }
      }
    } catch {
      return structuredClone(DEFAULTS)
    }
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      fs.writeFileSync(this.file, JSON.stringify(this.state, null, 2))
    } catch (err) {
      console.error('[store] kaydedilemedi', err)
    }
  }

  get deviceNames(): Record<string, string> {
    return this.state.deviceNames
  }

  setDeviceName(uid: string, name: string): void {
    if (name.trim()) this.state.deviceNames[uid] = name.trim().slice(0, 60)
    else delete this.state.deviceNames[uid]
    this.save()
  }

  get routes(): RouteConfig[] {
    return this.state.routes
  }

  upsertRoute(route: RouteConfig): void {
    const i = this.state.routes.findIndex((r) => r.id === route.id)
    if (i >= 0) this.state.routes[i] = route
    else this.state.routes.push(route)
    this.save()
  }

  removeRoute(id: string): void {
    this.state.routes = this.state.routes.filter((r) => r.id !== id)
    this.save()
  }

  get settings(): AppSettings {
    return this.state.settings
  }

  setSettings(s: AppSettings): void {
    this.state.settings = s
    this.save()
  }
}
