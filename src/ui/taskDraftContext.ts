import { createContext } from 'react'
import type { TaskEditBase } from '../domain/taskEdit'
import type { TaskReminder } from '../domain/reminder'

export interface TaskFormWerte {
  title: string
  description: string
  dueAt: string
  recurrence: string
  reminders: TaskReminder[]
  sectionId: string | null
}
export interface TaskDraft {
  taskId: string | null
  listId: string
  werte: TaskFormWerte
  start: TaskFormWerte
  base: TaskEditBase | null
  busy: boolean
  error: string | null
  conflict: boolean
}
export interface TaskDraftState {
  drafts: Readonly<Record<string, TaskDraft>>
  activeNewDrafts: Readonly<Record<string, string>>
  activateNewDraft(listId: string, key: string): void
  /** Ordnet die noch ungebundene Eingabe zu, ohne Listenentwürfe zu ersetzen. */
  assignUnassignedDraft(listId: string): void
  change(key: string, initial: TaskDraft, update: (previous: TaskDraft) => TaskDraft): void
  discard(key: string): void
  beginSave(key: string, initial: TaskDraft): boolean
  saved(key: string): void
  failed(key: string, message: string, conflict: boolean): void
  listNames: Readonly<Record<string, string>>
  setListName(id: string, value: string): void
  discardListName(id: string): void
}
export const TaskDraftContext = createContext<TaskDraftState | null>(null)

export function newDraftKey(state: TaskDraftState, listId: string): string {
  const active = state.activeNewDrafts[listId]
  if (active && state.drafts[active]?.listId === listId) return active
  const standard = `new:${listId}`
  if (state.drafts[standard]) return standard
  return Object.entries(state.drafts).find(([, draft]) => draft.taskId === null && draft.listId === listId)?.[0] ?? standard
}
