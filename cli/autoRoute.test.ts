import { describe, it, expect } from 'vitest'
import { pickAutoRoute, resolveAutoRouteFields } from './autoRoute'
import type { RouteConfig, SeenUniverse, UsbDevice } from '../shared/types'

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

const existingRoute = (over: Partial<RouteConfig> = {}): RouteConfig => ({
  id: 'auto',
  universe: 0,
  deviceUid: 'dev-1',
  protocol: 'open-dmx',
  hz: 40,
  channelOffset: 1,
  enabled: true,
  ...over
})

describe('resolveAutoRouteFields', () => {
  it('mevcut rota yoksa varsayılanları kullanır (open-dmx, 40Hz, offset 0)', () => {
    expect(resolveAutoRouteFields(undefined, {})).toEqual({ protocol: 'open-dmx', hz: 40, channelOffset: 0 })
  })

  it('bayrak elle verilmediyse mevcut rotanın değerini korur — regresyon: servis restart channelOffset\'i sıfırlamamalı', () => {
    const r = resolveAutoRouteFields(existingRoute({ channelOffset: 1, protocol: 'enttec-pro', hz: 30 }), {})
    expect(r).toEqual({ protocol: 'enttec-pro', hz: 30, channelOffset: 1 })
  })

  it('bayrak elle verildiyse mevcut rotayı ezer', () => {
    const r = resolveAutoRouteFields(existingRoute({ channelOffset: 1 }), { channelOffset: 9 })
    expect(r.channelOffset).toBe(9)
  })

  it('mevcut rotada channelOffset tanımsızsa 0 varsayılanına düşer', () => {
    const r = resolveAutoRouteFields(existingRoute({ channelOffset: undefined }), {})
    expect(r.channelOffset).toBe(0)
  })
})
