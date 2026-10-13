import { useEffect, useRef } from 'react'
import { isRecurrence } from '../../domain/recurrence'
import { MAX_REMINDERS, alignReminders, type TaskReminder } from '../../domain/reminder'
import { sameData } from '../../domain/equality'
import { reminderSuggestion } from '../reminder'

/**
 * Der Zustand der Erinnerungsliste einer Aufgabe.
 *
 * Aus `ReminderList.tsx` herausgelöst (457 Zeilen, vier Komponenten): Die
 * Komponente zeichnet, was hier entschieden wird.
 *
 * Die Ausrichtung kommt aus der Domäne (`alignReminders`) – eine
 * Fassung, nicht zwei: Die zweite hier vergaß die Stummschaltung.
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
   * Fälligkeit und Wiederholung richten Erinnerungen wie beim Speichern aus.
   *
   * Sonst stünde im Formular etwas anderes, als beim Speichern herauskäme. Das
   * Repository rechnet zwar ebenfalls um, aber nur wenn das Formular zur Liste
   * nichts sagt; hier sagt es etwas, und deshalb muss es das Richtige sagen.
   */
  const previous = useRef({ dueAt, recurrence })
  useEffect(() => {
    const before = previous.current
    if (before.dueAt === dueAt && before.recurrence === recurrence) return
    previous.current = { dueAt, recurrence }
    const next = alignReminders({ due_at: before.dueAt, recurrence: before.recurrence, reminders },
      { due_at: dueAt, recurrence }, Date.now()).reminders
    if (!sameData(next, reminders)) onChange(next)
  }, [dueAt, recurrence, reminders, onChange])

  const ersetzen = (index: number, neu: TaskReminder) => {
    onChange(reminders.map((eintrag, i) => (i === index ? neu : eintrag)))
  }

  const entfernen = (index: number) => {
    onChange(reminders.filter((_, i) => i !== index))
  }

  const hinzufuegen = () => {
    if (reminders.length >= MAX_REMINDERS) return
    onChange([...reminders, reminderSuggestion(dueAt, Date.now(), reminders)])
  }

  return { relativ, ersetzen, entfernen, hinzufuegen }
}
