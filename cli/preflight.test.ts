import { describe, expect, it } from 'vitest'
import { isUsbSerialCandidate, runPreflightChecks, type DevicePreflight } from './doctor'

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

describe('isUsbSerialCandidate', () => {
  it('accepts ports that report USB ids', () => {
    expect(isUsbSerialCandidate({ path: '/dev/ttyUSB0', vendorId: '0403', productId: '6001' })).toBe(true)
  })

  it('accepts USB paths even without ids', () => {
    expect(isUsbSerialCandidate({ path: '/dev/ttyACM0' })).toBe(true)
    expect(isUsbSerialCandidate({ path: '/dev/tty.usbserial-A1' })).toBe(true)
  })

  it('rejects legacy COM ports', () => {
    // /dev/ttyS0..3 exist on nearly every PC and are root-owned; including them
    // buried the real diagnosis under irrelevant failures.
    expect(isUsbSerialCandidate({ path: '/dev/ttyS0' })).toBe(false)
    expect(isUsbSerialCandidate({ path: '/dev/ttyS3' })).toBe(false)
  })
})

describe('root group is never suggested', () => {
  it('does not warn about joining a non-serial group', () => {
    const issues = runPreflightChecks({
      ...linux,
      devices: [device({ path: '/dev/ttyS0', group: 'root', inGroup: false })]
    })
    expect(issues).toEqual([])
  })
})

describe('open probe severity', () => {
  it('treats a baud-rate quirk as a warning, not a failure', () => {
    const issues = runPreflightChecks({
      ...linux,
      devices: [device({ openProblem: { kind: 'unknown', path: '/dev/ttyUSB0', detail: 'Error: Input/output error setting custom baud rate of 57600.' } })]
    })
    expect(issues).toHaveLength(1)
    expect(issues[0]!.level).toBe('warning')
  })

  it('still fails hard on a denied open', () => {
    const issues = runPreflightChecks({
      ...linux,
      devices: [device({ openProblem: { kind: 'permission', path: '/dev/ttyUSB0', detail: 'EACCES' } })]
    })
    expect(issues[0]!.level).toBe('error')
  })
})
