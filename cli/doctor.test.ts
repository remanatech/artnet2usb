import { describe, it, expect } from 'vitest'
import { runDoctorChecks } from './doctor'
import type { RouteConfig, UsbDevice } from '../shared/types'

const route = (over: Partial<RouteConfig> = {}): RouteConfig => ({
  id: 'r1',
  universe: 1,
  deviceUid: 'dev-1',
  protocol: 'enttec-pro',
  hz: 40,
  enabled: true,
  ...over
})
const device = (uid: string): UsbDevice => ({ uid, path: `/dev/${uid}`, connected: true })

describe('runDoctorChecks', () => {
  it('sorun yoksa boş liste döner', () => {
    expect(runDoctorChecks([route()], [device('dev-1')])).toEqual([])
  })

  it('devre dışı rotaları görmezden gelir', () => {
    expect(runDoctorChecks([route({ enabled: false, deviceUid: 'missing' })], [])).toEqual([])
  })

  it('bağlı olmayan cihazı hata olarak bildirir', () => {
    const issues = runDoctorChecks([route({ deviceUid: 'missing' })], [device('dev-1')])
    expect(issues).toHaveLength(1)
    expect(issues[0].level).toBe('error')
    expect(issues[0].message).toMatch(/not currently connected/)
  })

  it('aralık dışı hz değerini hata olarak bildirir', () => {
    const issues = runDoctorChecks([route({ hz: 99 })], [device('dev-1')])
    expect(issues.some((i) => i.level === 'error' && /hz/.test(i.message))).toBe(true)
  })

  it('çakışan universe için uyarı verir', () => {
    const issues = runDoctorChecks(
      [route({ id: 'r1', deviceUid: 'dev-1' }), route({ id: 'r2', deviceUid: 'dev-2', universe: 1 })],
      [device('dev-1'), device('dev-2')]
    )
    expect(issues.some((i) => i.level === 'warning' && /Universe 1/.test(i.message))).toBe(true)
  })

  it('aynı cihaza atanmış birden fazla rota için uyarı verir', () => {
    const issues = runDoctorChecks(
      [route({ id: 'r1', universe: 1 }), route({ id: 'r2', universe: 2 })],
      [device('dev-1')]
    )
    expect(issues.some((i) => i.level === 'warning' && /dev-1/.test(i.message))).toBe(true)
  })

  it('aralık dışı channelOffset değerini hata olarak bildirir', () => {
    const issues = runDoctorChecks([route({ channelOffset: 600 })], [device('dev-1')])
    expect(issues.some((i) => i.level === 'error' && /channelOffset/.test(i.message))).toBe(true)
  })

  it('channelOffset tanımsızsa (varsayılan 0) sorun bildirmez', () => {
    expect(runDoctorChecks([route()], [device('dev-1')])).toEqual([])
  })

  it('geçerli negatif channelOffset sorun bildirmez', () => {
    expect(runDoctorChecks([route({ channelOffset: -3 })], [device('dev-1')])).toEqual([])
  })

  it('aralık dışı negatif channelOffset değerini hata olarak bildirir', () => {
    const issues = runDoctorChecks([route({ channelOffset: -600 })], [device('dev-1')])
    expect(issues.some((i) => i.level === 'error' && /channelOffset/.test(i.message))).toBe(true)
  })
})
