import { describe, expect, it } from 'vitest'
import { formatBackendLabel } from '../../src/ui/backendLabel'

/**
 * Die Beschriftung des Datenziels.
 *
 * Sie entscheidet, ob ein Lauf gegen den Mock oder gegen das echte Projekt
 * geht – und ob man das von außen erkennen kann. Ein lokales Ziel muss deshalb
 * als Mock erkennbar sein, ein echtes nur seinen Host zeigen.
 */
describe('Beschriftung des Datenziels', () => {
  it('zeigt bei einem echten Projekt den Host', () => {
    expect(formatBackendLabel('https://abcdefghijklm.supabase.co')).toBe('abcdefghijklm.supabase.co')
  })

  it('kennzeichnet den lokalen Mock', () => {
    expect(formatBackendLabel('http://127.0.0.1:54321')).toBe('Mock · 127.0.0.1:54321')
    expect(formatBackendLabel('http://localhost:54321')).toBe('Mock · localhost:54321')
    // Die Adresse, unter der der Android-Emulator den Rechner sieht.
    expect(formatBackendLabel('http://10.0.2.2:54321')).toBe('Mock · 10.0.2.2:54321')
  })

  it('kennzeichnet auch eine Adresse ohne Schema als Mock', () => {
    expect(formatBackendLabel('127.0.0.1:54321')).toBe('Mock · 127.0.0.1:54321')
  })

  it('liefert nichts, wenn nichts konfiguriert ist', () => {
    expect(formatBackendLabel(undefined)).toBeNull()
    expect(formatBackendLabel('')).toBeNull()
    expect(formatBackendLabel('   ')).toBeNull()
  })
})
