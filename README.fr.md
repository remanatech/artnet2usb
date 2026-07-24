<div align="center">

<img src="src/public/logo.svg" alt="Relackout ArtNet 2 USB" width="96" height="96">

# Relackout ArtNet 2 USB

**Un pont Art-Net → USB DMX gratuit et ciblé, avec une interface graphique de bureau et une CLI sans interface.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)](#download)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)

[Téléchargement](https://relackout.com/usb-dmx) · [Utilisation de la CLI](#cli-usage) · [Compilation depuis les sources](#building-from-source) · [Architecture](#architecture)

[English](README.md) · [Türkçe](README.tr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · **Français** · [Italiano](README.it.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [简体中文](README.zh-Hans.md) · [日本語](README.ja.md)

</div>

---

## Qu'est-ce que c'est ?

La plupart des logiciels d'éclairage communiquent en **Art-Net** sur le réseau, mais de nombreuses interfaces USB DMX — le DMX USB Pro d'Enttec (et ses compatibles), les dongles génériques Open DMX / FTDI — ont encore besoin d'un appareil sur le bureau pour recevoir ce signal réseau et le renvoyer en USB.

**Relackout ArtNet 2 USB** est exactement cela : un petit pont ciblé que vous laissez tourner en arrière-plan. Il ne coûte rien, ne nécessite aucun compte, et a été conçu pour faciliter le travail avec tout l'écosystème Art-Net — y compris les consoles et logiciels qui ne sont pas [Relackout](https://relackout.com).

Il est disponible sous deux formes :
- **Une interface graphique de bureau** — découverte automatique, aperçu en direct des 512 canaux et table de routage visuelle.
- **Une CLI sans interface** (`artnet2usb-cli`) — exactement le même moteur de routage, sans aucune interface, conçue pour un Raspberry Pi caché derrière un pont, un serveur en coulisses sans écran, ou pour scripter l'intégralité d'une installation avant un spectacle. Les deux lisent et écrivent le **même fichier de configuration**, ce qui permet de construire des routes dans l'interface graphique et de les exécuter en mode sans interface, ou inversement.

## Fonctionnalités

- **Découverte automatique** — écoute passivement le port UDP 6454 et liste chaque univers Art-Net diffusé sur le réseau, avec l'IP source et un débit d'images en direct ; le balayage de nœuds `ArtPoll`/`ArtPollReply` détecte les appareils qui ne diffusent pas encore de DMX.
- **Aperçu des canaux en direct** — observez la mise à jour en temps réel des 512 canaux de n'importe quel univers découvert, avant même de router quoi que ce soit.
- **Table de routage visuelle** — chaque ligne est une règle : univers Art-Net → appareil USB + protocole + fréquence de rafraîchissement (1 à 44 Hz).
- **Deux protocoles** — Enttec DMX USB Pro (et ses clones compatibles au niveau du firmware) et sortie brute Open DMX / FTDI.
- **Identité persistante des appareils** — les interfaces USB sont mémorisées par leur identité matérielle (identifiant fournisseur, identifiant produit, numéro de série), et non par leur chemin de port système. Renommez un appareil une seule fois : le nom et ses routes survivent au débranchement et au déplacement vers un autre port.
- **Décalage de patch de canaux** — compense l'adresse de départ DMX propre à un projecteur ou une numérotation de canaux différente sur une console, par route (`-511..511`). L'univers est décalé **circulairement** au sein de ses 512 canaux — aucune donnée de canal n'est jamais perdue, elle boucle simplement.
- **Comportement en cas de perte de signal** — choisissez si la sortie conserve la dernière image ou passe au noir lorsque la source Art-Net disparaît.
- **Configuration portable** — s'exécute depuis une clé USB sans aucune installation ; voir [Configuration portable](#portable-config) ci-dessous.
- **5 langues dans l'interface graphique** — English, Deutsch, Français, Italiano, Türkçe.

## Téléchargement

Des binaires précompilés, en fichier unique et sans installateur, pour Windows, macOS et Linux (y compris Raspberry Pi pour la CLI) sont disponibles sur **[relackout.com/usb-dmx](https://relackout.com/usb-dmx)** et sur la page des [Releases GitHub](../../releases).

| | Fichier | Remarques |
|---|---|---|
| GUI · Windows | `Relackout-ArtNet2USB-<ver>-portable.exe` | Portable — aucun installateur, il suffit de l'exécuter. |
| GUI · macOS | `Relackout-ArtNet2USB-<ver>-<arch>.dmg` | Glisser-déposer, aucun installateur. |
| GUI · Linux | `Relackout-ArtNet2USB-<ver>-<arch>.AppImage` | `chmod +x` puis exécuter. |
| CLI · toutes plateformes | `artnet2usb-cli-<ver>-<platform>[.exe]` | Un véritable binaire autonome — Node.js n'est pas requis. Couvre macOS (arm64/x64), Linux (x64/arm64/armv7l — y compris Raspberry Pi) et Windows (x64). |

> **Binaires non signés.** Les versions publiées ne sont pas signées. Au premier lancement, macOS nécessite un *clic droit → Ouvrir*, et Windows SmartScreen nécessite *Informations complémentaires → Exécuter quand même*.

## Utilisation de la CLI

```bash
npx artnet2usb-cli                 # no args → interactive terminal wizard
artnet2usb-cli --help              # full command reference
```

| Commande | Ce qu'elle fait |
|---|---|
| `configure` | Assistant interactif pour ajouter/supprimer des routes et démarrer le pont si besoin. |
| `auto` | Détecte automatiquement un univers Art-Net et un appareil USB uniques, enregistre la route et la démarre (`--no-start` pour ne pas la démarrer). |
| `run` | Démarre le pont à partir des routes enregistrées et l'exécute jusqu'à l'arrêt (`Ctrl+C`). |
| `route add` / `route list` / `route remove <id>` | Gère les routes de façon non interactive — scriptable depuis un script shell ou un playbook Ansible. |
| `list-ports` | Liste les appareils série USB connectés. |
| `list-nodes` | Écoute les nœuds Art-Net sur le réseau (~3 s) et les liste. |
| `doctor` | Signale les appareils déconnectés, les routes en conflit et les réglages hors limites dans la configuration enregistrée. |
| `install-service` / `uninstall-service` | Génère (et affiche, sans jamais l'appliquer silencieusement) une unité systemd (Linux) ou un agent launchd (macOS) afin que le pont redémarre automatiquement après un redémarrage ou un plantage. |

Configuration sans interface en une seule commande sur une machine disposant d'exactement un univers Art-Net et une interface USB DMX :

```bash
artnet2usb-cli auto --protocol enttec-pro --hz 40
```

Chaque commande accepte `--config <dir>` pour pointer vers un répertoire de configuration spécifique, et `run`/`auto` acceptent `--json` pour émettre un statut au format JSON délimité par des retours à la ligne plutôt qu'un texte lisible par un humain (pratique pour superviser le processus depuis un autre script).

## Configuration portable

L'application recherche d'abord `config.json` à côté de l'exécutable, afin de pouvoir voyager sur une clé USB entre plusieurs machines. Si ce répertoire n'est pas accessible en écriture (par exemple à cause de la « translocation d'application » de Gatekeeper pour une app macOS non signée), elle se rabat sur le répertoire de configuration standard par utilisateur du système d'exploitation. L'interface graphique et la CLI partagent exactement le même `config.json` lorsqu'elles sont exécutées depuis le même dossier — construisez des routes visuellement, puis exécutez-les sans interface, ou inversement.

## Compilation depuis les sources

```bash
npm install
npm run dev             # GUI, electron-vite dev server
npm test                # unit tests (parser, framing, device uid, config)
npm run typecheck       # tsc --noEmit
npm run dist             # package the GUI for the host platform (electron-builder)
npm run dev:cli          # run the CLI from source (tsx)
npm run build:cli        # compile the CLI to dist-cli/
```

### Compilations autonomes, fichier unique

Toutes les sorties autonomes sont générées dans `dist-standalone/` ; chaque artefact est un fichier unique, sans rien à installer :

```bash
npm run dist:standalone                                   # host platform: GUI + CLI
node scripts/build-standalone.mjs --cli --all-targets     # CLI: every platform in one pass
node scripts/build-standalone.mjs --gui --mac --win       # GUI: selected platforms only
```

La CLI est empaquetée avec `esbuild` puis transformée en véritables binaires avec [`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg) (aucun Node.js requis pour les exécuter) ; l'interface graphique est empaquetée avec `electron-builder`.

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

## Contribution

Les issues et les pull requests sont les bienvenues. Avant d'ouvrir une PR, assurez-vous que `npm test` et `npm run typecheck` passent tous les deux.

## Licence

[MIT](LICENSE) © Remana

---

<div align="center">

Fait partie de l'écosystème de contrôle d'éclairage [Relackout](https://relackout.com).

</div>
