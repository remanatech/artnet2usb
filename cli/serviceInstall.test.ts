import { describe, it, expect } from 'vitest'
import { buildLaunchdPlist, buildSystemdUnit } from './serviceInstall'
import type { ServiceOpts } from './serviceInstall'

const opts: ServiceOpts = {
  nodePath: '/usr/local/bin/node',
  scriptPath: '/opt/artnet2usb/dist-cli/cli/index.js',
  args: ['auto', '--config', '/etc/artnet2usb'],
  user: 'pi',
  label: 'tech.remana.relackout.artnet2usb-cli'
}

describe('buildLaunchdPlist', () => {
  it('label, node yolu ve tüm argümanları içerir', () => {
    const plist = buildLaunchdPlist(opts)
    expect(plist).toContain('<string>tech.remana.relackout.artnet2usb-cli</string>')
    expect(plist).toContain('<string>/usr/local/bin/node</string>')
    expect(plist).toContain('<string>/opt/artnet2usb/dist-cli/cli/index.js</string>')
    expect(plist).toContain('<string>auto</string>')
    expect(plist).toContain('<string>--config</string>')
    expect(plist).toContain('<string>/etc/artnet2usb</string>')
  })

  it('RunAtLoad ve KeepAlive true olarak ayarlanır', () => {
    const plist = buildLaunchdPlist(opts)
    const runAtLoadIdx = plist.indexOf('RunAtLoad')
    const keepAliveIdx = plist.indexOf('KeepAlive')
    expect(plist.slice(runAtLoadIdx, runAtLoadIdx + 40)).toContain('<true/>')
    expect(plist.slice(keepAliveIdx, keepAliveIdx + 40)).toContain('<true/>')
  })

  it('XML özel karakterlerini escape eder', () => {
    const plist = buildLaunchdPlist({ ...opts, args: ['--config', '/tmp/a & b'] })
    expect(plist).toContain('/tmp/a &amp; b')
  })
})

describe('buildSystemdUnit', () => {
  it('User, ExecStart ve Restart=always içerir', () => {
    const unit = buildSystemdUnit(opts)
    expect(unit).toContain('User=pi')
    expect(unit).toContain("ExecStart='/usr/local/bin/node' '/opt/artnet2usb/dist-cli/cli/index.js' 'auto' '--config' '/etc/artnet2usb'")
    expect(unit).toContain('Restart=always')
    expect(unit).toContain('WantedBy=multi-user.target')
  })

  it("tek tırnak içeren argümanları güvenle shell-quote'lar", () => {
    const unit = buildSystemdUnit({ ...opts, args: ["it's-a-test"] })
    expect(unit).toContain(`'it'\\''s-a-test'`)
  })
})
