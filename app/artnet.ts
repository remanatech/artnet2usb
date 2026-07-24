import dgram from 'node:dgram'
import os from 'node:os'
import type { ArtNetNode, SeenUniverse } from '../shared/types'

/**
 * Art-Net listener: passively watches for ArtDMX packets on UDP 6454
 * (discovery + live data) and queries nodes via ArtPoll. No library, built
 * to spec:
 *  - Header: 'Art-Net\0' + OpCode (LE)
 *  - ArtDMX 0x5000: [seq, phys, SubUni, Net, LenHi, LenLo, data...]
 *  - ArtPoll 0x2000 / ArtPollReply 0x2100
 */

const ARTNET_PORT = 6454
const HEADER = Buffer.from('Art-Net\0', 'ascii')
const OP_DMX = 0x5000
const OP_POLL = 0x2000
const OP_POLL_REPLY = 0x2100

interface UniverseState {
  sourceIp: string
  lastAt: number
  data: Buffer
  /** fps measurement: number of frames in the current window */
  frames: number
  fps: number
  windowStart: number
}

export interface ParsedDmx {
  universe: number
  data: Buffer
}

/** Parses an ArtDMX packet; returns null if it's not Art-Net / not ArtDMX. (Pure — unit tested.) */
export function parseArtDmx(msg: Buffer): ParsedDmx | null {
  // 18-byte header + at least 1 channel
  if (msg.length < 19 || !msg.subarray(0, 8).equals(HEADER)) return null
  const opCode = msg.readUInt16LE(8)
  if (opCode !== OP_DMX) return null
  const subUni = msg[14]
  const net = msg[15]
  const len = (msg[16] << 8) | msg[17]
  const data = msg.subarray(18, 18 + Math.min(len, 512))
  return { universe: ((net & 0x7f) << 8) | subUni, data }
}

/** Node info parsed from an ArtPollReply. */
export function parsePollReply(msg: Buffer, fallbackIp: string): ArtNetNode | null {
  if (msg.length < 26 || !msg.subarray(0, 8).equals(HEADER)) return null
  if (msg.readUInt16LE(8) !== OP_POLL_REPLY) return null
  const ip = msg.length >= 14 ? `${msg[10]}.${msg[11]}.${msg[12]}.${msg[13]}` : fallbackIp
  const shortName = msg.length >= 44 ? msg.subarray(26, 44).toString('ascii').replace(/\0.*$/, '') : ''
  const longName = msg.length >= 108 ? msg.subarray(44, 108).toString('ascii').replace(/\0.*$/, '') : ''
  return { ip, shortName, longName }
}

export function buildArtPoll(): Buffer {
  const b = Buffer.alloc(14)
  HEADER.copy(b, 0)
  b.writeUInt16LE(OP_POLL, 8)
  b[10] = 0 // ProtVerHi
  b[11] = 14 // ProtVerLo
  b[12] = 0 // TalkToMe
  b[13] = 0 // Priority
  return b
}

export class ArtNetListener {
  private socket: dgram.Socket | null = null
  private universes = new Map<number, UniverseState>()
  private nodes = new Map<string, ArtNetNode>()
  private pollTimer: NodeJS.Timeout | null = null
  private onFrame: ((u: number, data: Buffer) => void) | null = null

  start(onFrame?: (universe: number, data: Buffer) => void): void {
    if (this.socket) return
    this.onFrame = onFrame ?? null
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    sock.on('message', (msg, rinfo) => {
      const dmx = parseArtDmx(msg)
      if (dmx) {
        const now = Date.now()
        let st = this.universes.get(dmx.universe)
        if (!st) {
          st = { sourceIp: rinfo.address, lastAt: now, data: Buffer.alloc(512), frames: 0, fps: 0, windowStart: now }
          this.universes.set(dmx.universe, st)
        }
        dmx.data.copy(st.data, 0)
        st.sourceIp = rinfo.address
        st.lastAt = now
        st.frames++
        if (now - st.windowStart >= 2000) {
          st.fps = Math.round((st.frames * 1000) / (now - st.windowStart))
          st.frames = 0
          st.windowStart = now
        }
        this.onFrame?.(dmx.universe, st.data)
        return
      }
      const node = parsePollReply(msg, rinfo.address)
      if (node) this.nodes.set(node.ip, node)
    })
    sock.on('error', (err) => console.error('[artnet] socket error', err.message))
    sock.bind(ARTNET_PORT, () => {
      try {
        sock.setBroadcast(true)
      } catch {
        /* if the platform doesn't allow it, discovery still works passively */
      }
      this.sendPoll()
    })
    this.socket = sock
    this.pollTimer = setInterval(() => this.sendPoll(), 8000)
  }

  private sendPoll(): void {
    const poll = buildArtPoll()
    const targets = new Set<string>(['255.255.255.255'])
    for (const ifaces of Object.values(os.networkInterfaces())) {
      for (const inf of ifaces ?? []) {
        if (inf.family === 'IPv4' && !inf.internal) {
          const ip = inf.address.split('.').map(Number)
          const mask = inf.netmask.split('.').map(Number)
          targets.add(ip.map((o, i) => o | (~mask[i] & 0xff)).join('.'))
        }
      }
    }
    for (const t of targets) {
      this.socket?.send(poll, ARTNET_PORT, t, () => {})
    }
  }

  /** Universes seen (entries older than 10s are dropped). */
  list(): SeenUniverse[] {
    const now = Date.now()
    const out: SeenUniverse[] = []
    for (const [universe, st] of this.universes) {
      if (now - st.lastAt > 10_000) continue
      out.push({
        universe,
        sourceIp: st.sourceIp,
        fps: st.fps,
        lastAt: st.lastAt,
        channels: st.data.length
      })
    }
    return out.sort((a, b) => a.universe - b.universe)
  }

  listNodes(): ArtNetNode[] {
    return [...this.nodes.values()]
  }

  /** The universe's latest frame (a copy) — for preview and the output engine. */
  frameOf(universe: number): { data: Buffer; lastAt: number } | null {
    const st = this.universes.get(universe)
    return st ? { data: Buffer.from(st.data), lastAt: st.lastAt } : null
  }

  stop(): void {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = null
    this.socket?.close()
    this.socket = null
  }
}
