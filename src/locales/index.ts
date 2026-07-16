import { en, type TKey } from './en'
import { de } from './de'
import { fr } from './fr'
import { it } from './it'
import { tr } from './tr'

export type { TKey }
export type Locale = 'en' | 'de' | 'fr' | 'it' | 'tr'

/** Native autonyms — shown as-is in the language switcher regardless of active locale. */
export const LOCALE_OPTIONS: { code: Locale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'it', label: 'Italiano' },
  { code: 'tr', label: 'Türkçe' }
]

export const DEFAULT_LOCALE: Locale = 'en'

export const dictionaries: Record<Locale, Record<TKey, string>> = { en, de, fr, it, tr }

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && value in dictionaries
}

/** Main-process error codes (see app/main.ts, app/dmxOutput.ts) mapped to translation keys. */
export const ERROR_CODE_KEYS: Record<string, TKey> = {
  device_not_connected: 'errorDeviceNotConnected',
  route_not_found: 'errorRouteNotFound',
  port_closed: 'errorPortClosed'
}

export type Translate = (key: TKey, vars?: Record<string, string | number>) => string

export function makeTranslate(locale: Locale): Translate {
  const dict = dictionaries[locale]
  return (key, vars) => {
    let s = dict[key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{{${k}}}`, String(v))
    }
    return s
  }
}

/** Error text coming from the main process: known codes are translated, anything else (driver/OS errors) passes through as-is. */
export function translateError(t: Translate, raw: string): string {
  const key = ERROR_CODE_KEYS[raw]
  return key ? t(key) : raw
}
