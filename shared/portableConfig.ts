import fs from 'node:fs'
import path from 'node:path'

/**
 * Portable (standalone) config resolution — the shared rule for GUI and CLI:
 *  1. If a config.json already EXISTS next to the exe, it always wins (USB drive scenario).
 *  2. Otherwise try writing next to the exe — if writable, the config is created there and stays.
 *  3. If it can't be written (e.g. macOS app translocation, read-only mount), fall back
 *     to the OS-standard user directory (the old behavior).
 * If the GUI and CLI binaries are placed in the same folder, they keep sharing the same config.json.
 */

/** Is the directory actually writable — does a test write (accessSync is misleading on Windows). */
export function isWritableDir(dir: string): boolean {
  const probe = path.join(dir, `.artnet2usb-write-probe-${process.pid}`)
  try {
    fs.writeFileSync(probe, '')
    fs.unlinkSync(probe)
    return true
  } catch {
    return false
  }
}

export function resolvePortableConfigDir(exeSideDir: string | null, fallbackDir: string): string {
  if (!exeSideDir) return fallbackDir
  try {
    if (fs.existsSync(path.join(exeSideDir, 'config.json'))) return exeSideDir
  } catch {
    return fallbackDir
  }
  return isWritableDir(exeSideDir) ? exeSideDir : fallbackDir
}

/**
 * Is the process running as a single-file compiled binary?
 * (pkg → process.pkg; bun build --compile → globalThis.Bun)
 * Returns false under a plain `node`/`tsx` run — in that case process.execPath
 * is node itself, and writing a config next to it would be meaningless/wrong.
 */
export function isCompiledBinary(): boolean {
  const proc = process as unknown as { pkg?: unknown }
  return Boolean(proc.pkg) || 'Bun' in globalThis
}
