<div align="center">

<img src="src/public/logo.svg" alt="Relackout ArtNet 2 USB" width="96" height="96">

# Relackout ArtNet 2 USB

**無料でシンプルな Art-Net → USB DMX ブリッジ。デスクトップ GUI とヘッドレス CLI を備えています。**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)](#download)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)

[ダウンロード](https://relackout.com/usb-dmx) · [CLI の使い方](#cli-usage) · [ソースからのビルド](#building-from-source) · [アーキテクチャ](#architecture)

[English](README.md) · [Türkçe](README.tr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Italiano](README.it.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [简体中文](README.zh-Hans.md) · **日本語**

</div>

---

## これは何ですか？

多くの照明制御ソフトウェアはネットワーク経由で **Art-Net** を使用しますが、Enttec の DMX USB Pro（および互換機）や汎用の Open DMX / FTDI ドングルなど、多くの USB DMX インターフェースは、そのネットワーク信号を受信して USB 経由で出力するための何かを、依然として手元に必要としています。

**Relackout ArtNet 2 USB** はまさにそのためのツールです。バックグラウンドで動かし続ける、小さく用途を絞ったブリッジです。無料で、アカウント登録も不要。[Relackout](https://relackout.com) 以外のコンソールやソフトウェアも含め、Art-Net エコシステム全体を扱いやすくすることを目的として作られています。

提供形態は2つあります。
- **デスクトップ GUI** — 自動検出、512 チャンネルのライブプレビュー、視覚的なルーティングテーブルを備えています。
- **ヘッドレス CLI**（`artnet2usb-cli`） — GUI とまったく同じルーティングエンジンを、UI なしで提供します。トラスの裏に隠れた Raspberry Pi、モニターのないバックステージサーバー、あるいは本番前に照明システム全体をスクリプトで組み上げる用途を想定しています。GUI と CLI はどちらも**同じ設定ファイル**を読み書きするため、GUI でルートを作成してヘッドレスで実行することも、その逆も可能です。

## 機能

- **自動検出** — UDP 6454 をパッシブに監視し、ネットワーク上でブロードキャストされているすべての Art-Net ユニバースを、送信元 IP とリアルタイムのフレームレート表示とともにリストアップします。`ArtPoll`/`ArtPollReply` によるノードスキャンにより、まだ DMX をブロードキャストしていないデバイスも検出できます。
- **ライブチャンネルプレビュー** — ルーティングを設定する前に、検出したユニバースの 512 チャンネルすべてがリアルタイムに更新される様子を確認できます。
- **視覚的なルーティングテーブル** — 各行が1つのルールです：Art-Net ユニバース → USB デバイス + プロトコル + リフレッシュレート（1〜44 Hz）。
- **2つのプロトコル** — Enttec DMX USB Pro（およびファームウェア互換のクローン）と、生の Open DMX / FTDI 出力に対応しています。
- **永続的なデバイス識別** — USB インターフェースは OS 上のポートパスではなく、ハードウェア識別情報（ベンダー ID、プロダクト ID、シリアル番号）で記憶されます。一度デバイスに名前を付ければ、抜き差しして別のポートに接続しても、その名前とルートはそのまま保持されます。
- **チャンネルパッチオフセット** — 機材固有の DMX 開始アドレスや、コンソール側と異なるチャンネル番号付けを、ルートごとに補正できます（`-511..511`）。ユニバースは 512 チャンネル内で**循環的に**シフトされるため、チャンネルデータが失われることはなく、端まで来ると折り返します。
- **信号ロス時の挙動** — Art-Net の送信元が失われた際に、出力が最後のフレームを保持し続けるか、ブラックアウトするかを選択できます。
- **ポータブル設定** — インストール不要で USB スティックから起動できます。詳しくは下記の[ポータブル設定](#portable-config)を参照してください。
- **GUI は5言語対応** — English、Deutsch、Français、Italiano、Türkçe。

## ダウンロード

Windows、macOS、Linux（CLI については Raspberry Pi を含む）向けの、ビルド済みでインストーラー不要な単一ファイルのバイナリを、**[relackout.com/usb-dmx](https://relackout.com/usb-dmx)** および [GitHub Releases](../../releases) ページで配布しています。

| | ファイル | 備考 |
|---|---|---|
| GUI · Windows | `Relackout-ArtNet2USB-<ver>-portable.exe` | ポータブル — インストーラー不要、実行するだけです。 |
| GUI · macOS | `Relackout-ArtNet2USB-<ver>-<arch>.dmg` | ドラッグ＆ドロップ、インストーラー不要。 |
| GUI · Linux | `Relackout-ArtNet2USB-<ver>-<arch>.AppImage` | `chmod +x` を実行してから起動してください。 |
| CLI · 全プラットフォーム | `artnet2usb-cli-<ver>-<platform>[.exe]` | Node.js 不要の、正真正銘のスタンドアロンバイナリです。macOS（arm64/x64）、Linux（x64/arm64/armv7l — Raspberry Pi を含む）、Windows（x64）に対応しています。 |

> **署名されていないビルド。** リリースはコード署名されていません。初回起動時、macOS では*右クリック → 開く*、Windows の SmartScreen では*詳細情報 → 実行*が必要です。

## CLI の使い方

```bash
npx artnet2usb-cli                 # no args → interactive terminal wizard
artnet2usb-cli --help              # full command reference
```

| コマンド | 動作 |
|---|---|
| `configure` | ルートの追加・削除を行うインタラクティブウィザード。必要に応じてブリッジを起動することもできます。 |
| `auto` | 単一の Art-Net ユニバースと USB デバイスを自動検出し、ルートを保存して起動します（起動をスキップするには `--no-start`）。 |
| `run` | 保存済みのルートを使ってブリッジを起動し、停止（`Ctrl+C`）するまで実行し続けます。 |
| `route add` / `route list` / `route remove <id>` | 対話なしでルートを管理します — シェルスクリプトや Ansible Playbook からスクリプト実行可能です。 |
| `list-ports` | 接続中の USB シリアルデバイスを一覧表示します。 |
| `list-nodes` | ネットワーク上の Art-Net ノードを（約3秒間）待ち受けて一覧表示します。 |
| `doctor` | 保存済み設定内の、切断されたデバイス、競合するルート、範囲外の設定値を検出して警告します。 |
| `install-service` / `uninstall-service` | systemd ユニット（Linux）または launchd エージェント（macOS）を生成して表示します（黙って適用されることはありません）。これにより、再起動やクラッシュの後にブリッジが自動的に再起動するようになります。 |

Art-Net ユニバースと USB DMX インターフェースがそれぞれ1つだけのマシンでは、1コマンドでヘッドレスセットアップが完了します。

```bash
artnet2usb-cli auto --protocol enttec-pro --hz 40
```

すべてのコマンドは、特定の設定ディレクトリを指定するための `--config <dir>` を受け付けます。また `run`/`auto` は、人間が読めるテキストの代わりに改行区切りの JSON ステータスを出力する `--json` を受け付けます（別のスクリプトからプロセスを監視する際に便利です）。

## ポータブル設定

アプリはまず実行ファイルと同じ場所にある `config.json` を探すため、USB スティックに入れてマシン間を持ち運ぶことができます。そのディレクトリに書き込めない場合（例えば、署名されていない macOS アプリに対する Gatekeeper の「app translocation」など）は、OS 標準のユーザーごとの設定ディレクトリにフォールバックします。同じフォルダーから実行すれば、GUI と CLI はまったく同じ `config.json` を共有します — GUI で視覚的にルートを組み立ててからヘッドレスで実行することも、その逆も可能です。

## ソースからのビルド

```bash
npm install
npm run dev             # GUI, electron-vite dev server
npm test                # unit tests (parser, framing, device uid, config)
npm run typecheck       # tsc --noEmit
npm run dist             # package the GUI for the host platform (electron-builder)
npm run dev:cli          # run the CLI from source (tsx)
npm run build:cli        # compile the CLI to dist-cli/
```

### スタンドアロンの単一ファイルビルド

スタンドアロン出力はすべて `dist-standalone/` に生成されます。各成果物はインストール不要の単一ファイルです。

```bash
npm run dist:standalone                                   # host platform: GUI + CLI
node scripts/build-standalone.mjs --cli --all-targets     # CLI: every platform in one pass
node scripts/build-standalone.mjs --gui --mac --win       # GUI: selected platforms only
```

CLI は `esbuild` でバンドルされ、[`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg) によって実行可能な本物のバイナリにパッケージ化されます（実行に Node.js は不要です）。GUI は `electron-builder` でパッケージ化されます。

## アーキテクチャ

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

## コントリビューション

Issue や Pull Request を歓迎します。PR を開く前に、`npm test` と `npm run typecheck` の両方が通ることを確認してください。

## ライセンス

[MIT](LICENSE) © Remana

---

<div align="center">

[Relackout](https://relackout.com) 照明制御エコシステムの一部です。

</div>
