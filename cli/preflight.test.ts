import { describe, expect, it } from 'vitest'
import { runPreflightChecks, type DevicePreflight } from './doctor'

const linux = { platform: 'linux' as NodeJS.Platform, username: 'ayse' }

function device(over: Partial<DevicePreflight> = {}): DevicePreflight {
  return { path: '/dev/ttyUSB0', uid: '0403:6001:A1', exists: true, accessible: true, group: 'dialout', inGroup: true, ...over }
}

describe('runPreflightChecks', () => {
  it('reports when no device is present at all', () => {
    const issues = runPreflightChecks({ ...linux, devices: [] })
    expect(issues).toHaveLength(1)
    expect(issues[0]!.level).toBe('error')
    expect(issues[0]!.message).toContain('No USB serial device found')
  })

  it('passes clean when the port is usable', () => {
    expect(runPreflightChecks({ ...linux, devices: [device()] })).toEqual([])
  })

  it('reports a vanished device node', () => {
    const issues = runPreflightChecks({ ...linux, devices: [device({ exists: false, accessible: false })] })
    expect(issues[0]!.message).toContain('no longer exists')
  })

  it('gives the exact fix command when permission is denied', () => {
    const issues = runPreflightChecks({ ...linux, devices: [device({ accessible: false, inGroup: false })] })
    expect(issues).toHaveLength(1)
    expect(issues[0]!.level).toBe('error')
    expect(issues[0]!.message).toContain('permission denied')
    expect(issues[0]!.message).toContain('sudo usermod -aG dialout ayse')
    expect(issues[0]!.message).toContain('Do not run ArtNet2USB with sudo')
  })

  it('does not suggest a group fix off Linux', () => {
    const issues = runPreflightChecks({
      platform: 'darwin',
      username: 'ayse',
      devices: [device({ path: '/dev/tty.usbserial', accessible: false, group: undefined, inGroup: undefined })]
    })
    expect(issues[0]!.message).toContain('permission denied')
    expect(issues[0]!.message).not.toContain('usermod')
  })

  it('warns when access works but group membership is missing', () => {
    // udev rule / ACL grants access today, but it will break on a rebuild.
    const issues = runPreflightChecks({ ...linux, devices: [device({ inGroup: false })] })
    expect(issues).toHaveLength(1)
    expect(issues[0]!.level).toBe('warning')
    expect(issues[0]!.message).toContain('not in the "dialout" group')
  })

  it('reports a port held by another process', () => {
    const issues = runPreflightChecks({
      ...linux,
      devices: [device({ openProblem: { kind: 'busy', path: '/dev/ttyUSB0' } })]
    })
    expect(issues[0]!.level).toBe('error')
    expect(issues[0]!.message).toContain('already open in another process')
  })

  it('checks every device independently', () => {
    const issues = runPreflightChecks({
      ...linux,
      devices: [device(), device({ path: '/dev/ttyUSB1', accessible: false, inGroup: false })]
    })
    expect(issues).toHaveLength(1)
    expect(issues[0]!.message).toContain('/dev/ttyUSB1')
  })
})
