import { describe, expect, it } from 'vitest'
import { fromRemoteList, fromRemoteMember, fromRemoteTask, toPushPayload, toRemoteList, toRemoteTask } from '../../src/domain/mapping'
import { normalizeIso, timeOf } from '../../src/domain/clock'
import { localList, localMember, localTask, remoteTask } from '../support/factories'

/**
 * Umwandlung zwischen lokalem Datenmodell (Dexie) und Supabase-Datenmodell.
 *
 * Kritisch ist dabei die Normalisierung der Zeitstempel: Supabase liefert
 * `timestamptz` als `+00:00` mit Mikrosekunden, lokal gilt `...Z`. Ohne
 * Normalisierung wäre der Last-Write-Wins-Vergleich falsch.
 */
describe('Mapping zwischen lokalem und Supabase-Modell', () => {
  it('entfernt das lokale dirty-Flag beim Hochladen', () => {
    const remote = toRemoteTask(localTask({ dirty: 1 }))
    expect(remote).not.toHaveProperty('dirty')
  })

  it('setzt beim Herunterladen dirty auf 0', () => {
    const local = fromRemoteTask(remoteTask({ title: 'vom Server' }))
    expect(local.dirty).toBe(0)
    expect(local.title).toBe('vom Server')
  })

  it('normalisiert Mikrosekunden und Offset-Angaben aus PostgreSQL', () => {
    const local = fromRemoteTask(
      remoteTask({ created_at: '2026-01-31T12:00:00.123456+00:00', updated_at: '2026-01-31T12:00:00.123456+00:00' }),
    )
    expect(local.created_at).toBe('2026-01-31T12:00:00.123Z')
    expect(local.updated_at).toBe(local.created_at)
  })

  it('behandelt fehlende optionale Zeitstempel als null', () => {
    const local = fromRemoteTask(remoteTask({ due_at: null, deleted_at: null }))
    expect(local.due_at).toBeNull()
    expect(local.deleted_at).toBeNull()
  })

  it('wandelt Listen und Mitgliedschaften verlustfrei um', () => {
    const list = fromRemoteList(toRemoteList(localList({ name: 'Arbeit', is_shared: true, dirty: 1 })))
    expect(list.name).toBe('Arbeit')
    expect(list.is_shared).toBe(true)
    expect(list.dirty).toBe(0)

    const member = fromRemoteMember({ list_id: 'l', user_id: 'u', created_at: '2026-01-01T00:00:00+00:00', updated_at: '2026-01-01T00:00:00+00:00', deleted_at: null })
    expect(member).toMatchObject({ list_id: 'l', user_id: 'u', dirty: 0 })
  })

  it('baut die Upload-Nutzlast ohne dirty-Felder', () => {
    const payload = toPushPayload([localList({ dirty: 1 })], [localMember({ dirty: 1 })], [localTask({ dirty: 1 })])
    expect(payload.lists[0]).not.toHaveProperty('dirty')
    expect(payload.members[0]).not.toHaveProperty('dirty')
    expect(payload.tasks[0]).not.toHaveProperty('dirty')
  })

  it('macht Zeitstempel über Formatgrenzen hinweg vergleichbar', () => {
    expect(timeOf(normalizeIso('2026-01-31T12:00:00.123456+00:00'))).toBe(timeOf('2026-01-31T12:00:00.123Z'))
    expect(timeOf('2026-01-02T00:00:00.000Z')).toBeGreaterThan(timeOf('2026-01-01T23:00:00.000Z'))
  })
})
