import type { TKey } from './en'

export const it: Record<TKey, string> = {
  appTitle: 'Relackout',
  appSubtitle: 'ArtNet 2 USB',
  footerTagline: "Strumento gratuito — per l'automazione completa dello show",

  onSignalLoss: 'In caso di perdita del segnale',
  holdLastFrame: 'Mantieni ultimo fotogramma',
  blackout: 'Blackout',

  universesTitle: 'Trasmissioni Art-Net',
  universesCount: '{{n}} trasmissione · {{nodes}} nodo',
  noUniverses: 'Nessuna trasmissione Art-Net visibile sulla rete — la console o il software stanno inviando su UDP 6454?',
  selectForRoute: 'Seleziona per creare una route',
  selected: 'selezionato',
  preview: 'Anteprima',
  close: 'Chiudi',

  selectBroadcast: 'Seleziona trasmissione',
  selectDevice: 'Seleziona dispositivo',
  protocolEnttec: 'Enttec Pro',
  protocolOpenDmx: 'Open DMX (FTDI)',
  selectBothFirst: 'Seleziona prima una trasmissione e un dispositivo',
  createRoute: 'Crea route e avvia',

  previewTitle: 'Anteprima — Universe {{u}}',
  activeChannels: '{{n}} canali attivi',
  channelTooltip: 'Canale {{n}}: {{v}}',

  devicesTitle: 'Dispositivi USB',
  connectedCount: '{{n}} connessi',
  noDevices: 'Nessun dispositivo seriale USB trovato.',
  notConnectedBadge: '(non connesso)',
  serialLabel: 'SN {{sn}}',
  rename: 'Rinomina',
  renameButtonTooltip: "Rinomina — il nome resta collegato in modo permanente all'identità del dispositivo",
  namePlaceholder: 'Nome dispositivo',
  unnamedDevice: 'Dispositivo senza nome',

  routesTitle: 'Route',
  liveCount: '{{n}} in diretta',
  noRoutes: 'Nessuna route ancora — seleziona sopra una trasmissione e un dispositivo, poi "Crea route e avvia".',
  freeze: 'Freeze',
  resume: 'Riprendi',
  freezeTooltip: "Blocca il fotogramma corrente — l'uscita resta fissa",
  resumeTooltip: 'Torna ai dati in diretta',
  stop: 'Ferma',
  start: 'Avvia',
  deleteRouteTooltip: 'Elimina route',
  liveBadge: 'IN DIRETTA',
  frozenBadge: 'BLOCCATO — uscita fissa',
  framesCount: '{{n}} fotogrammi',

  languageLabel: 'Lingua',

  errorDeviceNotConnected: 'Dispositivo non connesso',
  errorRouteNotFound: 'Route non trovata',
  errorPortClosed: 'Porta chiusa'
}
