import { describe, expect, it } from 'vitest'
import {
  buildFixCommand,
  classifySerialError,
  describeSerialProblem,
  groupNameFromEtcGroup,
  planPermissionFix
} from './serialPermissions'

describe('classifySerialError', () => {
  it('recognises permission denials', () => {
    expect(classifySerialError(Object.assign(new Error('open failed'), { code: 'EACCES' }))).toBe('permission')
    expect(classifySerialError(Object.assign(new Error('nope'), { code: 'EPERM' }))).toBe('permission')
    // serialport surfaces the code inside the message on some platforms
    expect(classifySerialError(new Error("EACCES: permission denied, open '/dev/ttyUSB0'"))).toBe('permission')
  })

  it('recognises a port held by another process', () => {
    expect(classifySerialError(Object.assign(new Error('busy'), { code: 'EBUSY' }))).toBe('busy')
    expect(classifySerialError(new Error('Error: Cannot lock port'))).toBe('busy')
  })

  it('recognises a vanished device', () => {
    expect(classifySerialError(Object.assign(new Error('gone'), { code: 'ENOENT' }))).toBe('missing')
    expect(classifySerialError(Object.assign(new Error('gone'), { code: 'ENXIO' }))).toBe('missing')
  })

  it('falls back to unknown', () => {
    expect(classifySerialError(new Error('something else'))).toBe('unknown')
    expect(classifySerialError(null)).toBe('unknown')
  })
})

describe('buildFixCommand', () => {
  it('produces the documented usermod command', () => {
    expect(buildFixCommand('dialout', 'ayse')).toBe('sudo usermod -aG dialout ayse')
  })
})

describe('groupNameFromEtcGroup', () => {
  const etc = ['root:x:0:', 'dialout:x:20:ayse,mehmet', 'plugdev:x:46:', 'broken-line'].join('\n')

  it('maps a gid to its group name', () => {
    expect(groupNameFromEtcGroup(etc, 20)).toBe('dialout')
    expect(groupNameFromEtcGroup(etc, 46)).toBe('plugdev')
  })

  it('returns null for an unknown gid', () => {
    expect(groupNameFromEtcGroup(etc, 999)).toBeNull()
  })
})

describe('describeSerialProblem', () => {
  const ctx = { platform: 'linux' as NodeJS.Platform, username: 'ayse' }

  it('keeps the real cause and gives the one-command fix', () => {
    const out = describeSerialProblem(
      { kind: 'permission', path: '/dev/ttyUSB0', group: 'dialout', detail: "EACCES: permission denied, open '/dev/ttyUSB0'" },
      ctx
    )
    const text = out.lines.join('\n')
    // The generic "device not connected" wording must never come back.
    expect(text).toContain('Device detected at /dev/ttyUSB0 but permission was denied.')
    expect(text).toContain("EACCES: permission denied, open '/dev/ttyUSB0'")
    expect(text).toContain('sudo usermod -aG dialout ayse')
    expect(text).toContain('log out and log back in')
    expect(text).toContain('Do not run ArtNet2USB itself with sudo.')
    expect(out.fixCommand).toBe('sudo usermod -aG dialout ayse')
  })

  it('does not suggest group changes off Linux', () => {
    const out = describeSerialProblem({ kind: 'permission', path: '/dev/tty.usbserial', detail: 'EACCES' }, {
      platform: 'darwin',
      username: 'ayse'
    })
    expect(out.fixCommand).toBeNull()
    expect(out.lines.join('\n')).not.toContain('usermod')
  })

  it('explains a busy port without offering a permission fix', () => {
    const out = describeSerialProblem({ kind: 'busy', path: '/dev/ttyUSB0' }, ctx)
    expect(out.title).toBe('Serial port is busy')
    expect(out.lines.join('\n')).toContain('already open in another process')
    expect(out.fixCommand).toBeNull()
  })
})

describe('planPermissionFix', () => {
  it('does nothing off Linux', () => {
    const plan = planPermissionFix({ platform: 'darwin', username: 'ayse', elevator: 'pkexec' })
    expect(plan.needed).toBe(false)
    expect(plan.argv).toBeNull()
  })

  it('does nothing when the user is already in the group', () => {
    const plan = planPermissionFix({ platform: 'linux', username: 'ayse', group: 'dialout', inGroup: true, elevator: 'pkexec' })
    expect(plan.needed).toBe(false)
    expect(plan.argv).toBeNull()
  })

  it('elevates only usermod via pkexec for the GUI', () => {
    const plan = planPermissionFix({ platform: 'linux', username: 'ayse', group: 'dialout', inGroup: false, elevator: 'pkexec' })
    expect(plan.needed).toBe(true)
    expect(plan.argv).toEqual(['pkexec', 'usermod', '-aG', 'dialout', 'ayse'])
    // The whole app is never launched as root.
    expect(plan.argv?.[0]).not.toBe('sudo')
  })

  it('uses sudo for the CLI', () => {
    const plan = planPermissionFix({ platform: 'linux', username: 'ayse', group: 'dialout', inGroup: false, elevator: 'sudo' })
    expect(plan.argv).toEqual(['sudo', 'usermod', '-aG', 'dialout', 'ayse'])
  })

  it('skips the elevator when already root', () => {
    const plan = planPermissionFix({
      platform: 'linux',
      username: 'ayse',
      group: 'dialout',
      inGroup: false,
      elevator: 'sudo',
      isRoot: true
    })
    expect(plan.argv).toEqual(['usermod', '-aG', 'dialout', 'ayse'])
  })

  it('defaults to dialout when the owning group is unknown', () => {
    const plan = planPermissionFix({ platform: 'linux', username: 'ayse', inGroup: false, elevator: 'sudo' })
    expect(plan.group).toBe('dialout')
    expect(plan.display).toBe('sudo usermod -aG dialout ayse')
  })
})
