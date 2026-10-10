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
