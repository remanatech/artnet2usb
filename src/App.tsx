import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppState, RouteConfig, RouteStatus, SeenUniverse, UsbDevice } from '../shared/types'

declare global {
  interface Window {
    artnet2usb: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
      onPreviewFrame: (cb: (universe: number, data: number[]) => void) => () => void
    }
  }
}

const api = {
  state: () => window.artnet2usb.invoke('state:get') as Promise<AppState>,
  rename: (uid: string, name: string) => window.artnet2usb.invoke('devices:rename', uid, name) as Promise<AppState>,
  upsertRoute: (r: RouteConfig) => window.artnet2usb.invoke('routes:upsert', r) as Promise<AppState>,
  removeRoute: (id: string) => window.artnet2usb.invoke('routes:remove', id) as Promise<AppState>,
  startRoute: (id: string) => window.artnet2usb.invoke('routes:start', id) as Promise<AppState>,
  stopRoute: (id: string) => window.artnet2usb.invoke('routes:stop', id) as Promise<AppState>,
  setSettings: (s: AppState['settings']) => window.artnet2usb.invoke('settings:set', s) as Promise<AppState>,
  setPreview: (u: number | null) => window.artnet2usb.invoke('preview:set', u),
  openExternal: (url: string) => window.artnet2usb.invoke('app:openExternal', url)
}

export default function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [preview, setPreview] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setState(await api.state())
    } catch {
      /* ana süreç henüz hazır değilse sonraki tur */
    }
  }, [])

  useEffect(() => {
    void refresh()
    const t = setInterval(() => void refresh(), 1500)
    return () => clearInterval(t)
  }, [refresh])

  const run = async (fn: () => Promise<AppState>) => {
    try {
      setError(null)
      setState(await fn())
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : String(e))
    }
  }

  if (!state) {
    return <div className="flex h-full items-center justify-center text-slate-500">…</div>
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border-dark px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-black tracking-tight text-primary">ArtNet 2 USB</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Relackout</span>
        </div>
        <SettingsBar settings={state.settings} onChange={(s) => void run(() => api.setSettings(s))} />
      </header>

      {error && (
        <div className="mx-4 mt-2 flex items-center justify-between rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-300">
          <span>{error}</span>
          <button className="font-mono" onClick={() => setError(null)}>x</button>
        </div>
      )}

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 lg:grid-cols-2">
        <section className="flex min-h-0 flex-col gap-3">
          <UniversePanel
            universes={state.universes}
            nodeCount={state.nodes.length}
            preview={preview}
            onPreview={(u) => {
              setPreview(u)
              void api.setPreview(u)
            }}
          />
          {preview != null && <PreviewGrid universe={preview} onClose={() => { setPreview(null); void api.setPreview(null) }} />}
        </section>
        <section className="flex min-h-0 flex-col gap-3">
          <DevicePanel devices={state.devices} onRename={(uid, name) => void run(() => api.rename(uid, name))} />
          <RoutePanel
            routes={state.routes}
            universes={state.universes}
            devices={state.devices}
            onUpsert={(r) => void run(() => api.upsertRoute(r))}
            onRemove={(id) => void run(() => api.removeRoute(id))}
            onStart={(id) => void run(() => api.startRoute(id))}
            onStop={(id) => void run(() => api.stopRoute(id))}
          />
        </section>
      </main>

      <footer className="flex items-center justify-between border-t border-border-dark px-4 py-2 text-[11px] text-slate-500">
        <span>Ücretsiz araç — sahne otomasyonunun tamamı için</span>
        <button
          className="font-bold text-primary hover:underline"
          onClick={() => void api.openExternal('https://relackout.com')}
        >
          relackout.com →
        </button>
      </footer>
    </div>
  )
}

function SettingsBar({ settings, onChange }: { settings: AppState['settings']; onChange: (s: AppState['settings']) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="label">Sinyal kesilince</span>
      <select
        className="input"
        value={settings.onSignalLoss}
        onChange={(e) => onChange({ ...settings, onSignalLoss: e.target.value as 'hold' | 'blackout' })}
      >
        <option value="hold">Son kareyi tut</option>
        <option value="blackout">Karart</option>
      </select>
    </div>
  )
}

