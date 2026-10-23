import { applyTaskEdit } from '../../src/domain/taskEdit'
import { planTaskCompletion } from '../../src/domain/taskCompletion'
import { alignReminders } from '../../src/domain/reminder'
import { fromRemoteList, fromRemoteTask, toRemoteTask } from '../../src/domain/mapping'
import { appendChecklistItem, deleteChecklistItem, setChecklistWeight, validateChecklist } from '../../src/domain/checklist'
import { conflictingTaskTitle, taskSeriesId, taskTitleKey } from '../../src/domain/taskTitles'
import { completionDeadline, completionExpired } from '../../src/domain/taskLifecycle'
import { compareTasks } from '../../src/domain/ordering'
import { insertionPosition } from '../../src/domain/taskPlacement'
import { sameData } from '../../src/domain/equality'
import type { LocalTask, RemoteList, RemoteTask } from '../../src/domain/types'
import type { Edit, Expected } from './schemas'
import type { Change, CloudRow, Connection, Guard, Plan, Snapshot, Table, Versioned } from './types'
import { CommandError } from './types'
import { calendarStep } from './calendar'
import { effectiveRoutine, routineAvailableAt } from '../../src/domain/routine'

export const rowKey = (table: Table, row: CloudRow): string => table === 'members' || table === 'preferences'
  ? `${table}:${(row as { list_id: string }).list_id}:${(row as { user_id: string }).user_id}` : `${table}:${(row as { id: string }).id}`

