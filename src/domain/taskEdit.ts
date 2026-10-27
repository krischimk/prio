import { normalizeIso } from './clock'
import { sameData } from './equality'
import { alignReminders, parseReminders, type TaskReminder } from './reminder'
import type { LocalTask } from './types'
import { optionalText, requireText } from './validation'
import { mergeChecklist, parseChecklist, validateChecklist, type ChecklistItem } from './checklist'
import { mergeTags, parseTags } from './tags'
import { parseRating, validateRating, type TaskRating } from './rating'
import { parseRecurrenceRule, type RecurrenceRule } from './routine'

/** Fachliche Eingabe; unveränderte Felder werden nicht mitgeschickt. */
export interface TaskEditInput {
  title?: string
  description?: string | null
  checklist?: ChecklistItem[]
  checklistHideCompleted?: boolean
  tags?: string[]
  rating?: TaskRating | null
  dueAt?: string | null
  recurrence?: string | null
  recurrenceRule?: RecurrenceRule | null
  reminders?: TaskReminder[]
  sectionId?: string | null
}

type EditableTask = Pick<LocalTask, 'title' | 'description' | 'checklist' | 'checklist_hide_completed' | 'tags' | 'rating' | 'due_at' | 'recurrence' | 'recurrence_rule' | 'reminders' | 'section_id'>
export interface TaskEditBase {
  taskId: string
  listId: string
  values: EditableTask
}
export interface TaskEditOptions { base?: TaskEditBase }

export class TaskEditConflict extends Error {
  readonly code = 'conflict'
  readonly fields: Array<keyof EditableTask | 'id' | 'list_id'>
  constructor(fields: TaskEditConflict['fields']) {
    super('task-edit-conflict')
    this.name = 'TaskEditConflict'
    this.fields = fields
  }
}

/** Vergleichsbasis mit derselben Normalisierung wie beim Bearbeiten. */
export function taskEditValues(task: LocalTask): EditableTask {
  return {
    title: task.title,
    description: optionalText(task.description),
    checklist: parseChecklist(task.checklist),
    checklist_hide_completed: task.checklist_hide_completed === true,
    tags: parseTags(task.tags),
    rating: parseRating(task.rating),
    due_at: normalizeIso(task.due_at),
    recurrence: task.recurrence ?? null,
    recurrence_rule: parseRecurrenceRule(task.recurrence_rule),
    reminders: parseReminders(task.reminders),
    section_id: task.section_id ?? null,
  }
}

export function taskEditBase(task: LocalTask): TaskEditBase {
  return { taskId: task.id, listId: task.list_id, values: taskEditValues(task) }
}

/**
 * Reiner Bearbeitungsablauf für UI und spätere Serveradapter. Die Prüfung und
 * Persistierung des aktuellen Bestands müssen beim Aufrufer atomar erfolgen.
 * Verschiedene Felder bleiben unabhängig; Termin/Wiederholung/Erinnerungen
 * bilden wegen ihrer gemeinsamen Ausrichtung eine Konfliktgruppe.
 */
export function applyTaskEdit(task: LocalTask, patch: TaskEditInput, nowMs: number, base?: TaskEditBase): EditableTask {
  const current = taskEditValues(task)
  let checklist = patch.checklist === undefined ? current.checklist : validateChecklist(patch.checklist)
  let tags = patch.tags === undefined ? current.tags : parseTags(patch.tags)
  const fields: Array<keyof EditableTask> = []
  if (patch.title !== undefined) fields.push('title')
  if (patch.description !== undefined) fields.push('description')
  if (patch.rating !== undefined) fields.push('rating')
  if (patch.checklistHideCompleted !== undefined) fields.push('checklist_hide_completed')
  if (patch.sectionId !== undefined) fields.push('section_id')
  const changesSchedule = patch.dueAt !== undefined || patch.recurrence !== undefined || patch.reminders !== undefined || patch.recurrenceRule !== undefined
  if (changesSchedule) fields.push('due_at', 'recurrence', 'reminders', 'recurrence_rule')

  if (base) {
    const conflicts: TaskEditConflict['fields'] = fields.filter(field => !sameData(current[field], base.values[field]))
    if (patch.checklist !== undefined) {
      const merged = mergeChecklist(base.values.checklist ?? [], checklist, current.checklist)
      if (merged.conflict) conflicts.push('checklist')
      checklist = merged.items
    }
    if (patch.tags !== undefined) tags = mergeTags(base.values.tags ?? [], tags, current.tags)
    if (task.id !== base.taskId) conflicts.push('id')
    if (task.list_id !== base.listId) conflicts.push('list_id')
    if (conflicts.length) throw new TaskEditConflict(conflicts)
  }

  return {
    ...current,
    checklist,
    checklist_hide_completed: patch.checklistHideCompleted ?? current.checklist_hide_completed,
    tags,
    rating: patch.rating === undefined ? current.rating : validateRating(patch.rating),
    recurrence_rule: patch.recurrence === null || patch.dueAt === null ? null : patch.recurrenceRule === undefined ? current.recurrence_rule : parseRecurrenceRule(patch.recurrenceRule),
    title: patch.title === undefined ? current.title : requireText(patch.title, 'Der Titel'),
    description: patch.description === undefined ? current.description : optionalText(patch.description),
    section_id: patch.sectionId === undefined ? current.section_id : patch.sectionId,
    ...(changesSchedule ? alignReminders(current, {
      due_at: patch.dueAt === undefined ? current.due_at : normalizeIso(optionalText(patch.dueAt)),
      recurrence: patch.recurrence === undefined ? current.recurrence : patch.recurrence,
      reminders: patch.reminders,
    }, nowMs) : {}),
  }
}
