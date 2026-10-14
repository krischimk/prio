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
export interface NewListDraft {
  name: string
  icon: string | null
  includeInOverview: boolean
  keepCompleted: boolean
  busy: boolean
  error: string | null
}
export const emptyNewListDraft: NewListDraft = {
  name: '', icon: null, includeInOverview: false, keepCompleted: false, busy: false, error: null,
}
export interface TaskDraftState {
  newList: NewListDraft
  changeNewList(patch: Partial<Pick<NewListDraft, 'name' | 'icon' | 'includeInOverview' | 'keepCompleted'>>): void
  beginListSave(): boolean
  listSaved(): void
  listFailed(message: string): void
  drafts: Readonly<Record<string, TaskDraft>>
  overviewTarget: string | null
  selectOverviewTarget(listId: string): void
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
