import { normalizeIso } from '../domain/clock'
import { isMutedFor, parseReminders, reminderTimeOf } from '../domain/reminder'
import type { LocalList, LocalTask } from '../domain/types'

/**
 * Ermittelt, für welche Aufgaben eine Erinnerung geplant werden soll.
 *
 * Bewusst eine reine Funktion ohne Datenbank, Uhr oder Plugin – dadurch lässt
 * sich das Verhalten vollständig und schnell testen.
 *
 * Regeln:
 *  - **Wann** erinnert wird, steht an der Aufgabe: als Liste von Vorläufen
 *    (wiederkehrende Aufgaben, vorzeichenbehaftet – negativ heißt *nach* der
 *    Fälligkeit) oder absoluten Zeitpunkten (einmalige). Die Form folgt der
 *    Wiederholung und wird in `alignReminders` festgelegt.
 *  - **Jede Erinnerung wird ein eigener Termin.** Eine Aufgabe mit „1 Tag
 *    vorher" und „1 Std vorher" plant zwei Benachrichtigungen.
 *  - **Stummgeschaltete Erinnerungen werden für diese Person übersprungen**,
 *    für alle anderen aber weiter geplant – siehe `isMutedFor`.
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

/**
 * Die Zeitpunkte, zu denen eine Aufgabe erinnern soll – in stabilem Format,
 * ohne Vergangenheitsprüfung.
 *
 * Ausgelagert und exportiert, weil die Oberfläche dieselben Werte für ihre
 * Vorschau braucht („Erinnert am …"). Zwei Rechenwege für dieselbe Zahl wären
 * genau die Art Abweichung, die man erst im Betrieb merkt.
 */
export function reminderTimesFor(task: LocalTask, viewerId: string | null = null): string[] {
  // `parseReminders` statt direktem Zugriff: Eine Zeile aus einer älteren
  // Fassung hat das Feld womöglich gar nicht, und ein `undefined` darf die
  // Aufgabe nicht unlesbar machen.
  return parseReminders(task.reminders)
    // Wer stummgeschaltet hat, wird nicht geweckt. Ohne Kennung (Tests, alte
    // Aufrufer) gilt jede Erinnerung als gewünscht.
    .filter((reminder) => viewerId === null || !isMutedFor(reminder, viewerId))
    .map((reminder) => reminderTimeOf(reminder, task.due_at))
    .filter((at): at is string => at !== null)
}

export function planReminders(
  tasks: LocalTask[],
  lists: LocalList[],
  nowMs: number,
  viewerId: string | null = null,
): ReminderCandidate[] {
  const listNames = new Map(lists.map((list) => [list.id, list.name]))

  const candidates: ReminderCandidate[] = []
  for (const task of tasks) {
    if (task.deleted_at !== null) continue
    if (task.completed) continue

    // Eine Aufgabe kann mehrere Erinnerungen tragen – jede wird ein eigener
    // Termin beim Betriebssystem.
    for (const at of reminderTimesFor(task, viewerId)) {
      const atMs = Date.parse(at)
      if (Number.isNaN(atMs) || atMs <= nowMs) continue

      candidates.push({
        taskId: task.id,
        title: task.title,
        body: listNames.get(task.list_id) ?? 'PRIO',
        at: normalizeIso(at),
      })
    }
  }

  // Stabile Reihenfolge: erst nach Zeit, dann nach ID. Das erleichtert
  // Vergleiche in Tests und macht das Verhalten nachvollziehbar.
  return candidates.sort((a, b) => a.at.localeCompare(b.at) || a.taskId.localeCompare(b.taskId))
}
