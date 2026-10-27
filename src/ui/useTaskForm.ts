import { useContext, useEffect, useRef, type FormEvent } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import { sameData } from '../domain/equality'
import { TaskEditConflict, type TaskEditInput } from '../domain/taskEdit'
import type { LocalTask } from '../domain/types'
import { TaskDraftContext, type TaskFormWerte } from './taskDraftContext'
import { fromDateTimeLocalValue } from './datetime'
import { createTaskDraft } from './taskDraft'
import { appendChecklistItem, createChecklistItem } from '../domain/checklist'
import { parseTags } from '../domain/tags'

export type { TaskFormWerte } from './taskDraftContext'
export interface TaskForm {
  werte: TaskFormWerte
  setzen: <F extends keyof TaskFormWerte>(feld: F, wert: TaskFormWerte[F]) => void
  zuruecksetzen: () => Promise<boolean>
  dueIso: string | null
  busy: boolean
  error: string | null
  /** Ersetzt den Entwurf bewusst durch den über Hooks gelesenen Stand. */
  neuLaden: (() => Promise<void>) | null
  speichern: (event: FormEvent) => Promise<void>
  geaendert: boolean
}

/** Formularverhalten und Umwandlungen; Fachprüfung kommt aus taskEdit. */
export function useTaskForm({ task, listId, onSaved, overviewUserId, detailedRatings = false, initialDueAt }: {
  task: LocalTask | null
  listId: string
  onSaved: () => void
  /** Eigener Gesamtentwurf; seine Zielliste wird erst beim Speichern gebunden. */
  overviewUserId?: string
  detailedRatings?: boolean
  initialDueAt?: string
}): TaskForm {
  const { repositories } = useWorkspace()
  const drafts = useContext(TaskDraftContext)
  if (!drafts) throw new Error('useTaskForm braucht einen TaskDraftProvider.')
  const key = task ? `task:${task.id}` : overviewUserId !== undefined ? 'new:overview' : initialDueAt ? `new:${listId}:date:${initialDueAt}` : `new:${listId}`
  const activeKey = useRef<string | null>(null)
  useEffect(() => {
    activeKey.current = key
    return () => { activeKey.current = null }
  }, [key])
  const initial = createTaskDraft(task, listId, initialDueAt)
  const draft = drafts.drafts[key] ?? initial
  const { werte, start, busy, error } = draft

  const setzen = <F extends keyof TaskFormWerte>(feld: F, wert: TaskFormWerte[F]) => {
    drafts.change(key, draft, previous => {
      const werte = { ...previous.werte, [feld]: wert }
      if (!detailedRatings && werte.dueAt && werte.rating?.urgencyMode === 'manual') {
        werte.rating = { ...werte.rating, urgencyMode: 'auto' }
      }
      return { ...previous, werte }
    })
  }
  const verworfeneNotizSichern = async () => {
    if (werte.description !== start.description) await repositories.rememberDiscardedNote({
      taskId: draft.taskId, listId: draft.listId, title: werte.title, description: werte.description,
    })
  }
  const zuruecksetzen = async () => {
    if (!drafts.beginSave(key, draft)) return false
    try { await verworfeneNotizSichern(); drafts.saved(key); return true }
    catch { drafts.failed(key, 'Die verworfene Notiz konnte nicht gesichert werden. Deine Eingaben bleiben erhalten.', false); return false }
  }
  const neuLaden = async () => {
    if (!drafts.beginSave(key, draft)) return
    try {
      await verworfeneNotizSichern()
      drafts.saved(key)
      drafts.change(key, initial, () => initial)
    } catch { drafts.failed(key, 'Die verworfene Notiz konnte nicht gesichert werden. Deine Eingaben bleiben erhalten.', true) }
  }
  const speichern = async (event: FormEvent) => {
    event.preventDefault()
    if (werte.title.trim().length === 0 || !drafts.beginSave(key, draft)) return
    try {
      const eingabe = {
        title: werte.title,
        description: werte.description,
        checklist: werte.checklistText.trim() ? appendChecklistItem(werte.checklist, createChecklistItem(werte.checklistText)) : werte.checklist,
        checklistHideCompleted: werte.checklistHideCompleted,
        tags: parseTags([...werte.tags, werte.tagText]),
        rating: !detailedRatings && werte.dueAt && werte.rating ? { ...werte.rating, urgencyMode: 'auto' as const } : werte.rating,
        dueAt: fromDateTimeLocalValue(werte.dueAt),
        recurrence: werte.recurrence === '' ? null : werte.recurrence,
        recurrenceRule: werte.recurrence && werte.dueAt ? werte.recurrenceRule : null,
        reminders: werte.reminders,
        sectionId: werte.sectionId,
      }
      if (draft.taskId === null) {
        await repositories.createTask({ listId, ...eingabe, rememberOverviewTargetFor: overviewUserId })
      } else {
        const patch: TaskEditInput = {}
        if (werte.title !== start.title) patch.title = eingabe.title
        if (werte.description !== start.description) patch.description = eingabe.description
        if (!sameData(werte.checklist, start.checklist) || werte.checklistText.trim()) patch.checklist = eingabe.checklist
        if (werte.checklistHideCompleted !== start.checklistHideCompleted) patch.checklistHideCompleted = eingabe.checklistHideCompleted
        if (!sameData(werte.tags, start.tags) || werte.tagText.trim()) patch.tags = eingabe.tags
        if (!sameData(eingabe.rating, start.rating)) patch.rating = eingabe.rating
        if (werte.dueAt !== start.dueAt) patch.dueAt = eingabe.dueAt
        if (werte.recurrence !== start.recurrence) patch.recurrence = eingabe.recurrence
        if (!sameData(werte.recurrenceRule, start.recurrenceRule)) patch.recurrenceRule = eingabe.recurrenceRule
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
    neuLaden: task && draft.conflict ? neuLaden : null,
    speichern,
    geaendert: !sameData(werte, start),
  }
}
