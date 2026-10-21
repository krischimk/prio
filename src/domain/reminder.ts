import { normalizeIso } from './clock'
import { isRecurrence } from './recurrence'
import type { IsoDateTime } from './types'

/**
 * Erinnerungen einer Aufgabe – getrennt von der Fälligkeit.
 *
 * Die Absicht des Benutzers steht an der Aufgabe, die Buchhaltung der
 * tatsächlich geplanten Alarme bleibt lokal (`reminders`-Tabelle). Eine Aufgabe
 * kann mehrere Erinnerungen tragen. Feste Zeitpunkte bleiben unabhängig;
 * Vorlagen wie „10 Minuten vorher“ bleiben an die Fälligkeit gebunden, auch
 * bei einmaligen Aufgaben. Eine Serie benötigt Vorläufe, damit jede Ausführung
 * erinnert wird. Ohne Fälligkeit werden Vorläufe gegen den bisherigen Termin
 * in feste, noch zukünftige Zeitpunkte umgerechnet.
 *
 * Diese Datei kennt weder Datenbank noch Oberfläche und ist damit vollständig
 * testbar.
 */

/**
 * Eine einzelne Erinnerung.
 *
 * Die Form speichert die Absicht: einen festen Moment oder einen Abstand zur
 * Fälligkeit. Beide dürfen bei einer einmaligen Aufgabe nebeneinander stehen.
 */
export type TaskReminder = { mutedBy?: string[] } & (
  | { form: 'absolute'; at: IsoDateTime }
  | { form: 'offset'; minutes: number }
)

export interface ReminderFields {
  due_at: IsoDateTime | null
  recurrence: string | null
  reminders: TaskReminder[]
}

/**
 * Was ein Formular mitschickt.
 *
 * `reminders` ist **optional**, und der Unterschied ist wichtig: `undefined`
 * heißt „dazu habe ich nichts gesagt" – dann wird die bisherige Liste in die
 * neue Form umgerechnet. Eine leere Liste heißt „keine Erinnerungen" und wird
 * wörtlich genommen. Ohne diese Unterscheidung würde ein Löschen die
 * Erinnerungen wiederbeleben.
 */
export interface ReminderTarget {
  due_at: IsoDateTime | null
  recurrence: string | null
  reminders?: TaskReminder[]
}

const MINUTE_MS = 60_000

/** Obergrenze für Vorläufe: fünf Jahre. Darüber ist es mit Sicherheit ein Irrtum. */
export const MAX_OFFSET_MINUTES = 5 * 365 * 24 * 60

/**
 * Wie viele Erinnerungen eine Aufgabe tragen kann.
 *
 * Eine Grenze muss sein: Jede Erinnerung ist ein Alarm beim Betriebssystem.
 * Zehn sind großzügig und halten eine verbogene Zeile davon ab, das Gerät mit
 * Hunderten von Terminen zu fluten.
 */
export const MAX_REMINDERS = 10

/**
 * `true`, wenn diese Person die Erinnerung nicht bekommen will.
 *
 * Die Stummschaltung ist eine Angabe **je Person**, und sie liegt trotzdem in
 * der Aufgabe – die gehört der Liste, und die Liste gehört allen. Eine eigene
 * Tabelle für „wer will das nicht" wäre der vierte Sync-Pfad für eine
 * Handvoll Kennungen; siehe README.
 *
 * Wer hier nicht steht, bekommt die Erinnerung. Fehlt das Feld ganz, gilt sie
 * für alle – so verhalten sich auch Aufgaben aus der Zeit vor dieser Funktion.
 */
export function isMutedFor(reminder: TaskReminder, viewerId: string): boolean {
  return reminder.mutedBy?.includes(viewerId) ?? false
}

