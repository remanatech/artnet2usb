import type { TKey } from './en'

export const fr: Record<TKey, string> = {
  appTitle: 'Relackout',
  appSubtitle: 'ArtNet 2 USB',
  footerTagline: "Outil gratuit — pour l'automatisation complète du spectacle",

  onSignalLoss: 'En cas de perte de signal',
  holdLastFrame: 'Conserver la dernière image',
  blackout: 'Noir (blackout)',

  universesTitle: 'Diffusions Art-Net',
  universesCount: '{{n}} diffusion · {{nodes}} nœud',
  noUniverses: 'Aucune diffusion Art-Net visible sur le réseau — votre console ou logiciel envoie-t-il bien vers UDP 6454 ?',
  selectForRoute: 'Sélectionner pour créer une route',
  selected: 'sélectionné',
  preview: 'Aperçu',
  close: 'Fermer',

  selectBroadcast: 'Choisir une diffusion',
  selectDevice: 'Choisir un périphérique',
  protocolEnttec: 'Enttec Pro',
  protocolOpenDmx: 'Open DMX (FTDI)',
  selectBothFirst: "Sélectionnez d'abord une diffusion et un périphérique",
  createRoute: 'Créer la route et démarrer',

  previewTitle: 'Aperçu — Univers {{u}}',
  activeChannels: '{{n}} canaux actifs',
  channelTooltip: 'Canal {{n}} : {{v}}',

  devicesTitle: 'Périphériques USB',
  connectedCount: '{{n}} connecté(s)',
  noDevices: 'Aucun périphérique série USB détecté.',
  notConnectedBadge: '(non connecté)',
  serialLabel: 'SN {{sn}}',
  rename: 'Renommer',
  renameButtonTooltip: "Renommer — le nom reste lié à l'identité du périphérique",
  namePlaceholder: 'Nom du périphérique',
  unnamedDevice: 'Périphérique sans nom',

  routesTitle: 'Routes',
  liveCount: '{{n}} en direct',
  noRoutes: 'Aucune route pour le moment — sélectionnez une diffusion et un périphérique ci-dessus, puis « Créer la route et démarrer ».',
  freeze: 'Freeze',
  resume: 'Reprendre',
  freezeTooltip: "Figer l'image actuelle — la sortie reste fixe",
  resumeTooltip: 'Revenir aux données en direct',
  stop: 'Arrêter',
  start: 'Démarrer',
  deleteRouteTooltip: 'Supprimer la route',
  liveBadge: 'EN DIRECT',
  frozenBadge: 'FIGÉ — sortie fixe',
  framesCount: '{{n}} images',

  languageLabel: 'Langue',

  serialPermissionTitle: 'Autorisation du port série requise',

  serialPermissionBody: 'ArtNet2USB détecte votre périphérique USB-DMX sur {{path}}, mais votre utilisateur n\'a pas l\'autorisation d\'y accéder. Votre utilisateur n\'appartient pas au groupe « {{group}} ».',

  serialPermissionFix: 'Corriger l\'autorisation',

  serialPermissionFixing: 'Correction…',


  errorDeviceNotConnected: 'Périphérique non connecté',
  errorRouteNotFound: 'Route introuvable',
  errorPortClosed: 'Port fermé'
}
