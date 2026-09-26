import { normalizeIso } from './clock'
import { isRecurrence } from './recurrence'
import type { IsoDateTime } from './types'

/**
 * Erinnerung und Fälligkeit auseinanderhalten.
 *
 * Die Absicht des Benutzers steht an der Aufgabe, die Buchhaltung der
 * tatsächlich geplanten Alarme bleibt lokal (`reminders`-Tabelle). Damit die
 * beiden Formen nicht auseinanderlaufen, gibt es hier genau eine Regel:
 *
 *   **Die Form der Erinnerung folgt der Wiederholung.**
 *
 *   * einmalige Aufgabe  → `remind_at`, ein absoluter Zeitpunkt
 *   * wiederkehrende     → `reminder_offset_minutes`, ein Vorlauf
 *
 * Warum keine andere Aufteilung: Eine absolute Erinnerung an einer
 * wiederkehrenden Aufgabe feuerte genau einmal und wäre ab der zweiten
 * Ausführung falsch. Ein Vorlauf an einer einmaligen Aufgabe könnte nichts, was
 * ein absoluter Zeitpunkt nicht auch könnte – außer sich beim Verschieben der
 * Fälligkeit mitzubewegen, was bei einer einmaligen Aufgabe nicht passiert.
 *
 * Diese Datei kennt weder Datenbank noch Oberfläche und ist damit vollständig
 * testbar.
 */

export type ReminderForm = 'none' | 'absolute' | 'relative'

export interface ReminderFields {
  due_at: IsoDateTime | null
  recurrence: string | null
  remind_at: IsoDateTime | null
  reminder_offset_minutes: number | null
}

/**
 * Was ein Formular mitschickt.
 *
 * Die beiden Erinnerungsfelder sind **optional**, und der Unterschied ist
 * wichtig: `undefined` heißt „dazu habe ich nichts gesagt" – dann wird der
 * bisherige Wert in die neue Form umgerechnet. `null` heißt „keine Erinnerung"
 * und wird wörtlich genommen. Ohne diese Unterscheidung würde ein Löschen die
 * Erinnerung wiederbeleben.
 */
export interface ReminderTarget {
  due_at: IsoDateTime | null
  recurrence: string | null
  remind_at?: IsoDateTime | null
  reminder_offset_minutes?: number | null
}

const MINUTE_MS = 60_000

/** Obergrenze für Vorläufe: fünf Jahre. Darüber ist es mit Sicherheit ein Irrtum. */
const MAX_OFFSET_MINUTES = 5 * 365 * 24 * 60

export function reminderFormFor(
  recurrence: string | null,
  dueAt: IsoDateTime | null,
): ReminderForm {
  if (dueAt === null) return 'none'
  return isRecurrence(recurrence) ? 'relative' : 'absolute'
}

/**
 * Rechnet einen absoluten Erinnerungszeitpunkt in einen Vorlauf um.
 *
 * Wird gebraucht, wenn aus einer einmaligen Aufgabe eine wiederkehrende wird:
 * Der Moment bleibt derselbe, nur die Darstellung wechselt.
 */
export function offsetFromAbsolute(
  dueAt: IsoDateTime | null,
  remindAt: IsoDateTime | null,
): number | null {
  if (dueAt === null || remindAt === null) return null
  const abstand = Date.parse(dueAt) - Date.parse(remindAt)
  if (!Number.isFinite(abstand)) return null
  return Math.round(abstand / MINUTE_MS)
}

/**
 * Zeitpunkt aus Fälligkeit und Vorlauf – ohne Prüfung, ob er schon vorbei ist.
 *
 * Die Oberfläche braucht das für ihre Vorschau: Sie soll auch dann zeigen, was
 * herauskommt, wenn nichts geplant würde.
 */
export function timeFromOffset(
  dueAt: IsoDateTime | null,
  offsetMinutes: number | null,
): IsoDateTime | null {
  if (dueAt === null || offsetMinutes === null) return null
  const zeitpunkt = Date.parse(dueAt) - offsetMinutes * MINUTE_MS
  if (!Number.isFinite(zeitpunkt)) return null
  return new Date(zeitpunkt).toISOString()
}

