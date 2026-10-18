import { ratingValues } from '../../src/domain/rating'
import { checklistProgress } from '../../src/domain/checklist'
import { fromRemoteList, fromRemoteTask } from '../../src/domain/mapping'
import { compareTasks } from '../../src/domain/ordering'
import type { RemoteTask } from '../../src/domain/types'
import type { SearchInput } from './schemas'
import type { CloudPort, Snapshot, Versioned } from './types'
import { CommandError } from './types'

export function presentTask(item: Versioned<RemoteTask>, snapshot: Snapshot, now: number, full = false) {
  const task = fromRemoteTask(item.row)
  const list = snapshot.lists.find(list => list.row.id === task.list_id)?.row
  const { description: note, dirty: _dirty, reopen_context: _context, ...rest } = task
  return { ...rest, revision: item.revision, list_name: list?.name ?? null, note: full ? note : note?.slice(0, 300) ?? null,
    note_truncated: !full && (note?.length ?? 0) > 300, checklist_progress: checklistProgress(task.checklist),
    rating_values: list?.ratings_enabled && task.rating ? ratingValues(task.rating, task.due_at, now, task.checklist) : null,
    available: !task.available_from || Date.parse(task.available_from) <= now }
}
export async function workspace(port: CloudPort) {
  const [connection, snapshot] = await Promise.all([port.context(), port.snapshot()])
  return { account: connection, lists: snapshot.lists.map(item => ({ ...fromRemoteList(item.row), dirty: undefined, revision: item.revision,
    owner_username: snapshot.profiles.find(profile => profile.id === item.row.owner_id)?.username ?? null })),
    members: snapshot.members.map(item => ({ ...item.row, revision: item.revision, username: snapshot.profiles.find(profile => profile.id === item.row.user_id)?.username ?? null })),
    list_preferences: snapshot.preferences, account_preferences: snapshot.userPreferences,
    option_resources: ['prio://guide', 'prio://icons'],
    semantics: 'Read prio://guide for task rules, atomic writes, privacy and conflict handling. All data is the confirmed cloud state, not unsynced offline changes.' }
}
const digest = async (value: unknown) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))].map(value => value.toString(16).padStart(2, '0')).join('')

export async function searchTasks(port: CloudPort, input: SearchInput) {
  const { cursor: _cursor, limit, ...query } = input
  const queryHash = await digest(query)
  let previous: { query: string; snapshot: string; at: number; offset: number } | undefined
  if (input.cursor) {
    try { previous = JSON.parse(atob(input.cursor)) } catch { throw new CommandError('invalid_cursor', 'Invalid search cursor.') }
    if (!previous || previous.query !== queryHash || !Number.isInteger(previous.offset) || previous.offset < 0 || !Number.isFinite(previous.at)) throw new CommandError('invalid_cursor', 'Cursor belongs to another query.')
  }
  let listIds = input.list_ids
  if (input.overview_only) {
    const selection = await port.snapshot()
    const included = selection.preferences.filter(item => item.row.deleted_at === null && item.row.include_in_overview).map(item => item.row.list_id)
    listIds = listIds ? listIds.filter(id => included.includes(id)) : included
  }
  const snapshot = await port.snapshot({ include_tasks: true, list_ids: listIds, text: input.text, tags: input.tags, state: input.state,
    due_before: input.due_before, due_after: input.due_after, available_now: input.available_now, limit: 10001 })
  if (snapshot.tasks.length > 10000) throw new CommandError('selection_too_large', 'More than 10,000 tasks match. Narrow by list, text, tags or deadline before sorting; nothing was silently omitted.')
  const stamp = await digest([snapshot.lists.map(item => item.revision), snapshot.tasks.map(item => item.revision), snapshot.preferences.map(item => item.revision)])
  if (previous && previous.snapshot !== stamp) throw new CommandError('cursor_stale', 'Tasks or list preferences changed. Restart the search without cursor.')
  const at = previous?.at ?? Date.now()
  const rows = snapshot.tasks.filter(item => snapshot.lists.some(list => list.row.id === item.row.list_id && list.row.deleted_at === null))
  const priority = (item: Versioned<RemoteTask>) => { const task = fromRemoteTask(item.row); return snapshot.lists.find(list => list.row.id === task.list_id)?.row.ratings_enabled && task.rating ? ratingValues(task.rating, task.due_at, at, task.checklist).priority : -1 }
  rows.sort((a, b) => {
    const order = input.sort === 'priority' ? priority(b) - priority(a) : input.sort === 'due' ? (a.row.due_at ?? 'z').localeCompare(b.row.due_at ?? 'z')
      : input.sort === 'newest' ? b.row.created_at.localeCompare(a.row.created_at) : a.row.list_id.localeCompare(b.row.list_id) || compareTasks(fromRemoteTask(a.row), fromRemoteTask(b.row))
    return order || a.row.id.localeCompare(b.row.id)
  })
  const offset = previous?.offset ?? 0
  return { computed_at: new Date(at).toISOString(), total: rows.length, tasks: rows.slice(offset, offset + limit).map(item => presentTask(item, snapshot, at)),
    next_cursor: offset + limit < rows.length ? btoa(JSON.stringify({ query: queryHash, snapshot: stamp, at, offset: offset + limit })) : null }
}
