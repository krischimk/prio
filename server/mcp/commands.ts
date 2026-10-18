import { z } from 'zod'
import { edit, expected, id, requestId, targets } from './schemas'
import { Planner, rowKey } from './planner'
import type { CloudPort, CloudRow, CommandRecord, Connection, Snapshot, Table } from './types'
import { CommandError } from './types'
import { completionExpired } from '../../src/domain/taskLifecycle'
import { fromRemoteTask } from '../../src/domain/mapping'
import { sameData } from '../../src/domain/equality'
import { listDeletionTime } from '../../src/domain/listDeletion'
import { findListIcon } from '../../src/ui/listIcons'
import { SECTION_NAME_MAX, SECTIONS_MAX } from '../../src/domain/sections'

const listPatch = z.strictObject({ name: z.string().trim().min(1).max(200), icon: z.string().max(200).refine(value => findListIcon(value) !== null, 'Use an icon id from prio://icons.').nullable().optional().describe('List symbol id from prio://icons, null removes the symbol.'),
  keep_completed: z.boolean().optional(), ratings_enabled: z.boolean().optional(), allow_duplicate_titles: z.boolean().optional() })
export const commandSchemas = {
  create_tasks: z.strictObject({ ...requestId, list_id: id, tasks: z.array(edit.extend({ title: z.string().trim().min(1).max(2000) })).min(1).max(100), placement: z.enum(['top', 'end']).default('top') }),
  update_tasks: z.strictObject({ ...requestId, updates: z.array(z.strictObject({ task: expected, set: edit })).min(1).max(100) }),
  complete_tasks: z.strictObject({ ...requestId, ...targets, completed: z.boolean() }),
  move_tasks: z.strictObject({ ...requestId, ...targets, list_id: id, section_id: id.nullable().default(null), before_task_id: id.nullable().default(null) }),
  delete_tasks: z.strictObject({ ...requestId, ...targets }), restore_tasks: z.strictObject({ ...requestId, ...targets }),
  edit_checklist: z.strictObject({ ...requestId, task: expected, operations: z.array(z.discriminatedUnion('op', [
    z.strictObject({ op: z.literal('add'), text: z.string().trim().min(1).max(2000), completed: z.boolean().optional() }),
    z.strictObject({ op: z.literal('update'), id, text: z.string().trim().min(1).max(2000).optional(), completed: z.boolean().optional() }),
    z.strictObject({ op: z.literal('delete'), id }), z.strictObject({ op: z.literal('weight'), id, weight: z.number().min(0).max(1) }),
    z.strictObject({ op: z.literal('reorder'), order: z.array(id).max(500) }),
  ])).min(1).max(100) }),
  manage_lists: z.strictObject({ ...requestId, operation: z.discriminatedUnion('op', [
    z.strictObject({ op: z.literal('create'), settings: listPatch, include_in_overview: z.boolean().default(false) }),
    z.strictObject({ op: z.literal('update'), list: expected, set: listPatch.partial() }),
    z.strictObject({ op: z.literal('delete'), list: expected }), z.strictObject({ op: z.literal('restore'), list: expected }),
  ]) }),
  manage_sections: z.strictObject({ ...requestId, list: expected, sections: z.array(z.strictObject({ id: id.optional(), name: z.string().trim().min(1).max(SECTION_NAME_MAX) })).max(SECTIONS_MAX) }),
  update_preferences: z.strictObject({ ...requestId, list: z.strictObject({ id, revision: z.string().regex(/^[a-f0-9]{32}$/).nullable(), set: z.strictObject({
    include_in_overview: z.boolean().optional(), hidden: z.boolean().optional(), position: z.number().finite().nullable().optional(), sort_mode: z.enum(['manual', 'priority', 'priority_flat']).optional(),
  }) }).optional(), account: z.strictObject({ revision: z.string().regex(/^[a-f0-9]{32}$/).nullable(), set: z.strictObject({ overview_mode: z.enum(['by_list', 'newest', 'priority']).optional(), detailed_ratings: z.boolean().optional(), default_list_id: id.nullable().optional() }) }).optional() }),
  manage_sharing: z.strictObject({ ...requestId, list: expected, op: z.enum(['add', 'remove']), username: z.string().trim().regex(/^[a-zA-Z0-9_]{3,30}$/) }),
  undo_change: z.strictObject({ ...requestId, change_request_id: id }),
}
export type CommandName = keyof typeof commandSchemas

