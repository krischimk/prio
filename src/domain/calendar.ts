import { Temporal } from '@js-temporal/polyfill'
import type { LocalTask } from './types'
import { isRecurrence, recurrenceInterval, type Recurrence } from './recurrence'
import { effectiveRoutine, routineAvailableAt, stepInZone } from './routine'

export type DayCapacity = 'normal' | 'low' | 'none'
export type RepeatFilter = 'active' | 'all' | 'none'
export interface CalendarPreferences {
  days: Record<string, Exclude<DayCapacity, 'normal'>>
  notes?: Record<string, string>
  repeats: RepeatFilter
  open: boolean
  timeZone: string | null
}
export const systemTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
export function validTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 100) return false
  try { new Intl.DateTimeFormat('de', { timeZone: value }).format(); return true } catch { return false }
}
export function validDay(value: string): boolean {
  try { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Temporal.PlainDate.from(value).toString() === value } catch { return false }
}
export function parseCalendarPreferences(value: unknown): CalendarPreferences {
  const row = value && typeof value === 'object' ? value as Partial<CalendarPreferences> : {}
  const days = row.days && typeof row.days === 'object' ? Object.fromEntries(Object.entries(row.days)
    .filter(([day, level]) => validDay(day) && (level === 'low' || level === 'none')).slice(0, 3660)) : {}
  const notes = row.notes && typeof row.notes === 'object' ? Object.fromEntries(Object.entries(row.notes)
    .filter(([day, note]) => validDay(day) && typeof note === 'string' && note.trim()).slice(0, 3660)
    .map(([day, note]) => [day, note.trim().slice(0, 2000)])) : {}
  return { days, notes, repeats: row.repeats === 'all' || row.repeats === 'none' ? row.repeats : 'active',
    open: row.open === true, timeZone: validTimeZone(row.timeZone) ? row.timeZone : null }
}
export function dayInZone(at: string | number, timeZone = systemTimeZone()): string {
  return Temporal.Instant.from(typeof at === 'number' ? new Date(at).toISOString() : at).toZonedDateTimeISO(timeZone).toPlainDate().toString()
}
// Tagesgrenzen hängen nur von Datum und Zeitzone ab. Wiederholte Bewertungen
// derselben Tage brauchen keine erneute Temporal-/Sommerzeitberechnung.
const dayRanges = new Map<string, readonly [number, number]>()
function dayRange(day: string, zone: string): readonly [number, number] {
  const key = `${zone}:${day}`
  const cached = dayRanges.get(key)
  if (cached) return cached
  const start = Temporal.PlainDate.from(day).toZonedDateTime(zone)
  const range = [Number(start.epochMilliseconds), Number(start.add({ days: 1 }).epochMilliseconds)] as const
  if (dayRanges.size >= 512) dayRanges.delete(dayRanges.keys().next().value!)
  dayRanges.set(key, range)
  return range
}
/** Nur überschneidende Tagesanteile; auch 23-/25-Stunden-Tage bleiben korrekt. */
export function availableDuration(from: number, until: number, preferences?: CalendarPreferences): number {
  if (!preferences || until <= from) return until - from
  let duration = until - from
  const zone = preferences.timeZone ?? systemTimeZone()
  for (const [day, capacity] of Object.entries(preferences.days)) {
    const [start, end] = dayRange(day, zone)
    const overlap = Math.max(0, Math.min(until, end) - Math.max(from, start))
    duration -= overlap * (capacity === 'none' ? 1 : .5)
  }
  return duration
}
export function mergeCalendarPreferences(base: unknown, local: unknown, remote: unknown): CalendarPreferences {
  const b = parseCalendarPreferences(base), l = parseCalendarPreferences(local), r = parseCalendarPreferences(remote)
  const days = { ...r.days }
  for (const day of new Set([...Object.keys(b.days), ...Object.keys(l.days)])) {
    if (b.days[day] === l.days[day]) continue
    if (l.days[day]) days[day] = l.days[day]; else delete days[day]
  }
  const notes = { ...r.notes }
  for (const day of new Set([...Object.keys(b.notes ?? {}), ...Object.keys(l.notes ?? {})])) {
    if (b.notes?.[day] === l.notes?.[day]) continue
    if (l.notes?.[day]) notes[day] = l.notes[day]; else delete notes[day]
  }
  return { days, notes, repeats: l.repeats === b.repeats ? r.repeats : l.repeats,
    open: l.open === b.open ? r.open : l.open, timeZone: l.timeZone === b.timeZone ? r.timeZone : l.timeZone }
}
export interface CalendarEntry { task: LocalTask; day: string; planned: boolean; occurrences?: number }
/** Projektionen erzeugen keine DB-Zeilen und keine zusätzlichen Erinnerungen. */
export function calendarEntries(tasks: LocalTask[], firstDay: string, lastDay: string, filter: RepeatFilter, now: number, timeZone = systemTimeZone()): CalendarEntry[] {
  const entries: CalendarEntry[] = []
  for (const original of tasks) {
    if (original.completed || original.deleted_at || original.expired_at || !original.due_at) continue
    const task = effectiveRoutine(original, now)
    const repeating = isRecurrence(task.recurrence)
    if (repeating && filter === 'none') continue
    const visible = !task.available_from || Date.parse(task.available_from) <= now
    const add = (item: LocalTask, planned: boolean) => {
      const day = dayInZone(item.due_at!, timeZone)
      if (day >= firstDay && day <= lastDay) entries.push({ task: item, day, planned })
    }
    if (!repeating || filter === 'all' || visible) add(task, !visible)
    if (!repeating || filter !== 'all') continue
    // Für Minutenintervalle direkt an den sichtbaren Monat springen, dann begrenzen.
    let due = task.due_at!
    const interval = recurrenceInterval(task.recurrence)!
    const step = stepInZone(task.recurrence_rule?.timeZone ?? timeZone)
    if (interval.unit === 'minutes' || interval.unit === 'hours') {
      const duration = interval.every * (interval.unit === 'minutes' ? 60_000 : 3_600_000)
      for (let date = Temporal.PlainDate.from(firstDay); date.toString() <= lastDay; date = date.add({ days: 1 })) {
        const start = date.toZonedDateTime(timeZone)
        const first = Math.max(1, Math.ceil((Number(start.epochMilliseconds) - Date.parse(due)) / duration))
        const last = Math.floor((Number(start.add({ days: 1 }).epochMilliseconds) - 1 - Date.parse(due)) / duration)
        if (last < first) continue
        const projectedDue = new Date(Date.parse(due) + first * duration).toISOString()
        entries.push({ task: { ...task, due_at: projectedDue, available_from: routineAvailableAt(projectedDue, task.recurrence_rule) }, day: date.toString(), planned: true, occurrences: last - first + 1 })
      }
      continue
    }
    for (let count = 0; count < 5000; count++) {
      const next = step(new Date(due), task.recurrence as Recurrence).toISOString()
      if (next <= due || dayInZone(next, timeZone) > lastDay) break
      due = next
      add({ ...task, due_at: due, available_from: routineAvailableAt(due, task.recurrence_rule) }, true)
    }
  }
  return entries.sort((a, b) => a.task.due_at!.localeCompare(b.task.due_at!) || a.task.title.localeCompare(b.task.title, 'de'))
}
