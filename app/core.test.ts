import { describe, it, expect } from 'vitest'
import { buildArtPoll, parseArtDmx, parsePollReply } from './artnet'
import { applyChannelOffset, buildEnttecFrame, deviceUid } from './dmxOutput'

function makeArtDmx(universe: number, data: number[]): Buffer {
  const b = Buffer.alloc(18 + data.length)
  b.write('Art-Net\0', 0, 'ascii')
  b.writeUInt16LE(0x5000, 8)
  b[10] = 0
  b[11] = 14
  b[12] = 0 // seq
  b[13] = 0 // phys
  b[14] = universe & 0xff
  b[15] = (universe >> 8) & 0x7f
  b[16] = (data.length >> 8) & 0xff
  b[17] = data.length & 0xff
  Buffer.from(data).copy(b, 18)
  return b
}

describe('Art-Net parser', () => {
  it('ArtDMX paketini çözer (universe + veri)', () => {
    const pkt = makeArtDmx(3, [255, 128, 0, 42])
    const r = parseArtDmx(pkt)
    expect(r?.universe).toBe(3)
    expect([...r!.data]).toEqual([255, 128, 0, 42])
  })

  it('15-bit port adresini (Net<<8|SubUni) doğru birleştirir', () => {
    const pkt = makeArtDmx(0x0203, [1])
    expect(parseArtDmx(pkt)?.universe).toBe(0x0203)
  })

  it('Art-Net olmayan / ArtDMX olmayan paketleri reddeder', () => {
    expect(parseArtDmx(Buffer.from('hello world, not artnet'))).toBeNull()
    expect(parseArtDmx(buildArtPoll())).toBeNull()
  })

  it('ArtPoll paketi geçerli başlık ve opcode taşır', () => {
    const p = buildArtPoll()
    expect(p.subarray(0, 8).toString('ascii')).toBe('Art-Net\0')
    expect(p.readUInt16LE(8)).toBe(0x2000)
  })

  it('ArtPollReply node bilgisini çözer', () => {
    const b = Buffer.alloc(240)
    b.write('Art-Net\0', 0, 'ascii')
    b.writeUInt16LE(0x2100, 8)
    b[10] = 192; b[11] = 168; b[12] = 1; b[13] = 50
    b.write('Node-A\0', 26, 'ascii')
    b.write('Uzun Ad Node A\0', 44, 'ascii')
    const n = parsePollReply(b, '10.0.0.9')
    expect(n).toEqual({ ip: '192.168.1.50', shortName: 'Node-A', longName: 'Uzun Ad Node A' })
  })
})

describe('DMX çıkışı', () => {
  it('Enttec Pro çerçevesi spec ile birebir', () => {
    const dmx = Buffer.alloc(512)
    dmx[0] = 255
    dmx[511] = 7
    const f = buildEnttecFrame(dmx)
    expect(f[0]).toBe(0x7e)
    expect(f[1]).toBe(6)
    expect(f.readUInt16LE(2)).toBe(513) // startcode + 512
    expect(f[4]).toBe(0) // start code
    expect(f[5]).toBe(255) // kanal 1
    expect(f[4 + 512]).toBe(7) // kanal 512
    expect(f[f.length - 1]).toBe(0xe7)
    expect(f.length).toBe(513 + 5)
  })

  it('kısa kare 512 kanala sıfır dolgulanır', () => {
    const f = buildEnttecFrame(Buffer.from([9]))
    expect(f.readUInt16LE(2)).toBe(513)
    expect(f[5]).toBe(9)
    expect(f[6]).toBe(0)
  })

  it('cihaz kimliği: seri no varsa yol değişse de sabit kalır', () => {
    const a = deviceUid({ vendorId: '0403', productId: '6001', serialNumber: 'A1B2C3', path: '/dev/ttyUSB0' })
    const b = deviceUid({ vendorId: '0403', productId: '6001', serialNumber: 'A1B2C3', path: 'COM7' })
    expect(a).toBe(b)
    expect(a).toBe('0403:6001:A1B2C3')
  })

  it('seri no yoksa yol kimliğe girer (en iyi çaba)', () => {
    expect(deviceUid({ vendorId: '0403', productId: '6001', path: 'COM3' })).toBe('0403:6001:COM3')
  })
})

describe('applyChannelOffset (kanal başlangıç/patch offset)', () => {
  it('offset 0 ise buffer\'ı olduğu gibi döner', () => {
    const dmx = Buffer.from([255, 128, 64])
    expect(applyChannelOffset(dmx, 0)).toBe(dmx)
  })

  it('offset verilince ilk N bayt karanlık kalır, veri sağa kayar', () => {
    const dmx = Buffer.alloc(512)
    dmx[0] = 255
    dmx[1] = 128
    const shifted = applyChannelOffset(dmx, 5)
    expect(shifted.length).toBe(512)
    expect([...shifted.subarray(0, 5)]).toEqual([0, 0, 0, 0, 0])
    expect(shifted[5]).toBe(255)
    expect(shifted[6]).toBe(128)
  })

  it('offset + veri 512\'yi aşarsa taşan kısım kırpılır', () => {
    const dmx = Buffer.alloc(10).fill(9)
    const shifted = applyChannelOffset(dmx, 510)
    expect(shifted.length).toBe(512)
    expect(shifted[510]).toBe(9)
    expect(shifted[511]).toBe(9)
  })

  it('negatif offset dokunmadan orijinali döner', () => {
    const dmx = Buffer.from([1, 2, 3])
    expect(applyChannelOffset(dmx, -1)).toBe(dmx)
  })
})
