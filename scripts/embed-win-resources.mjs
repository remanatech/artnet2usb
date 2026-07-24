#!/usr/bin/env node
/**
 * Embeds an icon + version metadata into a pkg-produced Windows .exe (PE resource section).
 * Uses the `resedit` library directly — so it runs inside a real `node` process, with no
 * .cmd/npx shim or shell-quoting issues to trip over.
 *
 * pkg's payload sits at the end of the PE as "extra data" (an overlay); pe-library
 * preserves it via getExtraData/setExtraData, so the binary still runs after generate().
 *
 * Usage: node scripts/embed-win-resources.mjs <exe-path> <icon.ico-path>
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
  console.error('Usage: node scripts/embed-win-resources.mjs <exe> <icon.ico>')
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

// --- Icon (group ID 1) ---
const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(iconPath))
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
  res.entries,
  1,
  LANG,
  iconFile.icons.map((item) => item.data)
)

// --- Version info ---
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
console.log(`✓ icon + version embedded: ${path.relative(root, exePath)}`)
