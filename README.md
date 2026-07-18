# Relackout ArtNet 2 USB

Ağdaki Art-Net yayınlarını USB DMX arayüzlerine köprüleyen ücretsiz, kompakt masaüstü aracı.
[Relackout](https://relackout.com) ekosisteminin yan aracıdır — giriş/hesap gerektirmez.

## Özellikler
- **Keşif**: UDP 6454'teki ArtDMX yayınlarını pasif izler (universe, kaynak IP, fps); ArtPoll ile node taraması
- **Önizleme**: seçilen universe'ün 512 kanalı canlı grid'de
- **Yönlendirme tablosu**: her satır bir kural — Art-Net universe → USB cihaz + protokol + Hz (10–44)
- **Protokoller**: Enttec DMX USB Pro (ve uyumluları) · Open DMX / FTDI ham çıkış
- **Cihaz hafızası**: cihazlar kalıcı kimliğiyle (VID:PID:serial) tanınır ve adlandırılır — port yolu değişse de ad ve rotalar korunur
- **Sinyal kaybı davranışı**: son kareyi tut ya da karart

## Standalone dağıtım (kurulumsuz, tek dosya)

Tüm çıktılar `dist-standalone/` altında toplanır; her biri kurulum gerektirmeyen **tek dosyadır**:

| | Dosya | Not |
|---|---|---|
| GUI Windows | `Relackout-ArtNet2USB-<ver>-portable.exe` | Çift tıkla çalışır, setup yok |
| GUI macOS | `Relackout-ArtNet2USB-<ver>-<arch>.dmg` | Sürükle-bırak, kurulum yok |
| GUI Linux | `Relackout-ArtNet2USB-<ver>-<arch>.AppImage` | `chmod +x` yeterli |
| CLI | `artnet2usb-cli-<ver>-<platform>[.exe]` | Gerçek binary — Node.js gerekmez (macos-arm64/x64, linux-x64/arm64/armv7l, win-x64) |

```bash
npm run dist:standalone                                  # host platform: GUI + CLI
node scripts/build-standalone.mjs --cli --all-targets    # CLI: tüm platform matrisi
node scripts/build-standalone.mjs --gui --mac --win      # GUI: seçili platformlar
```

**Portable config:** uygulama, `config.json`'ı önce exe'nin yanında arar/oluşturur —
USB bellekten taşınabilir. Exe'nin dizini yazılabilir değilse (örn. imzasız macOS
uygulamasında Gatekeeper "app translocation") OS-standart kullanıcı dizinine düşer.
GUI ve CLI aynı klasördeyse aynı `config.json`'u paylaşır.

**İmza notu:** dağıtımlar imzasızdır — macOS'ta ilk açılışta "sağ tık → Aç",
Windows'ta SmartScreen'de "Yine de çalıştır" gerekir.

## Geliştirme
```bash
npm install
npm run dev        # electron-vite dev
npm test           # birim testleri (parser, framing, uid)
npm run dist       # paket (electron-builder, host platform)
```

## Mimari
- `app/artnet.ts` — Art-Net dinleyici/parser (kütüphanesiz, spec'e göre)
- `app/dmxOutput.ts` — çıkış motoru + protokol sürücüleri (`serialport`)
- `app/store.ts` — cihaz adları/rotalar/ayarlar (portable-öncelikli config.json)
- `shared/portableConfig.ts` — GUI+CLI ortak portable config kuralı
- `scripts/build-standalone.mjs` — tek dosya dağıtım pipeline'ı (esbuild + @yao-pkg/pkg + electron-builder)
- `src/` — React + Tailwind arayüz (Relackout tasarım dili)
