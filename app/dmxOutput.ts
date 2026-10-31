import { SerialPort } from 'serialport'
import type { AppSettings, OutputProtocol, RouteConfig, RouteStatus, UsbDevice } from '../shared/types'
import { checkSerialAccess, classifySerialError, describeSerialProblem } from '../shared/serialPermissions'
import { userInfo } from 'node:os'

/**
 * USB DMX output engine. Each active route runs on its own timer (hz):
 * it grabs the source universe's latest frame and writes it to the port
 * using the selected protocol.
 *  - enttec-pro: Enttec DMX USB Pro frame (0x7E, label 6, len LE, data, 0xE7)
 *  - open-dmx:   FTDI raw DMX — 250000 baud 8N2, break + MAB + startcode + 512
 * The device identity (uid) is independent of the port path: when the
 * device is reconnected, the route finds its new path on its own.
 */

/** Enttec Pro "Output Only Send DMX" packet. (Pure — unit tested.) */
export function buildEnttecFrame(dmx: Buffer): Buffer {
  const payload = Buffer.alloc(513)
  payload[0] = 0 // start code
  dmx.copy(payload, 1, 0, Math.min(dmx.length, 512))
  const frame = Buffer.alloc(payload.length + 5)
  frame[0] = 0x7e
  frame[1] = 6 // label: Output Only Send DMX
  frame.writeUInt16LE(payload.length, 2)
  payload.copy(frame, 4)
  frame[frame.length - 1] = 0xe7
  return frame
}

/**
 * Applies a channel start (patch) offset — a circular rotation, so NO DATA
 * IS LOST: the entire 512-channel buffer is preserved, only the positions
 * are rotated circularly.
 *  - offset > 0: source channels 1..512 are written in order to device
 *    channel (1+offset).. onward; the `offset` channels that overflow the
 *    end of the buffer wrap around to the start (device channels 1..offset).
 *  - offset < 0: the first |offset| channels of the source wrap around to
 *    the END of the device buffer (not dropped), source channel (|offset|+1)
 *    is written to the device's channel 1.
 * If offset=0, returns the original buffer untouched. (Pure — unit tested.)
 */
export function applyChannelOffset(dmx: Buffer, offset: number): Buffer {
  if (!offset) return dmx
  const shifted = Buffer.alloc(512)
  for (let i = 0; i < 512; i++) {
    const srcIndex = ((((i - offset) % 512) + 512) % 512)
    shifted[i] = srcIndex < dmx.length ? dmx[srcIndex] : 0
  }
  return shifted
}

/** Derives a persistent device identity from a serialport list record. (Pure — unit tested.) */
export function deviceUid(p: { vendorId?: string; productId?: string; serialNumber?: string; path: string }): string {
  const vid = (p.vendorId ?? '?').toLowerCase()
  const pid = (p.productId ?? '?').toLowerCase()
  return p.serialNumber ? `${vid}:${pid}:${p.serialNumber}` : `${vid}:${pid}:${p.path}`
}

/** os.userInfo() throws when the uid has no passwd entry (some containers). */
function safeUsername(): string {
  try {
    return userInfo().username
  } catch {
    return process.env.USER ?? process.env.LOGNAME ?? 'your-user'
  }
}

interface ActiveOutput {
  port: SerialPort
  timer: NodeJS.Timeout
  framesSent: number
  error: string | null
  writing: boolean
  /** Frozen frame — when set, this is output instead of live data */
  frozenFrame: Buffer | null
}

export class DmxOutputEngine {
  private active = new Map<string, ActiveOutput>() // routeId -> output
  private lastFrames = new Map<string, Buffer>() // routeId -> last frame sent
  /**
   * Why the last start() attempt failed, per route. Callers (CLI bridge
   * watchdog, GUI) retry in a loop and used to swallow the error, which turned
   * a permission problem into a bare "device not connected". Keeping it here
   * means statusOf() can report the real cause without changing call sites.
   */
  private startErrors = new Map<string, string>()

  constructor(
    private getFrame: (universe: number) => { data: Buffer; lastAt: number } | null,
    private getSettings: () => AppSettings
  ) {}

  /**
   * Being listed is NOT the same as being usable: on Linux the device node is
   * owned by a group (usually `dialout`) and a user outside it can see the port
   * but never open it. Each entry therefore carries a real, non-invasive
   * permission check alongside its presence.
   */
  async listDevices(): Promise<Omit<UsbDevice, 'name'>[]> {
    const ports = await SerialPort.list()
    return ports.map((p) => {
      const access = checkSerialAccess(p.path)
      return {
        uid: deviceUid(p),
        path: p.path,
        manufacturer: p.manufacturer,
        vendorId: p.vendorId,
        productId: p.productId,
        serialNumber: p.serialNumber,
        connected: true,
        accessible: access.accessible,
        accessProblem: access.problem
      }
    })
  }

  isActive(routeId: string): boolean {
    return this.active.has(routeId)
  }

  statusOf(route: RouteConfig): Pick<RouteStatus, 'active' | 'error' | 'framesSent' | 'frozen'> {
    const a = this.active.get(route.id)
    return {
      active: !!a && !a.error,
      // A route that never opened has no ActiveOutput; its failure reason lives
      // in startErrors, otherwise the caller would only see a null error.
      error: a?.error ?? this.startErrors.get(route.id) ?? null,
      framesSent: a?.framesSent ?? 0,
      frozen: !!a?.frozenFrame
    }
  }

