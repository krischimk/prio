import { describe, expect, it } from 'vitest'
import type { SyncResult } from '../../src/sync/syncEngine'
import { OFFLINE_TEXT, describeSyncState } from '../../src/ui/status/syncStatus'

function status(kind: SyncResult['kind'], message: string | null = null): SyncResult {
  return { kind, pushed: 0, pulled: 0, message, at: '2026-01-01T00:00:00.000Z' }
}

describe('Statusanzeige der Synchronisation', () => {
  it('zeigt bei fehlender Verbindung genau die geforderte Offline-Meldung', () => {
    const description = describeSyncState(status('offline'), 1, false)
    expect(description.text).toBe('Offline – Änderungen werden später synchronisiert.')
    expect(description.text).toBe(OFFLINE_TEXT)
    expect(description.tone).toBe('pending')
  })

  it('zeigt während eines laufenden Syncs einen Hinweis', () => {
    expect(describeSyncState(status('ok'), 0, true).text).toBe('Synchronisiere…')
  })

  it('meldet offene Änderungen, wenn der letzte Sync erfolgreich war', () => {
    expect(describeSyncState(status('ok'), 3, false).text).toBe('3 Änderungen warten auf Übertragung.')
    expect(describeSyncState(status('ok'), 1, false).text).toBe('1 Änderung wartet auf Übertragung.')
  })

  it('meldet einen vollständig abgeglichenen Zustand', () => {
    const description = describeSyncState(status('ok'), 0, false)
    expect(description.text).toBe('Alles synchronisiert.')
    expect(description.tone).toBe('ok')
  })

  it('weist auf eine abgelaufene Anmeldung hin', () => {
    const description = describeSyncState(status('auth'), 0, false)
    expect(description.tone).toBe('error')
    expect(description.text).toContain('Anmeldung abgelaufen')
  })

  it('zeigt vor dem ersten Sync einen Neutralzustand', () => {
    expect(describeSyncState(null, 0, false).text).toBe('Noch nicht synchronisiert.')
  })

  it('bewahrt offene Konflikte auch bei Offline-Zustand und nach Neustart', () => {
    expect(describeSyncState(status('offline'), 0, false, 0, 1).text).toContain('1 Änderungskonflikt')
    expect(describeSyncState(null, 0, false, 0, 2).text).toContain('2 Änderungskonflikte')
    expect(describeSyncState(status('conflict'), 0, true, 0, 2).text).toBe('Synchronisiere…')
  })
})

/**
 * Abgelehnte Änderungen sind kein „warten“.
 *
 * Anlass: Der Upload war alles-oder-nichts. Eine dauerhaft abgelehnte Zeile
 * blieb `dirty`, und die Anzeige sagte für immer „N Änderungen warten“ – obwohl
 * nichts mehr von selbst durchgeht. Sie liegen jetzt in einem Ablagefach und
 * werden hier benannt.
 */
describe('Abgelehnte Änderungen', () => {
  const ok: SyncResult = {
    kind: 'ok',
    pushed: 1,
    pulled: 0,
    message: null,
    at: '2026-01-01T00:00:00.000Z',
  }

  it('benennt sie mit Fehlerton statt als „warten“', () => {
    const description = describeSyncState(ok, 0, false, 2)

    expect(description.tone).toBe('error')
    expect(description.text).toContain('2 Änderungen wurden')
  })

  it('nennt eine einzelne im Singular', () => {
    expect(describeSyncState(ok, 0, false, 1).text).toContain('1 Änderung wurde')
  })

  it('bleibt beim Üblichen, wenn nichts abgelehnt ist', () => {
    expect(describeSyncState(ok, 0, false, 0)).toEqual({ text: 'Alles synchronisiert.', tone: 'ok' })
  })
})
