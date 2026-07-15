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

## Geliştirme
```bash
npm install
npm run dev        # electron-vite dev
npm test           # birim testleri (parser, framing, uid)
npm run dist       # paket (electron-builder)
```

## Mimari
- `app/artnet.ts` — Art-Net dinleyici/parser (kütüphanesiz, spec'e göre)
- `app/dmxOutput.ts` — çıkış motoru + protokol sürücüleri (`serialport`)
- `app/store.ts` — cihaz adları/rotalar/ayarlar (userData/config.json)
- `src/` — React + Tailwind arayüz (Relackout tasarım dili)
