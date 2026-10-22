import { registerPlugin, SystemBars, SystemBarsStyle } from '@capacitor/core'
import { isNativeApp } from './platform'
import { hasNativeWidgets, widgetBridge } from '../widgets/native'

export type Theme = 'dark' | 'light'
export type ThemePreference = Theme | 'system'
const key = 'prio:theme'
const changed = 'prio:theme-changed'
const appearance = registerPlugin<{ setBackground(options: { color: string }): Promise<void> }>('Appearance')

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function themePreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(key)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* Ohne Speicher gilt weiterhin das Gerätethema. */ }
  return 'system'
}

function resolvedTheme(preference: ThemePreference): Theme {
  return preference === 'system' ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' : preference
}

/** Die Farbwahl ist eine Geräteansicht, keine fachliche Änderung mit Upload. */
export function applyTheme(preference: ThemePreference): void {
  try {
    if (preference === 'system') localStorage.removeItem(key)
    else localStorage.setItem(key, preference)
  } catch { /* Die aktuelle Ansicht funktioniert auch ohne Speicher. */ }
  renderTheme(resolvedTheme(preference))
  if (hasNativeWidgets()) void widgetBridge.theme({ preference }).catch(() => {})
}

function renderTheme(theme: Theme): void {
  document.documentElement.classList.add('theme-switching')
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme)
  const background = getComputedStyle(document.documentElement).getPropertyValue('--color-page').trim()
  if (background) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background)
  if (isNativeApp()) void SystemBars.setStyle({ style: theme === 'light' ? SystemBarsStyle.Light : SystemBarsStyle.Dark })
    .then(() => { if (theme === currentTheme() && background) return appearance.setBackground({ color: background }) })
    .catch(() => {})
  window.dispatchEvent(new Event(changed))
  requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove('theme-switching')))
}

/** Starten folgt der vorhandenen Wahl, ohne einen Systemstandard festzuschreiben. */
export function startThemeTracking(): () => void {
  renderTheme(resolvedTheme(themePreference()))
  const device = window.matchMedia('(prefers-color-scheme: dark)')
  const onDeviceChange = () => {
    if (themePreference() === 'system') renderTheme(device.matches ? 'dark' : 'light')
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) renderTheme(resolvedTheme(themePreference()))
  }
  device.addEventListener('change', onDeviceChange)
  window.addEventListener('storage', onStorage)
  return () => { device.removeEventListener('change', onDeviceChange); window.removeEventListener('storage', onStorage) }
}

export function subscribeTheme(listener: () => void): () => void {
  window.addEventListener(changed, listener)
  return () => window.removeEventListener(changed, listener)
}
