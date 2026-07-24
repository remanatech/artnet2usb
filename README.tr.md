<div align="center">

<img src="src/public/logo.svg" alt="Relackout ArtNet 2 USB" width="96" height="96">

# Relackout ArtNet 2 USB

**Masaüstü GUI'si ve başsız (headless) CLI'siyle gelen, ücretsiz ve odaklanmış bir Art-Net → USB DMX köprüsü.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)](#download)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)

[İndir](https://relackout.com/usb-dmx) · [CLI kullanımı](#cli-usage) · [Kaynaktan derleme](#building-from-source) · [Mimari](#architecture)

[English](README.md) · **Türkçe** · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Italiano](README.it.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [简体中文](README.zh-Hans.md) · [日本語](README.ja.md)

</div>

---

## Bu nedir?

Çoğu ışık kontrol yazılımı ağ üzerinden **Art-Net** konuşur, ancak Enttec'in DMX USB Pro'su (ve uyumlu klonları) ile jenerik Open DMX / FTDI dongle'ları gibi birçok USB DMX arayüzü, bu ağ sinyalini alıp USB üzerinden dışarı aktaracak bir cihaza hâlâ masada ihtiyaç duyar.

**Relackout ArtNet 2 USB** tam olarak bunu yapar: arka planda çalışır durumda tuttuğunuz, küçük ve odaklanmış bir köprü. Hiçbir ücreti yoktur, hesap gerektirmez ve [Relackout](https://relackout.com) olmayan konsollar ve yazılımlar da dahil olmak üzere tüm Art-Net ekosistemiyle çalışmayı kolaylaştırmak için tasarlanmıştır.

İki biçimde sunulur:
- **Bir masaüstü GUI'si** — otomatik keşif, canlı 512 kanallık önizleme ve görsel bir yönlendirme tablosu.
- **Başsız bir CLI** (`artnet2usb-cli`) — tamamen aynı yönlendirme motoru, sıfır arayüz; bir traversin arkasındaki Raspberry Pi için, monitörü olmayan bir sahne arkası sunucusu için ya da bir gösteri öncesi tüm kurulumu betikle otomatikleştirmek için tasarlanmıştır. İkisi de **aynı yapılandırma dosyasını** okur ve yazar, böylece rotaları GUI'de oluşturup başsız çalıştırabilir ya da tam tersini yapabilirsiniz.

## Özellikler

- **Otomatik keşif** — UDP 6454 portunu pasif olarak dinler ve ağda yayın yapan her Art-Net universe'ini, kaynak IP'si ve canlı kare hızı okumasıyla birlikte listeler; `ArtPoll`/`ArtPollReply` düğüm taraması, henüz DMX yayınlamayan cihazları da bulur.
- **Canlı kanal önizlemesi** — herhangi bir rota tanımlamadan önce, keşfedilen bir universe'in 512 kanalının tümünün gerçek zamanlı olarak güncellenmesini izleyin.
- **Görsel yönlendirme tablosu** — her satır bir kuraldır: Art-Net universe → USB cihazı + protokol + yenileme hızı (1–44 Hz).
- **İki protokol** — Enttec DMX USB Pro (ve ürün yazılımı uyumlu klonları) ile ham Open DMX / FTDI çıkışı.
- **Kalıcı cihaz kimliği** — USB arayüzleri, işletim sistemi port yoluna göre değil, donanım kimliklerine (satıcı kimliği, ürün kimliği, seri numarası) göre hatırlanır. Bir cihazı bir kez yeniden adlandırdığınızda, isim ve rotaları, cihaz çıkarılıp farklı bir porta takıldığında bile kalıcı olur.
- **Kanal yama kaydırması (patch offset)** — bir fikstürün kendi DMX başlangıç adresini veya bir konsolun farklı kanal numaralandırmasını, rota bazında telafi edin (`-511..511`). Universe, 512 kanalı içinde **dairesel** olarak kaydırılır — hiçbir kanal verisi asla kaybolmaz, bunun yerine baştan sarar.
- **Sinyal kaybı davranışı** — Art-Net kaynağı kaybolduğunda çıkışın son kareyi koruyacağını mı yoksa kararacağını mı seçin.
- **Taşınabilir yapılandırma** — kurulum gerektirmeden bir USB bellekten çalışır; aşağıdaki [Taşınabilir yapılandırma](#portable-config) bölümüne bakın.
- **GUI'de 5 dil** — English, Deutsch, Français, Italiano, Türkçe.

## İndir

Windows, macOS ve Linux için (CLI'de Raspberry Pi dahil) önceden derlenmiş, tek dosyalık, kurulum gerektirmeyen ikili dosyalar **[relackout.com/usb-dmx](https://relackout.com/usb-dmx)** adresinde ve [GitHub Releases](../../releases) sayfasında mevcuttur.

| | Dosya | Notlar |
|---|---|---|
| GUI · Windows | `Relackout-ArtNet2USB-<ver>-portable.exe` | Taşınabilir — kurulum yok, yalnızca çalıştırın. |
| GUI · macOS | `Relackout-ArtNet2USB-<ver>-<arch>.dmg` | Sürükle bırak, kurulum yok. |
| GUI · Linux | `Relackout-ArtNet2USB-<ver>-<arch>.AppImage` | `chmod +x` yapıp çalıştırın. |
| CLI · tüm platformlar | `artnet2usb-cli-<ver>-<platform>[.exe]` | Gerçek, bağımsız bir ikili dosya — Node.js gerekmez. macOS (arm64/x64), Linux (x64/arm64/armv7l — Raspberry Pi dahil) ve Windows (x64) platformlarını kapsar. |

> **İmzasız derlemeler.** Sürümler kod imzalı değildir. İlk çalıştırmada macOS *sağ tık → Aç* işlemini, Windows SmartScreen ise *Diğer bilgiler → Yine de çalıştır* seçeneğini gerektirir.

## CLI kullanımı

```bash
npx artnet2usb-cli                 # no args → interactive terminal wizard
artnet2usb-cli --help              # full command reference
```

| Komut | Ne yapar |
|---|---|
| `configure` | Rota ekleyip kaldırmak ve isteğe bağlı olarak köprüyü başlatmak için interaktif sihirbaz. |
| `auto` | Tek bir Art-Net universe'i ve USB cihazını otomatik algılar, rotayı kaydeder ve başlatır (başlatmayı atlamak için `--no-start`). |
| `run` | Kayıtlı rotaları kullanarak köprüyü başlatır ve durdurulana kadar (`Ctrl+C`) çalıştırır. |
| `route add` / `route list` / `route remove <id>` | Rotaları interaktif olmayan şekilde yönetir — bir shell betiğinden veya bir Ansible playbook'undan betikle çalıştırılabilir. |
| `list-ports` | Bağlı USB seri cihazları listeler. |
| `list-nodes` | Ağdaki Art-Net düğümlerini dinler (~3sn) ve listeler. |
| `doctor` | Kayıtlı yapılandırmadaki bağlantısı kesilmiş cihazları, çakışan rotaları ve aralık dışı ayarları işaretler. |
| `install-service` / `uninstall-service` | Köprünün yeniden başlatma veya çökme sonrasında otomatik olarak yeniden başlamasını sağlayan bir systemd birimi (Linux) veya launchd ajanı (macOS) oluşturur (ve yalnızca yazdırır, asla sessizce uygulamaz). |

Tam olarak bir Art-Net universe'i ve bir USB DMX arayüzü bulunan bir makinede tek komutla başsız kurulum:

```bash
artnet2usb-cli auto --protocol enttec-pro --hz 40
```

Her komut, belirli bir yapılandırma dizinini işaret etmek için `--config <dir>` seçeneğini kabul eder; `run`/`auto` ise insan tarafından okunabilir metin yerine satır sonlarıyla ayrılmış JSON durumu yaymak için `--json` seçeneğini kabul eder (işlemi başka bir betikten izlemek için kullanışlıdır).

## Taşınabilir yapılandırma

Uygulama, makineler arasında bir USB bellekte taşınabilmesi için önce çalıştırılabilir dosyanın yanındaki `config.json` dosyasına bakar. Bu dizin yazılabilir değilse (örneğin imzasız bir macOS uygulaması için Gatekeeper'ın "app translocation" özelliği), işletim sisteminin standart kullanıcı başına yapılandırma dizinine geri döner. GUI ve CLI, aynı klasörden çalıştırıldıklarında tamamen aynı `config.json` dosyasını paylaşır — rotaları görsel olarak oluşturup başsız çalıştırabilir, ya da tam tersini yapabilirsiniz.

## Kaynaktan derleme

```bash
npm install
npm run dev             # GUI, electron-vite dev server
npm test                # unit tests (parser, framing, device uid, config)
npm run typecheck       # tsc --noEmit
npm run dist             # package the GUI for the host platform (electron-builder)
npm run dev:cli          # run the CLI from source (tsx)
npm run build:cli        # compile the CLI to dist-cli/
```

### Bağımsız, tek dosyalık derlemeler

Tüm bağımsız çıktılar `dist-standalone/` dizinine yerleşir; her çıktı, kurulacak hiçbir şey içermeyen tek bir dosyadır:

```bash
npm run dist:standalone                                   # host platform: GUI + CLI
node scripts/build-standalone.mjs --cli --all-targets     # CLI: every platform in one pass
node scripts/build-standalone.mjs --gui --mac --win       # GUI: selected platforms only
```

CLI, `esbuild` ile paketlenir ve [`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg) ile gerçek ikili dosyalara dönüştürülür (çalıştırmak için Node.js gerekmez); GUI ise `electron-builder` ile paketlenir.

## Mimari

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

## Katkıda bulunma

Issue'lar ve pull request'ler memnuniyetle karşılanır. Bir PR açmadan önce lütfen `npm test` ve `npm run typecheck` komutlarının ikisinin de başarıyla geçtiğinden emin olun.

## Lisans

[MIT](LICENSE) © Remana

---

<div align="center">

[Relackout](https://relackout.com) ışık kontrol ekosisteminin bir parçasıdır.

</div>
