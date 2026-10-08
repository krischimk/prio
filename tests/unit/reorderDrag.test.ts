import { describe, expect, it } from 'vitest'
import { zielAusSlots, type Slot } from '../../src/ui/mobile/useReorderDrag'

/**
 * Das Ziel beim Ziehen (unit).
 *
 * Drei Zeilen à 50 px (Mittellinien bei 25, 75, 125), dazu ein Bereichskopf.
 */
function zeile(id: string, top: number, abschnittId: string | null = null): Slot {
  return { art: 'zeile', top, height: 50, id, abschnittId }
}
function kopf(abschnittId: string, top: number): Slot {
  return { art: 'kopf', top, height: 32, id: abschnittId, abschnittId }
}

const FLACH = [zeile('A', 0), zeile('B', 50), zeile('C', 100)]

describe('zielAusSlots', () => {
  it('lässt die Aufgabe an ihrem Platz, solange der Finger in ihrer Zeile bleibt', () => {
    // Genau hier sprang sie früher: Sobald der Finger die eigene Mitte (75)
    // verließ, galt die nächste Zeile als Ziel.
    expect(zielAusSlots(FLACH, 1, 60).stelle).toBe(1)
    expect(zielAusSlots(FLACH, 1, 80).stelle).toBe(1)
    expect(zielAusSlots(FLACH, 1, 99).stelle).toBe(1)
  })

  it('zählt nur die anderen Mittellinien', () => {
    expect(zielAusSlots(FLACH, 1, 0).stelle).toBe(0)
    expect(zielAusSlots(FLACH, 1, 500).stelle).toBe(2)
    expect(zielAusSlots(FLACH, 0, 30).stelle).toBe(0)
    expect(zielAusSlots(FLACH, 0, 80).stelle).toBe(1)
    expect(zielAusSlots(FLACH, 0, 130).stelle).toBe(2)
  })

  it('nimmt den Bereich der nächsten Zeile', () => {
    const mitBereichen = [
      kopf('obst', 0),
      zeile('A', 32, 'obst'),
      kopf('getraenke', 82),
      zeile('B', 114, 'getraenke'),
    ]

    expect(zielAusSlots(mitBereichen, 1, 120).abschnittId).toBe('getraenke')
  })

  it('zieht in einen leeren Bereich, wenn der Finger auf seinem Kopf steht', () => {
    // Ohne diese Regel ließe sich ein leerer Bereich gar nicht befüllen: Es gibt
    // keine Zeile, an der sich das Ziel ablesen ließe.
    const mitLeerem = [zeile('A', 0, null), kopf('leer', 50)]

    expect(zielAusSlots(mitLeerem, 0, 60).abschnittId).toBe('leer')
  })

  it('zieht auch in einen zugeklappten Bereich', () => {
    const zugeklappt = [zeile('A', 0, null), kopf('zu', 50)]

    expect(zielAusSlots(zugeklappt, 0, 70).abschnittId).toBe('zu')
  })
})
