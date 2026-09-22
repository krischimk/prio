import { describe, expect, it } from 'vitest'
import { describeUpdateState, type UpdateState } from '../../src/updates/updateStatus'

const veroeffentlichung = {
  version: '0.6.1',
  apkUrl: 'https://example.com/prio-0.6.1.apk',
  fileName: 'prio-0.6.1.apk',
  sizeBytes: 3_300_000,
  notes: '',
}

/**
 * Der Ton steuert die Farbe. Genau hier lag ein Fehler: „ist aktuell“ wurde
 * orange dargestellt, weil die Farbe an einer immer gefüllten Zeichenkette hing
 * statt am Zustand.
 */
describe('Update-Zustand beschreiben', () => {
  it('„aktuell“ ist kein Hinweis, der Aufmerksamkeit braucht', () => {
    const zustand: UpdateState = { status: 'up-to-date', current: '0.6.1', latest: '0.6.1' }
    const { text, tone } = describeUpdateState(zustand)
    expect(tone).toBe('ok')
    expect(text).toContain('0.6.1')
  })

  it('eine verfügbare Fassung braucht Aufmerksamkeit', () => {
    const zustand: UpdateState = {
      status: 'available',
      current: '0.6.0',
      release: veroeffentlichung,
    }
    const { text, tone } = describeUpdateState(zustand)
    expect(tone).toBe('attention')
    expect(text).toContain('0.6.1')
    expect(text).toContain('0.6.0')
  })

  it('Fehler werden als Fehler gemeldet', () => {
    const { text, tone } = describeUpdateState({ status: 'failed', message: 'Netzwerk weg' })
    expect(tone).toBe('error')
    expect(text).toBe('Netzwerk weg')
  })

  it('Ruhe und Suche bleiben zurückhaltend', () => {
    expect(describeUpdateState({ status: 'idle' }).tone).toBe('muted')
    expect(describeUpdateState({ status: 'checking' }).tone).toBe('muted')
  })
})
