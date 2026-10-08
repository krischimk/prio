import { useCallback, useState, type FormEvent } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import type { TaskReminder } from '../domain/reminder'
import type { LocalTask } from '../domain/types'
import { fromDateTimeLocalValue, toDateTimeLocalValue } from './datetime'

/** Die Felder eines Aufgabenformulars – in der Form, in der sie getippt werden. */
export interface TaskFormWerte {
  title: string
  description: string
  /** Als `datetime-local`-Wert, so wie das Feld ihn führt. */
  dueAt: string
  recurrence: string
  reminders: TaskReminder[]
  sectionId: string | null
}

export interface TaskForm {
  werte: TaskFormWerte
  setzen: <F extends keyof TaskFormWerte>(feld: F, wert: TaskFormWerte[F]) => void
  /** Leert das Formular – für das Anlegen mehrerer Aufgaben hintereinander. */
  zuruecksetzen: () => void
  /** Die Fälligkeit als Zeitpunkt, wie `ReminderList` und `RecurrenceSelect` ihn brauchen. */
  dueIso: string | null
  busy: boolean
  speichern: (event: FormEvent) => Promise<void>
  /**
   * `true`, wenn im Formular etwas anders steht als beim Öffnen.
   *
   * Gebraucht wird das beim Schließen über das Kreuz: Die Änderungen sind dann
   * nicht gespeichert, und das soll nicht stillschweigend passieren.
   */
  geaendert: boolean
}

function werteVon(task: LocalTask | null): TaskFormWerte {
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    dueAt: toDateTimeLocalValue(task?.due_at ?? null),
    recurrence: task?.recurrence ?? '',
    reminders: task?.reminders ?? [],
    sectionId: task?.section_id ?? null,
  }
}

/**
 * Der Zustand eines Aufgabenformulars – einmal, für alle drei Formulare.
 *
 * Dieselben Felder, dieselben Umwandlungen (`datetime-local` ↔ Zeitpunkt),
 * dieselbe Prüfung („ohne Titel speichern wir nicht") und dieselbe Sperre
 * während des Schreibens standen vorher dreimal im Code: in der Aufgabenzeile,
 * in der Detailansicht und in der Eingabezeile. Sie waren schon
 * auseinandergelaufen – das Anlegen in der breiten Ansicht konnte weniger als
 * das auf dem Telefon.
 *
 * Das **Aussehen** gehört nicht hierher: `TaskFields` rendert die Felder, der
 * Rahmen (Karte, Blatt, Eingabezeile) bleibt beim Aufrufer.
 */
export function useTaskForm({
  task,
  listId,
  onSaved,
}: {
  /** `null` legt eine neue Aufgabe an. */
  task: LocalTask | null
  listId: string
  /** Wird nach erfolgreichem Speichern gerufen – schließen bzw. leeren. */
  onSaved: () => void
}): TaskForm {
  const { repositories } = useWorkspace()
  const [werte, setWerte] = useState<TaskFormWerte>(() => werteVon(task))
  /**
   * Der Stand beim Öffnen – daran wird „geändert" gemessen.
   *
   * Als Zustand, nicht als Ref: Gelesen wird er beim Rendern, und ein Ref
   * gehört nicht dorthin (er löst kein Neuzeichnen aus).
   */
  const [start, setStart] = useState<TaskFormWerte>(() => werteVon(task))
  const [busy, setBusy] = useState(false)

  const setzen = useCallback(<F extends keyof TaskFormWerte>(feld: F, wert: TaskFormWerte[F]) => {
    setWerte((alte) => ({ ...alte, [feld]: wert }))
  }, [])

  const zuruecksetzen = useCallback(() => {
    setStart(werteVon(null))
    setWerte(werteVon(null))
  }, [])

  const speichern = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || werte.title.trim().length === 0) return
    setBusy(true)
    try {
      const eingabe = {
        title: werte.title,
        description: werte.description,
        dueAt: fromDateTimeLocalValue(werte.dueAt),
        recurrence: werte.recurrence === '' ? null : werte.recurrence,
        reminders: werte.reminders,
        sectionId: werte.sectionId,
      }
      if (task === null) {
        await repositories.createTask({ listId, ...eingabe })
      } else {
        await repositories.updateTask(task.id, eingabe)
      }
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  return {
    werte,
    setzen,
    zuruecksetzen,
    dueIso: fromDateTimeLocalValue(werte.dueAt),
    busy,
    speichern,
    // Ein Vergleich der Werte, kein zweites Buchführungsfeld: So kann die
    // Anzeige nicht auseinanderlaufen.
    geaendert: JSON.stringify(werte) !== JSON.stringify(start),
  }
}