/** Load a complete bounded planning scope, including tombstones and successors. */
async function loadScope(port: CloudPort, name: CommandName, data: Record<string, unknown>): Promise<Snapshot> {
  const selected = new Set<string>()
  if (typeof data.list_id === 'string') selected.add(data.list_id)
  const account = data.account as { set?: { default_list_id?: string } } | undefined
  if (account?.set?.default_list_id) selected.add(account.set.default_list_id)
  const list = data.list as { id?: string } | undefined
  if (list?.id) selected.add(list.id)
  const operation = data.operation as { list?: { id: string } } | undefined
  if (operation?.list) selected.add(operation.list.id)
  const tasks = [...(data.tasks as { id: string }[] ?? []), ...((data.updates as { task: { id: string } }[] | undefined)?.map(item => item.task) ?? []), ...(data.task ? [data.task as { id: string }] : [])]
  if (tasks.length) {
    const seed = await port.snapshot({ include_tasks: true, task_ids: tasks.map(task => task.id), state: 'all', limit: 101 })
    seed.tasks.forEach(item => { selected.add(item.row.list_id); if (item.row.reopen_context?.list_id) selected.add(item.row.reopen_context.list_id) })
    const successorIds = seed.tasks.flatMap(item => item.row.successor_id ? [item.row.successor_id] : [])
    if (successorIds.length) (await port.snapshot({ include_tasks: true, task_ids: successorIds, state: 'all', limit: 101 })).tasks.forEach(item => selected.add(item.row.list_id))
  }
  if (name === 'undo_change') {
    const saved = await port.history(data.change_request_id as string) as CommandRecord | null
    if (!saved) throw new CommandError('not_found', 'No command with that id belongs to this connection.')
    for (const change of saved.changes) {
      const row = change.after
      if ('list_id' in row) selected.add(row.list_id)
      else if (change.table === 'lists') selected.add((row as { id: string }).id)
    }
  }
  // Empty scope still returns account preferences; never downloads unrelated tasks.
  return port.snapshot({ list_ids: [...selected], include_tasks: true, state: 'all', limit: 10001 })
}

export async function executeCommand<N extends CommandName>(port: CloudPort, connection: Connection, name: N, input: z.infer<(typeof commandSchemas)[N]>) {
  if (!connection.can_write) throw new CommandError('permission_denied', 'Enable editing for this connection in Prio Konto → KI-Verbindungen.')
  const data = input as Record<string, unknown> & { request_id: string }
  const intent = { action: name, ...input }
  const replay = await port.replay(data.request_id, intent)
  if (replay) return replay
  for (let attempt = 0; attempt < 2; attempt++) {
    const snapshot = await loadScope(port, name, data)
    const p = new Planner(snapshot, connection)
    await planCommand(port, p, name, commandSchemas[name].parse(input))
    const result = await port.commit(data.request_id, name, intent, p.plan(snapshot))
    if (result.kind !== 'scope_conflict') {
      if (result.kind !== 'committed') throw new CommandError(result.kind, result.message ?? 'No changes were made. Re-read affected rows before retrying.', result.detail ?? result)
      return result
    }
  }
  throw new CommandError('conflict', 'List contents kept changing. Read again before retrying; no changes were made.')
}