/**
 * Rechnet einen Vorlauf in einen absoluten Zeitpunkt um.
 *
 * Wird gebraucht, wenn aus einer wiederkehrenden Aufgabe eine einmalige wird.
 * Liegt das Ergebnis hinter `nowMs`, ist es `null`: Eine Erinnerung, die schon
 * vorbei ist, ist keine – und die Absicht dafür aufzubewahren wäre irreführend.
 */
export function absoluteFromOffset(
  dueAt: IsoDateTime | null,
  offsetMinutes: number | null,
  nowMs: number,
): IsoDateTime | null {
  const zeitpunkt = timeFromOffset(dueAt, offsetMinutes)
  if (zeitpunkt === null) return null
  if (Date.parse(zeitpunkt) <= nowMs) return null
  return zeitpunkt
}

/** `true`, wenn der Vorlauf innerhalb des Erlaubten liegt. */
export function isPlausibleOffset(minutes: number): boolean {
  return Number.isFinite(minutes) && Math.abs(minutes) <= MAX_OFFSET_MINUTES
}

/**
 * Bringt Wiederholung, Fälligkeit und Erinnerung in eine widerspruchsfreie Form.
 *
 * Der eine Ort, an dem die Regeln stehen – nicht in den Formularen. Beide
 * Oberflächen rufen dieselbe Funktion über die Repositories auf, und ein
 * fehlerhaftes Formular kann keine widersprüchlichen Daten erzeugen.
 *
 * Umgesetzt wird nur, wenn das Formular zur neuen Form **nichts sagt**
 * (`undefined`). Sagt es etwas – auch `null` –, gilt das wörtlich.
 *
 * Wechselt die Form und das Formular hat den Wert nicht mitgeschickt, wird der
 * Moment umgerechnet, damit er erhalten bleibt:
 *
 *   einmalig → wiederkehrend   absoluter Zeitpunkt wird zum Vorlauf
 *   wiederkehrend → einmalig   Vorlauf wird zum Zeitpunkt, solange der noch in
 *                              der Zukunft liegt
 *
 * Eine Fälligkeit, die verschwindet, nimmt die Wiederholung mit (sie braucht
 * einen Bezugspunkt). Die Erinnerung wandert dabei in die absolute Form – das
 * Entfernen des einen darf das andere nicht still löschen.
 */
export function alignReminder(
  previous: ReminderFields | null,
  next: ReminderTarget,
  nowMs: number,
): ReminderFields {
  const dueAt = next.due_at === null ? null : normalizeIso(next.due_at)

  // Ohne Fälligkeit gibt es nichts fortzuschreiben – weder eine Wiederholung
  // noch einen Vorlauf.
  const recurrence = dueAt !== null && isRecurrence(next.recurrence) ? next.recurrence : null

  const vorherRelativ =
    previous !== null && previous.due_at !== null && isRecurrence(previous.recurrence)
  const formWechselt = vorherRelativ !== (recurrence !== null)

  if (recurrence !== null) {
    let offset: number | null
    if (next.reminder_offset_minutes !== undefined) {
      offset = brauchbarerVorlauf(next.reminder_offset_minutes)
    } else if (formWechselt) {
      offset = offsetFromAbsolute(
        next.due_at ?? previous?.due_at ?? null,
        next.remind_at ?? previous?.remind_at ?? null,
      )
    } else {
      offset = previous === null ? null : previous.reminder_offset_minutes
    }

    return {
      due_at: dueAt,
      recurrence,
      // Bei wiederkehrenden Aufgaben gilt immer der Vorlauf.
      remind_at: null,
      reminder_offset_minutes: offset,
    }
  }

  let at: IsoDateTime | null
  if (next.remind_at !== undefined) {
    at = next.remind_at === null ? null : normalizeIso(next.remind_at)
  } else if (formWechselt) {
    at = absoluteFromOffset(
      // Beim Entfernen der Fälligkeit gibt es nur noch die alte als Bezug.
      dueAt ?? previous?.due_at ?? null,
      next.reminder_offset_minutes ?? previous?.reminder_offset_minutes ?? null,
      nowMs,
    )
  } else {
    at = previous === null ? null : previous.remind_at
  }

  return {
    due_at: dueAt,
    recurrence: null,
    remind_at: at,
    reminder_offset_minutes: null,
  }
}

function brauchbarerVorlauf(minutes: number | null): number | null {
  if (minutes === null || !isPlausibleOffset(minutes)) return null
  return Math.round(minutes)
}
