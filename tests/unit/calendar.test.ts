import { describe, expect, it } from 'vitest'
import { availableDuration, calendarEntries, mergeCalendarPreferences, parseCalendarPreferences } from '../../src/domain/calendar'
import { effectiveRoutine, routineAvailableAt, routineRestorable } from '../../src/domain/routine'
import { automaticUrgency } from '../../src/domain/rating'
import { localTask } from '../support/factories'
import { mergeCloudRow } from '../../src/domain/cloudMerge'
import { toRemoteTask } from '../../src/domain/mapping'

const rule = { visibility: { mode: 'clock' as const, time: '05:00' }, resetMissed: true, timeZone: 'Europe/Berlin' }
const task = () => localTask({ recurrence: 'daily', recurrence_rule: rule, due_at: '2026-10-24T20:30:00.000Z', available_from: '2026-10-24T03:00:00.000Z',
  rating: { importance: 8, urgency: 5, effort: 7, urgencyMode: 'auto', effortFromChecklist: true },
  checklist: [{ id: 'a', text: 'Lesen', completed: true, deleted_at: null }] })
describe('Flexible Routinen und persönlicher Kalender', () => {
  it('mischt einen verspäteten Haken des Vortags nicht still in den frischen Durchlauf', () => {
    const base = { ...task(), checklist: [{ ...task().checklist[0], completed: false }] }
    const current = effectiveRoutine(base, Date.parse('2026-10-25T05:00:00Z'))
    const late = { ...base, checklist: [{ ...base.checklist[0], completed: true }] }
    const merged = mergeCloudRow('tasks', toRemoteTask(base), toRemoteTask(current), toRemoteTask(late))
    expect(merged.fields).toContain('checklist')
    expect('checklist' in merged.row && merged.row.checklist?.[0].completed).toBe(false)
  })
  it('ersetzt einen verpassten Tag erst um 5 Uhr und setzt die Checkliste zurück', () => {
    const original = task()
    expect(effectiveRoutine(original, Date.parse('2026-10-25T03:59:59Z'))).toBe(original)
    const next = effectiveRoutine(original, Date.parse('2026-10-25T04:00:00Z'))
    expect(next.id).toBe(original.id)
    expect(next.due_at).toBe('2026-10-25T21:30:00.000Z')
    expect(next.available_from).toBe('2026-10-25T04:00:00.000Z')
    expect(next.checklist[0].completed).toBe(false)
    expect(next.rating).toEqual(original.rating)
    expect(effectiveRoutine(next, Date.parse('2026-10-25T04:01:00Z'))).toBe(next)
  })
  it('überspringt mehrere verpasste Tage ohne Rückstau; Abschalten erhält die überfällige Aufgabe', () => {
    expect(effectiveRoutine(task(), Date.parse('2026-10-29T10:00:00Z')).due_at).toBe('2026-10-29T21:30:00.000Z')
    const retained = { ...task(), recurrence_rule: { ...rule, resetMissed: false } }
    expect(effectiveRoutine(retained, Date.parse('2026-10-29T10:00:00Z'))).toBe(retained)
  })
  it('berechnet zwölf Stunden Vorlauf auch bei einem Drei-Tage-Intervall', () => {
    const original = { ...task(), recurrence: 'every:3:days', recurrence_rule: { ...rule, visibility: { mode: 'lead' as const, minutes: 720 } } }
    const next = effectiveRoutine(original, Date.parse('2026-10-27T10:00:00Z'))
    expect(next.due_at).toBe('2026-10-27T21:30:00.000Z')
    expect(next.available_from).toBe('2026-10-27T09:30:00.000Z')
  })
  it('beendet das Wiederherstellen eines Durchlaufs beim nächsten Start', () => {
    expect(routineRestorable(task(), Date.parse('2026-10-25T03:59:59Z'))).toBe(true)
    expect(routineRestorable(task(), Date.parse('2026-10-25T04:00:00Z'))).toBe(false)
    expect(routineAvailableAt('2026-10-25T21:30:00.000Z', rule)).toBe('2026-10-25T04:00:00.000Z')
  })
  it('gewichtet ausschließlich Zeit vor der Fälligkeit, einschließlich angebrochener Tage', () => {
    const settings = parseCalendarPreferences({ days: { '2026-10-29': 'low', '2026-10-30': 'none' }, timeZone: 'Europe/Berlin' })
    const start = Date.parse('2026-10-29T11:00:00Z'), end = Date.parse('2026-10-30T11:00:00Z')
    expect(availableDuration(start, end, settings)).toBe(6 * 3_600_000)
    expect(automaticUrgency(new Date(end).toISOString(), 5, start, settings)).toBe(10)
  })
  it('rechnet den 25-Stunden-Tag bei der Zeitumstellung vollständig ab', () => {
    const settings = parseCalendarPreferences({ days: { '2026-10-25': 'none' }, timeZone: 'Europe/Berlin' })
    expect(availableDuration(Date.parse('2026-10-24T22:00:00Z'), Date.parse('2026-10-25T23:00:00Z'), settings)).toBe(0)
  })
  it('führt persönliche Änderungen an verschiedenen Tagen zusammen und entfernt Normal korrekt', () => {
    const base = parseCalendarPreferences({ days: { '2026-10-25': 'low' } })
    const local = { ...base, days: { '2026-10-26': 'none' as const } }
    const remote = { ...base, days: { ...base.days, '2026-10-27': 'low' as const } }
    expect(mergeCalendarPreferences(base, local, remote).days).toEqual({ '2026-10-26': 'none', '2026-10-27': 'low' })
  })
  it('zeigt nur aktive Wiederholungen; Projektionen sind zuschaltbar und ändern keine Zeile', () => {
    const original = task(), before = structuredClone(original)
    const at = Date.parse('2026-10-24T10:00:00Z')
    expect(calendarEntries([original], '2026-10-24', '2026-10-31', 'active', at, 'Europe/Berlin')).toHaveLength(1)
    expect(calendarEntries([original], '2026-10-24', '2026-10-31', 'all', at, 'Europe/Berlin')).toHaveLength(8)
    expect(calendarEntries([original], '2026-10-24', '2026-10-31', 'none', at, 'Europe/Berlin')).toHaveLength(0)
    expect(original).toEqual(before)
  })
  it('fasst sehr kurze Intervalle je Tag zusammen, ohne spätere Tage still wegzulassen', () => {
    const minute = localTask({ recurrence: 'every:1:minutes', due_at: '2026-10-01T00:00:00Z' })
    const entries = calendarEntries([minute], '2026-10-01', '2026-10-31', 'all', Date.parse('2026-10-01T00:00:00Z'), 'UTC')
    expect(entries.reduce((sum, entry) => sum + (entry.occurrences ?? 1), 0)).toBe(31 * 1440)
    expect(entries.at(-1)?.day).toBe('2026-10-31')
  })
})
