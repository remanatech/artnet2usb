<div align="center">

<img src="src/public/logo.svg" alt="Relackout ArtNet 2 USB" width="96" height="96">

# Relackout ArtNet 2 USB

**Бесплатный, узкоспециализированный мост Art-Net → USB DMX с настольным GUI и headless CLI.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)](#download)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)

[Скачать](https://relackout.com/usb-dmx) · [Использование CLI](#cli-usage) · [Сборка из исходного кода](#building-from-source) · [Архитектура](#architecture)

[English](README.md) · [Türkçe](README.tr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Italiano](README.it.md) · [Português](README.pt-BR.md) · **Русский** · [简体中文](README.zh-Hans.md) · [日本語](README.ja.md)

</div>

---

## Что это такое?

Большинство программ управления освещением работают по сети через протокол **Art-Net**, но многим USB DMX-интерфейсам — таким как Enttec DMX USB Pro (и совместимые устройства), а также обычным адаптерам Open DMX / FTDI — по-прежнему нужно что-то на рабочем столе, что принимало бы этот сетевой сигнал и передавало его дальше через USB.

**Relackout ArtNet 2 USB** — именно такой инструмент: небольшой узкоспециализированный мост, который просто работает в фоне. Он абсолютно бесплатен, не требует регистрации и создан для того, чтобы упростить работу со всей экосистемой Art-Net в целом — включая пульты и программы, не относящиеся к [Relackout](https://relackout.com).

Поставляется в двух вариантах:
- **Настольный GUI** — автоматическое обнаружение, живой предпросмотр 512 каналов и визуальная таблица маршрутизации.
- **Headless CLI** (`artnet2usb-cli`) — тот же самый движок маршрутизации, но без интерфейса, созданный для Raspberry Pi за фермой, серверов без монитора за кулисами или для написания скриптов, настраивающих всю установку перед шоу. Оба варианта читают и записывают **один и тот же файл конфигурации**, поэтому можно настроить маршруты в GUI и запускать их в headless-режиме — или наоборот.

## Возможности

- **Автоматическое обнаружение** — пассивно прослушивает UDP-порт 6454 и отображает список всех вселенных (universe) Art-Net, транслируемых в сети, с указанием IP-адреса источника и текущей частоты кадров в реальном времени; сканирование узлов через `ArtPoll`/`ArtPollReply` находит устройства, которые ещё не транслируют DMX.
- **Живой предпросмотр каналов** — наблюдайте за обновлением всех 512 каналов любой обнаруженной вселенной в реальном времени, ещё до настройки маршрутизации.
- **Визуальная таблица маршрутизации** — каждая строка представляет собой одно правило: вселенная Art-Net → USB-устройство + протокол + частота обновления (1–44 Гц).
- **Два протокола** — Enttec DMX USB Pro (и совместимые по прошивке клоны), а также прямой вывод Open DMX / FTDI.
- **Постоянная идентификация устройств** — USB-интерфейсы запоминаются по их аппаратному идентификатору (ID производителя, ID продукта, серийный номер), а не по пути порта в ОС. Один раз переименуйте устройство — и его имя, а также связанные с ним маршруты, сохранятся даже после отключения и подключения к другому порту.
- **Смещение патча каналов** — компенсируйте собственный стартовый DMX-адрес прибора или отличающуюся нумерацию каналов пульта, отдельно для каждого маршрута (`-511..511`). Вселенная сдвигается **циклически** в пределах своих 512 каналов — данные каналов никогда не теряются, а переносятся в начало/конец.
- **Поведение при потере сигнала** — выберите, должен ли вывод удерживать последний кадр или уходить в блэкаут при исчезновении источника Art-Net.
- **Портативная конфигурация** — запускается с USB-флешки без какой-либо установки; см. раздел [Портативная конфигурация](#portable-config) ниже.
- **5 языков интерфейса в GUI** — English, Deutsch, Français, Italiano, Türkçe.

## Скачать

Готовые однофайловые сборки, не требующие установки, для Windows, macOS и Linux (включая Raspberry Pi для CLI) доступны на **[relackout.com/usb-dmx](https://relackout.com/usb-dmx)** и на странице [GitHub Releases](../../releases).

| | Файл | Примечания |
|---|---|---|
| GUI · Windows | `Relackout-ArtNet2USB-<ver>-portable.exe` | Портативная версия — без установщика, просто запустите. |
| GUI · macOS | `Relackout-ArtNet2USB-<ver>-<arch>.dmg` | Перетащите и запустите, без установщика. |
| GUI · Linux | `Relackout-ArtNet2USB-<ver>-<arch>.AppImage` | Выполните `chmod +x` и запустите. |
| CLI · все платформы | `artnet2usb-cli-<ver>-<platform>[.exe]` | Полноценный автономный бинарный файл — Node.js не требуется. Поддерживаются macOS (arm64/x64), Linux (x64/arm64/armv7l — включая Raspberry Pi) и Windows (x64). |

> **Неподписанные сборки.** Релизы не подписаны цифровой подписью. При первом запуске в macOS потребуется *правый клик → Открыть*, а Windows SmartScreen потребует *Дополнительно → Выполнить в любом случае*.

## Использование CLI

```bash
npx artnet2usb-cli                 # no args → interactive terminal wizard
artnet2usb-cli --help              # full command reference
```

| Команда | Что она делает |
|---|---|
| `configure` | Интерактивный мастер для добавления/удаления маршрутов и, при желании, запуска моста. |
| `auto` | Автоматически определяет единственную вселенную Art-Net и USB-устройство, сохраняет маршрут и запускает его (`--no-start`, чтобы пропустить запуск). |
| `run` | Запускает мост, используя сохранённые маршруты, и работает до остановки (`Ctrl+C`). |
| `route add` / `route list` / `route remove <id>` | Управление маршрутами без интерактивного режима — можно использовать в shell-скриптах или Ansible-плейбуках. |
| `list-ports` | Выводит список подключённых USB serial-устройств. |
| `list-nodes` | Прослушивает сеть на предмет узлов Art-Net (~3 с) и выводит их список. |
| `doctor` | Отмечает отключённые устройства, конфликтующие маршруты и настройки вне допустимого диапазона в сохранённой конфигурации. |
| `install-service` / `uninstall-service` | Генерирует (и выводит на экран, никогда не применяя молча) unit-файл systemd (Linux) или агент launchd (macOS), чтобы мост автоматически перезапускался после перезагрузки или сбоя. |

Настройка headless-режима одной командой на машине ровно с одной вселенной Art-Net и одним USB DMX-интерфейсом:

```bash
artnet2usb-cli auto --protocol enttec-pro --hz 40
```

Любая команда принимает флаг `--config <dir>` для указания конкретного каталога конфигурации, а `run`/`auto` также принимают флаг `--json`, чтобы выводить статус построчно в формате JSON вместо текста, читаемого человеком (удобно для наблюдения за процессом из другого скрипта).

## Портативная конфигурация

Приложение сначала ищет `config.json` рядом с исполняемым файлом, чтобы конфигурацию можно было переносить между машинами на USB-флешке. Если этот каталог недоступен для записи (например, из-за механизма «app translocation» Gatekeeper для неподписанных приложений macOS), приложение переключается на стандартный для ОС каталог конфигурации пользователя. GUI и CLI используют один и тот же файл `config.json`, если запускаются из одной и той же папки — можно визуально настроить маршруты, а затем запускать их в headless-режиме, или наоборот.

## Сборка из исходного кода

```bash
npm install
npm run dev             # GUI, electron-vite dev server
npm test                # unit tests (parser, framing, device uid, config)
npm run typecheck       # tsc --noEmit
npm run dist             # package the GUI for the host platform (electron-builder)
npm run dev:cli          # run the CLI from source (tsx)
npm run build:cli        # compile the CLI to dist-cli/
```

### Автономные однофайловые сборки

Все автономные сборки попадают в `dist-standalone/`; каждый артефакт представляет собой единый файл, не требующий установки:

```bash
npm run dist:standalone                                   # host platform: GUI + CLI
node scripts/build-standalone.mjs --cli --all-targets     # CLI: every platform in one pass
node scripts/build-standalone.mjs --gui --mac --win       # GUI: selected platforms only
```

CLI собирается с помощью `esbuild` и упаковывается в реальные бинарные файлы с помощью [`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg) (для их запуска Node.js не требуется); GUI упаковывается с помощью `electron-builder`.

## Архитектура

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

## Участие в разработке

Issues и pull request'ы приветствуются. Перед открытием PR, пожалуйста, убедитесь, что команды `npm test` и `npm run typecheck` выполняются без ошибок.

## Лицензия

[MIT](LICENSE) © Remana

---

<div align="center">

Часть экосистемы управления освещением [Relackout](https://relackout.com).

</div>
