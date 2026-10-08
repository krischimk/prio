import { describe, expect, it } from 'vitest'
import { einfuegestelle } from '../../src/ui/mobile/useReorderDrag'

/**
 * Die Einfügestelle beim Ziehen (unit).
 *
 * Drei Zeilen à 50 px: Mittellinien bei 25, 75 und 125. Gezählt wird, an wie
 * vielen Mittellinien **anderer** Zeilen der Finger vorbei ist – das ist der
 * Index in der Liste ohne die gezogene Aufgabe.
 */
const ZEILEN = [
  { top: 0, height: 50 },
  { top: 50, height: 50 },
  { top: 100, height: 50 },
]

describe('einfuegestelle', () => {
  it('lässt die Aufgabe an ihrem Platz, solange der Finger in ihrer Zeile bleibt', () => {
    // Genau hier sprang sie früher: Sobald der Finger die eigene Mitte (75)
    // verließ, galt die nächste Zeile als Ziel.
    expect(einfuegestelle(ZEILEN, 1, 60)).toBe(1)
    expect(einfuegestelle(ZEILEN, 1, 80)).toBe(1)
    expect(einfuegestelle(ZEILEN, 1, 99)).toBe(1)
  })

  it('zählt nur die anderen Mittellinien', () => {
    // Oberhalb aller Mittellinien: ganz nach vorn.
    expect(einfuegestelle(ZEILEN, 1, 0)).toBe(0)
    // Unterhalb aller Mittellinien: ganz nach hinten.
    expect(einfuegestelle(ZEILEN, 1, 500)).toBe(2)
  })

  it('schiebt genau eine Position, wenn eine Mittellinie überschritten wird', () => {
    // Oben liegende Aufgabe (Mitte 25) eine Position nach unten.
    expect(einfuegestelle(ZEILEN, 0, 30)).toBe(0)
    expect(einfuegestelle(ZEILEN, 0, 80)).toBe(1)
    expect(einfuegestelle(ZEILEN, 0, 130)).toBe(2)
  })

  it('kommt mit einer einzelnen Zeile und mit fehlenden Maßen zurecht', () => {
    expect(einfuegestelle([{ top: 0, height: 50 }], 0, 999)).toBe(0)
    expect(einfuegestelle([ZEILEN[0]!, undefined as never, ZEILEN[2]!], 0, 130)).toBe(1)
  })
})
