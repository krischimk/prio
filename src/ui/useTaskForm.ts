import { useContext, useEffect, useRef, type FormEvent } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import { sameData } from '../domain/equality'
import { taskEditBase, TaskEditConflict, type TaskEditInput } from '../domain/taskEdit'
import type { LocalTask } from '../domain/types'
import { TaskDraftContext, type TaskDraft, type TaskFormWerte } from './taskDraftContext'
import { fromDateTimeLocalValue, toDateTimeLocalValue } from './datetime'

export type { TaskFormWerte } from './taskDraftContext'
export interface TaskForm {
  werte: TaskFormWerte
  setzen: <F extends keyof TaskFormWerte>(feld: F, wert: TaskFormWerte[F]) => void
  zuruecksetzen: () => void
  dueIso: string | null
  busy: boolean
  error: string | null
  /** Ersetzt den Entwurf bewusst durch den über Hooks gelesenen Stand. */
  neuLaden: (() => void) | null
  speichern: (event: FormEvent) => Promise<void>
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

/** Formularverhalten und Umwandlungen; Fachprüfung kommt aus taskEdit. */
export function useTaskForm({ task, listId, onSaved }: {
  task: LocalTask | null
  listId: string
  onSaved: () => void
}): TaskForm {
  const { repositories } = useWorkspace()
  const drafts = useContext(TaskDraftContext)
  const key = task ? `task:${task.id}` : `new:${listId}`
  const activeKey = useRef<string | null>(null)
  useEffect(() => {
    activeKey.current = key
    return () => { activeKey.current = null }
  }, [key])
  if (!drafts) throw new Error('useTaskForm braucht einen TaskDraftProvider.')
  const initial: TaskDraft = {
    taskId: task?.id ?? null,
    listId: task?.list_id ?? listId,
    werte: werteVon(task),
    start: werteVon(task),
    base: task ? taskEditBase(task) : null,
    busy: false,
    error: null,
    conflict: false,
  }
  const draft = drafts.drafts[key] ?? initial
  const { werte, start, busy, error } = draft

  const setzen = <F extends keyof TaskFormWerte>(feld: F, wert: TaskFormWerte[F]) => {
    drafts.change(key, draft, previous => ({ ...previous, werte: { ...previous.werte, [feld]: wert } }))
  }
  const zuruecksetzen = () => drafts.discard(key)
  const speichern = async (event: FormEvent) => {
    event.preventDefault()
    if (werte.title.trim().length === 0 || !drafts.beginSave(key, draft)) return
    try {
      const eingabe = {
        title: werte.title,
        description: werte.description,
        dueAt: fromDateTimeLocalValue(werte.dueAt),
        recurrence: werte.recurrence === '' ? null : werte.recurrence,
        reminders: werte.reminders,
        sectionId: werte.sectionId,
      }
      if (draft.taskId === null) {
        await repositories.createTask({ listId: draft.listId, ...eingabe })
      } else {
        const patch: TaskEditInput = {}
        if (werte.title !== start.title) patch.title = eingabe.title
        if (werte.description !== start.description) patch.description = eingabe.description
        if (werte.dueAt !== start.dueAt) patch.dueAt = eingabe.dueAt
        if (werte.recurrence !== start.recurrence) patch.recurrence = eingabe.recurrence
        if (!sameData(werte.reminders, start.reminders)) patch.reminders = eingabe.reminders
        if (werte.sectionId !== start.sectionId) patch.sectionId = eingabe.sectionId
        await repositories.updateTask(draft.taskId, patch, { base: draft.base ?? undefined })
      }
      drafts.saved(key)
      // Ein später Abschluss darf keinen inzwischen anderen Editor schließen.
      if (activeKey.current === key) onSaved()
    } catch (cause) {
      const conflict = cause instanceof TaskEditConflict
      const message = conflict
        ? 'Die Aufgabe wurde inzwischen geändert. Deine Eingaben bleiben erhalten. Lade den aktuellen Stand, bevor du weiterbearbeitest.'
        : cause instanceof Error ? cause.message : 'Speichern ist fehlgeschlagen. Bitte versuche es erneut.'
      drafts.failed(key, message, conflict)
    }
  }
  return {
    werte, setzen, zuruecksetzen,
    dueIso: fromDateTimeLocalValue(werte.dueAt), busy, error,
    neuLaden: task && draft.conflict ? () => drafts.change(key, initial, () => initial) : null,
    speichern,
    geaendert: !sameData(werte, start),
  }
}
