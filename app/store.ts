import { app } from 'electron'
import path from 'node:path'
import { Store as BaseStore } from '../shared/store'
import { resolvePortableConfigDir } from '../shared/portableConfig'

/**
 * Electron main process sarmalayıcısı — kalıcılık mantığının tamamı
 * shared/store.ts'te (Electron'dan bağımsız, CLI ile paylaşılır). Burada
 * sadece config dizini seçilir: portable-öncelikli (exe'nin yanı), olmuyorsa
 * Electron userData (eski davranış). Kural shared/portableConfig.ts'te.
 */

/** Platforma göre "exe'nin yanı" — portable config adayı. Dev modda null. */
export function exeSideDir(): string | null {
  // electron-builder portable hedefi (Windows) gerçek exe'nin dizinini verir —
  // process.execPath burada temp'e açılmış kopyayı gösterir, env doğrusudur.
  if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR
  // AppImage (Linux): execPath geçici mount noktasındadır (salt-okunur),
  // APPIMAGE env'i kullanıcının indirdiği gerçek tek dosyayı gösterir.
  if (process.env.APPIMAGE) return path.dirname(process.env.APPIMAGE)
  if (!app.isPackaged) return null
  if (process.platform === 'darwin') {
    // .../Foo.app/Contents/MacOS/Foo → .app paketini içeren klasör.
    // Gatekeeper app translocation'da bu yol salt-okunurdur — yazma denemesi
    // başarısız olur ve resolvePortableConfigDir userData'ya düşer.
    return path.resolve(process.execPath, '..', '..', '..', '..')
  }
  return path.dirname(process.execPath)
}

export class Store extends BaseStore {
  constructor() {
    super(resolvePortableConfigDir(exeSideDir(), app.getPath('userData')))
  }
}

export type { PersistedState } from '../shared/store'
