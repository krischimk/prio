import { useEffect, useRef } from 'react'
import { isRecurrence } from '../../domain/recurrence'
import {
  MAX_REMINDERS,
  absoluteFromOffset,
  offsetFromAbsolute,
  type TaskReminder,
} from '../../domain/reminder'
import { reminderSuggestion } from '../reminder'

/**
 * Der Zustand der Erinnerungsliste einer Aufgabe.
 *
 * Aus `ReminderList.tsx` herausgelöst (457 Zeilen, vier Komponenten): Die
 * Komponente zeichnet, was hier entschieden wird. Verhalten unverändert.
 */
export function useReminderRows({
  dueAt,
  recurrence,
  reminders,
  onChange,
}: {
  dueAt: string | null
  recurrence: string | null
  reminders: TaskReminder[]
  onChange: (next: TaskReminder[]) => void
}) {
  const relativ = isRecurrence(recurrence) && dueAt !== null

  /*
   * Wechselt die Form, wandert jede Erinnerung mit.
   *
   * Sonst stünde im Formular etwas anderes, als beim Speichern herauskäme. Das
   * Repository rechnet zwar ebenfalls um, aber nur wenn das Formular zur Liste
   * nichts sagt; hier sagt es etwas, und deshalb muss es das Richtige sagen.
   */
  const vorherRelativ = useRef(relativ)
  useEffect(() => {
    if (vorherRelativ.current === relativ) return
    vorherRelativ.current = relativ
    onChange(umformen(reminders, dueAt, relativ, Date.now()))
    // Absichtlich nur am Formwechsel aufgehängt; die Liste ist die Quelle.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [relativ])

  const ersetzen = (index: number, neu: TaskReminder) => {
    onChange(reminders.map((eintrag, i) => (i === index ? neu : eintrag)))
  }

  const entfernen = (index: number) => {
    onChange(reminders.filter((_, i) => i !== index))
  }

  const hinzufuegen = () => {
    if (reminders.length >= MAX_REMINDERS) return
    onChange([...reminders, reminderSuggestion(recurrence, dueAt, Date.now(), reminders)])
  }

  return { relativ, ersetzen, entfernen, hinzufuegen }
}

/**
 * Bringt eine Liste in die Form, die zur Wiederholung passt.
 *
 * Dieselbe Umrechnung wie in `alignReminders`, nur für die Anzeige: Beim
 * Wechsel der Wiederholung soll im Formular sofort stehen, was gespeichert
 * würde.
 */
function umformen(
  reminders: TaskReminder[],
  dueAt: string | null,
  relativ: boolean,
  nowMs: number,
): TaskReminder[] {
  const ergebnis: TaskReminder[] = []
  for (const reminder of reminders) {
    if (relativ) {
      const minutes =
        reminder.form === 'offset' ? reminder.minutes : offsetFromAbsolute(dueAt, reminder.at)
      if (minutes !== null) ergebnis.push({ form: 'offset', minutes })
    } else {
      const at =
        reminder.form === 'absolute'
          ? reminder.at
          : absoluteFromOffset(dueAt, reminder.minutes, nowMs)
      if (at !== null) ergebnis.push({ form: 'absolute', at })
    }
  }
  return ergebnis
}
