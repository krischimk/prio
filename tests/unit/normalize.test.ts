import { describe, expect, it } from 'vitest'
import {
  normalisiereAufgabe,
  normalisiereListe,
  normalisiereMitglied,
} from '../../src/domain/normalize'

/**
 * Der Leserand (unit).
 *
 * Eine Zeile aus einer älteren Fassung kennt neue Felder nicht – weder lokal
 * (die Datenbank stammt von einer früheren App-Fassung) noch vom Server (ein
 * älteres Gerät hat sie geschrieben, oder die Migration fehlt noch). Genau das
 * hat 0.18.0 mit einem schwarzen Bildschirm quittiert: `sections` fehlte, und
 * die Ansicht stürzte beim Lesen ab.
 *
 * Der Leserand macht jede Zeile vollständig, egal woher sie kommt. Diese Tests
 * bauen die Zeilen deshalb so, wie eine alte Fassung sie hinterlassen hätte.
 */
describe('Leserand', () => {
  const basis = {
    id: 'liste-1',
    name: 'Haushalt',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }

  it('ergänzt fehlende Felder einer Liste', () => {
    // So sah eine Zeile vor 0.18.0 aus: ohne `sections`, ohne `icon`.
    const alt = { ...basis } as never
    const liste = normalisiereListe(alt)

    expect(liste.sections).toEqual([])
    expect(liste.icon).toBeNull()
    expect(liste.deleted_at).toBeNull()
    expect(liste.dirty).toBe(0)
  })

  it('ergänzt fehlende Felder einer Aufgabe', () => {
    const alt = {
      ...basis,
      id: 'aufgabe-1',
      list_id: 'liste-1',
      title: 'Milch kaufen',
    } as never
    const aufgabe = normalisiereAufgabe(alt)

    expect(aufgabe.description).toBe('')
    expect(aufgabe.reminders).toEqual([])
    expect(aufgabe.section_id).toBeNull()
    expect(aufgabe.completed_at).toBeNull()
    expect(aufgabe.recurrence).toBeNull()
    expect(aufgabe.successor_id).toBeNull()
    expect(aufgabe.position).toBe(0)
    expect(aufgabe.completed).toBe(false)
  })

  it('lässt eine verbogene Zeile lesbar', () => {
    const kaputt = {
      ...basis,
      id: 'aufgabe-2',
      list_id: 'liste-1',
      title: 'Trotzdem lesbar',
      reminders: 'keine Liste',
      position: Number.NaN,
      sections: { keine: 'Liste' },
    } as never

    const aufgabe = normalisiereAufgabe(kaputt)
    expect(aufgabe.reminders).toEqual([])
    expect(aufgabe.position).toBe(0)

    const liste = normalisiereListe(kaputt)
    expect(liste.sections).toEqual([])
  })

  it('ergänzt fehlende Felder einer Mitgliedschaft', () => {
    const alt = { list_id: 'liste-1', user_id: 'user-1' } as never
    const mitglied = normalisiereMitglied(alt)

    expect(mitglied.deleted_at).toBeNull()
    expect(mitglied.dirty).toBe(0)
  })

  it('macht aus Serverzeitstempeln die kanonische Form', () => {
    const aufgabe = normalisiereAufgabe({
      ...basis,
      id: 'aufgabe-3',
      list_id: 'liste-1',
      title: 'Zeitzone',
      due_at: '2026-01-31T12:00:00.123456+00:00',
      created_at: '2026-01-01T00:00:00.000+00:00',
      updated_at: '2026-01-01T00:00:00.000+00:00',
    } as never)

    expect(aufgabe.due_at).toBe('2026-01-31T12:00:00.123Z')
    expect(aufgabe.created_at).toBe('2026-01-01T00:00:00.000Z')
  })
})
