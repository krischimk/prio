import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Wahl der Oberfläche (unit).
 *
 * Der Fall, der diesen Test ausgelöst hat: Ein Telefon im Querformat ist rund
 * 850 px breit und bekam damit die Desktop-Ansicht mit Seitenleiste – auf einem
 * Telefon unbrauchbar. In der App gilt deshalb eine höhere Schwelle.
 */
const state = vi.hoisted(() => ({ native: false }))

vi.mock('../../src/app/platform', () => ({
  isNativeApp: () => state.native,
}))

const { useIsDesktop } = await import('../../src/app/useIsDesktop')

/** Ersetzt matchMedia und merkt sich, mit welcher Abfrage es aufgerufen wurde. */
function stubMatchMedia(matches: boolean): string[] {
  const queries: string[] = []
  window.matchMedia = ((query: string) => {
    queries.push(query)
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }
  }) as unknown as typeof window.matchMedia
  return queries
}

const originalMatchMedia = window.matchMedia

afterEach(() => {
  state.native = false
  window.matchMedia = originalMatchMedia
})

describe('Wahl der Oberfläche', () => {
  it('nutzt im Browser die 768-px-Grenze', () => {
    const queries = stubMatchMedia(true)
    const { result } = renderHook(() => useIsDesktop())

    expect(result.current).toBe(true)
    expect(queries).toContain('(min-width: 768px)')
  })

  it('nutzt in der App die 1024-px-Grenze', () => {
    state.native = true
    const queries = stubMatchMedia(true)
    renderHook(() => useIsDesktop())

    expect(queries).toContain('(min-width: 1024px)')
    expect(queries).not.toContain('(min-width: 768px)')
  })

  it('bleibt auf einem Telefon im Querformat mobil', () => {
    // 873 px: breiter als die Web-Grenze, schmaler als die App-Grenze.
    state.native = true
    stubMatchMedia(false)

    const { result } = renderHook(() => useIsDesktop())
    expect(result.current).toBe(false)
  })

  it('zeigt auf einem Tablet die breite Ansicht', () => {
    state.native = true
    stubMatchMedia(true)

    const { result } = renderHook(() => useIsDesktop())
    expect(result.current).toBe(true)
  })

  it('bleibt im Browser bei 390 px mobil', () => {
    stubMatchMedia(false)
    const { result } = renderHook(() => useIsDesktop())
    expect(result.current).toBe(false)
  })

  it('fällt ohne matchMedia auf die breite Ansicht zurück', () => {
    // @ts-expect-error – absichtlich entfernen, um den Rückfall zu prüfen.
    delete window.matchMedia

    const { result } = renderHook(() => useIsDesktop())
    expect(result.current).toBe(true)
  })
})
