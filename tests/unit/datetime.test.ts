import { describe, expect, it } from 'vitest'
import { formatDueLabel } from '../../src/ui/datetime'

const now = Date.parse('2026-10-14T12:00:00Z')
describe('Relative Fälligkeit', () => {
  it.each([
    ['2026-10-14T12:00:30Z', 'In weniger als einer Minute'],
    ['2026-10-14T12:05:00Z', 'In 5 Minuten'],
    ['2026-10-14T15:20:00Z', 'In 3 Stunden und 20 Minuten'],
    ['2026-10-15T13:20:00Z', 'In 1 Tag'],
    ['2026-10-17T12:00:00Z', 'In 3 Tagen'],
    ['2026-10-31T12:00:00Z', 'In 2 Wochen und 3 Tagen'],
    ['2026-12-28T12:00:00Z', 'In 2 Monaten und 2 Wochen'],
    ['2029-01-14T12:00:00Z', 'In 2 Jahren und 3 Monaten'],
  ])('zeigt %s als %s', (due, text) => {
    const label = formatDueLabel(due, false, now)
    expect(label.text).toBe(text)
    expect(label.overdue).toBe(false)
    expect(label.absoluteText).toMatch(/^Fällig: /)
  })
  it('rechnet mit Kalender-Monaten und begrenzt am Monatsende', () => {
    expect(formatDueLabel('2026-02-28T12:00:00Z', false, Date.parse('2026-01-31T12:00:00Z')).text).toBe('In 1 Monat')
    expect(formatDueLabel('2025-02-28T12:00:00Z', false, Date.parse('2024-02-29T12:00:00Z')).text).toBe('In 1 Jahr')
  })
  it('unterscheidet laufende und überschrittene Fälligkeit', () => {
    expect(formatDueLabel('2026-10-14T12:00:00Z', false, now)).toMatchObject({ text: 'Jetzt fällig', overdue: false })
    expect(formatDueLabel('2026-10-14T10:00:00Z', false, now)).toMatchObject({ text: 'Seit 2 Stunden überfällig', overdue: true })
  })
  it('nennt bei erledigten Aufgaben die Vergangenheit ohne Überfällig-Zustand', () => {
    expect(formatDueLabel('2026-10-14T10:00:00Z', true, now)).toMatchObject({ text: 'Vor 2 Stunden', overdue: false })
  })
  it('verträgt unbrauchbare alte Termine', () => {
    expect(formatDueLabel('ungültig', false, now)).toMatchObject({ text: 'Fälligkeit unklar', overdue: false })
  })
})
