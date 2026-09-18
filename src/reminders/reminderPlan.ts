import { normalizeIso } from '../domain/clock'
import type { LocalList, LocalTask } from '../domain/types'

/**
 * Ermittelt, für welche Aufgaben eine Erinnerung geplant werden soll.
 *
 * Bewusst eine reine Funktion ohne Datenbank, Uhr oder Plugin – dadurch lässt
 * sich das Verhalten vollständig und schnell testen.
 *
 * Regeln:
 *  - Nur Aufgaben mit Fälligkeitsdatum (inklusive Uhrzeit).
 *  - Erledigte und gelöschte Aufgaben erinnern nicht.
 *  - Zeitpunkte in der Vergangenheit werden nicht geplant. Eine Aufgabe, die
 *    während einer Offline-Phase fällig geworden ist, würde sonst beim ersten
 *    Sync eine Benachrichtigung auslösen – das wäre Lärm, keine Erinnerung.
 */

export interface ReminderCandidate {
  taskId: string
  /** Überschrift der Benachrichtigung. */
  title: string
  /** Zusatzzeile – hier der Name der Liste als Kontext. */
  body: string
  at: string
}

export function planReminders(tasks: LocalTask[], lists: LocalList[], nowMs: number): ReminderCandidate[] {
  const listNames = new Map(lists.map((list) => [list.id, list.name]))

  const candidates: ReminderCandidate[] = []
  for (const task of tasks) {
    if (task.deleted_at !== null) continue
    if (task.completed) continue
    if (task.due_at === null) continue

    const dueMs = Date.parse(task.due_at)
    if (Number.isNaN(dueMs) || dueMs <= nowMs) continue

    candidates.push({
      taskId: task.id,
      title: task.title,
      body: listNames.get(task.list_id) ?? 'prio',
      at: normalizeIso(task.due_at),
    })
  }

  // Stabile Reihenfolge: erst nach Zeit, dann nach ID. Das erleichtert
  // Vergleiche in Tests und macht das Verhalten nachvollziehbar.
  return candidates.sort((a, b) => a.at.localeCompare(b.at) || a.taskId.localeCompare(b.taskId))
}