/** A bounded snapshot and a pure plan: persistence is one guarded database RPC. */
export class Planner {
  readonly snapshot: Snapshot
  readonly connection: Connection
  readonly now: string
  readonly changes = new Map<string, Change>()
  readonly guarded = new Set<string>()
  constructor(snapshot: Snapshot, connection: Connection, now = new Date().toISOString()) {
    this.snapshot = structuredClone(snapshot); this.connection = connection; this.now = now
    if (snapshot.tasks.length > 10000) throw new CommandError('selection_too_large', 'Narrow the command to fewer lists; no changes were made.')
  }
  put(table: Table, row: CloudRow) {
    const key = rowKey(table, row)
    const previous = this.snapshot[table].find(item => rowKey(table, item.row) === key) as Versioned<CloudRow> | undefined
    const first = this.changes.get(key)
    const expected = first ? first.expected : previous?.row ?? null
    if (sameData(expected, row)) { this.changes.delete(key); return }
    this.changes.set(key, { table, row, expected })
    if (previous) previous.row = row
    else (this.snapshot[table] as Versioned<CloudRow>[]).push({ row, revision: '' })
  }
  list(id: string, owner = false, allowDeleted = false): RemoteList {
    const list = this.snapshot.lists.find(item => item.row.id === id)?.row
    if (!list || (!allowDeleted && list.deleted_at)) throw new CommandError('not_found', 'List not available.', { list_id: id })
    if (owner && list.owner_id !== this.connection.user_id) throw new CommandError('permission_denied', 'Only the list owner can change this setting.')
    this.guarded.add(id)
    return list
  }
  task(ref: Expected, allowDeleted = false): LocalTask {
    const entry = this.snapshot.tasks.find(item => item.row.id === ref.id)
    if (!entry || (!allowDeleted && entry.row.deleted_at) || completionExpired(fromRemoteTask(entry?.row ?? {} as RemoteTask), Date.parse(this.now))) throw new CommandError('not_found', 'Task not available or its retention window has expired.', { task_id: ref.id })
    if (entry.revision !== ref.revision) throw new CommandError('conflict', 'Task changed. Read it again before deciding what to update.', { task_id: ref.id, current: entry })
    this.list(entry.row.list_id, false, allowDeleted)
    return effectiveRoutine(fromRemoteTask(entry.row), Date.parse(this.now))
  }
  expectList(ref: Expected, owner = true, deleted = false) {
    const list = this.list(ref.id, owner, deleted)
    if (this.snapshot.lists.find(item => item.row.id === ref.id)?.revision !== ref.revision) throw new CommandError('conflict', 'List changed. Read it again.', { list_id: ref.id })
    return list
  }
  peers(listId: string): LocalTask[] { return this.snapshot.tasks.filter(item => item.row.list_id === listId).map(item => fromRemoteTask(item.row)) }
  section(list: RemoteList, sectionId: string | null) {
    if (sectionId !== null && !(list.sections ?? []).some(section => section.id === sectionId)) throw new CommandError('not_found', 'Section does not belong to the destination list.')
  }
  unique(task: LocalTask) {
    const list = this.list(task.list_id)
    const conflict = list.allow_duplicate_titles === false && conflictingTaskTitle(task, this.peers(task.list_id), Date.parse(this.now))
    if (conflict) throw new CommandError('duplicate_title', 'This list forbids duplicate names (including completed tasks).', { task_id: conflict.id, title: conflict.title })
  }
  saveTask(task: LocalTask) {
    const current = this.snapshot.tasks.find(item => item.row.id === task.id)?.row
    if (current && sameData(toRemoteTask({ ...task, updated_at: current.updated_at }), toRemoteTask(fromRemoteTask(current)))) return
    this.put('tasks', toRemoteTask({ ...task, updated_at: this.now }))
  }
  create(listId: string, fields: Edit & { title: string }, atEnd = false) {
    const list = this.list(listId); this.section(list, fields.section_id ?? null)
    const peers = this.peers(listId).filter(task => task.deleted_at === null)
    const task: LocalTask = { id: crypto.randomUUID(), list_id: listId, section_id: fields.section_id ?? null,
      title: fields.title.trim(), description: fields.note?.trim() || null, checklist: this.editChecklist(fields.checklist, []), tags: fields.tags ?? [], rating: fields.rating ?? null,
      ...alignReminders(null, { due_at: fields.due_at ?? null, recurrence: fields.recurrence ?? null, reminders: fields.reminders }, Date.parse(this.now)),
      completed: false, available_from: null, completed_at: null, completed_expires_at: null, expired_at: null, reopen_context: null,
      successor_id: null, recurrence_series_id: null, position: atEnd ? Math.max(-1, ...peers.map(task => task.position)) + 1 : Math.min(1, ...peers.map(task => task.position)) - 1,
      recurrence_rule: fields.recurrence && fields.due_at ? fields.recurrence_rule ?? null : null,
      created_at: this.now, updated_at: this.now, deleted_at: null, dirty: 1 }
    if (task.recurrence) task.recurrence_series_id = task.id
    if (task.due_at && task.recurrence_rule) task.available_from = routineAvailableAt(task.due_at, task.recurrence_rule)
    this.unique(task); this.saveTask(task); return task.id
  }
  editChecklist(input: Edit['checklist'], current: LocalTask['checklist']) {
    if (!input) return current
    const active = input.map(item => {
      if (item.id && !current.some(row => row.id === item.id && row.deleted_at === null)) throw new CommandError('not_found', 'Checklist item does not belong to this task. Omit id for a new item.')
      return { ...item, id: item.id ?? crypto.randomUUID(), deleted_at: null }
    })
    const removed = current.filter(item => !active.some(row => row.id === item.id)).map(item => ({ ...item, deleted_at: item.deleted_at ?? this.now }))
    return validateChecklist([...active, ...removed])
  }
  update(ref: Expected, fields: Edit) {
    const task = this.task(ref)
    this.section(this.list(task.list_id), fields.section_id === undefined ? task.section_id : fields.section_id)
    if (fields.recurrence && !(fields.due_at === undefined ? task.due_at : fields.due_at)) throw new CommandError('invalid_input', 'A recurrence requires a due date.')
    const values = applyTaskEdit(task, { title: fields.title, description: fields.note, tags: fields.tags, rating: fields.rating,
      dueAt: fields.due_at, recurrence: fields.recurrence, recurrenceRule: fields.recurrence_rule, reminders: fields.reminders, sectionId: fields.section_id,
      checklist: fields.checklist ? this.editChecklist(fields.checklist, task.checklist) : undefined }, Date.parse(this.now))
    const changed = { ...task, ...values, available_from: values.due_at !== task.due_at || values.recurrence !== task.recurrence || !sameData(values.recurrence_rule, task.recurrence_rule)
      ? values.due_at ? routineAvailableAt(values.due_at, values.recurrence_rule) : null : task.available_from }
    if (changed.recurrence && !changed.recurrence_series_id) changed.recurrence_series_id = taskSeriesId(task, this.peers(task.list_id))
    if (taskTitleKey(changed.title) !== taskTitleKey(task.title)) this.unique(changed)
    this.saveTask(changed)
  }
  async complete(ref: Expected, completed: boolean) {
    const task = this.task(ref)
    const plan = await planTaskCompletion(task, fromRemoteList(this.list(task.list_id)), this.snapshot.tasks.map(item => fromRemoteTask(item.row)), completed, this.now, calendarStep(this.connection.time_zone))
    for (const changed of plan.changes) {
      const previous = this.snapshot.tasks.find(item => item.row.id === changed.id)?.row
      if (!changed.deleted_at && (!previous || previous.deleted_at)) this.unique(changed)
      this.saveTask(changed)
    }
  }
  trash(ref: Expected, restore: boolean) {
    const task = this.task(ref, restore)
    this.list(task.list_id)
    if (restore && task.deleted_at) this.unique(task)
    this.saveTask({ ...task, deleted_at: restore ? null : this.now })
  }
  move(ref: Expected, listId: string, sectionId: string | null, beforeId: string | null) {
    const task = this.task(ref); const list = this.list(listId); this.section(list, sectionId)
    const peers = this.peers(listId).filter(row => row.id !== task.id && row.deleted_at === null && !row.completed && row.section_id === sectionId).sort(compareTasks)
    const index = beforeId === null ? peers.length : peers.findIndex(row => row.id === beforeId)
    if (index < 0) throw new CommandError('not_found', 'before_task_id must be an open task in the destination section.')
    let position = insertionPosition(peers, index)
    if (position === null) { peers.forEach((row, at) => { row.position = at + 1; this.saveTask(row) }); position = insertionPosition(peers, index)! }
    const changed = { ...task, list_id: listId, section_id: sectionId, position,
      completed_expires_at: task.completed && task.list_id !== listId ? completionDeadline(this.now, list.keep_completed === true) : task.completed_expires_at }
    if (task.list_id !== listId) this.unique(changed)
    this.saveTask(changed)
  }
  checklist(ref: Expected, operations: { op: 'add' | 'update' | 'delete' | 'reorder' | 'weight'; id?: string; text?: string; completed?: boolean; weight?: number; order?: string[] }[]) {
    const task = this.task(ref); let items = task.checklist
    for (const op of operations) {
      const item = items.find(row => row.id === op.id && row.deleted_at === null)
      if (op.op === 'add') {
        if (!op.text?.trim()) throw new CommandError('invalid_input', 'New checklist item requires text.')
        items = appendChecklistItem(items, { id: crypto.randomUUID(), text: op.text.trim(), completed: op.completed ?? false, deleted_at: null })
      } else if (op.op === 'reorder') {
        const ids = items.filter(row => row.deleted_at === null).map(row => row.id)
        if (!op.order || op.order.length !== ids.length || new Set(op.order).size !== ids.length || op.order.some(id => !ids.includes(id))) throw new CommandError('invalid_input', 'order must contain every active checklist item exactly once.')
        items = [...op.order.map(id => items.find(row => row.id === id)!), ...items.filter(row => row.deleted_at !== null)]
      } else {
        if (!item) throw new CommandError('not_found', 'Checklist item not found.')
        if (op.op === 'delete') items = deleteChecklistItem(items, item.id, this.now)
        else if (op.op === 'weight') { if (op.weight === undefined) throw new CommandError('invalid_input', 'weight is required.'); items = setChecklistWeight(items, item.id, op.weight) }
        else items = items.map(row => row.id === item.id ? { ...row, text: op.text?.trim() || row.text, completed: op.completed ?? row.completed } : row)
      }
    }
    this.saveTask({ ...task, checklist: validateChecklist(items) })
  }
  plan(original: Snapshot): Plan {
    const guards: Guard[] = [...this.guarded].flatMap(id => {
      const list = original.lists.find(item => item.row.id === id)?.row
      return list ? [{ list_id: id, row: list, positions: original.tasks.filter(item => item.row.list_id === id).sort((a, b) => a.row.id.localeCompare(b.row.id))
        .map(({ row }) => ({ id: row.id, section_id: row.section_id ?? null, position: row.position, completed: row.completed, deleted_at: row.deleted_at })) }] : []
    })
    return { changes: [...this.changes.values()], guards }
  }
}
