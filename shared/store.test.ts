import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Store } from './store'
import type { RouteConfig } from './types'

const route: RouteConfig = {
  id: 'route-1',
  universe: 3,
  deviceUid: '0403:6001:A1B2C3',
  protocol: 'enttec-pro',
  hz: 40,
  enabled: true
}

describe('Store', () => {
  let dir: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'artnet2usb-store-'))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('config.json yokken varsayılan durumla başlar', () => {
    const store = new Store(dir)
    expect(store.deviceNames).toEqual({})
    expect(store.routes).toEqual([])
    expect(store.settings).toEqual({ onSignalLoss: 'hold', signalLossMs: 3000 })
  })

  it('upsertRoute: yeni rota ekler ve diske yazar', () => {
    const store = new Store(dir)
    store.upsertRoute(route)
    expect(store.routes).toEqual([route])
    const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'))
    expect(onDisk.routes).toEqual([route])
  })

  it('upsertRoute: aynı id ile çağrılırsa günceller (çoğaltmaz)', () => {
    const store = new Store(dir)
    store.upsertRoute(route)
    store.upsertRoute({ ...route, hz: 25 })
    expect(store.routes).toHaveLength(1)
    expect(store.routes[0].hz).toBe(25)
  })

  it('removeRoute: id ile rotayı kaldırır', () => {
    const store = new Store(dir)
    store.upsertRoute(route)
    store.removeRoute(route.id)
    expect(store.routes).toEqual([])
  })

  it('setDeviceName: isim atar ve boş isim verilirse siler', () => {
    const store = new Store(dir)
    store.setDeviceName('0403:6001:A1B2C3', 'Sahne Sol')
    expect(store.deviceNames['0403:6001:A1B2C3']).toBe('Sahne Sol')
    store.setDeviceName('0403:6001:A1B2C3', '  ')
    expect(store.deviceNames['0403:6001:A1B2C3']).toBeUndefined()
  })

  it('setSettings: sinyal kaybı ayarını günceller ve kalıcı kılar', () => {
    const store = new Store(dir)
    store.setSettings({ onSignalLoss: 'blackout', signalLossMs: 1000 })
    expect(store.settings).toEqual({ onSignalLoss: 'blackout', signalLossMs: 1000 })
  })

  it('kalıcılık: yeni bir Store örneği dosyadan aynı durumu okur', () => {
    const store1 = new Store(dir)
    store1.upsertRoute(route)
    store1.setDeviceName('0403:6001:A1B2C3', 'Sahne Sol')
    store1.setSettings({ onSignalLoss: 'blackout', signalLossMs: 500 })

    const store2 = new Store(dir)
    expect(store2.routes).toEqual([route])
    expect(store2.deviceNames).toEqual({ '0403:6001:A1B2C3': 'Sahne Sol' })
    expect(store2.settings).toEqual({ onSignalLoss: 'blackout', signalLossMs: 500 })
  })

  it('bozuk/eksik config.json karşısında varsayılanlara düşer (çökmez)', () => {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'config.json'), '{ not valid json')
    const store = new Store(dir)
    expect(store.routes).toEqual([])
    expect(store.deviceNames).toEqual({})
  })
})
