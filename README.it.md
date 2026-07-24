<div align="center">

<img src="src/public/logo.svg" alt="Relackout ArtNet 2 USB" width="96" height="96">

# Relackout ArtNet 2 USB

**Un bridge Art-Net → USB DMX gratuito e mirato, con GUI desktop e CLI headless.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)](#download)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)

[Download](https://relackout.com/usb-dmx) · [Uso della CLI](#cli-usage) · [Compilazione dai sorgenti](#building-from-source) · [Architettura](#architecture)

[English](README.md) · [Türkçe](README.tr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · **Italiano** · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [简体中文](README.zh-Hans.md) · [日本語](README.ja.md)

</div>

---

## Cos'è

La maggior parte dei software di illuminazione parla **Art-Net** in rete, ma molte interfacce USB DMX — il DMX USB Pro di Enttec (e i suoi compatibili), i dongle generici Open DMX / FTDI — hanno ancora bisogno di qualcosa sulla scrivania che riceva quel segnale di rete e lo inoltri via USB.

**Relackout ArtNet 2 USB** è esattamente questo: un bridge piccolo e mirato che tieni in esecuzione in background. Non costa nulla, non richiede un account, ed è pensato per rendere l'intero ecosistema Art-Net più semplice da usare — comprese le console e i software che non sono [Relackout](https://relackout.com).

Viene distribuito in due modalità:
- **Una GUI desktop** — auto-discovery, un'anteprima live a 512 canali e una tabella di routing visuale.
- **Una CLI headless** (`artnet2usb-cli`) — lo stesso identico motore di routing, senza interfaccia grafica, pensata per un Raspberry Pi dietro un traliccio, un server backstage senza monitor, o per scriptare un intero rig prima di uno spettacolo. Entrambe leggono e scrivono lo **stesso file di configurazione**, quindi puoi costruire i routing nella GUI ed eseguirli in headless, o viceversa.

## Funzionalità

- **Auto-discovery** — resta in ascolto passivo su UDP 6454 ed elenca ogni universo Art-Net trasmesso sulla rete, con IP sorgente e frame-rate letto in tempo reale; la scansione dei nodi `ArtPoll`/`ArtPollReply` individua anche i dispositivi che non trasmettono ancora DMX.
- **Anteprima live dei canali** — osserva in tempo reale tutti i 512 canali di qualsiasi universo rilevato, prima ancora di configurare un routing.
- **Tabella di routing visuale** — ogni riga è una regola: universo Art-Net → dispositivo USB + protocollo + frequenza di aggiornamento (1–44 Hz).
- **Due protocolli** — Enttec DMX USB Pro (e i cloni compatibili a livello firmware) e output Open DMX / FTDI grezzo.
- **Identità persistente del dispositivo** — le interfacce USB vengono riconosciute dalla loro identità hardware (vendor ID, product ID, numero di serie), non dal percorso della porta del sistema operativo. Rinomina un dispositivo una sola volta: il nome e i suoi routing sopravvivono anche se viene scollegato e spostato su un'altra porta.
- **Offset di patch dei canali** — compensa l'indirizzo DMX iniziale di un fixture o una numerazione dei canali diversa su una console, per ogni singolo routing (`-511..511`). L'universo viene spostato in modo **circolare** all'interno dei suoi 512 canali — nessun dato di canale viene mai perso, semplicemente ricomincia dall'altro capo.
- **Comportamento in caso di perdita del segnale** — scegli se l'output mantiene l'ultimo frame oppure va a nero quando la sorgente Art-Net scompare.
- **Configurazione portatile** — funziona da una chiavetta USB senza alcuna installazione; vedi [Configurazione portatile](#portable-config) più sotto.
- **5 lingue nella GUI** — English, Deutsch, Français, Italiano, Türkçe.

## Download

Binari precompilati, a file singolo e senza installer per Windows, macOS e Linux (incluso Raspberry Pi per la CLI) sono disponibili su **[relackout.com/usb-dmx](https://relackout.com/usb-dmx)** e nella pagina [GitHub Releases](../../releases).

| | File | Note |
|---|---|---|
| GUI · Windows | `Relackout-ArtNet2USB-<ver>-portable.exe` | Portabile — nessun installer, basta eseguirlo. |
| GUI · macOS | `Relackout-ArtNet2USB-<ver>-<arch>.dmg` | Trascina e rilascia, nessun installer. |
| GUI · Linux | `Relackout-ArtNet2USB-<ver>-<arch>.AppImage` | `chmod +x` ed esegui. |
| CLI · tutte le piattaforme | `artnet2usb-cli-<ver>-<platform>[.exe]` | Un vero binario standalone — non serve Node.js. Copre macOS (arm64/x64), Linux (x64/arm64/armv7l — incluso Raspberry Pi) e Windows (x64). |

> **Build non firmate.** Le release non sono firmate digitalmente. Al primo avvio, macOS richiede *tasto destro → Apri*, mentre Windows SmartScreen richiede *Ulteriori informazioni → Esegui comunque*.

## Uso della CLI

```bash
npx artnet2usb-cli                 # nessun argomento → wizard interattivo da terminale
artnet2usb-cli --help              # riferimento completo dei comandi
```

| Comando | Cosa fa |
|---|---|
| `configure` | Wizard interattivo per aggiungere/rimuovere routing e, facoltativamente, avviare il bridge. |
| `auto` | Rileva automaticamente un singolo universo Art-Net e dispositivo USB, salva il routing e lo avvia (`--no-start` per non avviarlo). |
| `run` | Avvia il bridge usando i routing salvati ed esegue finché non viene fermato (`Ctrl+C`). |
| `route add` / `route list` / `route remove <id>` | Gestisce i routing in modo non interattivo — scriptabile da uno shell script o da un playbook Ansible. |
| `list-ports` | Elenca i dispositivi seriali USB collegati. |
| `list-nodes` | Resta in ascolto dei nodi Art-Net sulla rete (~3s) e li elenca. |
| `doctor` | Segnala dispositivi scollegati, routing in conflitto e impostazioni fuori intervallo nella configurazione salvata. |
| `install-service` / `uninstall-service` | Genera (e stampa a video, senza mai applicarla in silenzio) un'unità systemd (Linux) o un agente launchd (macOS) in modo che il bridge si riavvii automaticamente dopo un riavvio del sistema o un crash. |

Configurazione headless in un solo comando su una macchina con esattamente un universo Art-Net e un'interfaccia USB DMX:

```bash
artnet2usb-cli auto --protocol enttec-pro --hz 40
```

Ogni comando accetta `--config <dir>` per puntare a una specifica directory di configurazione, e `run`/`auto` accettano `--json` per emettere lo stato come JSON delimitato da newline invece che come testo leggibile (comodo per supervisionare il processo da un altro script).

## Configurazione portatile

L'app cerca prima `config.json` accanto all'eseguibile, così può viaggiare su una chiavetta USB tra diverse macchine. Se quella directory non è scrivibile (ad esempio a causa della "app translocation" di Gatekeeper per un'app macOS non firmata), l'app ricade sulla directory di configurazione per-utente standard del sistema operativo. La GUI e la CLI condividono esattamente lo stesso `config.json` quando vengono eseguite dalla stessa cartella — costruisci i routing visualmente, poi eseguili in headless, o viceversa.

## Compilazione dai sorgenti

```bash
npm install
npm run dev             # GUI, electron-vite dev server
npm test                # test unitari (parser, framing, device uid, config)
npm run typecheck       # tsc --noEmit
npm run dist             # pacchettizza la GUI per la piattaforma host (electron-builder)
npm run dev:cli          # esegue la CLI dai sorgenti (tsx)
npm run build:cli        # compila la CLI in dist-cli/
```

### Build standalone a file singolo

Tutti gli output standalone finiscono in `dist-standalone/`; ogni artefatto è un unico file, senza nulla da installare:

```bash
npm run dist:standalone                                   # piattaforma host: GUI + CLI
node scripts/build-standalone.mjs --cli --all-targets     # CLI: ogni piattaforma in un solo passaggio
node scripts/build-standalone.mjs --gui --mac --win       # GUI: solo le piattaforme selezionate
```

La CLI viene impacchettata con `esbuild` e trasformata in binari veri e propri con [`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg) (non serve Node.js per eseguirli); la GUI viene pacchettizzata con `electron-builder`.

## Architettura

```
app/                      Processo main di Electron
  artnet.ts                Listener/parser Art-Net — nessuna libreria di protocollo esterna, scritto a mano seguendo la spec
  dmxOutput.ts              motore di output + driver di protocollo (Enttec Pro, Open DMX), tramite `serialport`
  store.ts                  nomi dispositivi / routing / impostazioni, con priorità alla configurazione portatile
  main.ts, preload.ts       ciclo di vita dell'app Electron + il bridge IPC esposto al renderer

cli/                       CLI headless (compilata separatamente, vedi tsconfig.cli.json)
  index.ts                  definizioni dei comandi (commander) + wizard interattivo (@clack/prompts)
  bridge.ts, autoRoute.ts    logica condivisa di avvio del bridge e di auto-selezione singolo universo/dispositivo
  routeCommands.ts           `route add/list/remove` — gestione scriptabile dei routing
  serviceInstall.ts          generazione dell'unità systemd/launchd
  doctor.ts, configDir.ts    controlli di salute della configurazione + risoluzione della directory di configurazione

shared/                    Codice condiviso tra GUI e CLI
  types.ts                  RouteConfig, UsbDevice, e il resto della superficie dei tipi condivisi
  store.ts, portableConfig.ts   il file di configurazione stesso + la regola portatile-vs-per-utente per la directory

scripts/build-standalone.mjs   la pipeline di distribuzione a file singolo (esbuild + @yao-pkg/pkg + electron-builder)
scripts/embed-win-resources.mjs   incorpora un'icona + metadati di versione nell'.exe della CLI Windows (tramite resedit)
src/                       Renderer React + Tailwind (GUI), incluso src/locales/ per le 5 lingue supportate
```

## Contribuire

Issue e pull request sono benvenute. Prima di aprire una PR, assicurati che `npm test` e `npm run typecheck` passino entrambi.

## Licenza

[MIT](LICENSE) © Remana

---

<div align="center">

Parte dell'ecosistema di controllo luci [Relackout](https://relackout.com).

</div>
