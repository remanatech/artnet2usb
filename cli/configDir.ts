import os from 'node:os'
import path from 'node:path'

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