/** Setzt oder entfernt die Stummschaltung einer Person. */
export function withMuted(
  reminder: TaskReminder,
  viewerId: string,
  muted: boolean,
): TaskReminder {
  const andere = (reminder.mutedBy ?? []).filter((id) => id !== viewerId)
  const mutedBy = muted ? [...andere, viewerId] : andere

  // Leere Listen kommen gar nicht erst in die Daten – sonst wüchse die Zeile
  // mit jedem Stummschalten und wieder Einschalten.
  if (reminder.form === 'absolute') {
    return mutedBy.length > 0
      ? { form: 'absolute', at: reminder.at, mutedBy }
      : { form: 'absolute', at: reminder.at }
  }
  return mutedBy.length > 0
    ? { form: 'offset', minutes: reminder.minutes, mutedBy }
    : { form: 'offset', minutes: reminder.minutes }
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

/** Der Zeitpunkt einer Erinnerung, gerechnet gegen eine Fälligkeit. */
export function reminderTimeOf(
  reminder: TaskReminder,
  dueAt: IsoDateTime | null,
): IsoDateTime | null {
  if (reminder.form === 'absolute') return reminder.at
  return timeFromOffset(dueAt, reminder.minutes)
}

/**
 * Bringt Wiederholung, Fälligkeit und Erinnerungen in eine widerspruchsfreie
 * Form.
 *
 * Der eine Ort, an dem die Regeln stehen – nicht in den Formularen. Beide
 * Oberflächen rufen dieselbe Funktion über die Repositories auf, und ein
 * fehlerhaftes Formular kann keine widersprüchlichen Daten erzeugen.
 *
 * Ohne ausdrückliche Erinnerungsliste bleiben die bisherigen Einträge erhalten.
 * Eine leere Liste löscht sie. Serien benötigen Vorläufe; ohne Fälligkeit
 * werden diese gegen den bisherigen Termin in feste Zeitpunkte umgerechnet.
 * Einmalige Aufgaben mit Fälligkeit behalten beide Formen und ihre Bindung.
 */
export function alignReminders(
  previous: ReminderFields | null,
  next: ReminderTarget,
  nowMs: number,
): ReminderFields {
  const dueAt = next.due_at === null ? null : normalizeIso(next.due_at)

  // Ohne Fälligkeit gibt es nichts fortzuschreiben – weder eine Wiederholung
  // noch einen Vorlauf.
  const recurrence = dueAt !== null && isRecurrence(next.recurrence) ? next.recurrence : null
  // Beim Entfernen der Fälligkeit gibt es nur noch die alte als Bezugspunkt.
  const bezug = dueAt ?? previous?.due_at ?? null

  const roh = next.reminders ?? previous?.reminders ?? []
  const forcedForm = recurrence !== null ? 'offset' : dueAt === null ? 'absolute' : null

  return {
    due_at: dueAt,
    recurrence,
    reminders: normalisieren(roh, bezug, forcedForm, nowMs),
  }
}

/**
 * Rechnet in die verlangte Form um und erhält die Stummschaltungen.
 */
function umformen(
  reminders: TaskReminder[],
  dueAt: IsoDateTime | null,
  relativ: boolean,
  nowMs: number,
): TaskReminder[] {
  const ergebnis: TaskReminder[] = []
  for (const reminder of reminders) {
    // Wer stummgeschaltet hat, bleibt es – auch wenn die Form wechselt.
    const stumm = reminder.mutedBy !== undefined ? { mutedBy: reminder.mutedBy } : {}
    if (relativ) {
      const minutes =
        reminder.form === 'offset'
          ? reminder.minutes
          : offsetFromAbsolute(dueAt, reminder.at)
      if (minutes !== null) ergebnis.push({ form: 'offset', minutes, ...stumm })
    } else {
      const at =
        reminder.form === 'absolute'
          ? reminder.at
          : absoluteFromOffset(dueAt, reminder.minutes, nowMs)
      if (at !== null) ergebnis.push({ form: 'absolute', at, ...stumm })
    }
  }
  return ergebnis
}

/** Wirft Unbrauchbares weg, entfernt Doppelte und begrenzt die Anzahl. */
function normalisieren(
  reminders: TaskReminder[],
  dueAt: IsoDateTime | null,
  forcedForm: TaskReminder['form'] | null,
  nowMs: number,
): TaskReminder[] {
  const ergebnis: TaskReminder[] = []
  const gesehen = new Set<string>()

  const prepared = forcedForm === null ? reminders : umformen(reminders, dueAt, forcedForm === 'offset', nowMs)
  for (const reminder of prepared) {
    if (reminder.form === 'offset' && !isPlausibleOffset(reminder.minutes)) continue
    const schluessel =
      reminder.form === 'offset' ? `o:${reminder.minutes}` : `a:${normalizeIso(reminder.at)}`
    if (gesehen.has(schluessel)) continue
    gesehen.add(schluessel)
    const stumm = reminder.mutedBy !== undefined ? { mutedBy: reminder.mutedBy } : {}
    ergebnis.push(
      reminder.form === 'offset'
        ? { form: 'offset', minutes: Math.round(reminder.minutes), ...stumm }
        : { form: 'absolute', at: normalizeIso(reminder.at), ...stumm },
    )
    if (ergebnis.length >= MAX_REMINDERS) break
  }

  return ergebnis
}

/**
 * Liest eine Erinnerungsliste, wie sie aus der Datenbank kommt.
 *
 * Muss mit allem zurechtkommen: `null` aus einer alten Zeile, Freitext von
 * Hand, Werte aus einer neueren Fassung. Unbekanntes wird still fallen
 * gelassen – eine kaputte Zeile darf die Aufgabe nicht unlesbar machen.
 */
export function parseReminders(wert: unknown): TaskReminder[] {
  if (!Array.isArray(wert)) return []
  const ergebnis: TaskReminder[] = []
  for (const eintrag of wert) {
    if (typeof eintrag !== 'object' || eintrag === null) continue
    const form = (eintrag as { form?: unknown }).form
    const stumm = leseMutedBy((eintrag as { mutedBy?: unknown }).mutedBy)

    if (form === 'absolute') {
      const at = (eintrag as { at?: unknown }).at
      if (typeof at !== 'string') continue
      try {
        ergebnis.push({ form: 'absolute', at: normalizeIso(at), ...stumm })
      } catch {
        // Ein ungültiger Zeitstempel ist kein Grund, den Rest zu verlieren.
      }
    } else if (form === 'offset') {
      const minutes = (eintrag as { minutes?: unknown }).minutes
      if (typeof minutes === 'number' && isPlausibleOffset(minutes)) {
        ergebnis.push({ form: 'offset', minutes: Math.round(minutes), ...stumm })
      }
    }
  }
  return ergebnis.slice(0, MAX_REMINDERS)
}

/** Liest die Stummschaltungen; alles Unbrauchbare fällt weg. */
function leseMutedBy(wert: unknown): { mutedBy?: string[] } {
  if (!Array.isArray(wert)) return {}
  const kennungen = wert.filter((eintrag): eintrag is string => typeof eintrag === 'string')
  return kennungen.length > 0 ? { mutedBy: kennungen } : {}
}
