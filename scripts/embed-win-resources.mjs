#!/usr/bin/env node
/**
 * pkg ile üretilmiş Windows .exe'sine ikon + sürüm metadatası gömer (PE resource section).
 * `resedit` kütüphanesini doğrudan kullanır — böylece .cmd/npx shim'lerine ve shell
 * tırnaklama sorunlarına takılmadan, gerçek `node` süreci içinde çalışır.
 *
 * pkg payload'ı PE'nin sonuna eklenen "extra data" (overlay) olarak durur; pe-library
 * bunu getExtraData/setExtraData ile koruduğundan generate() sonrası binary çalışır kalır.
 *
 * Kullanım: node scripts/embed-win-resources.mjs <exe-yolu> <icon.ico-yolu>
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as ResEdit from 'resedit'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkgJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

const exePath = process.argv[2]
const iconPath = process.argv[3]
if (!exePath || !iconPath) {
  console.error('Kullanım: node scripts/embed-win-resources.mjs <exe> <icon.ico>')
  process.exit(1)
}

const LANG = 1033 // en-US
const CODEPAGE = 1200 // Unicode

/** "0.2.0" → [0, 2, 0, 0] */
function versionParts(v) {
  const p = String(v).split('.').map((n) => parseInt(n, 10) || 0)
  while (p.length < 4) p.push(0)
  return p.slice(0, 4)
}

const [major, minor, micro, rev] = versionParts(pkgJson.version)
const productName = pkgJson.build?.productName || pkgJson.name
const description = pkgJson.description || pkgJson.name
const company = pkgJson.author || ''
const versionStr = `${major}.${minor}.${micro}.${rev}`

const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath))
const res = ResEdit.NtExecutableResource.from(exe)

// --- İkon (grup ID 1) ---
const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(iconPath))
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
  res.entries,
  1,
  LANG,
  iconFile.icons.map((item) => item.data)
)

// --- Sürüm bilgisi ---
const vi = ResEdit.Resource.VersionInfo.createEmpty()
vi.setFileVersion(major, minor, micro, rev, LANG)
vi.setProductVersion(major, minor, micro, rev, LANG)
vi.setStringValues(
  { lang: LANG, codepage: CODEPAGE },
  {
    ProductName: productName,
    FileDescription: description,
    CompanyName: company,
    OriginalFilename: path.basename(exePath),
    InternalName: pkgJson.name,
    ProductVersion: versionStr,
    FileVersion: versionStr
  }
)
vi.outputToResourceEntries(res.entries)

res.outputResource(exe)
fs.writeFileSync(exePath, Buffer.from(exe.generate()))
console.log(`✓ ikon + sürüm gömüldü: ${path.relative(root, exePath)}`)