  /** Freeze: locks in the current frame; a second call returns to live. Returns: the new frozen state. */
  toggleFreeze(route: RouteConfig): boolean {
    const out = this.active.get(route.id)
    if (!out) return false
    if (out.frozenFrame) {
      out.frozenFrame = null
      return false
    }
    // Current output frame: live data, else the last frame sent, else blackout
    const fr = this.getFrame(route.universe)
    out.frozenFrame = Buffer.from(fr?.data ?? this.lastFrames.get(route.id) ?? Buffer.alloc(512))
    return true
  }

  /** Start a route: find the device's current port path by uid, open the port, set up the loop. */
  async start(route: RouteConfig): Promise<void> {
    await this.stop(route.id)
    const devices = await this.listDevices()
    const dev = devices.find((d) => d.uid === route.deviceUid)
    if (!dev) {
      this.startErrors.set(route.id, 'device_not_connected')
      throw new Error('device_not_connected')
    }
    const baud = route.protocol === 'open-dmx' ? 250000 : 57600
    const port = new SerialPort({
      path: dev.path,
      baudRate: baud,
      dataBits: 8,
      stopBits: 2,
      parity: 'none',
      autoOpen: false
    })
    try {
      await new Promise<void>((resolve, reject) => {
        port.open((err) => (err ? reject(err) : resolve()))
      })
    } catch (err) {
      // The device IS plugged in — reporting "not connected" here would send the
      // user hunting for a cable fault instead of the actual one-command fix.
      const problem = {
        kind: classifySerialError(err),
        path: dev.path,
        group: dev.accessProblem?.group,
        detail: err instanceof Error ? err.message : String(err)
      }
      const described = describeSerialProblem(problem, { platform: process.platform, username: safeUsername() })
      const message = [described.title, ...described.lines].join('\n')
      this.startErrors.set(route.id, message)
      throw new Error(message)
    }
    this.startErrors.delete(route.id)
    const hz = Math.max(1, Math.min(44, route.hz))
    const out: ActiveOutput = { port, timer: null as unknown as NodeJS.Timeout, framesSent: 0, error: null, writing: false, frozenFrame: null }
    out.timer = setInterval(() => void this.tick(route, out), Math.round(1000 / hz))
    port.on('error', (err) => {
      out.error = err.message
    })
    port.on('close', () => {
      out.error = out.error ?? 'port_closed'
    })
    this.active.set(route.id, out)
  }

  private currentFrame(route: RouteConfig): Buffer | null {
    const settings = this.getSettings()
    const fr = this.getFrame(route.universe)
    const fresh = fr && Date.now() - fr.lastAt <= settings.signalLossMs
    if (fresh) {
      this.lastFrames.set(route.id, fr.data)
      return fr.data
    }
    // No signal: hold the last frame or blackout, depending on the setting
    if (settings.onSignalLoss === 'blackout') return Buffer.alloc(512)
    return this.lastFrames.get(route.id) ?? null
  }

  private async tick(route: RouteConfig, out: ActiveOutput): Promise<void> {
    if (out.writing || !out.port.isOpen) return
    const raw = out.frozenFrame ?? this.currentFrame(route)
    if (!raw) return
    const dmx = applyChannelOffset(raw, route.channelOffset ?? 0)
    out.writing = true
    try {
      if (route.protocol === 'enttec-pro') {
        await new Promise<void>((resolve, reject) =>
          out.port.write(buildEnttecFrame(dmx), (err) => (err ? reject(err) : resolve()))
        )
      } else {
        // Open DMX: break (~1ms) + MAB (Mark After Break) + frame, via serialport set({brk}).
        // Keep RTS clear on both calls; serialport otherwise asserts it by default.
        // NOTE: flush() was tried between break→data but caused jitter (reverted).
        // In this version flush() was moved to the VERY START of the loop — it tries
        // to clear any leftover stray byte from the previous cycle without touching
        // the current break/MAB timing.
        await new Promise<void>((resolve, reject) => out.port.flush((e) => (e ? reject(e) : resolve())))
        await new Promise<void>((resolve, reject) => out.port.set({ brk: true, rts: false }, (e) => (e ? reject(e) : resolve())))
        await new Promise((r) => setTimeout(r, 1))
        await new Promise<void>((resolve, reject) => out.port.set({ brk: false, rts: false }, (e) => (e ? reject(e) : resolve())))
        await new Promise((r) => setTimeout(r, 1))
        const frame = Buffer.alloc(513)
        frame[0] = 0
        dmx.copy(frame, 1, 0, Math.min(dmx.length, 512))
        await new Promise<void>((resolve, reject) => out.port.write(frame, (err) => (err ? reject(err) : resolve())))
        await new Promise<void>((resolve, reject) => out.port.drain((err) => (err ? reject(err) : resolve())))
      }
      out.framesSent++
      out.error = null
    } catch (err) {
      out.error = err instanceof Error ? err.message : String(err)
    } finally {
      out.writing = false
    }
  }

  async stop(routeId: string): Promise<void> {
    const out = this.active.get(routeId)
    if (!out) return
    clearInterval(out.timer)
    this.active.delete(routeId)
    this.lastFrames.delete(routeId)
    if (out.port.isOpen) {
      await new Promise<void>((resolve) => out.port.close(() => resolve()))
    }
  }

  async stopAll(): Promise<void> {
    for (const id of [...this.active.keys()]) await this.stop(id)
  }
}

export type { OutputProtocol }
