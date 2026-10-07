import { isMutedFor, reminderTimeOf, type TaskReminder } from '../domain/reminder'
import type { LocalTask } from '../domain/types'
import { formatReminderLabel } from './datetime'

/**
 * Texte rund um die Erinnerungen.
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

/** Kurzform für die Auswahlliste eines Vorlaufs, ohne Richtungswort. */
export function formatOffsetChoice(minutes: number): string {
  return minutes === 0 ? 'Zur Fälligkeit' : formatDuration(minutes)
}

export interface ReminderLabel {
  /** Fertiger Text, z. B. „Erinnert: 15.02.2027, 17:30". */
  text: string
  /** `true`, wenn der Zeitpunkt hinter der Fälligkeit liegt (Nachlauf). */
  afterDue: boolean
  /** `true`, wenn diese Person die Erinnerung nicht bekommen will. */
  muted: boolean
}

/**
 * Die Erinnerungen als Zeilen unter einer Aufgabe – **eine je Erinnerung**.
 *
 * Leer, wenn es nichts zu sagen gibt: ohne Erinnerung, oder wenn eine ohnehin
 * zur Fälligkeit passiert – dann stünde in jeder Zeile dasselbe wie in der
 * Zeile darüber.
 */
export function describeReminders(task: LocalTask, viewerId: string | null = null): ReminderLabel[] {
  const dueMs = task.due_at === null ? null : Date.parse(task.due_at)

  // `task.reminders` ist am Leserand ergänzt (`normalize.ts`) – hier reicht der
  // direkte Zugriff.
  return task.reminders.flatMap((reminder) => {
    const at = reminderTimeOf(reminder, task.due_at)
    if (at === null) return []
    const atMs = Date.parse(at)
    if (!Number.isFinite(atMs)) return []

    // Eine stummgeschaltete Erinnerung bleibt sichtbar – sonst wüsste man nicht
    // mehr, warum man nicht geweckt wird. Sie wird nur als solche benannt.
    //
    // Deshalb wird sie auch dann gezeigt, wenn sie genau zur Fälligkeit
    // passiert: Für die anderen wäre das eine Dublette zur Zeile darüber, für
    // die stummgeschaltete Person ist es die einzige Spur ihrer Entscheidung.
    const muted = viewerId !== null && isMutedFor(reminder, viewerId)
    if (dueMs !== null && dueMs === atMs && !muted) return []
    return [
      {
        text: muted ? `${formatReminderLabel(at)} · für mich stumm` : formatReminderLabel(at),
        afterDue: dueMs !== null && atMs > dueMs,
        muted,
      },
    ]
  })
}

/**
 * Ein Vorschlag für eine neu hinzugefügte Erinnerung.
 *
 * Eine leere Zeile wäre unbrauchbar, also wird etwas Plausibles vorbelegt, das
 * sofort geändert werden kann: bei wiederkehrenden Aufgaben „zur Fälligkeit",
 * bei einmaligen die Fälligkeit selbst – und ohne Fälligkeit die nächste volle
 * Stunde.
 *
 * **Der Vorschlag weicht dem aus, was schon da ist.** Sonst ergäbe zweimal
 * „Weitere Erinnerung" zweimal denselben Wert, und beim Speichern fiele die
 * Dublette stillschweigend weg – eine Zeile, die man hinzufügt und die
 * verschwindet.
 */
export function reminderSuggestion(
  recurrence: string | null,
  dueAt: string | null,
  nowMs: number,
  vorhandene: TaskReminder[] = [],
): TaskReminder {
  const belegt = new Set(
    vorhandene.map((reminder) =>
      reminder.form === 'offset' ? `o:${reminder.minutes}` : `a:${reminder.at}`,
    ),
  )

  if (dueAt !== null && recurrence !== null) {
    for (const minuten of [0, 10, 60, 1440, -60, 2880]) {
      if (!belegt.has(`o:${minuten}`)) return { form: 'offset', minutes: minuten }
    }
    return { form: 'offset', minutes: 0 }
  }

  const basis =
    dueAt !== null
      ? Date.parse(dueAt)
      : (() => {
          const stunde = new Date(nowMs)
          stunde.setMinutes(0, 0, 0)
          stunde.setHours(stunde.getHours() + 1)
          return stunde.getTime()
        })()

  // Eine Stunde je Versuch zurück – so entsteht eine Reihe, die man sofort
  // auseinanderhalten kann.
  for (let schritt = 0; schritt < 6; schritt += 1) {
    const at = new Date(basis - schritt * 60 * 60 * 1000).toISOString()
    if (!belegt.has(`a:${at}`)) return { form: 'absolute', at }
  }
  return { form: 'absolute', at: new Date(basis).toISOString() }
}
