import type { TKey } from './en'

export const de: Record<TKey, string> = {
  appTitle: 'Relackout',
  appSubtitle: 'ArtNet 2 USB',
  footerTagline: 'Kostenloses Tool — für die komplette Show-Automatisierung',

  onSignalLoss: 'Bei Signalverlust',
  holdLastFrame: 'Letztes Bild halten',
  blackout: 'Abdunkeln',

  universesTitle: 'Art-Net-Sendungen',
  universesCount: '{{n}} Sendung · {{nodes}} Node',
  noUniverses: 'Im Netzwerk ist keine Art-Net-Sendung sichtbar — sendet Ihre Konsole oder Software an UDP 6454?',
  selectForRoute: 'Auswählen, um eine Route anzulegen',
  selected: 'ausgewählt',
  preview: 'Vorschau',
  close: 'Schließen',

  selectBroadcast: 'Sendung wählen',
  selectDevice: 'Gerät wählen',
  protocolEnttec: 'Enttec Pro',
  protocolOpenDmx: 'Open DMX (FTDI)',
  selectBothFirst: 'Zuerst eine Sendung und ein Gerät auswählen',
  createRoute: 'Route anlegen & starten',

  previewTitle: 'Vorschau — Universe {{u}}',
  activeChannels: '{{n}} aktive Kanäle',
  channelTooltip: 'Kanal {{n}}: {{v}}',

  devicesTitle: 'USB-Geräte',
  connectedCount: '{{n}} verbunden',
  noDevices: 'Kein USB-Seriengerät gefunden.',
  notConnectedBadge: '(nicht verbunden)',
  serialLabel: 'SN {{sn}}',
  rename: 'Umbenennen',
  renameButtonTooltip: 'Umbenennen — der Name bleibt dauerhaft mit der Geräte-ID verknüpft',
  namePlaceholder: 'Gerätename',
  unnamedDevice: 'Unbenanntes Gerät',

  routesTitle: 'Routen',
  liveCount: '{{n}} live',
  noRoutes: 'Noch keine Route — oben eine Sendung und ein Gerät auswählen, dann „Route anlegen & starten“.',
  freeze: 'Freeze',
  resume: 'Fortsetzen',
  freezeTooltip: 'Aktuelles Bild einfrieren — Ausgabe bleibt fest',
  resumeTooltip: 'Zurück zu Live-Daten',
  stop: 'Stopp',
  start: 'Start',
  deleteRouteTooltip: 'Route löschen',
  liveBadge: 'LIVE',
  frozenBadge: 'EINGEFROREN — Ausgabe fest',
  framesCount: '{{n}} Bilder',

  languageLabel: 'Sprache',

  serialPermissionTitle: 'Berechtigung für seriellen Port erforderlich',

  serialPermissionBody: 'ArtNet2USB erkennt Ihr USB-DMX-Gerät unter {{path}}, aber Ihr Benutzer hat keine Zugriffsberechtigung. Ihr Benutzer ist nicht in der Gruppe "{{group}}".',

  serialPermissionFix: 'Berechtigung korrigieren',

  serialPermissionFixing: 'Wird korrigiert…',


  errorDeviceNotConnected: 'Gerät nicht verbunden',
  errorRouteNotFound: 'Route nicht gefunden',
  errorPortClosed: 'Port geschlossen'
}
