import { describe, expect, it } from 'vitest'
import {
  RESTORE_WINDOW_DAYS,
  compareListsByName,
  compareRestorable,
  compareTasks,
  restoreCutoff,
} from '../../src/domain/ordering'
import type { LocalTask } from '../../src/domain/types'
import { localList, localTask } from '../support/factories'

/**
 * Reihenfolgen (unit).
 *
 * Sie standen in der Datenschicht – damit war die **Anzeigeentscheidung** eine
 * Eigenschaft der Datenbank. Hier stehen sie als reine Funktionen und sind
 * direkt prüfbar, ohne IndexedDB.
 */
function mit(teil: Partial<LocalTask>): LocalTask {
  return localTask(teil)
}

describe('Reihenfolge der Aufgaben', () => {
  it('folgt der Position des Benutzers', () => {
    const erste = mit({ position: 1, title: 'Erste' })
    const zweite = mit({ position: 2, title: 'Zweite' })

    expect(compareTasks(erste, zweite)).toBeLessThan(0)
    expect([zweite, erste].sort(compareTasks).map((t) => t.title)).toEqual(['Erste', 'Zweite'])
  })

  it('lässt eine erledigte Aufgabe an ihrem Platz', () => {
    // Nur bei gleicher Position greifen die alten Regeln – dort rutscht die
    // erledigte Aufgabe nach hinten.
    const offen = mit({ position: 0, completed: false })
    const erledigt = mit({ position: 0, completed: true })

    expect(compareTasks(erledigt, offen)).toBeGreaterThan(0)
  })

  it('sortiert fehlende Positionen nach vorn statt zu NaN zu werden', () => {
    const ohne = mit({ position: Number.NaN })
    const mitPosition = mit({ position: 5 })

    expect(Number.isNaN(compareTasks(ohne, mitPosition))).toBe(false)
    expect(compareTasks(ohne, mitPosition)).toBeLessThan(0)
  })

  it('sortiert Wiederherstellbares zuletzt abgehakt zuerst', () => {
    const alt = mit({ completed_at: '2026-01-01T10:00:00.000Z' })
    const neu = mit({ completed_at: '2026-01-02T10:00:00.000Z' })

    expect([alt, neu].sort(compareRestorable)[0]).toBe(neu)
  })

  it('sortiert Listen alphabetisch', () => {
    const a = localList({ name: 'Arbeit' })
    const b = localList({ name: 'Haushalt' })
    expect([b, a].sort(compareListsByName)[0]).toBe(a)
  })
})

describe('Wiederherstellungsfenster', () => {
  it('rechnet das Fenster aus der Uhrzeit', () => {
    const jetzt = Date.parse('2026-01-10T12:00:00.000Z')
    const grenze = restoreCutoff(jetzt)

    expect(Date.parse(grenze)).toBe(jetzt - RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  })
})
