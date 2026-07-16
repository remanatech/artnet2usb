import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppState, RouteConfig, RouteStatus, SeenUniverse, UsbDevice } from '../shared/types'
import { LOCALE_OPTIONS, makeTranslate, translateError, type Locale, type Translate } from './locales'
import { useLocale } from './lib/useLocale'

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
  freezeRoute: (id: string) => window.artnet2usb.invoke('routes:freeze', id) as Promise<AppState>,
  setSettings: (s: AppState['settings']) => window.artnet2usb.invoke('settings:set', s) as Promise<AppState>,
  setPreview: (u: number | null) => window.artnet2usb.invoke('preview:set', u),
  openExternal: (url: string) => window.artnet2usb.invoke('app:openExternal', url)
}

export default function App() {
  const [locale, setLocale] = useLocale()
  const t = useMemo(() => makeTranslate(locale), [locale])
  const [state, setState] = useState<AppState | null>(null)
  const [preview, setPreview] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Click-select-pair flow: pick one broadcast + one device, one click builds and starts the route
  const [selUniverse, setSelUniverse] = useState<number | null>(null)
  const [selDevice, setSelDevice] = useState<string | null>(null)
  const [newProtocol, setNewProtocol] = useState<RouteConfig['protocol']>('enttec-pro')
  const [newHz, setNewHz] = useState(40)

  const refresh = useCallback(async () => {
    try {
      setState(await api.state())
    } catch {
      /* main process not ready yet — retried next tick */
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), 1500)
    return () => clearInterval(timer)
  }, [refresh])

  const run = async (fn: () => Promise<AppState>) => {
    try {
      setError(null)
      setState(await fn())
    } catch (e) {
      const raw = e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : String(e)
      setError(translateError(t, raw))
    }
  }

  if (!state) {
    return <div className="flex h-full items-center justify-center text-slate-500">…</div>
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border-dark px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <img src="./logo.svg" alt="" className="h-8 w-8" aria-hidden />
          <div className="flex items-baseline gap-2">
            <span className="font-display text-lg font-bold uppercase tracking-tight text-slate-100">{t('appTitle')}</span>
            <span className="font-display text-sm font-bold uppercase tracking-tight text-primary">{t('appSubtitle')}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SettingsBar t={t} settings={state.settings} onChange={(s) => void run(() => api.setSettings(s))} />
          <LanguageSwitcher t={t} locale={locale} onChange={setLocale} />
        </div>
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
            t={t}
            universes={state.universes}
            nodeCount={state.nodes.length}
            preview={preview}
            selected={selUniverse}
            onSelect={(u) => setSelUniverse((cur) => (cur === u ? null : u))}
            onPreview={(u) => {
              setPreview(u)
              void api.setPreview(u)
            }}
          />
          {preview != null && <PreviewGrid t={t} universe={preview} onClose={() => { setPreview(null); void api.setPreview(null) }} />}
        </section>
        <section className="flex min-h-0 flex-col gap-3">
          <DevicePanel
            t={t}
            devices={state.devices}
            selected={selDevice}
            onSelect={(uid) => setSelDevice((cur) => (cur === uid ? null : uid))}
            onRename={(uid, name) => void run(() => api.rename(uid, name))}
          />
          <PairBar
            t={t}
            universe={selUniverse}
            device={state.devices.find((d) => d.uid === selDevice) ?? null}
            protocol={newProtocol}
            hz={newHz}
            onProtocol={setNewProtocol}
            onHz={setNewHz}
            onCreate={() => {
              if (selUniverse == null || !selDevice) return
              const id = `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
              void run(async () => {
                await api.upsertRoute({ id, universe: selUniverse, deviceUid: selDevice, protocol: newProtocol, hz: newHz, enabled: false })
                return api.startRoute(id)
              })
              setSelUniverse(null)
              setSelDevice(null)
            }}
          />
          <RoutePanel
            t={t}
            routes={state.routes}
            devices={state.devices}
            onUpsert={(r) => void run(() => api.upsertRoute(r))}
            onRemove={(id) => void run(() => api.removeRoute(id))}
            onStart={(id) => void run(() => api.startRoute(id))}
            onStop={(id) => void run(() => api.stopRoute(id))}
            onFreeze={(id) => void run(() => api.freezeRoute(id))}
          />
        </section>
      </main>

      <footer className="flex items-center justify-between border-t border-border-dark px-4 py-2 text-[11px] text-slate-500">
        <span>{t('footerTagline')}</span>
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

function LanguageSwitcher({ t, locale, onChange }: { t: Translate; locale: Locale; onChange: (l: Locale) => void }) {
  return (
    <select
      className="input"
      value={locale}
      aria-label={t('languageLabel')}
      onChange={(e) => onChange(e.target.value as Locale)}
    >
      {LOCALE_OPTIONS.map((opt) => (
        <option key={opt.code} value={opt.code}>{opt.label}</option>
      ))}
    </select>
  )
}

function SettingsBar({ t, settings, onChange }: { t: Translate; settings: AppState['settings']; onChange: (s: AppState['settings']) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="label">{t('onSignalLoss')}</span>
      <select
        className="input"
        value={settings.onSignalLoss}
        onChange={(e) => onChange({ ...settings, onSignalLoss: e.target.value as 'hold' | 'blackout' })}
      >
        <option value="hold">{t('holdLastFrame')}</option>
        <option value="blackout">{t('blackout')}</option>
      </select>
    </div>
  )
}

function UniversePanel({
  t,
  universes,
  nodeCount,
  preview,
  selected,
  onSelect,
  onPreview
}: {
  t: Translate
  universes: SeenUniverse[]
  nodeCount: number
  preview: number | null
  selected: number | null
  onSelect: (u: number) => void
  onPreview: (u: number | null) => void
}) {
  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="label">{t('universesTitle')}</p>
        <span className="text-[10px] text-slate-500">
          {t('universesCount', { n: universes.length, nodes: nodeCount })}
        </span>
      </div>
      {universes.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-500">{t('noUniverses')}</p>
      ) : (
        <div className="space-y-1">
          {universes.map((u) => {
            const isSel = selected === u.universe
            return (
              <div
                key={u.universe}
                role="button"
                title={t('selectForRoute')}
                onClick={() => onSelect(u.universe)}
                className={`flex cursor-pointer items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                  isSel
                    ? 'border-primary bg-primary/15 ring-1 ring-primary/40'
                    : 'border-border-dark bg-background-dark/50 hover:border-primary/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-primary">U{u.universe}</span>
                  <span className="text-slate-400">{u.sourceIp}</span>
                  {isSel && <span className="text-[10px] font-bold uppercase text-primary">{t('selected')}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-slate-500">{u.fps} fps</span>
                  <button
                    className="btn px-2 py-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      onPreview(preview === u.universe ? null : u.universe)
                    }}
                  >
                    {preview === u.universe ? t('close') : t('preview')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Pairing bar: pick a broadcast + device → one click builds and starts the route. */
function PairBar({
  t,
  universe,
  device,
  protocol,
  hz,
  onProtocol,
  onHz,
  onCreate
}: {
  t: Translate
  universe: number | null
  device: UsbDevice | null
  protocol: RouteConfig['protocol']
  hz: number
  onProtocol: (p: RouteConfig['protocol']) => void
  onHz: (h: number) => void
  onCreate: () => void
}) {
  const ready = universe != null && device != null
  return (
    <div className={`card flex flex-wrap items-center gap-2 p-3 ${ready ? 'border-primary/50' : ''}`}>
      <span className={`font-mono text-xs font-bold ${universe != null ? 'text-primary' : 'text-slate-600'}`}>
        {universe != null ? `U${universe}` : t('selectBroadcast')}
      </span>
      <span className="text-slate-600">→</span>
      <span className={`min-w-0 max-w-[10rem] truncate text-xs font-medium ${device ? 'text-slate-200' : 'text-slate-600'}`}>
        {device ? (device.name ?? device.manufacturer ?? device.path) : t('selectDevice')}
      </span>
      <select className="input" value={protocol} onChange={(e) => onProtocol(e.target.value as RouteConfig['protocol'])}>
        <option value="enttec-pro">{t('protocolEnttec')}</option>
        <option value="open-dmx">{t('protocolOpenDmx')}</option>
      </select>
      <select className="input" value={hz} onChange={(e) => onHz(Number(e.target.value))}>
        {HZ_OPTIONS.map((h) => (
          <option key={h} value={h}>{h} Hz</option>
        ))}
      </select>
      <button className="btn-primary ml-auto" disabled={!ready} onClick={onCreate} title={ready ? '' : t('selectBothFirst')}>
        ▶ {t('createRoute')}
      </button>
    </div>
  )
}

function PreviewGrid({ t, universe, onClose }: { t: Translate; universe: number; onClose: () => void }) {
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
        <p className="label">{t('previewTitle', { u: universe })}</p>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span>{t('activeChannels', { n: nonZero })}</span>
          <button className="btn px-2 py-0.5" onClick={onClose}>{t('close')}</button>
        </div>
      </div>
      <div className="grid flex-1 content-start gap-px overflow-y-auto" style={{ gridTemplateColumns: 'repeat(32, minmax(0, 1fr))' }}>
        {frame.map((v, i) => (
          <div
            key={i}
            title={t('channelTooltip', { n: i + 1, v })}
            className="aspect-square rounded-[2px]"
            style={{ backgroundColor: v > 0 ? `rgba(37, 185, 244, ${0.15 + (v / 255) * 0.85})` : 'rgba(148, 163, 184, 0.08)' }}
          />
        ))}
      </div>
    </div>
  )
}

function DevicePanel({
  t,
  devices,
  selected,
  onSelect,
  onRename
}: {
  t: Translate
  devices: UsbDevice[]
  selected: string | null
  onSelect: (uid: string) => void
  onRename: (uid: string, name: string) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])
  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="label">{t('devicesTitle')}</p>
        <span className="text-[10px] text-slate-500">{t('connectedCount', { n: devices.filter((d) => d.connected).length })}</span>
      </div>
      {devices.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-500">{t('noDevices')}</p>
      ) : (
        <div className="space-y-1">
          {devices.map((d) => (
            <div
              key={d.uid}
              role="button"
              title={d.connected ? t('selectForRoute') : t('errorDeviceNotConnected')}
              onClick={() => d.connected && onSelect(d.uid)}
              className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                selected === d.uid
                  ? 'border-primary bg-primary/15 ring-1 ring-primary/40'
                  : d.connected
                    ? 'cursor-pointer border-border-dark bg-background-dark/50 hover:border-primary/40'
                    : 'border-border-dark opacity-50'
              }`}
            >
              <div className="min-w-0 flex-1">
                {editing === d.uid ? (
                  <input
                    ref={inputRef}
                    className="input w-full"
                    value={draft}
                    placeholder={t('namePlaceholder')}
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
                      {d.name ?? d.manufacturer ?? t('unnamedDevice')}
                      {!d.connected && <span className="ml-1.5 text-[10px] text-slate-500">{t('notConnectedBadge')}</span>}
                    </p>
                    <p className="truncate font-mono text-[10px] text-slate-500">
                      {d.connected ? d.path : ''} {d.serialNumber ? `· ${t('serialLabel', { sn: d.serialNumber })}` : ''}
                    </p>
                  </>
                )}
              </div>
              <button
                className="btn shrink-0 px-2 py-1"
                title={t('renameButtonTooltip')}
                onClick={(e) => {
                  e.stopPropagation()
                  setEditing(d.uid)
                  setDraft(d.name ?? '')
                }}
              >
                {t('rename')}
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
  t,
  routes,
  devices,
  onUpsert,
  onRemove,
  onStart,
  onStop,
  onFreeze
}: {
  t: Translate
  routes: RouteStatus[]
  devices: UsbDevice[]
  onUpsert: (r: RouteConfig) => void
  onRemove: (id: string) => void
  onStart: (id: string) => void
  onStop: (id: string) => void
  onFreeze: (id: string) => void
}) {
  const nameOf = (uid: string) => {
    const d = devices.find((x) => x.uid === uid)
    return d?.name ?? d?.manufacturer ?? uid.slice(0, 14)
  }
  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="label">{t('routesTitle')}</p>
        <span className="text-[10px] text-slate-500">{t('liveCount', { n: routes.filter((r) => r.active).length })}</span>
      </div>
      {routes.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-500">{t('noRoutes')}</p>
      ) : (
        <div className="space-y-1.5">
          {routes.map((r) => (
            <div
              key={r.id}
              className={`rounded-lg border px-2.5 py-2 ${
                r.active && r.frozen
                  ? 'border-sky-400/50 bg-sky-400/5'
                  : r.active
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-border-dark bg-background-dark/50'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono font-bold text-primary">U{r.universe}</span>
                <span className="text-slate-600">→</span>
                <span className="min-w-0 max-w-[10rem] truncate font-medium text-slate-200">{nameOf(r.deviceUid)}</span>
                <select className="input" value={r.protocol} onChange={(e) => onUpsert({ ...r, protocol: e.target.value as RouteConfig['protocol'] })}>
                  <option value="enttec-pro">{t('protocolEnttec')}</option>
                  <option value="open-dmx">{t('protocolOpenDmx')}</option>
                </select>
                <select className="input" value={r.hz} onChange={(e) => onUpsert({ ...r, hz: Number(e.target.value) })}>
                  {HZ_OPTIONS.map((h) => (
                    <option key={h} value={h}>{h} Hz</option>
                  ))}
                </select>
                <div className="ml-auto flex items-center gap-1.5">
                  {r.active && (
                    <button
                      className={`btn px-2 py-1 ${r.frozen ? 'border-sky-300/70 bg-sky-300/10 text-sky-300' : ''}`}
                      title={r.frozen ? t('resumeTooltip') : t('freezeTooltip')}
                      onClick={() => onFreeze(r.id)}
                    >
                      {r.frozen ? `❄ ${t('resume')}` : `❄ ${t('freeze')}`}
                    </button>
                  )}
                  {r.active ? (
                    <button className="btn px-2 py-1 text-red-300 hover:border-red-400/60 hover:text-red-300" onClick={() => onStop(r.id)}>
                      ■ {t('stop')}
                    </button>
                  ) : (
                    <button className="btn-primary px-2 py-1" onClick={() => onStart(r.id)}>
                      ▶ {t('start')}
                    </button>
                  )}
                  <button className="btn px-2 py-1" title={t('deleteRouteTooltip')} onClick={() => onRemove(r.id)}>✕</button>
                </div>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px]">
                {r.active && !r.frozen && <span className="font-bold text-emerald-400">● {t('liveBadge')}</span>}
                {r.active && r.frozen && <span className="font-bold text-sky-300">❄ {t('frozenBadge')}</span>}
                {r.error && <span className="text-red-400">{translateError(t, r.error)}</span>}
                {r.active && <span className="font-mono text-slate-500">{t('framesCount', { n: r.framesSent })}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
