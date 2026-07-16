/** Source of truth for all UI strings — every other locale must match these keys exactly (enforced by TS). */
export const en = {
  appTitle: 'Relackout',
  appSubtitle: 'ArtNet 2 USB',
  footerTagline: 'Free tool — for full show automation',

  onSignalLoss: 'On signal loss',
  holdLastFrame: 'Hold last frame',
  blackout: 'Blackout',

  universesTitle: 'Art-Net Broadcasts',
  universesCount: '{{n}} broadcast · {{nodes}} node',
  noUniverses: 'No Art-Net broadcast seen on the network — is your console or software sending to UDP 6454?',
  selectForRoute: 'Select to create a route',
  selected: 'selected',
  preview: 'Preview',
  close: 'Close',

  selectBroadcast: 'Select broadcast',
  selectDevice: 'Select device',
  protocolEnttec: 'Enttec Pro',
  protocolOpenDmx: 'Open DMX (FTDI)',
  selectBothFirst: 'Select a broadcast and a device first',
  createRoute: 'Create route & start',

  previewTitle: 'Preview — Universe {{u}}',
  activeChannels: '{{n}} active channels',
  channelTooltip: 'Channel {{n}}: {{v}}',

  devicesTitle: 'USB Devices',
  connectedCount: '{{n}} connected',
  noDevices: 'No USB serial device found.',
  notConnectedBadge: '(not connected)',
  serialLabel: 'SN {{sn}}',
  rename: 'Rename',
  renameButtonTooltip: 'Rename — the name stays linked to the device identity',
  namePlaceholder: 'Device name',
  unnamedDevice: 'Unnamed device',

  routesTitle: 'Routes',
  liveCount: '{{n}} live',
  noRoutes: 'No routes yet — select a broadcast and a device above, then "Create route & start".',
  freeze: 'Freeze',
  resume: 'Resume',
  freezeTooltip: 'Freeze the current frame — output stays fixed',
  resumeTooltip: 'Return to live data',
  stop: 'Stop',
  start: 'Start',
  deleteRouteTooltip: 'Delete route',
  liveBadge: 'LIVE',
  frozenBadge: 'FROZEN — output fixed',
  framesCount: '{{n}} frames',

  languageLabel: 'Language',

  errorDeviceNotConnected: 'Device not connected',
  errorRouteNotFound: 'Route not found',
  errorPortClosed: 'Port closed'
} as const

export type TKey = keyof typeof en
