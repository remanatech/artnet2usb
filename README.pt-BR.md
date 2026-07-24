<div align="center">

<img src="src/public/logo.svg" alt="Relackout ArtNet 2 USB" width="96" height="96">

# Relackout ArtNet 2 USB

**Uma ponte Art-Net → USB DMX gratuita e focada, com uma GUI para desktop e uma CLI headless.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)](#download)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)

[Download](https://relackout.com/usb-dmx) · [Uso da CLI](#cli-usage) · [Compilando a partir do código-fonte](#building-from-source) · [Arquitetura](#architecture)

[English](README.md) · [Türkçe](README.tr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Italiano](README.it.md) · **Português** · [Русский](README.ru.md) · [简体中文](README.zh-Hans.md) · [日本語](README.ja.md)

</div>

---

## O que é isto?

A maioria dos softwares de iluminação fala **Art-Net** pela rede, mas muitas interfaces USB DMX — a DMX USB Pro da Enttec (e compatíveis), dongles genéricos Open DMX / FTDI — ainda precisam de algo na mesa para receber esse sinal de rede e enviá-lo via USB.

**Relackout ArtNet 2 USB** é exatamente isso: uma ponte pequena e focada que fica rodando em segundo plano. Não custa nada, não exige conta e foi criada para tornar todo o ecossistema Art-Net mais fácil de usar — inclusive com mesas e softwares que não são [Relackout](https://relackout.com).

O produto é distribuído de duas formas:
- **Uma GUI para desktop** — descoberta automática, pré-visualização ao vivo de 512 canais e uma tabela de roteamento visual.
- **Uma CLI headless** (`artnet2usb-cli`) — exatamente o mesmo motor de roteamento, sem interface, feita para um Raspberry Pi atrás de uma treliça, um servidor de bastidores sem monitor, ou para automatizar toda a configuração de um rig antes de um show. Ambas leem e escrevem o **mesmo arquivo de configuração**, então você pode montar rotas na GUI e executá-las em modo headless, ou o contrário.

## Funcionalidades

- **Descoberta automática** — escuta passivamente na porta UDP 6454 e lista todo universo Art-Net que estiver transmitindo na rede, com IP de origem e uma leitura de taxa de quadros em tempo real; a varredura de nós via `ArtPoll`/`ArtPollReply` encontra dispositivos que ainda não transmitem DMX.
- **Pré-visualização de canais ao vivo** — acompanhe a atualização em tempo real de todos os 512 canais de qualquer universo descoberto, antes de rotear qualquer coisa.
- **Tabela de roteamento visual** — cada linha é uma regra: universo Art-Net → dispositivo USB + protocolo + taxa de atualização (1–44 Hz).
- **Dois protocolos** — Enttec DMX USB Pro (e clones compatíveis a nível de firmware) e saída bruta Open DMX / FTDI.
- **Identidade persistente do dispositivo** — as interfaces USB são reconhecidas pela sua identidade de hardware (vendor ID, product ID, número de série), não pelo caminho da porta do sistema operacional. Renomeie um dispositivo uma vez, e o nome e suas rotas sobrevivem a ser desconectado e movido para outra porta.
- **Offset de patch de canal** — compense o endereço DMX inicial de um fixture ou uma numeração de canais diferente em uma mesa, por rota (`-511..511`). O universo é deslocado **circularmente** dentro de seus 512 canais — nenhum dado de canal é perdido, ele simplesmente dá a volta.
- **Comportamento em caso de perda de sinal** — escolha se a saída mantém o último quadro ou apaga (blackout) quando a fonte Art-Net desaparece.
- **Configuração portátil** — roda a partir de um pendrive USB sem qualquer instalação; veja [Configuração portátil](#portable-config) abaixo.
- **5 idiomas na GUI** — English, Deutsch, Français, Italiano, Türkçe.

## Download

Binários pré-compilados, de arquivo único e sem instalador para Windows, macOS e Linux (incluindo Raspberry Pi para a CLI) estão disponíveis em **[relackout.com/usb-dmx](https://relackout.com/usb-dmx)** e na página de [GitHub Releases](../../releases).

| | Arquivo | Notas |
|---|---|---|
| GUI · Windows | `Relackout-ArtNet2USB-<ver>-portable.exe` | Portátil — sem instalador, apenas execute. |
| GUI · macOS | `Relackout-ArtNet2USB-<ver>-<arch>.dmg` | Arraste e solte, sem instalador. |
| GUI · Linux | `Relackout-ArtNet2USB-<ver>-<arch>.AppImage` | `chmod +x` e execute. |
| CLI · todas as plataformas | `artnet2usb-cli-<ver>-<platform>[.exe]` | Um binário standalone de verdade — não requer Node.js. Cobre macOS (arm64/x64), Linux (x64/arm64/armv7l — incluindo Raspberry Pi) e Windows (x64). |

> **Builds não assinados.** As releases não são assinadas digitalmente (code-signed). Na primeira execução, o macOS exige *clique com o botão direito → Abrir*, e o SmartScreen do Windows exige *Mais informações → Executar assim mesmo*.

## Uso da CLI

```bash
npx artnet2usb-cli                 # sem argumentos → assistente interativo de terminal
artnet2usb-cli --help              # referência completa de comandos
```

| Comando | O que faz |
|---|---|
| `configure` | Assistente interativo para adicionar/remover rotas e, opcionalmente, iniciar a ponte. |
| `auto` | Detecta automaticamente um único universo Art-Net e dispositivo USB, salva a rota e a inicia (`--no-start` para pular a inicialização). |
| `run` | Inicia a ponte usando as rotas salvas e continua rodando até ser interrompida (`Ctrl+C`). |
| `route add` / `route list` / `route remove <id>` | Gerencia rotas de forma não interativa — automatizável a partir de um script de shell ou de um playbook do Ansible. |
| `list-ports` | Lista os dispositivos seriais USB conectados. |
| `list-nodes` | Escuta a rede em busca de nós Art-Net (~3s) e os lista. |
| `doctor` | Sinaliza dispositivos desconectados, rotas conflitantes e configurações fora do intervalo permitido no arquivo de configuração salvo. |
| `install-service` / `uninstall-service` | Gera (e exibe, nunca aplica silenciosamente) uma unit do systemd (Linux) ou um agente launchd (macOS) para que a ponte reinicie automaticamente após uma reinicialização do sistema ou uma falha. |

Configuração headless com um único comando em uma máquina com exatamente um universo Art-Net e uma interface USB DMX:

```bash
artnet2usb-cli auto --protocol enttec-pro --hz 40
```

Todo comando aceita `--config <dir>` para apontar para um diretório de configuração específico, e `run`/`auto` aceitam `--json` para emitir status em JSON delimitado por novas linhas em vez de texto legível para humanos (útil para supervisionar o processo a partir de outro script).

## Configuração portátil

O aplicativo procura primeiro por `config.json` ao lado do executável, para que possa viajar em um pendrive USB entre máquinas. Se esse diretório não for gravável (por exemplo, devido à "translocação de app" do Gatekeeper para um app macOS não assinado), ele recorre ao diretório de configuração padrão do sistema operacional por usuário. A GUI e a CLI compartilham exatamente o mesmo `config.json` quando executadas a partir da mesma pasta — monte rotas visualmente e depois as execute em modo headless, ou vice-versa.

## Compilando a partir do código-fonte

```bash
npm install
npm run dev             # GUI, servidor de desenvolvimento electron-vite
npm test                # testes unitários (parser, framing, device uid, config)
npm run typecheck       # tsc --noEmit
npm run dist             # empacota a GUI para a plataforma hospedeira (electron-builder)
npm run dev:cli          # executa a CLI a partir do código-fonte (tsx)
npm run build:cli        # compila a CLI para dist-cli/
```

### Builds standalone de arquivo único

Toda a saída standalone fica em `dist-standalone/`; cada artefato é um arquivo único, sem nada para instalar:

```bash
npm run dist:standalone                                   # plataforma hospedeira: GUI + CLI
node scripts/build-standalone.mjs --cli --all-targets     # CLI: todas as plataformas em uma única execução
node scripts/build-standalone.mjs --gui --mac --win       # GUI: apenas as plataformas selecionadas
```

A CLI é empacotada com `esbuild` e transformada em binários reais com [`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg) (não é necessário Node.js para executá-los); a GUI é empacotada com `electron-builder`.

## Arquitetura

```
app/                      Processo principal do Electron
  artnet.ts                Listener/parser Art-Net — sem biblioteca de protocolo externa, implementado à mão seguindo a spec
  dmxOutput.ts              motor de saída + drivers de protocolo (Enttec Pro, Open DMX), via `serialport`
  store.ts                  nomes de dispositivos / rotas / configurações, com prioridade à configuração portátil
  main.ts, preload.ts       ciclo de vida do app Electron + a ponte IPC exposta ao renderer

cli/                       CLI headless (compilada separadamente, veja tsconfig.cli.json)
  index.ts                  definições de comandos (commander) + o assistente interativo (@clack/prompts)
  bridge.ts, autoRoute.ts    lógica compartilhada de inicialização da ponte e seleção automática de universo/dispositivo único
  routeCommands.ts           `route add/list/remove` — gerenciamento de rotas automatizável por script
  serviceInstall.ts          geração de unit systemd/launchd
  doctor.ts, configDir.ts    verificações de saúde da configuração + resolução do diretório de configuração

shared/                    Código compartilhado entre a GUI e a CLI
  types.ts                  RouteConfig, UsbDevice, e o restante da superfície de tipos compartilhada
  store.ts, portableConfig.ts   o próprio arquivo de configuração + a regra de diretório portátil-vs-por-usuário

scripts/build-standalone.mjs   o pipeline de distribuição de arquivo único (esbuild + @yao-pkg/pkg + electron-builder)
scripts/embed-win-resources.mjs   incorpora um ícone + metadados de versão no .exe da CLI do Windows (via resedit)
src/                       Renderer da GUI em React + Tailwind, incluindo src/locales/ para os 5 idiomas suportados
```

## Contribuindo

Issues e pull requests são bem-vindos. Antes de abrir um PR, certifique-se de que `npm test` e `npm run typecheck` passem sem erros.

## Licença

[MIT](LICENSE) © Remana

---

<div align="center">

Parte do ecossistema de controle de iluminação [Relackout](https://relackout.com).

</div>
