import type { LocalReminder } from '../domain/types'
import type { ReminderCandidate } from './reminderPlan'

/**
 * Gleicht den gewünschten Zustand (aus den Aufgaben) mit dem tatsächlich
 * geplanten Zustand (beim Betriebssystem) ab.
 *
 * Reine Funktion bis auf die Nummernvergabe, die hereingereicht wird – damit
 * ist die Logik vollständig testbar.
 *
 * Verhalten:
 *  - Neue Aufgabe mit Fälligkeit        → planen
 *  - Zeitpunkt verschoben               → alten Termin abbrechen, neu planen
 *  - Aufgabe erledigt/gelöscht/ohne Datum → Termin abbrechen
 *  - Unverändert                        → nichts tun
 *
 * Die Nummer bleibt dabei an die Aufgabe gebunden: Sie ändert sich nur, wenn
 * die Aufgabe aus dem Plan fällt und später wieder hineinkommt.
 */

export interface ScheduleRequest extends ReminderCandidate {
  notificationId: number
}

export interface ReminderActions {
  schedule: ScheduleRequest[]
  cancel: number[]
  /** Zustand nach dem Abgleich – so wird er lokal gespeichert. */
  tracked: LocalReminder[]
}

export function reconcileReminders(
  desired: ReminderCandidate[],
  tracked: LocalReminder[],
  allocateNotificationId: () => number,
): ReminderActions {
  const trackedByTask = new Map(tracked.map((entry) => [entry.taskId, entry]))

  const schedule: ScheduleRequest[] = []
  const cancel: number[] = []
  const next: LocalReminder[] = []

  for (const candidate of desired) {
    const existing = trackedByTask.get(candidate.taskId)

    if (!existing) {
      const notificationId = allocateNotificationId()
      schedule.push({ ...candidate, notificationId })
      next.push({ taskId: candidate.taskId, notificationId, at: candidate.at })
      continue
    }

    if (existing.at !== candidate.at) {
      // Erst abbrechen, dann mit derselben Nummer neu planen – so bleibt die
      // Zuordnung Aufgabe ↔ Benachrichtigung stabil.
      cancel.push(existing.notificationId)
      schedule.push({ ...candidate, notificationId: existing.notificationId })
      next.push({ taskId: candidate.taskId, notificationId: existing.notificationId, at: candidate.at })
      continue
    }

    // Unverändert: nichts tun, aber vormerken.
    next.push(existing)
  }

  const desiredIds = new Set(desired.map((candidate) => candidate.taskId))
  for (const entry of tracked) {
    if (desiredIds.has(entry.taskId)) continue
    cancel.push(entry.notificationId)
  }

  next.sort((a, b) => a.taskId.localeCompare(b.taskId))
  cancel.sort((a, b) => a - b)

  return { schedule, cancel, tracked: next }
}
