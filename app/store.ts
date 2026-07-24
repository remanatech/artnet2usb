import { app } from 'electron'
import path from 'node:path'
import { Store as BaseStore } from '../shared/store'
import { resolvePortableConfigDir } from '../shared/portableConfig'

/**
 * Electron main process wrapper — all persistence logic lives in
 * shared/store.ts (independent of Electron, shared with the CLI). Here we
 * only pick the config directory: portable-first (next to the exe), falling
 * back to Electron userData (legacy behavior). The rule lives in
 * shared/portableConfig.ts.
 */

/** Platform-specific "next to the exe" — the portable config candidate. null in dev mode. */
export function exeSideDir(): string | null {
  // electron-builder's portable target (Windows) gives the real exe's directory —
  // process.execPath here points to the copy unpacked into temp, the env var is authoritative.
  if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR
  // AppImage (Linux): execPath is inside the temporary mount point (read-only),
  // the APPIMAGE env var points to the actual single file the user downloaded.
  if (process.env.APPIMAGE) return path.dirname(process.env.APPIMAGE)
  if (!app.isPackaged) return null
  if (process.platform === 'darwin') {
    // .../Foo.app/Contents/MacOS/Foo → the folder containing the .app bundle.
    // Under Gatekeeper app translocation this path is read-only — the write
    // attempt fails and resolvePortableConfigDir falls back to userData.
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
