import type { TKey } from './en'

export const tr: Record<TKey, string> = {
  appTitle: 'Relackout',
  appSubtitle: 'ArtNet 2 USB',
  footerTagline: 'Ücretsiz araç — sahne otomasyonunun tamamı için',

  onSignalLoss: 'Sinyal kesilince',
  holdLastFrame: 'Son kareyi tut',
  blackout: 'Karart',

  universesTitle: 'Art-Net Yayınları',
  universesCount: '{{n}} yayın · {{nodes}} node',
  noUniverses: "Ağda Art-Net yayını görünmüyor — konsolunuz/yazılımınız UDP 6454'e yayın yapıyor mu?",
  selectForRoute: 'Rota kurmak için seç',
  selected: 'seçili',
  preview: 'Önizle',
  close: 'Kapat',

  selectBroadcast: 'Yayın seçin',
  selectDevice: 'Cihaz seçin',
  protocolEnttec: 'Enttec Pro',
  protocolOpenDmx: 'Open DMX (FTDI)',
  selectBothFirst: 'Önce bir yayın ve bir cihaz seçin',
  createRoute: 'Rota oluştur ve başlat',

  previewTitle: 'Önizleme — Universe {{u}}',
  activeChannels: '{{n}} aktif kanal',
  channelTooltip: 'Kanal {{n}}: {{v}}',

  devicesTitle: 'USB Cihazları',
  connectedCount: '{{n}} bağlı',
  noDevices: 'USB seri cihaz bulunamadı.',
  notConnectedBadge: '(takılı değil)',
  serialLabel: 'SN {{sn}}',
  rename: 'Adlandır',
  renameButtonTooltip: 'Yeniden adlandır — ad cihaz kimliğine kalıcı bağlanır',
  namePlaceholder: 'Cihaz adı',
  unnamedDevice: 'Adsız cihaz',

  routesTitle: 'Rotalar',
  liveCount: '{{n}} yayında',
  noRoutes: 'Henüz rota yok — üstte bir yayın ve bir cihaz seçip "Rota oluştur ve başlat".',
  freeze: 'Freeze',
  resume: 'Devam et',
  freezeTooltip: 'O anki kareyi dondur — çıkış sabit kalır',
  resumeTooltip: 'Canlı veriye dön',
  stop: 'Durdur',
  start: 'Başlat',
  deleteRouteTooltip: 'Rotayı sil',
  liveBadge: 'YAYINDA',
  frozenBadge: 'DONDURULDU — çıkış sabit',
  framesCount: '{{n}} kare',

  languageLabel: 'Dil',

  errorDeviceNotConnected: 'Cihaz takılı değil',
  errorRouteNotFound: 'Rota bulunamadı',
  errorPortClosed: 'Port kapandı'
}
