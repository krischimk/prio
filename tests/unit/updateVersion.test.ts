import { describe, expect, it } from 'vitest'
import { isNewerVersion, parseVersion } from '../../src/updates/version'

describe('Versionen vergleichen', () => {
  it('liest Versionen mit und ohne führendes v', () => {
    expect(parseVersion('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 })
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 })
    expect(parseVersion('  v2.0  ')).toEqual({ major: 2, minor: 0, patch: 0 })
  })

  it('gibt bei Unsinn null zurück', () => {
    expect(parseVersion('neueste')).toBeNull()
    expect(parseVersion('')).toBeNull()
  })

  it('erkennt eine neuere Version', () => {
    expect(isNewerVersion('0.6.0', '0.5.0')).toBe(true)
    expect(isNewerVersion('0.5.1', '0.5.0')).toBe(true)
    expect(isNewerVersion('1.0.0', '0.9.9')).toBe(true)
  })

  it('erkennt gleiche und ältere Versionen', () => {
    expect(isNewerVersion('0.5.0', '0.5.0')).toBe(false)
    expect(isNewerVersion('0.4.9', '0.5.0')).toBe(false)
  })

  it('vergleicht Zahlen, nicht Zeichenketten', () => {
    // Als Text wäre "0.10.0" kleiner als "0.9.0".
    expect(isNewerVersion('0.10.0', '0.9.0')).toBe(true)
    expect(isNewerVersion('0.9.0', '0.10.0')).toBe(false)
  })

  it('fordert bei unlesbaren Versionen nicht zum Aktualisieren auf', () => {
    expect(isNewerVersion('neueste', '0.5.0')).toBe(false)
    expect(isNewerVersion('0.6.0', 'unbekannt')).toBe(false)
  })
})
