import os from 'node:os'
import path from 'node:path'
import { isCompiledBinary, resolvePortableConfigDir } from '../shared/portableConfig'

/**
 * Electron'un app.getPath('userData') için kullandığı OS-standart yolu,
 * Electron'suz (CLI sürecinde) yeniden hesaplar — GUI ile AYNI config.json
 * paylaşılsın diye productName birebir aynı ('main.ts'te app.setName() hiç
 * çağrılmıyor, yani Electron package.json'daki build.productName'i kullanır).
 *  - macOS:   ~/Library/Application Support/<productName>
 *  - Windows: %APPDATA%/<productName>
 *  - Linux:   ${XDG_CONFIG_HOME:-~/.config}/<productName>
 */
const PRODUCT_NAME = 'Relackout ArtNet 2 USB'

export function defaultConfigDir(): string {
  const home = os.homedir()
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', PRODUCT_NAME)
  }
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming'), PRODUCT_NAME)
  }
  return path.join(process.env.XDG_CONFIG_HOME ?? path.join(home, '.config'), PRODUCT_NAME)
}

/**
 * Tek dosyalık derlenmiş binary'de (pkg/bun) exe'nin bulunduğu dizin —
 * portable config adayı. Düz node/tsx çalıştırmasında null (execPath node'un
 * kendisi olurdu, yanına config yazmak yanlış).
 */
export function portableExeDir(): string | null {
  if (!isCompiledBinary()) return null
  return path.dirname(process.execPath)
}

/**
 * CLI'ın kullanacağı config dizini: portable-öncelikli.
 * Standalone binary'de exe'nin yanı (yazılabilirse ya da orada config.json
 * zaten varsa), aksi halde OS-standart dizin (GUI userData ile aynı).
 */
export function resolveConfigDir(): string {
  return resolvePortableConfigDir(portableExeDir(), defaultConfigDir())
}
