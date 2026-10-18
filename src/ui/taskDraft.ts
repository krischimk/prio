import { taskEditBase } from '../domain/taskEdit'
import type { LocalTask } from '../domain/types'
import type { TaskDraft, TaskFormWerte } from './taskDraftContext'
import { toDateTimeLocalValue } from './datetime'

export function createTaskDraft(task: LocalTask | null, listId: string): TaskDraft {
  const values: TaskFormWerte = {
    title: task?.title ?? '', description: task?.description ?? '', checklist: task?.checklist ?? [], checklistText: '',
    tags: task?.tags ?? [], tagText: '', rating: task?.rating ?? null, dueAt: toDateTimeLocalValue(task?.due_at ?? null),
    recurrence: task?.recurrence ?? '', reminders: task?.reminders ?? [], sectionId: task?.section_id ?? null,
  }
  return { taskId: task?.id ?? null, listId: task?.list_id ?? listId, werte: values, start: values,
    base: task ? taskEditBase(task) : null, busy: false, error: null, conflict: false }
}
