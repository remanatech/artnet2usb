<div align="center">

<img src="src/public/logo.svg" alt="Relackout ArtNet 2 USB" width="96" height="96">

# Relackout ArtNet 2 USB

**Eine kostenlose, fokussierte Art-Net-→-USB-DMX-Bridge mit Desktop-GUI und Headless-CLI.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)](#download)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)

[Download](https://relackout.com/usb-dmx) · [CLI-Nutzung](#cli-usage) · [Aus dem Quellcode erstellen](#building-from-source) · [Architektur](#architecture)

[English](README.md) · [Türkçe](README.tr.md) · **Deutsch** · [Español](README.es.md) · [Français](README.fr.md) · [Italiano](README.it.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [简体中文](README.zh-Hans.md) · [日本語](README.ja.md)

</div>

---

## Was ist das?

Die meisten Lichtsteuerungs-Programme sprechen **Art-Net** über das Netzwerk, aber viele USB-DMX-Interfaces — Enttecs DMX USB Pro (und kompatible Geräte), generische Open-DMX-/FTDI-Dongles — benötigen weiterhin etwas auf dem Tisch, das dieses Netzwerksignal empfängt und über USB ausgibt.

**Relackout ArtNet 2 USB** ist genau das: eine kleine, fokussierte Bridge, die Sie im Hintergrund laufen lassen. Sie kostet nichts, erfordert kein Konto und wurde entwickelt, um den Umgang mit dem gesamten Art-Net-Ökosystem zu erleichtern — auch mit Konsolen und Software, die nicht von [Relackout](https://relackout.com) stammen.

Es gibt sie in zwei Varianten:
- **Eine Desktop-GUI** — automatische Erkennung, eine Live-Vorschau aller 512 Kanäle und eine visuelle Routing-Tabelle.
- **Eine Headless-CLI** (`artnet2usb-cli`) — genau dieselbe Routing-Engine, ohne UI, gedacht für einen Raspberry Pi hinter einer Traverse, einen Backstage-Server ohne Monitor oder das Skripten einer kompletten Show-Konfiguration im Voraus. Beide lesen und schreiben dieselbe Konfigurationsdatei, sodass Sie Routen in der GUI anlegen und headless ausführen können — oder umgekehrt.

## Funktionen

- **Automatische Erkennung** — lauscht passiv auf UDP 6454 und listet jedes im Netzwerk gesendete Art-Net-Universum auf, samt Quell-IP und einer Live-Anzeige der Framerate; `ArtPoll`/`ArtPollReply`-Node-Scanning findet auch Geräte, die noch kein DMX senden.
- **Live-Kanalvorschau** — beobachten Sie alle 512 Kanäle eines erkannten Universums in Echtzeit, bevor Sie überhaupt etwas routen.
- **Visuelle Routing-Tabelle** — jede Zeile ist eine Regel: Art-Net-Universum → USB-Gerät + Protokoll + Aktualisierungsrate (1–44 Hz).
- **Zwei Protokolle** — Enttec DMX USB Pro (und firmwarekompatible Klone) sowie rohe Open-DMX-/FTDI-Ausgabe.
- **Dauerhafte Geräteidentität** — USB-Interfaces werden anhand ihrer Hardware-Identität (Vendor-ID, Product-ID, Seriennummer) erkannt, nicht anhand ihres OS-Port-Pfads. Benennen Sie ein Gerät einmal um, und Name sowie zugehörige Routen bleiben erhalten, selbst wenn das Gerät abgesteckt und an einem anderen Port wieder angeschlossen wird.
- **Kanal-Patch-Offset** — gleicht die eigene DMX-Startadresse eines Scheinwerfers oder eine abweichende Kanalnummerierung einer Konsole pro Route aus (`-511..511`). Das Universum wird **zirkulär** innerhalb seiner 512 Kanäle verschoben — es gehen dabei nie Kanaldaten verloren, sie laufen stattdessen um.
- **Verhalten bei Signalverlust** — legen Sie fest, ob die Ausgabe das letzte Frame hält oder abdunkelt, sobald die Art-Net-Quelle verschwindet.
- **Portable Konfiguration** — läuft ohne jede Installation von einem USB-Stick; siehe [Portable Konfiguration](#portable-config) unten.
- **5 Sprachen in der GUI** — Englisch, Deutsch, Französisch, Italienisch, Türkisch.

## Download

Vorgefertigte Single-File-Binärdateien ohne Installer für Windows, macOS und Linux (einschließlich Raspberry Pi für die CLI) finden Sie unter **[relackout.com/usb-dmx](https://relackout.com/usb-dmx)** sowie auf der Seite [GitHub Releases](../../releases).

| | Datei | Hinweise |
|---|---|---|
| GUI · Windows | `Relackout-ArtNet2USB-<ver>-portable.exe` | Portabel — kein Installer, einfach ausführen. |
| GUI · macOS | `Relackout-ArtNet2USB-<ver>-<arch>.dmg` | Drag & Drop, kein Installer. |
| GUI · Linux | `Relackout-ArtNet2USB-<ver>-<arch>.AppImage` | `chmod +x` und ausführen. |
| CLI · alle Plattformen | `artnet2usb-cli-<ver>-<platform>[.exe]` | Ein echtes eigenständiges Binary — kein Node.js erforderlich. Deckt macOS (arm64/x64), Linux (x64/arm64/armv7l — einschließlich Raspberry Pi) und Windows (x64) ab. |

> **Unsignierte Builds.** Die Releases sind nicht code-signiert. Beim ersten Start verlangt macOS *Rechtsklick → Öffnen*, und der Windows SmartScreen verlangt *Weitere Informationen → Trotzdem ausführen*.

## CLI-Nutzung

```bash
npx artnet2usb-cli                 # no args → interactive terminal wizard
artnet2usb-cli --help              # full command reference
```

| Befehl | Was er tut |
|---|---|
| `configure` | Interaktiver Assistent zum Hinzufügen/Entfernen von Routen und optional zum Starten der Bridge. |
| `auto` | Erkennt automatisch ein einzelnes Art-Net-Universum und USB-Gerät, speichert die Route und startet sie (`--no-start`, um den Start zu überspringen). |
| `run` | Startet die Bridge mit den gespeicherten Routen und läuft, bis sie gestoppt wird (`Ctrl+C`). |
| `route add` / `route list` / `route remove <id>` | Verwaltet Routen nicht-interaktiv — skriptfähig aus einem Shell-Skript oder einem Ansible-Playbook heraus. |
| `list-ports` | Listet angeschlossene USB-Seriell-Geräte auf. |
| `list-nodes` | Lauscht im Netzwerk nach Art-Net-Nodes (~3 s) und listet sie auf. |
| `doctor` | Meldet getrennte Geräte, widersprüchliche Routen und Einstellungen außerhalb des gültigen Bereichs in der gespeicherten Konfiguration. |
| `install-service` / `uninstall-service` | Erzeugt (und gibt aus, wendet aber nie stillschweigend an) eine systemd-Unit (Linux) oder einen launchd-Agent (macOS), damit die Bridge nach einem Neustart oder Absturz automatisch wieder startet. |

Ein-Befehl-Headless-Einrichtung auf einem Rechner mit genau einem Art-Net-Universum und einem USB-DMX-Interface:

```bash
artnet2usb-cli auto --protocol enttec-pro --hz 40
```

Jeder Befehl akzeptiert `--config <dir>`, um ein bestimmtes Konfigurationsverzeichnis anzugeben, und `run`/`auto` akzeptieren `--json`, um newline-delimited JSON-Status statt menschenlesbarem Text auszugeben (praktisch, um den Prozess aus einem anderen Skript heraus zu überwachen).

## Portable Konfiguration

Die App sucht zuerst neben der ausführbaren Datei nach `config.json`, damit sie auf einem USB-Stick zwischen Rechnern wandern kann. Ist dieses Verzeichnis nicht beschreibbar (z. B. wegen Gatekeepers „App-Translokation" bei einer unsignierten macOS-App), weicht sie auf das für das Betriebssystem übliche, benutzerbezogene Konfigurationsverzeichnis aus. GUI und CLI teilen sich dieselbe `config.json`, wenn sie aus demselben Ordner heraus ausgeführt werden — legen Sie Routen visuell an und führen Sie sie dann headless aus, oder umgekehrt.

## Aus dem Quellcode erstellen

```bash
npm install
npm run dev             # GUI, electron-vite dev server
npm test                # unit tests (parser, framing, device uid, config)
npm run typecheck       # tsc --noEmit
npm run dist             # package the GUI for the host platform (electron-builder)
npm run dev:cli          # run the CLI from source (tsx)
npm run build:cli        # compile the CLI to dist-cli/
```

### Eigenständige Single-File-Builds

Alle eigenständigen Build-Ergebnisse landen in `dist-standalone/`; jedes Artefakt ist eine einzelne Datei ohne Installation:

```bash
npm run dist:standalone                                   # host platform: GUI + CLI
node scripts/build-standalone.mjs --cli --all-targets     # CLI: every platform in one pass
node scripts/build-standalone.mjs --gui --mac --win       # GUI: selected platforms only
```

Die CLI wird mit `esbuild` gebündelt und mit [`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg) zu echten Binärdateien gepackt (zum Ausführen ist kein Node.js nötig); die GUI wird mit `electron-builder` gepackt.

## Architektur

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

## Mitwirken

Issues und Pull Requests sind willkommen. Bevor Sie einen PR öffnen, stellen Sie bitte sicher, dass sowohl `npm test` als auch `npm run typecheck` erfolgreich durchlaufen.

## Lizenz

[MIT](LICENSE) © Remana

---

<div align="center">

Teil des [Relackout](https://relackout.com) Lichtsteuerungs-Ökosystems.

</div>
