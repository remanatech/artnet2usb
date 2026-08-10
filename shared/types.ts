/** Main process ↔ renderer shared types. */

import type { SerialAccessProblem } from './serialPermissions'

export type { SerialAccessProblem }

/** An Art-Net DMX broadcast seen on the network (per universe). */
export interface SeenUniverse {
  /** Art-Net 15-bit port address: Net<<8 | SubUni */
  universe: number
  sourceIp: string
  /** Frame rate measured over the last ~2 sec */
  fps: number
  lastAt: number
  channels: number
}

/** Node discovered via ArtPollReply. */
export interface ArtNetNode {
  ip: string
  shortName: string
  longName: string
}

/** USB serial device — uid is the persistent identity (stays stable even if the port path changes). */
export interface UsbDevice {
  /** vendorId:productId:serialNumber (or port path if no serial) */
  uid: string
  path: string
  manufacturer?: string
  vendorId?: string
  productId?: string
  serialNumber?: string
  /** User-given name (from device memory) */
  name?: string
  /** Device node is present in the port list. */
  connected: boolean
  /**
   * The port can actually be opened by this user. A device can be `connected`
   * but NOT accessible — on Linux the node is typically owned by the `dialout`
   * group, so a user outside it sees the device yet gets EACCES on open.
   * Undefined only when the check could not run.
   */
  accessible?: boolean
  /** Why the port is not accessible; preserved so the real cause is never lost. */
  accessProblem?: SerialAccessProblem | null
}

export type OutputProtocol = 'enttec-pro' | 'open-dmx'

/** Routing rule: source universe → named device + protocol + rate. */
export interface RouteConfig {
  id: string
  universe: number
  deviceUid: string
  protocol: OutputProtocol
  hz: number
  enabled: boolean
  /**
   * Channel start (patch) offset, -511..511. Default 0 (no shift).
   * Rotates the universe CIRCULARLY within 512 channels — no data is lost;
   * channels that overflow one end wrap around to the other (e.g. offset=-1:
   * source channel 1 isn't dropped, it wraps to the device's channel 512;
   * source channel 2 → device channel 1). Lets you compensate in software
   * for external hardware's own offset (a fixture's patch address, a
   * console's differing channel numbering, etc.) — confirmed through live
   * field testing that both positive and negative directions are needed and
   * data loss is not acceptable.
   */
  channelOffset?: number
}

export interface RouteStatus extends RouteConfig {
  /** Is the device currently plugged in and the port open */
  active: boolean
  error: string | null
  framesSent: number
  /** Is output frozen — the current frame is held steady and live data is ignored */
  frozen: boolean
}

export interface AppSettings {
  /** On signal loss: hold the last frame or blackout */
  onSignalLoss: 'hold' | 'blackout'
  /** How many ms of no signal counts as loss */
  signalLossMs: number
}

export interface AppState {
  universes: SeenUniverse[]
  nodes: ArtNetNode[]
  devices: UsbDevice[]
  routes: RouteStatus[]
  settings: AppSettings
}
