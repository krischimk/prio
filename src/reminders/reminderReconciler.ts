import type { LocalReminder } from '../domain/types'
import type { ReminderCandidate } from './reminderPlan'

/**
 * Gleicht den gewünschten Zustand (aus den Aufgaben) mit dem tatsächlich
 * geplanten Zustand (beim Betriebssystem) ab.
 *
 * Reine Funktion bis auf die Nummernvergabe, die hereingereicht wird – damit
 * ist die Logik vollständig testbar.
 *
 * **Eine Aufgabe kann mehrere Erinnerungen haben**, jede ist ein eigener
 * Termin. Zusammengehalten wird eine Zeile über Aufgabe **und** Zeitpunkt:
 *
 *  - dieselbe Aufgabe, derselbe Zeitpunkt   → unverändert, nichts tun
 *  - Zeitpunkt verschoben                    → alten Termin abbrechen, neu planen
 *  - Aufgabe erledigt/gelöscht/ohne Erinnerung → Termine abbrechen
 *
 * Der Zeitpunkt als zweiter Schlüssel ist die entscheidende Vereinfachung:
 * Das Entfernen einer Erinnerung lässt die Nummern der übrigen in Ruhe, und
 * eine zweite Erinnerung bekommt einfach eine neue Nummer dazu.
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

/** Aufgabe und Zeitpunkt zusammen – darunter ist eine Erinnerung eindeutig. */
function schluessel(taskId: string, at: string): string {
  return `${taskId}|${at}`
}

export function reconcileReminders(
  desired: ReminderCandidate[],
  tracked: LocalReminder[],
  allocateNotificationId: () => number,
): ReminderActions {
  const trackedByKey = new Map(tracked.map((entry) => [schluessel(entry.taskId, entry.at), entry]))

  const schedule: ScheduleRequest[] = []
  const cancel: number[] = []
  const next: LocalReminder[] = []

  for (const candidate of desired) {
    const existing = trackedByKey.get(schluessel(candidate.taskId, candidate.at))

    if (existing) {
      // Unverändert: nichts tun, Nummer behalten.
      next.push(existing)
      continue
    }

    const notificationId = allocateNotificationId()
    schedule.push({ ...candidate, notificationId })
    next.push({ taskId: candidate.taskId, notificationId, at: candidate.at })
  }

  const desiredKeys = new Set(desired.map((candidate) => schluessel(candidate.taskId, candidate.at)))
  for (const entry of tracked) {
    if (desiredKeys.has(schluessel(entry.taskId, entry.at))) continue
    cancel.push(entry.notificationId)
  }

  next.sort(
    (a, b) => a.taskId.localeCompare(b.taskId) || a.at.localeCompare(b.at),
  )
  cancel.sort((a, b) => a - b)

  return { schedule, cancel, tracked: next }
}
