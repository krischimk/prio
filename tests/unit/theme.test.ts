import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, currentTheme, startThemeTracking, themePreference } from '../../src/app/theme'

vi.mock('../../src/app/platform', () => ({ isNativeApp: () => false }))

describe('Gerätethema und persönliche Farbwahl', () => {
  let device: EventTarget & { matches: boolean }
  let stop: (() => void) | undefined
  const switchDevice = (dark: boolean) => { device.matches = dark; device.dispatchEvent(new Event('change')) }
  beforeEach(() => {
    localStorage.clear()
    device = Object.assign(new EventTarget(), { matches: false })
    vi.stubGlobal('matchMedia', () => device)
  })
  afterEach(() => { stop?.(); stop = undefined; localStorage.clear(); vi.unstubAllGlobals() })

  it('startet ohne gespeicherte Wahl mit dem Gerätethema und folgt dessen Änderungen', () => {
    stop = startThemeTracking()
    expect(currentTheme()).toBe('light')
    expect(themePreference()).toBe('system')
    expect(localStorage.getItem('prio:theme')).toBeNull()
    switchDevice(true)
    expect(currentTheme()).toBe('dark')
    expect(localStorage.getItem('prio:theme')).toBeNull()
  })
  it.each(['dark', 'light'] as const)('bewahrt die vorhandene Wahl %s und erlaubt die Rückkehr zum Gerätestandard', theme => {
    localStorage.setItem('prio:theme', theme)
    stop = startThemeTracking()
    expect(currentTheme()).toBe(theme)
    switchDevice(theme !== 'dark')
    expect(currentTheme()).toBe(theme)
    applyTheme('system')
    expect(currentTheme()).toBe(theme === 'dark' ? 'light' : 'dark')
    expect(themePreference()).toBe('system')
    switchDevice(theme === 'dark')
    expect(currentTheme()).toBe(theme)
  })
  it('verwendet eine manuelle Wahl sofort und schreibt bei fremden Speicherereignissen nichts zurück', () => {
    stop = startThemeTracking()
    applyTheme('dark')
    expect(themePreference()).toBe('dark')
    expect(currentTheme()).toBe('dark')
    const write = vi.spyOn(Storage.prototype, 'setItem')
    localStorage.removeItem('prio:theme')
    window.dispatchEvent(new StorageEvent('storage', { key: 'prio:theme', newValue: null }))
    expect(currentTheme()).toBe('light')
    expect(write).not.toHaveBeenCalled()
    write.mockRestore()
  })
})
