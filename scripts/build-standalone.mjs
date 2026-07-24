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
const ICON_ICO = path.join(root, 'build', 'icon.ico')

/** pkg hedefi → çıktı dosya adı eki. armv7l = Raspberry Pi (32-bit OS). */
const CLI_TARGETS = {
  'node22-macos-arm64': 'macos-arm64',
  'node22-macos-x64': 'macos-x64',
  'node22-linux-x64': 'linux-x64',
  'node22-linux-arm64': 'linux-arm64',
  'node22-linuxstatic-armv7': 'linux-armv7l',
  'node22-win-x64': 'win-x64.exe'
}

function hostCliTarget() {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  if (process.platform === 'darwin') return `node22-macos-${arch}`
  if (process.platform === 'win32') return 'node22-win-x64'
  return `node22-linux-${arch}`
}

// Node 20+ execFileSync, Windows'ta .cmd/.bat dosyalarını shell olmadan çalıştırmayı
// reddeder (EINVAL). Bu yüzden win32'de shell:true kullanıp boşluk içeren argümanları
// kendimiz tırnaklıyoruz (root yolunda boşluk olan kurulumlar için).
const IS_WIN = process.platform === 'win32'

function run(cmd, cmdArgs, opts = {}) {
  console.log(`\n$ ${cmd} ${cmdArgs.join(' ')}`)
  const finalArgs = IS_WIN ? cmdArgs.map((a) => (/[\s"]/.test(a) ? `"${a}"` : a)) : cmdArgs
  execFileSync(cmd, finalArgs, { cwd: root, stdio: 'inherit', shell: IS_WIN, ...opts })
}

function npm(npmArgs) {
  run(IS_WIN ? 'npm.cmd' : 'npm', npmArgs)
}

function npx(bin, binArgs) {
  run(IS_WIN ? 'npx.cmd' : 'npx', [bin, ...binArgs])
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

/**
 * Windows .exe'ye ikon + sürüm metadatası gömer (PE resource section).
 * Sadece PE ikon gömmeyi destekleyen platformda anlamlı — macOS Mach-O / Linux ELF
 * binary'leri gömülü ikon taşımadığı için onlarda atlanır. resedit saf JS olduğundan
 * cross-build'de (mac/linux host'ta win hedefi) de çalışır. pkg payload'ı PE overlay'i
 * olarak sonda durur; resedit overlay'i koruyarak sadece resource section'ı günceller.
 */
function embedWinResources(exePath) {
  if (!fs.existsSync(ICON_ICO)) {
    console.log('… ikon atlandı (build/icon.ico bulunamadı)')
    return
  }
  console.log('\n=== CLI: Windows ikon + sürüm metadatası gömülüyor ===')
  // Gerçek `node` süreci (.cmd/npx shim'i değil) — resedit kütüphanesini kullanır.
  run('node', [path.join('scripts', 'embed-win-resources.mjs'), exePath, ICON_ICO])
}

async function buildCliBinaries() {
  console.log('\n=== CLI: tsc derleme ===')
  npm(['run', 'build:cli'])

  console.log('\n=== CLI: esbuild bundle ===')
  fs.rmSync(TMP_DIR, { recursive: true, force: true })
  fs.mkdirSync(TMP_DIR, { recursive: true })
  npx('esbuild', [
    'dist-cli/cli/index.js',
    '--bundle',
    '--platform=node',
    '--target=node18',
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
      // armv7 (32-bit Raspberry Pi): bytecode üretimi host platformda aynı mimaride
      // bir "fabricator" node'u ister; macos/win için armv7 binary'si yayınlanmadığından
      // cross-build ancak bytecode'suz mümkün (kod snapshot'ta düz JS olarak taşınır).
      const extra = target.includes('armv7') ? ['--no-bytecode', '--public'] : []
      npx('pkg', [PKG_CONFIG, '--target', target, ...extra, '--output', out])
      console.log(`✓ ${path.relative(root, out)}`)
      // Windows hedefiyse (PE .exe) ikon + sürüm bilgisini göm.
      if (target.includes('win') && out.endsWith('.exe')) embedWinResources(out)
    }
  } finally {
    fs.rmSync(PKG_CONFIG, { force: true })
    fs.rmSync(TMP_DIR, { recursive: true, force: true })
  }
}

function guiPlatformFlags() {
  const flags = ['--mac', '--win', '--linux'].filter((f) => has(f))
  if (flags.length === 0) {
    if (process.platform === 'darwin') flags.push('--mac')
    else if (process.platform === 'win32') flags.push('--win')
    else flags.push('--linux')
  }
  // Mimari bayrakları electron-builder'a aynen iletilir (verilmezse host mimarisi).
  // Aynı çağrıdaki TÜM platformlara uygulanır — mimari başına ayrı çağrı yapın.
  flags.push(...['--x64', '--arm64', '--armv7l'].filter((f) => has(f)))
  return flags
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
