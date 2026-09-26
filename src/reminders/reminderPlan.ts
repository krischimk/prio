import { normalizeIso } from '../domain/clock'
import type { LocalList, LocalTask } from '../domain/types'

/**
 * Ermittelt, für welche Aufgaben eine Erinnerung geplant werden soll.
 *
 * Bewusst eine reine Funktion ohne Datenbank, Uhr oder Plugin – dadurch lässt
 * sich das Verhalten vollständig und schnell testen.
 *
 * Regeln:
 *  - **Wann** erinnert wird, steht an der Aufgabe und hängt an ihrer Form:
 *    wiederkehrende Aufgaben tragen einen Vorlauf (`reminder_offset_minutes`,
 *    vorzeichenbehaftet – negativ heißt *nach* der Fälligkeit), einmalige einen
 *    absoluten Zeitpunkt (`remind_at`). Die Form folgt der Wiederholung und
 *    wird in `alignReminder` festgelegt.
 *  - Erledigte und gelöschte Aufgaben erinnern nicht. Ein Nachempfinden für
 *    eine offene Aufgabe verstummt also, sobald sie abgehakt ist.
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

const MINUTE_MS = 60_000

/**
 * Der Zeitpunkt, zu dem eine Aufgabe erinnern soll – oder `null`.
 *
 * Ausgelagert und exportiert, weil die Oberfläche denselben Wert für ihre
 * Vorschau braucht („Erinnert am …"). Zwei Rechenwege für dieselbe Zahl wären
 * genau die Art Abweichung, die man erst im Betrieb merkt.
 */
export function reminderTimeFor(task: LocalTask): string | null {
  if (task.recurrence !== null && task.due_at !== null) {
    const offset = task.reminder_offset_minutes
    if (offset === null || !Number.isFinite(offset)) return null
    const zeitpunkt = Date.parse(task.due_at) - offset * MINUTE_MS
    if (!Number.isFinite(zeitpunkt)) return null
    return new Date(zeitpunkt).toISOString()
  }
  return task.remind_at
}

export function planReminders(tasks: LocalTask[], lists: LocalList[], nowMs: number): ReminderCandidate[] {
  const listNames = new Map(lists.map((list) => [list.id, list.name]))

  const candidates: ReminderCandidate[] = []
  for (const task of tasks) {
    if (task.deleted_at !== null) continue
    if (task.completed) continue

    const at = reminderTimeFor(task)
    if (at === null) continue

    const atMs = Date.parse(at)
    if (Number.isNaN(atMs) || atMs <= nowMs) continue

    candidates.push({
      taskId: task.id,
      title: task.title,
      body: listNames.get(task.list_id) ?? 'prio',
      at: normalizeIso(at),
    })
  }

  // Stabile Reihenfolge: erst nach Zeit, dann nach ID. Das erleichtert
  // Vergleiche in Tests und macht das Verhalten nachvollziehbar.
  return candidates.sort((a, b) => a.at.localeCompare(b.at) || a.taskId.localeCompare(b.taskId))
}
