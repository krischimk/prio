import { taskEditBase } from '../domain/taskEdit'
import type { LocalTask } from '../domain/types'
import type { TaskDraft, TaskFormWerte } from './taskDraftContext'
import { toDateTimeLocalValue } from './datetime'

export function createTaskDraft(task: LocalTask | null, listId: string, initialDueAt?: string): TaskDraft {
  const values: TaskFormWerte = {
    title: task?.title ?? '', description: task?.description ?? '', checklist: task?.checklist ?? [], checklistText: '',
    tags: task?.tags ?? [], tagText: '', rating: task?.rating ?? null, dueAt: task ? toDateTimeLocalValue(task.due_at) : initialDueAt ?? '',
    recurrence: task?.recurrence ?? '', recurrenceRule: task?.recurrence_rule ?? null, reminders: task?.reminders ?? [], sectionId: task?.section_id ?? null,
  }
  return { taskId: task?.id ?? null, listId: task?.list_id ?? listId, werte: values, start: values,
    base: task ? taskEditBase(task) : null, busy: false, error: null, conflict: false }
}
