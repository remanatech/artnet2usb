import { app } from 'electron'
import { Store as BaseStore } from '../shared/store'

/**
 * Electron main process sarmalayıcısı — kalıcılık mantığının tamamı
 * shared/store.ts'te (Electron'dan bağımsız, CLI ile paylaşılır). Burada
 * sadece config dizini Electron'un kendi userData yolundan sağlanır.
 */
export class Store extends BaseStore {
  constructor() {
    super(app.getPath('userData'))
  }
}

export type { PersistedState } from '../shared/store'
