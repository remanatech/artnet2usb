import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolvePortableConfigDir, isWritableDir } from './portableConfig'

describe('resolvePortableConfigDir', () => {
  let exeDir: string
  let fallback: string

  beforeEach(() => {
    exeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'artnet2usb-exe-'))
    fallback = fs.mkdtempSync(path.join(os.tmpdir(), 'artnet2usb-fallback-'))
  })

  afterEach(() => {
    fs.chmodSync(exeDir, 0o755)
    fs.rmSync(exeDir, { recursive: true, force: true })
    fs.rmSync(fallback, { recursive: true, force: true })
  })

  it('exe dizini bilinmiyorsa (dev modu) fallback kullanılır', () => {
    expect(resolvePortableConfigDir(null, fallback)).toBe(fallback)
  })

  it('exe yanında config.json varsa her zaman exe dizini kazanır', () => {
    fs.writeFileSync(path.join(exeDir, 'config.json'), '{}')
    expect(resolvePortableConfigDir(exeDir, fallback)).toBe(exeDir)
  })

  it('exe yanında config yoksa ama dizin yazılabilirse exe dizini seçilir', () => {
    expect(resolvePortableConfigDir(exeDir, fallback)).toBe(exeDir)
  })

  it('exe dizini salt-okunursa fallback kullanılır', () => {
    fs.chmodSync(exeDir, 0o555)
    expect(resolvePortableConfigDir(exeDir, fallback)).toBe(fallback)
  })

  it('exe yanında config.json varsa salt-okunur dizin bile kazanır (okuma yeterli)', () => {
    fs.writeFileSync(path.join(exeDir, 'config.json'), '{}')
    fs.chmodSync(exeDir, 0o555)
    expect(resolvePortableConfigDir(exeDir, fallback)).toBe(exeDir)
  })
})

describe('isWritableDir', () => {
  it('yazılabilir dizinde true, salt-okunur dizinde false döner', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'artnet2usb-w-'))
    expect(isWritableDir(dir)).toBe(true)
    fs.chmodSync(dir, 0o555)
    expect(isWritableDir(dir)).toBe(false)
    fs.chmodSync(dir, 0o755)
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
