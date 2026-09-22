import { describe, expect, it } from 'vitest'
import { formatDueLabel } from '../../src/ui/datetime'

/**
 * Fälligkeitstext (unit).
 *
 * Beide Ansichten – breit und mobil – benutzen diese eine Funktion. Der Test
 * hält fest, dass es genau eine Schreibweise gibt und dass erledigte Aufgaben
 * nicht als überfällig gelten.
 */
describe('Fälligkeit formatieren', () => {
  it('nennt Datum und Uhrzeit', () => {
    const label = formatDueLabel('2099-02-15T18:30:00.000Z', false)
    expect(label.text).toMatch(/^Fällig: /)
    expect(label.overdue).toBe(false)
  })

  it('markiert Vergangenes als überfällig', () => {
    const label = formatDueLabel('2020-02-15T18:30:00.000Z', false)
    expect(label.text).toMatch(/· überfällig$/)
    expect(label.overdue).toBe(true)
  })

  it('markiert erledigte Aufgaben nicht als überfällig', () => {
    const label = formatDueLabel('2020-02-15T18:30:00.000Z', true)
    expect(label.text).not.toMatch(/überfällig/)
    expect(label.overdue).toBe(false)
  })

  it('setzt keine Klammern mehr – eine Schreibweise für beide Ansichten', () => {
    const label = formatDueLabel('2020-02-15T18:30:00.000Z', false)
    expect(label.text).not.toContain('(')
  })
})