async function planCommand(port: CloudPort, p: Planner, name: CommandName, input: z.infer<(typeof commandSchemas)[CommandName]>) {
  // The discriminated branch is checked by the corresponding public Zod schema.
  switch (name) {
    case 'create_tasks': { const d = commandSchemas.create_tasks.parse(input); for (const task of d.placement === 'top' ? [...d.tasks].reverse() : d.tasks) { if (task.recurrence && !task.due_at) throw new CommandError('invalid_input', 'A recurrence requires a due date.'); p.create(d.list_id, task, d.placement === 'end') } break }
    case 'update_tasks': { const d = commandSchemas.update_tasks.parse(input); unique(d.updates.map(item => item.task.id)); for (const item of d.updates) p.update(item.task, item.set); break }
    case 'complete_tasks': { const d = commandSchemas.complete_tasks.parse(input); unique(d.tasks.map(task => task.id)); for (const task of d.tasks) await p.complete(task, d.completed); break }
    case 'delete_tasks': case 'restore_tasks': { const d = commandSchemas.delete_tasks.parse(input); unique(d.tasks.map(task => task.id)); for (const task of d.tasks) p.trash(task, name === 'restore_tasks'); break }
    case 'move_tasks': { const d = commandSchemas.move_tasks.parse(input); unique(d.tasks.map(task => task.id)); if (d.tasks.some(task => task.id === d.before_task_id)) throw new CommandError('invalid_input', 'Destination anchor cannot be one of the moved tasks.'); for (const task of d.tasks) p.move(task, d.list_id, d.section_id, d.before_task_id); break }
    case 'edit_checklist': { const d = commandSchemas.edit_checklist.parse(input); p.checklist(d.task, d.operations); break }
    case 'manage_lists': {
      const { operation: op } = commandSchemas.manage_lists.parse(input)
      if (op.op === 'create') {
        const listId = crypto.randomUUID()
        p.put('lists', { id: listId, owner_id: p.connection.user_id, name: op.settings.name, icon: op.settings.icon ?? null, sections: [], is_shared: false,
          keep_completed: op.settings.keep_completed ?? false, ratings_enabled: op.settings.ratings_enabled ?? true, allow_duplicate_titles: op.settings.allow_duplicate_titles ?? true,
          completion_retention_started_at: p.now, created_at: p.now, updated_at: p.now, deleted_at: null })
        if (op.include_in_overview) p.put('preferences', { list_id: listId, user_id: p.connection.user_id, include_in_overview: true, hidden: false, position: null, sort_mode: 'manual', created_at: p.now, updated_at: p.now, deleted_at: null })
      } else {
        const list = p.expectList(op.list, true, op.op === 'restore')
        if (op.op === 'update') p.put('lists', { ...list, ...op.set, updated_at: p.now })
        else {
          const deletedAt = op.op === 'delete' ? listDeletionTime(p.now, p.peers(list.id)) : null
          p.put('lists', { ...list, deleted_at: deletedAt, updated_at: p.now })
          for (const task of p.peers(list.id)) {
            if (completionExpired(task, Date.parse(p.now))) continue
            if (op.op === 'delete' ? task.deleted_at === null : task.deleted_at === list.deleted_at && list.deleted_at !== null) p.saveTask({ ...task, deleted_at: deletedAt })
          }
        }
      } break
    }
    case 'manage_sections': {
      const d = commandSchemas.manage_sections.parse(input); const list = p.expectList(d.list)
      const sections = d.sections.map(section => { if (section.id && !(list.sections ?? []).some(row => row.id === section.id)) throw new CommandError('not_found', 'Section not in this list. Omit id for a new section.'); return { id: section.id ?? crypto.randomUUID(), name: section.name } })
      unique(sections.map(section => section.id)); p.put('lists', { ...list, sections, updated_at: p.now })
      for (const task of p.peers(list.id)) if (task.section_id && !sections.some(section => section.id === task.section_id)) p.saveTask({ ...task, section_id: null })
      break
    }
    case 'update_preferences': {
      const d = commandSchemas.update_preferences.parse(input)
      if (!d.list && !d.account) throw new CommandError('invalid_input', 'Provide list and/or account preferences.')
      if (d.list) {
        p.list(d.list.id)
        const entry = p.snapshot.preferences.find(item => item.row.list_id === d.list!.id)
        if ((entry?.revision ?? null) !== d.list.revision) throw new CommandError('conflict', 'List preferences changed; get_workspace again.')
        p.put('preferences', { list_id: d.list.id, user_id: p.connection.user_id, include_in_overview: false, hidden: false, position: null, sort_mode: 'manual', created_at: p.now,
          ...entry?.row, ...d.list.set, updated_at: p.now, deleted_at: null })
      }
      if (d.account) {
        const entry = p.snapshot.userPreferences[0]
        if ((entry?.revision ?? null) !== d.account.revision) throw new CommandError('conflict', 'Account preferences changed; get_workspace again.')
        if (d.account.set.default_list_id) p.list(d.account.set.default_list_id)
        const base = entry?.row ?? { id: p.connection.user_id, overview_mode: 'by_list' as const, default_list_id: null, detailed_ratings: false, task_expansions: {}, created_at: p.now }
        p.put('userPreferences', { ...base, ...d.account.set, updated_at: p.now, deleted_at: null })
      } break
    }
    case 'manage_sharing': {
      if (!p.connection.can_share) throw new CommandError('permission_denied', 'Sharing needs separate permission for this connection in Prio Konto → KI-Verbindungen.')
      const d = commandSchemas.manage_sharing.parse(input); const list = p.expectList(d.list)
      const user = await port.resolveUser(d.username)
      if (!user) throw new CommandError('not_found', 'Username not found.')
      if (user.id === list.owner_id) throw new CommandError('invalid_input', 'The owner is not a member and cannot be removed.')
      const old = p.snapshot.members.find(item => item.row.list_id === list.id && item.row.user_id === user.id)?.row
      p.put('members', { list_id: list.id, user_id: user.id, created_at: old?.created_at ?? p.now, updated_at: p.now, deleted_at: d.op === 'remove' ? p.now : null })
      if (d.op === 'add' && !list.is_shared) p.put('lists', { ...list, is_shared: true, updated_at: p.now })
      break
    }
    case 'undo_change': {
      const d = commandSchemas.undo_change.parse(input); const saved = await port.history(d.change_request_id) as CommandRecord | null
      if (!saved) throw new CommandError('not_found', 'Command not found for this connection.')
      const changedTasks = new Set(saved.changes.filter(change => change.table === 'tasks').map(change => (change.after as { id: string }).id))
      for (const change of saved.changes.filter(change => change.table === 'lists')) {
        const current = p.list((change.after as { id: string }).id, true, true)
        const before = change.before as typeof current | null
        const hidesList = (!before || before.deleted_at !== null) && current.deleted_at === null
        const removedSections = new Set((current.sections ?? []).filter(section => !(before?.sections ?? []).some(old => old.id === section.id)).map(section => section.id))
        const changesRetention = before !== null && before.keep_completed !== current.keep_completed
        if (p.peers(current.id).some(task => !task.deleted_at && !completionExpired(task, Date.parse(p.now)) && !changedTasks.has(task.id)
          && (hidesList || task.section_id !== null && removedSections.has(task.section_id) || changesRetention && task.completed)))
          throw new CommandError('conflict', 'New work was added after this command. Undo would hide it, remove its section or change its retention. No changes were made.')
      }
      // Reverse order: children before parents. Writers lock all rows first.
      for (const change of [...saved.changes].reverse()) {
        if (change.table === 'members' && !p.connection.can_share) throw new CommandError('permission_denied', 'Undoing sharing also needs sharing permission.')
        const key = rowKey(change.table, change.after)
        const entry = (p.snapshot[change.table] as { row: CloudRow }[]).find(item => rowKey(change.table, item.row) === key)
        if (!entry || !sameData(entry.row, change.after)) throw new CommandError('conflict', 'An affected row changed after this command; undo would overwrite it.', { key })
        if (change.table === 'tasks' && completionExpired(fromRemoteTask(change.after as Parameters<typeof fromRemoteTask>[0]), Date.parse(p.now))) throw new CommandError('not_found', 'An expired task cannot be restored.')
        p.put(change.table as Table, { ...(change.before ?? change.after), updated_at: p.now, deleted_at: change.before ? change.before.deleted_at : p.now })
      } break
    }
  }
}
function unique(ids: string[]) { if (new Set(ids).size !== ids.length) throw new CommandError('invalid_input', 'Each identifier must occur only once.') }
