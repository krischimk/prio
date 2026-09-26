import { timeFromOffset } from '../domain/reminder'
import type { LocalTask } from '../domain/types'
import { reminderTimeFor } from '../reminders/reminderPlan'
import { formatReminderLabel, fromDateTimeLocalValue } from './datetime'

/**
 * Texte rund um die Erinnerung.
 *
 * Eine Stelle für beide Ansichten – wie `formatDueLabel` für die Fälligkeit.
 * Ohne das stünde „30 Min vorher" auf dem Telefon anders da als in der breiten
 * Ansicht, und genau das ist in diesem Projekt schon einmal passiert.
 */

/**
 * Die festen Stufen für wiederkehrende Aufgaben.
 *
 * Sie stehen im Code und nicht in der gespeicherten Schnellauswahl: Sonst
 * stünden sie nach einer Umbenennung doppelt in der Liste. Eigene Werte des
 * Benutzers kommen in `meta` dazu (`reminder_presets`).
 */
export const FIXED_REMINDER_STEPS: ReadonlyArray<number> = [0, 10, 60, 1440]

/** „1 Tag 1 Std 30 Min" – ohne Nullteile. */
export function formatDuration(minutes: number): string {
  const betrag = Math.abs(Math.round(minutes))
  const tage = Math.floor(betrag / 1440)
  const stunden = Math.floor((betrag % 1440) / 60)
  const minuten = betrag % 60

  const teile: string[] = []
  if (tage > 0) teile.push(tage === 1 ? '1 Tag' : `${tage} Tage`)
  if (stunden > 0) teile.push(stunden === 1 ? '1 Std' : `${stunden} Std`)
  if (minuten > 0) teile.push(minuten === 1 ? '1 Min' : `${minuten} Min`)
  return teile.length > 0 ? teile.join(' ') : '0 Min'
}

/** „Zur Fälligkeit", „1 Std 30 Min vorher", „4 Std nach der Fälligkeit". */
export function formatReminderOffset(minutes: number): string {
  if (minutes === 0) return 'Zur Fälligkeit'
  return minutes > 0
    ? `${formatDuration(minutes)} vorher`
    : `${formatDuration(minutes)} nach der Fälligkeit`
}

/**
 * Zeitpunkt aus Fälligkeit und Vorlauf, wie ihn die Vorschau zeigt.
 *
 * Anders als `absoluteFromOffset` wird auch ein Zeitpunkt in der Vergangenheit
 * ausgegeben: Sonst stünde in der Vorschau nichts, und der Nutzer wüsste nicht,
 * warum.
 */
export function reminderPreview(dueAt: string | null, offsetMinutes: number | null): string | null {
  return timeFromOffset(dueAt, offsetMinutes)
}

export interface ReminderLabel {
  /** Fertiger Text, z. B. „Erinnert: 15.02.2027, 17:30". */
  text: string
  /** `true`, wenn der Zeitpunkt hinter der Fälligkeit liegt (Nachlauf). */
  afterDue: boolean
}

/**
 * Was das Formular gerade vorgibt.
 *
 * Nur das Feld, das zur aktuellen Form gehört, wird gesetzt. Das andere bleibt
 * `undefined` – daran erkennt `alignReminder`, dass es den Moment beim Wechsel
 * der Form umrechnen soll. Ein ausdrückliches `null` heißt dagegen „keine
 * Erinnerung" und wird wörtlich übernommen.
 */
export interface ReminderValue {
  remindAt?: string | null
  reminderOffsetMinutes?: number | null
}

/**
 * Die Erinnerung als Zeile unter einer Aufgabe.
 *
 * `null`, wenn es nichts zu sagen gibt: Ohne Erinnerung, oder wenn sie ohnehin
 * zur Fälligkeit passiert – dann stünde in jeder Zeile dasselbe wie in der
 * Zeile darüber.
 */
export function describeReminder(task: LocalTask): ReminderLabel | null {
  const at = reminderTimeFor(task)
  if (at === null) return null

  const dueMs = task.due_at === null ? null : Date.parse(task.due_at)
  const atMs = Date.parse(at)
  if (dueMs !== null && dueMs === atMs) return null

  return {
    text: formatReminderLabel(at),
    afterDue: dueMs !== null && atMs > dueMs,
  }
}

/**
 * Voreinstellung beim Setzen einer Fälligkeit.
 *
 * Wer einen Termin einträgt, will in aller Regel auch daran erinnert werden –
 * das war vor der Trennung immer so, und ein stiller Wegfall wäre eine
 * Verschlechterung. Sobald eine Erinnerung gesetzt ist, rührt die Funktion
 * nichts mehr an: Auch das Löschen bleibt damit eine bewusste Entscheidung.
 */
export function defaultReminderForDue(dueAt: string | null, aktuell: ReminderValue): ReminderValue {
  if (dueAt === null) return aktuell
  if (aktuell.remindAt != null || aktuell.reminderOffsetMinutes != null) return aktuell
  return { remindAt: fromDateTimeLocalValue(dueAt) }
}
