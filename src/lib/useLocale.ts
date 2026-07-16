import { useState } from 'react'
import { DEFAULT_LOCALE, isLocale, type Locale } from '../locales'

const STORAGE_KEY = 'artnet2usb.locale'

/** Persisted UI language — defaults to English regardless of OS locale (product requirement). */
export function useLocale(): [Locale, (l: Locale) => void] {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return isLocale(saved) ? saved : DEFAULT_LOCALE
    } catch {
      return DEFAULT_LOCALE
    }
  })
  const setLocale = (l: Locale) => {
    setLocaleState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      /* private mode / storage disabled — locale just won't persist across restarts */
    }
  }
  return [locale, setLocale]
}
