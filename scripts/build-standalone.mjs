#!/usr/bin/env node
/**
 * Standalone (tek dosya) dağıtım pipeline'ı — çıktıların TAMAMI dist-standalone/ altında,
 * her biri kurulum gerektirmeyen tek dosyadır:
 *   GUI : Relackout-ArtNet2USB-<ver>-portable.exe / -<arch>.dmg / -<arch>.AppImage
 *   CLI : artnet2usb-cli-<ver>-<platform> (pkg ile derlenmiş gerçek binary, node gerekmez)
 *
 * Kullanım:
 *   node scripts/build-standalone.mjs                 # host platform: GUI + CLI
 *   node scripts/build-standalone.mjs --cli           # sadece CLI (host hedefi)
 *   node scripts/build-standalone.mjs --cli --all-targets   # CLI: tüm platform matrisi
 *   node scripts/build-standalone.mjs --gui --mac --win --linux  # GUI: seçili platformlar
 *   node scripts/build-standalone.mjs --cli --targets node22-linux-x64,node22-win-x64
 *
 * CLI paketleme akışı: tsc (dist-cli) → esbuild ile tek CJS bundle (ESM commander/@clack
 * dahil) → @yao-pkg/pkg ile binary. serialport'un native .node dosyaları (prebuilds)
 * pkg asset'i olarak gömülür; @serialport/bindings-cpp bundle DIŞINDA bırakılır ki
 * node-gyp-build çalışma anında platforma uygun prebuild'i seçebilsin.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkgJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const version = pkgJson.version

const args = process.argv.slice(2)
const has = (f) => args.includes(f)
const buildCli = has('--cli') || !has('--gui')
const buildGui = has('--gui') || !has('--cli')

const OUT_DIR = path.join(root, 'dist-standalone')
const TMP_DIR = path.join(root, '.standalone-tmp')
const PKG_CONFIG = path.join(root, '.standalone-pkg.config.json')

/** pkg hedefi → çıktı dosya adı eki. armv7l = Raspberry Pi (32-bit OS). */
const CLI_TARGETS = {
  'node22-macos-arm64': 'macos-arm64',
  'node22-macos-x64': 'macos-x64',
  'node22-linux-x64': 'linux-x64',
  'node22-linux-arm64': 'linux-arm64',
  'node20-linuxstatic-armv7': 'linux-armv7l',
  'node22-win-x64': 'win-x64.exe'
}

function hostCliTarget() {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  if (process.platform === 'darwin') return `node22-macos-${arch}`
  if (process.platform === 'win32') return 'node22-win-x64'
  return `node22-linux-${arch}`
}

function run(cmd, cmdArgs, opts = {}) {
  console.log(`\n$ ${cmd} ${cmdArgs.join(' ')}`)
  execFileSync(cmd, cmdArgs, { cwd: root, stdio: 'inherit', ...opts })
}

function npx(bin, binArgs) {
  run(process.platform === 'win32' ? 'npx.cmd' : 'npx', [bin, ...binArgs])
}

function cliTargetList() {
  const explicit = args.find((a) => a.startsWith('--targets'))
  if (explicit) {
    const v = explicit.includes('=') ? explicit.split('=')[1] : args[args.indexOf(explicit) + 1]
    return v.split(',').map((s) => s.trim()).filter(Boolean)
  }
  if (has('--all-targets')) return Object.keys(CLI_TARGETS)
  return [hostCliTarget()]
}

function targetSuffix(target) {
  if (CLI_TARGETS[target]) return CLI_TARGETS[target]
  // Bilinmeyen/özel hedef: "node22-linux-x64" → "linux-x64" (+ win ise .exe)
  const suffix = target.replace(/^node\d+-/, '').replace(/^linuxstatic-/, 'linux-')
  return suffix.startsWith('win') ? `${suffix}.exe` : suffix
}

async function buildCliBinaries() {
  console.log('\n=== CLI: tsc derleme ===')
  run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build:cli'])

  console.log('\n=== CLI: esbuild bundle ===')
  fs.rmSync(TMP_DIR, { recursive: true, force: true })
  fs.mkdirSync(TMP_DIR, { recursive: true })
  npx('esbuild', [
    'dist-cli/cli/index.js',
    '--bundle',
    '--platform=node',
    '--target=node20',
    '--format=cjs',
    '--external:@serialport/bindings-cpp',
    `--outfile=${path.join(TMP_DIR, 'cli-bundle.cjs')}`
  ])

  console.log('\n=== CLI: pkg ile binary üretimi ===')
  fs.writeFileSync(
    PKG_CONFIG,
    JSON.stringify(
      {
        name: 'artnet2usb-cli',
        version,
        bin: '.standalone-tmp/cli-bundle.cjs',
        pkg: {
          assets: ['node_modules/@serialport/bindings-cpp/prebuilds/**']
        }
      },
      null,
      2
    )
  )
  try {
    for (const target of cliTargetList()) {
      const out = path.join(OUT_DIR, `artnet2usb-cli-${version}-${targetSuffix(target)}`)
      npx('pkg', [PKG_CONFIG, '--target', target, '--output', out])
      console.log(`✓ ${path.relative(root, out)}`)
    }
  } finally {
    fs.rmSync(PKG_CONFIG, { force: true })
    fs.rmSync(TMP_DIR, { recursive: true, force: true })
  }
}

function guiPlatformFlags() {
  const flags = ['--mac', '--win', '--linux'].filter((f) => has(f))
  if (flags.length > 0) return flags
  if (process.platform === 'darwin') return ['--mac']
  if (process.platform === 'win32') return ['--win']
  return ['--linux']
}

async function buildGuiArtifacts() {
  console.log('\n=== GUI: electron-vite build ===')
  npx('electron-vite', ['build'])
  console.log('\n=== GUI: electron-builder (tek dosya hedefler) ===')
  npx('electron-builder', guiPlatformFlags())

  // Tek dosyalık son ürünleri release/ içinden dist-standalone/'a topla
  const singleFile = /(-portable\.exe|\.dmg|\.AppImage)$/
  const releaseDir = path.join(root, 'release')
  for (const f of fs.readdirSync(releaseDir)) {
    if (!singleFile.test(f)) continue
    fs.copyFileSync(path.join(releaseDir, f), path.join(OUT_DIR, f))
    console.log(`✓ dist-standalone/${f}`)
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true })
if (buildCli) await buildCliBinaries()
if (buildGui) await buildGuiArtifacts()
console.log('\nTamamlandı — dist-standalone/ içindeki her dosya kurulumsuz, tek başına çalışır.')