function UniversePanel({
  universes,
  nodeCount,
  preview,
  onPreview
}: {
  universes: SeenUniverse[]
  nodeCount: number
  preview: number | null
  onPreview: (u: number | null) => void
}) {
  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="label">Art-Net Yayınları</p>
        <span className="text-[10px] text-slate-500">
          {universes.length} yayın · {nodeCount} node
        </span>
      </div>
      {universes.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-500">
          Ağda Art-Net yayını görünmüyor — konsolunuz/yazılımınız UDP 6454'e yayın yapıyor mu?
        </p>
      ) : (
        <div className="space-y-1">
          {universes.map((u) => (
            <div
              key={u.universe}
              className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs ${
                preview === u.universe ? 'border-primary/60 bg-primary/10' : 'border-border-dark bg-background-dark/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-primary">U{u.universe}</span>
                <span className="text-slate-400">{u.sourceIp}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-slate-500">{u.fps} fps</span>
                <button
                  className="btn px-2 py-1"
                  onClick={() => onPreview(preview === u.universe ? null : u.universe)}
                >
                  {preview === u.universe ? 'Kapat' : 'Önizle'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PreviewGrid({ universe, onClose }: { universe: number; onClose: () => void }) {
  const [frame, setFrame] = useState<number[]>(() => new Array(512).fill(0))
  useEffect(() => {
    return window.artnet2usb.onPreviewFrame((u, data) => {
      if (u === universe) setFrame(data.length >= 512 ? data : [...data, ...new Array(512 - data.length).fill(0)])
    })
  }, [universe])
  const nonZero = frame.filter((v) => v > 0).length
  return (
    <div className="card flex min-h-0 flex-1 flex-col p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="label">Önizleme — Universe {universe}</p>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span>{nonZero} aktif kanal</span>
          <button className="btn px-2 py-0.5" onClick={onClose}>Kapat</button>
        </div>
      </div>
      <div className="grid flex-1 content-start gap-px overflow-y-auto" style={{ gridTemplateColumns: 'repeat(32, minmax(0, 1fr))' }}>
        {frame.map((v, i) => (
          <div
            key={i}
            title={`Kanal ${i + 1}: ${v}`}
            className="aspect-square rounded-[2px]"
            style={{ backgroundColor: v > 0 ? `rgba(37, 185, 244, ${0.15 + (v / 255) * 0.85})` : 'rgba(148, 163, 184, 0.08)' }}
          />
        ))}
      </div>
    </div>
  )
}

function DevicePanel({ devices, onRename }: { devices: UsbDevice[]; onRename: (uid: string, name: string) => void }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])
  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="label">USB Cihazları</p>
        <span className="text-[10px] text-slate-500">{devices.filter((d) => d.connected).length} bağlı</span>
      </div>
      {devices.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-500">USB seri cihaz bulunamadı.</p>
      ) : (
        <div className="space-y-1">
          {devices.map((d) => (
            <div
              key={d.uid}
              className={`flex items-center justify-between gap-2 rounded-lg border border-border-dark px-2.5 py-1.5 text-xs ${
                d.connected ? 'bg-background-dark/50' : 'opacity-50'
              }`}
            >
              <div className="min-w-0 flex-1">
                {editing === d.uid ? (
                  <input
                    ref={inputRef}
                    className="input w-full"
                    value={draft}
                    placeholder="Cihaz adı"
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onRename(d.uid, draft)
                        setEditing(null)
                      }
                      if (e.key === 'Escape') setEditing(null)
                    }}
                    onBlur={() => setEditing(null)}
                  />
                ) : (
                  <>
                    <p className="truncate font-medium text-slate-200">
                      {d.name ?? d.manufacturer ?? 'Adsız cihaz'}
                      {!d.connected && <span className="ml-1.5 text-[10px] text-slate-500">(takılı değil)</span>}
                    </p>
                    <p className="truncate font-mono text-[10px] text-slate-500">
                      {d.connected ? d.path : ''} {d.serialNumber ? `· SN ${d.serialNumber}` : ''}
                    </p>
                  </>
                )}
              </div>
              <button
                className="btn shrink-0 px-2 py-1"
                title="Yeniden adlandır — ad cihaz kimliğine kalıcı bağlanır"
                onClick={() => {
                  setEditing(d.uid)
                  setDraft(d.name ?? '')
                }}
              >
                Adlandır
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const HZ_OPTIONS = [10, 20, 25, 30, 35, 40, 44]

function RoutePanel({
  routes,
  universes,
  devices,
  onUpsert,
  onRemove,
  onStart,
  onStop
}: {
  routes: RouteStatus[]
  universes: SeenUniverse[]
  devices: UsbDevice[]
  onUpsert: (r: RouteConfig) => void
  onRemove: (id: string) => void
  onStart: (id: string) => void
  onStop: (id: string) => void
}) {
  const connected = devices.filter((d) => d.connected)
  const addRoute = () => {
    onUpsert({
      id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      universe: universes[0]?.universe ?? 0,
      deviceUid: connected[0]?.uid ?? devices[0]?.uid ?? '',
      protocol: 'enttec-pro',
      hz: 40,
      enabled: false
    })
  }
  const nameOf = (uid: string) => {
    const d = devices.find((x) => x.uid === uid)
    return d?.name ?? d?.manufacturer ?? uid.slice(0, 14)
  }
  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="label">Yönlendirme Tablosu</p>
        <button className="btn-primary px-2 py-1" onClick={addRoute} disabled={devices.length === 0}>
          + Rota
        </button>
      </div>
      {routes.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-500">
          Rota yok — bir Art-Net universe'ünü USB cihazına bağlamak için "+ Rota".
        </p>
      ) : (
        <div className="space-y-1.5">
          {routes.map((r) => (
            <div key={r.id} className="rounded-lg border border-border-dark bg-background-dark/50 px-2.5 py-2">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="label">U</span>
                <input
                  type="number"
                  min={0}
                  max={32767}
                  className="input w-16"
                  value={r.universe}
                  onChange={(e) => onUpsert({ ...r, universe: Number(e.target.value) })}
                />
                <span className="text-slate-600">→</span>
                <select className="input max-w-[11rem]" value={r.deviceUid} onChange={(e) => onUpsert({ ...r, deviceUid: e.target.value })}>
                  {devices.map((d) => (
                    <option key={d.uid} value={d.uid}>
                      {nameOf(d.uid)}{d.connected ? '' : ' (takılı değil)'}
                    </option>
                  ))}
                </select>
                <select className="input" value={r.protocol} onChange={(e) => onUpsert({ ...r, protocol: e.target.value as RouteConfig['protocol'] })}>
                  <option value="enttec-pro">Enttec Pro</option>
                  <option value="open-dmx">Open DMX (FTDI)</option>
                </select>
                <select className="input" value={r.hz} onChange={(e) => onUpsert({ ...r, hz: Number(e.target.value) })}>
                  {HZ_OPTIONS.map((h) => (
                    <option key={h} value={h}>{h} Hz</option>
                  ))}
                </select>
                <div className="ml-auto flex items-center gap-1.5">
                  {r.active ? (
                    <button className="btn px-2 py-1 text-red-300 hover:border-red-400/60 hover:text-red-300" onClick={() => onStop(r.id)}>
                      Durdur
                    </button>
                  ) : (
                    <button className="btn-primary px-2 py-1" onClick={() => onStart(r.id)}>
                      Başlat
                    </button>
                  )}
                  <button className="btn px-2 py-1" title="Rotayı sil" onClick={() => onRemove(r.id)}>✕</button>
                </div>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px]">
                {r.active && <span className="font-bold text-emerald-400">● YAYINDA</span>}
                {r.error && <span className="text-red-400">{r.error}</span>}
                {r.active && <span className="font-mono text-slate-500">{r.framesSent} kare</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
