import { describe, it, expect } from 'vitest'
import { pickAutoRoute } from './autoRoute'
import type { SeenUniverse, UsbDevice } from '../shared/types'

const universe = (n: number): SeenUniverse => ({ universe: n, sourceIp: '10.0.0.1', fps: 40, lastAt: Date.now(), channels: 512 })
const device = (uid: string, path = `/dev/tty.${uid}`): UsbDevice => ({ uid, path, connected: true })

describe('pickAutoRoute', () => {
  it('tam olarak 1 universe + 1 cihaz varsa eşleştirir', () => {
    const r = pickAutoRoute([universe(3)], [device('0403:6001:A1')])
    expect(r).toEqual({ universe: 3, deviceUid: '0403:6001:A1' })
  })

  it('hiçbir şey bulunamazsa açıklayıcı hata döner', () => {
    const r = pickAutoRoute([], [])
    expect('error' in r).toBe(true)
  })

  it('universe yoksa hata döner', () => {
    const r = pickAutoRoute([], [device('0403:6001:A1')])
    expect('error' in r && r.error).toMatch(/universe/i)
  })

  it('cihaz yoksa hata döner', () => {
    const r = pickAutoRoute([universe(3)], [])
    expect('error' in r && r.error).toMatch(/device/i)
  })

  it('birden fazla universe varsa belirsizlik hatası döner', () => {
    const r = pickAutoRoute([universe(3), universe(7)], [device('a')])
    expect('error' in r && r.error).toMatch(/universes/i)
  })

  it('birden fazla cihaz varsa belirsizlik hatası döner', () => {
    const r = pickAutoRoute([universe(3)], [device('a'), device('b')])
    expect('error' in r && r.error).toMatch(/devices/i)
  })
})
