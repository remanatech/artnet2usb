#!/usr/bin/env node
/**
 * Standalone (single-file) distribution pipeline — every output lands under dist-standalone/,
 * and each one is a single file with nothing to install:
 *   GUI : Relackout-ArtNet2USB-<ver>-portable.exe / -<arch>.dmg / -<arch>.AppImage
 *   CLI : artnet2usb-cli-<ver>-<platform> (a real binary compiled with pkg, no Node.js needed)
 *
 * Usage:
 *   node scripts/build-standalone.mjs                 # host platform: GUI + CLI
 *   node scripts/build-standalone.mjs --cli           # CLI only (host target)
 *   node scripts/build-standalone.mjs --cli --all-targets   # CLI: every platform in one pass
 *   node scripts/build-standalone.mjs --gui --mac --win --linux  # GUI: selected platforms only
 *   node scripts/build-standalone.mjs --cli --targets node22-linux-x64,node22-win-x64
 *
 * CLI packaging flow: tsc (dist-cli) → esbuild into a single CJS bundle (including the ESM-only
 * commander/@clack packages) → a binary via @yao-pkg/pkg. serialport's native .node files
 * (prebuilds) are embedded as pkg assets; @serialport/bindings-cpp itself is kept OUTSIDE the
 * bundle so node-gyp-build can pick the right prebuild for the platform at runtime.
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

/** pkg target → output filename suffix. armv7l = Raspberry Pi (32-bit OS). */
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

// Node 20+'s execFileSync refuses to run .cmd/.bat files on Windows without a shell
// (EINVAL). So on win32 we use shell:true and quote arguments containing spaces
// ourselves (for setups where the root path itself has a space in it).
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
  // Unknown/custom target: "node22-linux-x64" → "linux-x64" (+ .exe if it's win)
  const suffix = target.replace(/^node\d+-/, '').replace(/^linuxstatic-/, 'linux-')
  return suffix.startsWith('win') ? `${suffix}.exe` : suffix
}

/**
 * Embeds an icon + version metadata into a Windows .exe (PE resource section).
 * Only meaningful on platforms that support embedding a PE icon — skipped for
 * macOS Mach-O / Linux ELF binaries, which don't carry an embedded icon. resedit is
 * pure JS, so it also works cross-build (a win target on a mac/linux host). pkg's
 * payload sits at the end as a PE overlay; resedit preserves that overlay and only
 * updates the resource section.
 */
function embedWinResources(exePath) {
  if (!fs.existsSync(ICON_ICO)) {
    console.log('… skipping icon (build/icon.ico not found)')
    return
  }
  console.log('\n=== CLI: embedding Windows icon + version metadata ===')
  // A real `node` process (not the .cmd/npx shim) — uses the resedit library.
  run('node', [path.join('scripts', 'embed-win-resources.mjs'), exePath, ICON_ICO])
}

async function buildCliBinaries() {
  console.log('\n=== CLI: tsc compile ===')
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

  console.log('\n=== CLI: building binaries with pkg ===')
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
      // armv7 (32-bit Raspberry Pi): bytecode generation needs a "fabricator" node of the
      // same architecture on the host; since no armv7 node binary is published for
      // macOS/Windows, cross-building only works without bytecode (the code ships as
      // plain JS in the snapshot instead).
      const extra = target.includes('armv7') ? ['--no-bytecode', '--public'] : []
      npx('pkg', [PKG_CONFIG, '--target', target, ...extra, '--output', out])
      console.log(`✓ ${path.relative(root, out)}`)
      // Windows target (PE .exe): embed the icon + version info.
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
  // Architecture flags are passed straight through to electron-builder (host architecture
  // if none given). They apply to ALL platforms in this call — use separate calls per arch.
  flags.push(...['--x64', '--arm64', '--armv7l'].filter((f) => has(f)))
  return flags
}

async function buildGuiArtifacts() {
  console.log('\n=== GUI: electron-vite build ===')
  npx('electron-vite', ['build'])
  console.log('\n=== GUI: electron-builder (single-file targets) ===')
  npx('electron-builder', guiPlatformFlags())

  // Collect the single-file artifacts from release/ into dist-standalone/
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
console.log('\nDone — every file in dist-standalone/ runs standalone, nothing to install.')
