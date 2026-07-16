import type { RouteConfig, UsbDevice } from '../shared/types'

export interface DoctorIssue {
  level: 'error' | 'warning'
  message: string
}

/**
 * `doctor` komutunun karar mantığı: config.json içindeki etkin rotaları,
 * o an bağlı USB cihazlarına karşı çapraz kontrol eder. Saf — gerçek dosya
 * sistemi/donanım erişimi çağıran tarafta (cli/index.ts) yapılır.
 */
export function runDoctorChecks(routes: RouteConfig[], devices: UsbDevice[]): DoctorIssue[] {
  const issues: DoctorIssue[] = []
  const connectedUids = new Set(devices.map((d) => d.uid))
  const enabled = routes.filter((r) => r.enabled)

  for (const r of enabled) {
    if (!connectedUids.has(r.deviceUid)) {
      issues.push({ level: 'error', message: `Route "${r.id}" (universe ${r.universe}): device ${r.deviceUid} is not currently connected.` })
    }
    if (!Number.isInteger(r.hz) || r.hz < 1 || r.hz > 44) {
      issues.push({ level: 'error', message: `Route "${r.id}": hz ${r.hz} is out of range (1-44).` })
    }
    const offset = r.channelOffset ?? 0
    if (!Number.isInteger(offset) || offset < 0 || offset > 511) {
      issues.push({ level: 'error', message: `Route "${r.id}": channelOffset ${offset} is out of range (0-511).` })
    }
  }

  const byUniverse = new Map<number, RouteConfig[]>()
  for (const r of enabled) byUniverse.set(r.universe, [...(byUniverse.get(r.universe) ?? []), r])
  for (const [universe, list] of byUniverse) {
    if (list.length > 1) {
      issues.push({ level: 'warning', message: `Universe ${universe} is routed by ${list.length} enabled routes: ${list.map((r) => r.id).join(', ')}.` })
    }
  }

  const byDevice = new Map<string, RouteConfig[]>()
  for (const r of enabled) byDevice.set(r.deviceUid, [...(byDevice.get(r.deviceUid) ?? []), r])
  for (const [deviceUid, list] of byDevice) {
    if (list.length > 1) {
      issues.push({ level: 'warning', message: `Device ${deviceUid} is targeted by ${list.length} enabled routes: ${list.map((r) => r.id).join(', ')}.` })
    }
  }

  return issues
}
