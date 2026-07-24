<div align="center">

<img src="src/public/logo.svg" alt="Relackout ArtNet 2 USB" width="96" height="96">

# Relackout ArtNet 2 USB

**A free, focused Art-Net → USB DMX bridge, with a desktop GUI and a headless CLI.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)](#download)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)

[Download](https://relackout.com/usb-dmx) · [CLI usage](#cli-usage) · [Building from source](#building-from-source) · [Architecture](#architecture)

**English** · [Türkçe](README.tr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Italiano](README.it.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [简体中文](README.zh-Hans.md) · [日本語](README.ja.md)

</div>

---

## What is this?

Most lighting software speaks **Art-Net** over the network, but a lot of USB DMX interfaces — Enttec's DMX USB Pro (and compatibles), generic Open DMX / FTDI dongles — still need something on the desk to receive that network signal and push it out over USB.

**Relackout ArtNet 2 USB** is exactly that: a small, focused bridge you keep running in the background. It costs nothing, requires no account, and is built to make the whole Art-Net ecosystem easier to work with — including consoles and software that aren't [Relackout](https://relackout.com).

It ships two ways:
- **A desktop GUI** — auto-discovery, a live 512-channel preview, and a visual routing table.
- **A headless CLI** (`artnet2usb-cli`) — the exact same routing engine, zero UI, built for a Raspberry Pi behind a truss, a backstage server with no monitor, or scripting an entire rig ahead of a show. Both read and write the **same config file**, so you can build routes in the GUI and run them headless, or the other way around.

## Features

- **Auto-discovery** — passively listens on UDP 6454 and lists every Art-Net universe broadcasting on the network, with source IP and a live frame-rate readout; `ArtPoll`/`ArtPollReply` node scanning finds devices that don't broadcast DMX yet.
- **Live channel preview** — watch all 512 channels of any discovered universe update in real time, before you route anything.
- **Visual routing table** — each row is one rule: Art-Net universe → USB device + protocol + refresh rate (1–44 Hz).
- **Two protocols** — Enttec DMX USB Pro (and firmware-compatible clones) and raw Open DMX / FTDI output.
- **Persistent device identity** — USB interfaces are remembered by their hardware identity (vendor ID, product ID, serial number), not their OS port path. Rename a device once, and the name and its routes survive being unplugged and moved to a different port.
- **Channel patch offset** — compensate for a fixture's own DMX start address or a console's differing channel numbering, per route (`-511..511`). The universe is shifted **circularly** within its 512 channels — no channel data is ever dropped, it wraps around instead.
- **Signal-loss behavior** — choose whether output holds the last frame or blacks out when the Art-Net source disappears.
- **Portable config** — runs from a USB stick with zero installation; see [Portable config](#portable-config) below.
- **5 languages in the GUI** — English, Deutsch, Français, Italiano, Türkçe.

## Download

Prebuilt, single-file, no-installer binaries for Windows, macOS, and Linux (including Raspberry Pi for the CLI) are available at **[relackout.com/usb-dmx](https://relackout.com/usb-dmx)** and on the [GitHub Releases](../../releases) page.

| | File | Notes |
|---|---|---|
| GUI · Windows | `Relackout-ArtNet2USB-<ver>-portable.exe` | Portable — no installer, just run it. |
| GUI · macOS | `Relackout-ArtNet2USB-<ver>-<arch>.dmg` | Drag & drop, no installer. |
| GUI · Linux | `Relackout-ArtNet2USB-<ver>-<arch>.AppImage` | `chmod +x` and run. |
| CLI · all platforms | `artnet2usb-cli-<ver>-<platform>[.exe]` | A real standalone binary — no Node.js required. Covers macOS (arm64/x64), Linux (x64/arm64/armv7l — including Raspberry Pi), and Windows (x64). |

> **Unsigned builds.** Releases aren't code-signed. On first launch, macOS requires *right-click → Open*, and Windows SmartScreen requires *More info → Run anyway*.

## CLI usage

```bash
npx artnet2usb-cli                 # no args → interactive terminal wizard
artnet2usb-cli --help              # full command reference
```

| Command | What it does |
|---|---|
| `configure` | Interactive wizard to add/remove routes and optionally start the bridge. |
| `auto` | Auto-detect a single Art-Net universe and USB device, save the route, and start it (`--no-start` to skip starting). |
| `run` | Start the bridge using saved routes and run until stopped (`Ctrl+C`). |
| `route add` / `route list` / `route remove <id>` | Manage routes non-interactively — scriptable from a shell script or an Ansible playbook. |
| `list-ports` | List connected USB serial devices. |
| `list-nodes` | Listen for Art-Net nodes on the network (~3s) and list them. |
| `doctor` | Flag disconnected devices, conflicting routes, and out-of-range settings in the saved config. |
| `install-service` / `uninstall-service` | Generate (and print, never silently apply) a systemd unit (Linux) or a launchd agent (macOS) so the bridge restarts automatically after a reboot or a crash. |

One-command headless setup on a machine with exactly one Art-Net universe and one USB DMX interface:

```bash
artnet2usb-cli auto --protocol enttec-pro --hz 40
```

Every command accepts `--config <dir>` to point at a specific config directory, and `run`/`auto` accept `--json` to emit newline-delimited JSON status instead of human-readable text (handy for supervising the process from another script).

## Portable config

The app looks for `config.json` next to the executable first, so it can travel on a USB stick between machines. If that directory isn't writable (e.g. Gatekeeper's "app translocation" for an unsigned macOS app), it falls back to the OS-standard per-user config directory. The GUI and the CLI share the exact same `config.json` when run from the same folder — build routes visually, then run them headless, or vice versa.

## Building from source

```bash
npm install
npm run dev             # GUI, electron-vite dev server
npm test                # unit tests (parser, framing, device uid, config)
npm run typecheck       # tsc --noEmit
npm run dist             # package the GUI for the host platform (electron-builder)
npm run dev:cli          # run the CLI from source (tsx)
npm run build:cli        # compile the CLI to dist-cli/
```

### Standalone, single-file builds

All standalone output lands in `dist-standalone/`; every artifact is a single file with nothing to install:

```bash
npm run dist:standalone                                   # host platform: GUI + CLI
node scripts/build-standalone.mjs --cli --all-targets     # CLI: every platform in one pass
node scripts/build-standalone.mjs --gui --mac --win       # GUI: selected platforms only
```

The CLI is bundled with `esbuild` and packaged into real binaries with [`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg) (no Node.js needed to run them); the GUI is packaged with `electron-builder`.

## Architecture

```
app/                      Electron main process
  artnet.ts                Art-Net listener/parser — no external protocol library, hand-rolled to spec
  dmxOutput.ts              output engine + protocol drivers (Enttec Pro, Open DMX), via `serialport`
  store.ts                  device names / routes / settings, portable-config-first
  main.ts, preload.ts       Electron app lifecycle + the IPC bridge exposed to the renderer

cli/                       Headless CLI (compiles separately, see tsconfig.cli.json)
  index.ts                  command definitions (commander) + the interactive wizard (@clack/prompts)
  bridge.ts, autoRoute.ts    shared bridge start-up and single-universe/device auto-pick logic
  routeCommands.ts           `route add/list/remove` — scriptable route management
  serviceInstall.ts          systemd/launchd unit generation
  doctor.ts, configDir.ts    config health checks + config-directory resolution

shared/                    Code shared between the GUI and the CLI
  types.ts                  RouteConfig, UsbDevice, and the rest of the shared type surface
  store.ts, portableConfig.ts   the config file itself + the portable-vs-per-user directory rule

scripts/build-standalone.mjs   the single-file distribution pipeline (esbuild + @yao-pkg/pkg + electron-builder)
scripts/embed-win-resources.mjs   embeds an icon + version metadata into the Windows CLI .exe (via resedit)
src/                       React + Tailwind renderer (GUI), including src/locales/ for the 5 supported languages
```

## Contributing

Issues and pull requests are welcome. Before opening a PR, please make sure `npm test` and `npm run typecheck` both pass.

## License

[MIT](LICENSE) © Remana

---

<div align="center">

Part of the [Relackout](https://relackout.com) lighting-control ecosystem.

</div>
