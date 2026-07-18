import fs from 'node:fs'
import path from 'node:path'

/**
 * Portable (standalone) config çözümü — GUI ve CLI'ın ortak kuralı:
 *  1. Exe'nin yanında config.json zaten VARSA her zaman o kazanır (USB bellek senaryosu).
 *  2. Yoksa exe'nin yanına yazmayı dene — yazılabiliyorsa config orada oluşur ve kalır.
 *  3. Yazılamıyorsa (örn. macOS app translocation, salt-okunur mount) OS-standart
 *     kullanıcı dizinine düşülür (eski davranış).
 * GUI ve CLI binary'si aynı klasöre konursa aynı config.json'u paylaşmaya devam eder.
 */

/** Dizin gerçekten yazılabilir mi — deneme yazması yapar (accessSync Windows'ta yanıltıcı). */
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
 * Süreç tek dosyalık derlenmiş bir binary olarak mı çalışıyor?
 * (pkg → process.pkg; bun build --compile → globalThis.Bun)
 * Düz `node`/`tsx` çalıştırmasında false döner — o durumda process.execPath
 * node'un kendisidir, yanına config yazmak anlamsız/yanlış olur.
 */
export function isCompiledBinary(): boolean {
  const proc = process as unknown as { pkg?: unknown }
  return Boolean(proc.pkg) || 'Bun' in globalThis
}
