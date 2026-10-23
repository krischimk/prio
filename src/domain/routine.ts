import { Temporal } from '@js-temporal/polyfill'
import { isRecurrence, recurrenceInterval, type Recurrence } from './recurrence'
import { repeatChecklist } from './checklist'
import type { LocalTask } from './types'

export interface RecurrenceRule {
  visibility: { mode: 'lead'; minutes: number } | { mode: 'clock'; time: string }
  resetMissed: boolean
  timeZone: string
}
export function parseRecurrenceRule(value: unknown): RecurrenceRule | null {
  if (!value || typeof value !== 'object') return null
  const row = value as RecurrenceRule
  if (typeof row.resetMissed !== 'boolean' || typeof row.timeZone !== 'string' || !row.visibility) return null
  try { Temporal.Now.zonedDateTimeISO(row.timeZone) } catch { return null }
  if (row.visibility.mode === 'lead' && Number.isInteger(row.visibility.minutes) && row.visibility.minutes >= 0 && row.visibility.minutes <= 5_256_000)
    return { visibility: { mode: 'lead', minutes: row.visibility.minutes }, resetMissed: row.resetMissed, timeZone: row.timeZone }
  if (row.visibility.mode === 'clock' && /^([01]\d|2[0-3]):[0-5]\d$/.test(row.visibility.time))
    return { visibility: { mode: 'clock', time: row.visibility.time }, resetMissed: row.resetMissed, timeZone: row.timeZone }
  return null
}
export function stepInZone(timeZone: string) {
  return (date: Date, recurrence: Recurrence): Date => {
    const { every, unit } = recurrenceInterval(recurrence)!
    const instant = Temporal.Instant.from(date.toISOString()).toZonedDateTimeISO(timeZone)
    return new Date(Number(instant.add({ [unit]: every }).epochMilliseconds))
  }
}
export function routineAvailableAt(due: string, rule: RecurrenceRule | null | undefined): string | null {
  if (!rule) return null
  if (rule.visibility.mode === 'lead') return new Date(Date.parse(due) - rule.visibility.minutes * 60_000).toISOString()
  const deadline = Temporal.Instant.from(due).toZonedDateTimeISO(rule.timeZone)
  let opening = deadline.withPlainTime(rule.visibility.time)
  if (Temporal.ZonedDateTime.compare(opening, deadline) > 0) opening = opening.subtract({ days: 1 })
  return opening.toInstant().toString({ fractionalSecondDigits: 3 })
}
export function isTaskVisible(task: LocalTask, now: number): boolean {
  return !task.recurrence_rule || !task.available_from || Date.parse(task.available_from) <= now
}
/** Ein verpasster Durchlauf wird an Ort und Stelle ersetzt, ohne einen Rückstau. */
export function effectiveRoutine(task: LocalTask, now: number): LocalTask {
  const rule = task.recurrence_rule
  if (!rule?.resetMissed || !task.due_at || !isRecurrence(task.recurrence) || task.completed || task.deleted_at) return task
  const step = stepInZone(rule.timeZone)
  let due = task.due_at
  const interval = recurrenceInterval(task.recurrence)!
  // Lange Rückstände bei kurzen festen Intervallen ohne tausende Einzelschritte.
  if (rule.visibility.mode === 'lead' && ['minutes', 'hours'].includes(interval.unit)) {
    const duration = interval.every * (interval.unit === 'minutes' ? 60_000 : 3_600_000)
    const steps = Math.min(Math.max(0, Math.floor((now + rule.visibility.minutes * 60_000 - Date.parse(due)) / duration)), Math.max(0, Math.floor((now - Date.parse(due)) / duration) + 1))
    if (steps) due = new Date(Date.parse(due) + steps * duration).toISOString()
  } else for (let count = 0; count < 10000; count++) {
    if (Date.parse(due) > now) break
    const next = step(new Date(due), task.recurrence).toISOString()
    const opening = routineAvailableAt(next, rule)!
    if (Date.parse(opening) > now || next <= due) break
    due = next
  }
  return due === task.due_at ? task : { ...task, due_at: due, available_from: routineAvailableAt(due, rule), checklist: repeatChecklist(task.checklist) }
}
export function routineRestorable(task: LocalTask, now: number): boolean {
  if (!task.recurrence_rule?.resetMissed || !task.due_at || !isRecurrence(task.recurrence)) return true
  const next = stepInZone(task.recurrence_rule.timeZone)(new Date(task.due_at), task.recurrence).toISOString()
  return Date.parse(routineAvailableAt(next, task.recurrence_rule)!) > now
}
