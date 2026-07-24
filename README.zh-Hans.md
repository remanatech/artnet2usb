<div align="center">

<img src="src/public/logo.svg" alt="Relackout ArtNet 2 USB" width="96" height="96">

# Relackout ArtNet 2 USB

**一款免费、专注的 Art-Net → USB DMX 桥接工具，提供桌面 GUI 和无界面 CLI。**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)](#download)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)

[下载](https://relackout.com/usb-dmx) · [CLI 用法](#cli-usage) · [从源码构建](#building-from-source) · [架构](#architecture)

[English](README.md) · [Türkçe](README.tr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Italiano](README.it.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · **简体中文** · [日本語](README.ja.md)

</div>

---

## 这是什么？

大多数灯光控制软件通过网络使用 **Art-Net** 协议，但许多 USB DMX 接口——例如 Enttec 的 DMX USB Pro（及其兼容产品）、通用的 Open DMX / FTDI 加密狗——仍然需要一台放在桌上的设备来接收这种网络信号，并通过 USB 输出出去。

**Relackout ArtNet 2 USB** 正是为此而生：一款小巧、专注的桥接工具，让它在后台持续运行即可。它完全免费、无需注册账号，其设计目标是让整个 Art-Net 生态系统更易于使用——包括那些并非 [Relackout](https://relackout.com) 的控制台和软件。

它提供两种使用方式：
- **桌面 GUI**——自动发现设备、实时 512 通道预览，以及可视化路由表。
- **无界面 CLI**（`artnet2usb-cli`）——采用完全相同的路由引擎，没有界面，专为树莓派（安装在桁架背后）、没有显示器的后台服务器，或需要为整场演出提前编写脚本的场景而生。GUI 和 CLI 读写的是**同一份配置文件**，因此你可以在 GUI 中搭建路由后以无界面方式运行，反之亦然。

## 功能特性

- **自动发现**——被动监听 UDP 6454 端口，列出网络上广播的每一个 Art-Net universe，并显示来源 IP 和实时帧率；`ArtPoll`/`ArtPollReply` 节点扫描还能发现那些尚未广播 DMX 数据的设备。
- **实时通道预览**——在建立任何路由之前，实时查看所发现的任意 universe 中全部 512 个通道的更新情况。
- **可视化路由表**——每一行代表一条规则：Art-Net universe → USB 设备 + 协议 + 刷新率（1–44 Hz）。
- **两种协议**——支持 Enttec DMX USB Pro（及其固件兼容的仿制品）以及原始 Open DMX / FTDI 输出。
- **持久化设备身份**——USB 接口通过其硬件身份（厂商 ID、产品 ID、序列号）来识别，而不是操作系统的端口路径。只需为设备命名一次，即使拔插并换到不同端口，其名称和路由配置依然保留。
- **通道位移偏移**——针对每条路由（`-511..511`），补偿灯具自身的 DMX 起始地址或控制台不同的通道编号方式。universe 会在其 512 个通道范围内**循环**偏移——不会丢失任何通道数据，而是环绕折返。
- **信号丢失行为**——可选择当 Art-Net 信号源消失时，输出保持最后一帧画面还是直接黑场。
- **便携式配置**——可从 U 盘直接运行，无需安装；详见下方[便携式配置](#portable-config)。
- **GUI 支持 5 种语言**——English、Deutsch、Français、Italiano、Türkçe。

## 下载

在 **[relackout.com/usb-dmx](https://relackout.com/usb-dmx)** 以及 [GitHub Releases](../../releases) 页面均提供适用于 Windows、macOS 和 Linux（含树莓派 CLI 版本）的预编译单文件、免安装二进制包。

| | 文件 | 说明 |
|---|---|---|
| GUI · Windows | `Relackout-ArtNet2USB-<ver>-portable.exe` | 便携版——无需安装，直接运行。 |
| GUI · macOS | `Relackout-ArtNet2USB-<ver>-<arch>.dmg` | 拖拽安装，无需安装程序。 |
| GUI · Linux | `Relackout-ArtNet2USB-<ver>-<arch>.AppImage` | 执行 `chmod +x` 后运行即可。 |
| CLI · 全平台 | `artnet2usb-cli-<ver>-<platform>[.exe]` | 真正独立的二进制文件——运行无需 Node.js。覆盖 macOS（arm64/x64）、Linux（x64/arm64/armv7l，含树莓派）以及 Windows（x64）。 |

> **未签名构建。** 发行版并未进行代码签名。首次启动时，macOS 需要*右键点击 → 打开*，Windows SmartScreen 需要点击*更多信息 → 仍要运行*。

## CLI 用法

```bash
npx artnet2usb-cli                 # no args → interactive terminal wizard
artnet2usb-cli --help              # full command reference
```

| 命令 | 作用 |
|---|---|
| `configure` | 交互式向导，用于添加/移除路由，并可选择启动桥接服务。 |
| `auto` | 自动检测单个 Art-Net universe 和 USB 设备，保存路由并启动（使用 `--no-start` 可跳过启动步骤）。 |
| `run` | 使用已保存的路由启动桥接服务，并持续运行直至停止（`Ctrl+C`）。 |
| `route add` / `route list` / `route remove <id>` | 以非交互方式管理路由——可在 shell 脚本或 Ansible playbook 中编写脚本调用。 |
| `list-ports` | 列出已连接的 USB 串口设备。 |
| `list-nodes` | 监听网络上的 Art-Net 节点（约 3 秒）并列出结果。 |
| `doctor` | 检测已保存配置中已断开连接的设备、冲突的路由，以及超出范围的设置。 |
| `install-service` / `uninstall-service` | 生成（并打印显示，从不静默应用）一个 systemd 单元（Linux）或 launchd agent（macOS），使桥接服务在重启或崩溃后自动恢复运行。 |

在只有一个 Art-Net universe 和一个 USB DMX 接口的机器上，一条命令即可完成无界面配置：

```bash
artnet2usb-cli auto --protocol enttec-pro --hz 40
```

每个命令都接受 `--config <dir>` 参数以指定特定的配置目录；`run`/`auto` 命令还接受 `--json` 参数，以换行分隔的 JSON 格式输出状态，而非人类可读文本（便于从另一个脚本中监控该进程）。

## 便携式配置

应用会优先在可执行文件所在目录查找 `config.json`，因此它可以随 U 盘在不同机器间移动。如果该目录不可写（例如未签名 macOS 应用的 Gatekeeper「应用程序转移」机制），则会回退到操作系统标准的按用户配置目录。当从同一文件夹运行时，GUI 与 CLI 共享完全相同的 `config.json`——可以先在图形界面中可视化搭建路由，再以无界面方式运行，反之亦然。

## 从源码构建

```bash
npm install
npm run dev             # GUI, electron-vite dev server
npm test                # unit tests (parser, framing, device uid, config)
npm run typecheck       # tsc --noEmit
npm run dist             # package the GUI for the host platform (electron-builder)
npm run dev:cli          # run the CLI from source (tsx)
npm run build:cli        # compile the CLI to dist-cli/
```

### 独立单文件构建

所有独立构建产物都会输出到 `dist-standalone/`；每个产物都是无需安装的单一文件：

```bash
npm run dist:standalone                                   # host platform: GUI + CLI
node scripts/build-standalone.mjs --cli --all-targets     # CLI: every platform in one pass
node scripts/build-standalone.mjs --gui --mac --win       # GUI: selected platforms only
```

CLI 使用 `esbuild` 打包，并通过 [`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg) 封装成真正的二进制文件（运行时无需 Node.js）；GUI 则使用 `electron-builder` 打包。

## 架构

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

## 贡献

欢迎提交 Issue 和 Pull Request。在提交 PR 之前，请确保 `npm test` 和 `npm run typecheck` 均能通过。

## 许可证

[MIT](LICENSE) © Remana

---

<div align="center">

Part of the [Relackout](https://relackout.com) lighting-control ecosystem.

</div>
