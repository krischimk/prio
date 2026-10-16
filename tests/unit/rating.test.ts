import { describe, expect, it } from 'vitest'
import { automaticUrgency, changeUrgencyMode, parseRating, ratingValues, startRating, validateRating } from '../../src/domain/rating'

const due = '2026-12-18T18:00:00.000Z'
const before = (hours: number) => Date.parse(due) - hours * 3600000

describe('Optionale gekoppelte Bewertung', () => {
  it('beginnt erst ausdrücklich und setzt auch bei Wichtigkeit 0 die übrigen Werte sichtbar mittig', () => {
    expect(parseRating(undefined)).toBeNull()
    expect(startRating(0)).toEqual({ importance: 0, urgency: 5, effort: 5, urgencyMode: 'auto', effortFromChecklist: true })
    for (const value of [{ importance: 5 }, { ...startRating(5), effort: 11 }, { ...startRating(5), urgency: NaN }, { ...startRating(5), urgencyMode: 'unknown' }]) {
      expect(parseRating(value)).toBeNull()
      expect(() => validateRating(value)).toThrow()
    }
    expect(validateRating({ ...startRating(0.7), effort: 2.35 })).toMatchObject({ importance: 0.7, effort: 2.35 })
  })
  it('steigt ohne Startschwelle zunächst langsam und dann schneller bis zum aufwandsabhängigen Maximum', () => {
    const far = automaticUrgency(due, 5, before(240))!
    const middle = automaticUrgency(due, 5, before(72))!
    const near = automaticUrgency(due, 5, before(24))!
    expect(far).toBeGreaterThan(0)
    expect(middle).toBeCloseTo(5)
    expect(near).toBeGreaterThan(middle)
    expect(automaticUrgency(due, 5, before(24))! - automaticUrgency(due, 5, before(25))!).toBeGreaterThan(automaticUrgency(due, 5, before(120))! - automaticUrgency(due, 5, before(121))!)
    expect(automaticUrgency(due, 5, before(12))).toBe(10)
    expect(automaticUrgency(due, 10, before(36))).toBe(10)
    expect(automaticUrgency(due, 0, before(36))).toBeLessThan(10)
    expect(automaticUrgency(due, 5, before(-100))).toBe(10)
  })
  it('berücksichtigt Restzeit und Aufwand, aber keinen manuellen Ausgangswert; ohne Termin greift der manuelle Wert', () => {
    expect(ratingValues({ ...startRating(8), urgency: 0 }, due, before(72))).toEqual(ratingValues({ ...startRating(8), urgency: 10 }, due, before(72)))
    expect(ratingValues({ ...startRating(8), urgencyMode: 'manual' }, due, before(0))).toMatchObject({ urgency: 5, priority: 6.5, automatic: false })
    expect(ratingValues(startRating(8), null, before(0))).toMatchObject({ urgency: 5, automatic: false })
    expect(automaticUrgency(due, 9, before(72))).toBeGreaterThan(automaticUrgency(due, 1, before(72))!)
  })
  it('friert beim Wechsel zu Manuell auch winzige automatische Werte auf einen erreichbaren Reglerwert ein', () => {
    expect(changeUrgencyMode(startRating(5), 'manual', due, before(10000))).toMatchObject({ urgencyMode: 'manual', urgency: 0 })
    expect(changeUrgencyMode(startRating(5), 'manual', due, before(72))).toMatchObject({ urgencyMode: 'manual', urgency: 5 })
    const manual = { ...startRating(5), urgencyMode: 'manual' as const, urgency: 2.3 }
    expect(changeUrgencyMode(manual, 'auto', due, before(72))).toMatchObject({ urgencyMode: 'auto', urgency: 2.3 })
  })
})
