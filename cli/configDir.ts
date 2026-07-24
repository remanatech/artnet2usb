import os from 'node:os'
import path from 'node:path'
import { isCompiledBinary, resolvePortableConfigDir } from '../shared/portableConfig'

/**
 * Recomputes, without Electron (in the CLI process), the OS-standard path that
 * Electron's app.getPath('userData') uses — productName is kept identical so
 * the SAME config.json is shared with the GUI ('main.ts' never calls
 * app.setName(), so it uses build.productName from the Electron package.json).
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
 * The directory the exe lives in, for a single-file compiled binary (pkg/bun) —
 * the candidate for portable config. Null when running under plain node/tsx
 * (execPath would be node itself, so writing config next to it would be wrong).
 */
export function portableExeDir(): string | null {
  if (!isCompiledBinary()) return null
  return path.dirname(process.execPath)
}

/**
 * The config directory the CLI will use: portable-first.
 * For a standalone binary, next to the exe (if writable, or if config.json
 * already exists there), otherwise the OS-standard directory (same as the GUI's userData).
 */
export function resolveConfigDir(): string {
  return resolvePortableConfigDir(portableExeDir(), defaultConfigDir())
}
