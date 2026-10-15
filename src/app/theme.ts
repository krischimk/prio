import { registerPlugin, SystemBars, SystemBarsStyle } from '@capacitor/core'
import { isNativeApp } from './platform'

export type Theme = 'dark' | 'light'
const key = 'prio:theme'
const changed = 'prio:theme-changed'
const appearance = registerPlugin<{ setBackground(options: { color: string }): Promise<void> }>('Appearance')

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

/** Die Farbwahl ist eine Geräteansicht, keine fachliche Änderung mit Upload. */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.add('theme-switching')
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme)
  const background = getComputedStyle(document.documentElement).getPropertyValue('--color-page').trim()
  if (background) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background)
  try { localStorage.setItem(key, theme) } catch { /* Die aktuelle Ansicht funktioniert auch ohne Speicher. */ }
  if (isNativeApp()) void SystemBars.setStyle({ style: theme === 'light' ? SystemBarsStyle.Light : SystemBarsStyle.Dark })
    .then(() => { if (theme === currentTheme() && background) return appearance.setBackground({ color: background }) })
    .catch(() => {})
  window.dispatchEvent(new Event(changed))
  requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove('theme-switching')))
}

export function subscribeTheme(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === key) applyTheme(event.newValue === 'light' ? 'light' : 'dark')
  }
  window.addEventListener(changed, listener)
  window.addEventListener('storage', onStorage)
  return () => { window.removeEventListener(changed, listener); window.removeEventListener('storage', onStorage) }
}
