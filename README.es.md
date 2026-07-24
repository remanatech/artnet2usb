<div align="center">

<img src="src/public/logo.svg" alt="Relackout ArtNet 2 USB" width="96" height="96">

# Relackout ArtNet 2 USB

**Un puente Art-Net → USB DMX gratuito y enfocado, con una interfaz gráfica de escritorio y una CLI sin interfaz.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)](#download)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)

[Descarga](https://relackout.com/usb-dmx) · [Uso de la CLI](#cli-usage) · [Compilar desde el código fuente](#building-from-source) · [Arquitectura](#architecture)

[English](README.md) · [Türkçe](README.tr.md) · [Deutsch](README.de.md) · **Español** · [Français](README.fr.md) · [Italiano](README.it.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [简体中文](README.zh-Hans.md) · [日本語](README.ja.md)

</div>

---

## ¿Qué es esto?

La mayoría del software de iluminación se comunica mediante **Art-Net** a través de la red, pero muchas interfaces USB DMX — la DMX USB Pro de Enttec (y sus compatibles), o los adaptadores genéricos Open DMX / FTDI — todavía necesitan algo en el escritorio que reciba esa señal de red y la envíe por USB.

**Relackout ArtNet 2 USB** es exactamente eso: un puente pequeño y enfocado que mantienes ejecutándose en segundo plano. No cuesta nada, no requiere ninguna cuenta, y está diseñado para facilitar el trabajo con todo el ecosistema Art-Net, incluyendo consolas y software que no son de [Relackout](https://relackout.com).

Se distribuye de dos maneras:
- **Una interfaz gráfica de escritorio** — descubrimiento automático, una vista previa en vivo de 512 canales y una tabla de enrutamiento visual.
- **Una CLI sin interfaz** (`artnet2usb-cli`) — exactamente el mismo motor de enrutamiento, sin interfaz gráfica, pensada para una Raspberry Pi detrás de una estructura de truss, un servidor de backstage sin monitor, o para automatizar todo un montaje antes de un espectáculo. Ambas leen y escriben el **mismo archivo de configuración**, así que puedes crear las rutas en la interfaz gráfica y ejecutarlas sin interfaz, o al revés.

## Características

- **Descubrimiento automático** — escucha de forma pasiva en el puerto UDP 6454 y lista cada universo Art-Net que se transmite en la red, con la IP de origen y una lectura en vivo de la tasa de fotogramas; el escaneo de nodos `ArtPoll`/`ArtPollReply` encuentra dispositivos que todavía no transmiten DMX.
- **Vista previa de canales en vivo** — observa cómo se actualizan en tiempo real los 512 canales de cualquier universo detectado, antes de enrutar nada.
- **Tabla de enrutamiento visual** — cada fila es una regla: universo Art-Net → dispositivo USB + protocolo + frecuencia de actualización (1–44 Hz).
- **Dos protocolos** — Enttec DMX USB Pro (y sus clones compatibles a nivel de firmware) y salida Open DMX / FTDI en bruto.
- **Identidad persistente del dispositivo** — las interfaces USB se recuerdan por su identidad de hardware (ID de proveedor, ID de producto, número de serie), no por la ruta de puerto del sistema operativo. Renombra un dispositivo una sola vez, y ese nombre y sus rutas sobreviven a que se desconecte y se conecte a un puerto distinto.
- **Desplazamiento de parche de canales** — compensa la dirección de inicio DMX propia de un fixture o una numeración de canales distinta en una consola, por ruta (`-511..511`). El universo se desplaza de forma **circular** dentro de sus 512 canales — no se pierde ningún dato de canal, simplemente da la vuelta.
- **Comportamiento ante pérdida de señal** — elige si la salida mantiene el último fotograma o se apaga (blackout) cuando la fuente Art-Net desaparece.
- **Configuración portátil** — se ejecuta desde una memoria USB sin necesidad de instalación; consulta [Configuración portátil](#portable-config) más abajo.
- **5 idiomas en la interfaz gráfica** — English, Deutsch, Français, Italiano, Türkçe.

## Descarga

Los binarios precompilados, de un solo archivo y sin instalador para Windows, macOS y Linux (incluyendo Raspberry Pi para la CLI) están disponibles en **[relackout.com/usb-dmx](https://relackout.com/usb-dmx)** y en la página de [GitHub Releases](../../releases).

| | Archivo | Notas |
|---|---|---|
| GUI · Windows | `Relackout-ArtNet2USB-<ver>-portable.exe` | Portátil — sin instalador, solo ejecútalo. |
| GUI · macOS | `Relackout-ArtNet2USB-<ver>-<arch>.dmg` | Arrastrar y soltar, sin instalador. |
| GUI · Linux | `Relackout-ArtNet2USB-<ver>-<arch>.AppImage` | `chmod +x` y ejecútalo. |
| CLI · todas las plataformas | `artnet2usb-cli-<ver>-<platform>[.exe]` | Un binario independiente real — no requiere Node.js. Cubre macOS (arm64/x64), Linux (x64/arm64/armv7l — incluyendo Raspberry Pi) y Windows (x64). |

> **Compilaciones sin firmar.** Las versiones publicadas no están firmadas digitalmente. En el primer inicio, macOS requiere *clic derecho → Abrir*, y Windows SmartScreen requiere *Más información → Ejecutar de todos modos*.

## Uso de la CLI

```bash
npx artnet2usb-cli                 # sin argumentos → asistente de terminal interactivo
artnet2usb-cli --help              # referencia completa de comandos
```

| Comando | Qué hace |
|---|---|
| `configure` | Asistente interactivo para añadir/eliminar rutas y, opcionalmente, iniciar el puente. |
| `auto` | Detecta automáticamente un único universo Art-Net y un dispositivo USB, guarda la ruta y la inicia (`--no-start` para omitir el inicio). |
| `run` | Inicia el puente usando las rutas guardadas y se ejecuta hasta que se detenga (`Ctrl+C`). |
| `route add` / `route list` / `route remove <id>` | Gestiona las rutas de forma no interactiva — apto para automatizar desde un script de shell o un playbook de Ansible. |
| `list-ports` | Lista los dispositivos serie USB conectados. |
| `list-nodes` | Escucha los nodos Art-Net en la red (~3 s) y los lista. |
| `doctor` | Detecta dispositivos desconectados, rutas en conflicto y ajustes fuera de rango en la configuración guardada. |
| `install-service` / `uninstall-service` | Genera (e imprime, nunca aplica silenciosamente) una unidad systemd (Linux) o un agente launchd (macOS) para que el puente se reinicie automáticamente tras un reinicio o un fallo. |

Configuración sin interfaz en un solo comando, en una máquina con exactamente un universo Art-Net y una interfaz USB DMX:

```bash
artnet2usb-cli auto --protocol enttec-pro --hz 40
```

Todos los comandos aceptan `--config <dir>` para apuntar a un directorio de configuración específico, y `run`/`auto` aceptan `--json` para emitir el estado como JSON delimitado por saltos de línea en lugar de texto legible por personas (útil para supervisar el proceso desde otro script).

## Configuración portátil

La aplicación busca primero `config.json` junto al ejecutable, para poder llevarla en una memoria USB de una máquina a otra. Si ese directorio no es escribible (por ejemplo, por la "app translocation" de Gatekeeper en una app de macOS sin firmar), recurre al directorio de configuración por usuario estándar del sistema operativo. La interfaz gráfica y la CLI comparten exactamente el mismo `config.json` cuando se ejecutan desde la misma carpeta — crea las rutas de forma visual y luego ejecútalas sin interfaz, o viceversa.

## Compilar desde el código fuente

```bash
npm install
npm run dev             # GUI, servidor de desarrollo electron-vite
npm test                # pruebas unitarias (parser, framing, device uid, config)
npm run typecheck       # tsc --noEmit
npm run dist             # empaqueta la GUI para la plataforma local (electron-builder)
npm run dev:cli          # ejecuta la CLI desde el código fuente (tsx)
npm run build:cli        # compila la CLI en dist-cli/
```

### Compilaciones independientes de un solo archivo

Toda la salida independiente se genera en `dist-standalone/`; cada artefacto es un único archivo sin nada que instalar:

```bash
npm run dist:standalone                                   # plataforma local: GUI + CLI
node scripts/build-standalone.mjs --cli --all-targets     # CLI: todas las plataformas en una sola pasada
node scripts/build-standalone.mjs --gui --mac --win       # GUI: solo las plataformas seleccionadas
```

La CLI se empaqueta con `esbuild` y se convierte en binarios reales con [`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg) (no se necesita Node.js para ejecutarlos); la GUI se empaqueta con `electron-builder`.

## Arquitectura

```
app/                      Proceso principal de Electron
  artnet.ts                Listener/parser de Art-Net — sin librería de protocolo externa, hecho a mano según la especificación
  dmxOutput.ts              motor de salida + drivers de protocolo (Enttec Pro, Open DMX), vía `serialport`
  store.ts                  nombres de dispositivos / rutas / ajustes, con prioridad a la configuración portátil
  main.ts, preload.ts       ciclo de vida de la app Electron + el puente IPC expuesto al renderer

cli/                       CLI sin interfaz (se compila por separado, ver tsconfig.cli.json)
  index.ts                  definiciones de comandos (commander) + el asistente interactivo (@clack/prompts)
  bridge.ts, autoRoute.ts    arranque compartido del puente y lógica de selección automática de universo/dispositivo único
  routeCommands.ts           `route add/list/remove` — gestión de rutas automatizable
  serviceInstall.ts          generación de unidades systemd/launchd
  doctor.ts, configDir.ts    comprobaciones de salud de la configuración + resolución del directorio de configuración

shared/                    Código compartido entre la GUI y la CLI
  types.ts                  RouteConfig, UsbDevice, y el resto de la superficie de tipos compartida
  store.ts, portableConfig.ts   el propio archivo de configuración + la regla de directorio portátil frente a por usuario

scripts/build-standalone.mjs   el pipeline de distribución de archivo único (esbuild + @yao-pkg/pkg + electron-builder)
scripts/embed-win-resources.mjs   incrusta un icono + metadatos de versión en el .exe de la CLI de Windows (mediante resedit)
src/                       Renderer de la GUI en React + Tailwind, incluyendo src/locales/ para los 5 idiomas soportados
```

## Contribuir

Los issues y pull requests son bienvenidos. Antes de abrir un PR, asegúrate de que `npm test` y `npm run typecheck` pasen correctamente.

## Licencia

[MIT](LICENSE) © Remana

---

<div align="center">

Parte del ecosistema de control de iluminación [Relackout](https://relackout.com).

</div>
