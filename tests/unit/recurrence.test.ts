import { describe, expect, it } from 'vitest'
import { isRecurrence, nextOccurrence, successorId } from '../../src/domain/recurrence'

/**
 * Termine fortschreiben.
 *
 * Bewusst in **lokalen** Datumsteilen geschrieben: Der nächste Termin hängt an
 * der Uhrzeit des Nutzers, nicht an UTC. So schlagen die Tests auch in einer
 * anderen Zeitzone nicht fehl.
 */
const lokal = (jahr: number, monat: number, tag: number, stunde = 18, minute = 30) =>
  new Date(jahr, monat - 1, tag, stunde, minute).toISOString()

describe('Wiederholungsarten erkennen', () => {
  it('erkennt die vier Arten', () => {
    for (const art of ['daily', 'weekly', 'monthly', 'yearly']) {
      expect(isRecurrence(art)).toBe(true)
    }
  })

  it('behandelt Unbekanntes und Leeres als keine Wiederholung', () => {
    expect(isRecurrence(null)).toBe(false)
    expect(isRecurrence(undefined)).toBe(false)
    expect(isRecurrence('')).toBe(false)
    expect(isRecurrence('stündlich')).toBe(false)
  })
})

describe('Nächster Termin', () => {
  it('zählt Tage und Wochen weiter', () => {
    expect(nextOccurrence(lokal(2026, 1, 15), 'daily', lokal(2026, 1, 1))).toBe(lokal(2026, 1, 16))
    expect(nextOccurrence(lokal(2026, 1, 15), 'weekly', lokal(2026, 1, 1))).toBe(lokal(2026, 1, 22))
  })

  it('behält die Uhrzeit', () => {
    // Sonst würde aus 18:30 nach der Zeitumstellung 17:30.
    expect(nextOccurrence(lokal(2026, 3, 20, 18, 30), 'daily', lokal(2026, 3, 1))).toBe(
      lokal(2026, 3, 21, 18, 30),
    )
  })

  it('klemmt das Monatsende', () => {
    // Der 31. Januar wird im Februar zum 28.
    expect(nextOccurrence(lokal(2026, 1, 31), 'monthly', lokal(2026, 1, 1))).toBe(lokal(2026, 2, 28))
    // Im Schaltjahr zum 29.
    expect(nextOccurrence(lokal(2024, 1, 31), 'monthly', lokal(2024, 1, 1))).toBe(lokal(2024, 2, 29))
    // Der 15. bleibt der 15.
    expect(nextOccurrence(lokal(2026, 1, 15), 'monthly', lokal(2026, 1, 1))).toBe(lokal(2026, 2, 15))
  })

  it('klemmt den 29. Februar im Folgejahr', () => {
    expect(nextOccurrence(lokal(2024, 2, 29), 'yearly', lokal(2024, 1, 1))).toBe(lokal(2025, 2, 28))
  })

  it('rückt bis in die Zukunft vor, statt Rückstand anzusammeln', () => {
    // Drei Wochen überfällig, wöchentlich: Der nächste Termin liegt künftig.
    const ergebnis = nextOccurrence(lokal(2026, 1, 1), 'weekly', lokal(2026, 1, 22))
    expect(ergebnis).toBe(lokal(2026, 1, 29))
  })

  it('geht auch bei einem künftigen Termin einen Schritt weiter', () => {
    // Sonst bliebe die Aufgabe beim nächsten Abhaken am selben Datum stehen.
    expect(nextOccurrence(lokal(2099, 1, 1), 'daily', lokal(2026, 1, 1))).toBe(lokal(2099, 1, 2))
  })

  it('lässt einen unlesbaren Termin unverändert', () => {
    expect(nextOccurrence('kein Datum', 'daily', lokal(2026, 1, 1))).toBe('kein Datum')
  })
})

describe('Kennung des Nachfolgers', () => {
  it('ist berechenbar – gleiche Eingabe, gleiche Kennung', async () => {
    const a = await successorId('task-1', lokal(2026, 1, 22))
    const b = await successorId('task-1', lokal(2026, 1, 22))
    expect(a).toBe(b)
  })

  it('sieht aus wie eine UUID', async () => {
    const id = await successorId('task-1', lokal(2026, 1, 22))
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('unterscheidet verschiedene Aufgaben und Termine', async () => {
    const eins = await successorId('task-1', lokal(2026, 1, 22))
    const zwei = await successorId('task-2', lokal(2026, 1, 22))
    const drei = await successorId('task-1', lokal(2026, 1, 29))
    expect(new Set([eins, zwei, drei]).size).toBe(3)
  })
})
