import { describe, expect, it } from 'vitest'
import { OFFLINE_MESSAGE, type SyncResult } from '../../src/sync/syncEngine'
import { describeSyncState } from '../../src/sync/syncStatus'

function status(kind: SyncResult['kind'], message: string | null = null): SyncResult {
  return { kind, pushed: 0, pulled: 0, message, at: '2026-01-01T00:00:00.000Z' }
}

describe('Statusanzeige der Synchronisation', () => {
  it('zeigt bei fehlender Verbindung genau die geforderte Offline-Meldung', () => {
    const description = describeSyncState(status('offline'), 1, false)
    expect(description.text).toBe('Offline – Änderungen werden später synchronisiert.')
    expect(description.text).toBe(OFFLINE_MESSAGE)
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
})
