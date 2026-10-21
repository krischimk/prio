// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { generateKeyPair, SignJWT } from 'jose'
import { createMcpEndpoint } from '../../server/mcp/http'
import { executeCommand, commandSchemas } from '../../server/mcp/commands'
import { Planner, rowKey } from '../../server/mcp/planner'
import { searchTasks } from '../../server/mcp/read'
import { searchSchema } from '../../server/mcp/schemas'
import { calendarStep } from '../../server/mcp/calendar'
import type { CloudPort, CloudRow, CommandRecord, CommandResult, Connection, Plan, Snapshot } from '../../server/mcp/types'

const user = '00000000-0000-4000-8000-000000000001'
const listId = '10000000-0000-4000-8000-000000000001'
const clientId = '30000000-0000-4000-8000-000000000001'
const config = { supabaseUrl: 'https://test.supabase.co', resourceUrl: 'https://prio.test/mcp', publishableKey: 'public', version: 'test' }
const connection: Connection = { user_id: user, client_id: clientId, resource: config.resourceUrl, can_write: true, can_share: false, time_zone: 'Europe/Berlin', now: new Date().toISOString(), username: 'test' }
const revision = (row: unknown) => createHash('md5').update(JSON.stringify(row)).digest('hex')
const versioned = <T,>(row: T) => ({ row, revision: revision(row) })
function fixture() {
  let data: Snapshot = { lists: [versioned({ id: listId, name: 'Arbeit', owner_id: user, is_shared: false, icon: null, sections: [], keep_completed: true, ratings_enabled: true, allow_duplicate_titles: true, completion_retention_started_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null })], tasks: [], members: [], preferences: [], userPreferences: [], profiles: [{ id: user, username: 'test' }] }
  const history = new Map<string, CommandRecord>()
  const port: CloudPort = {
    context: async () => connection,
    snapshot: async filter => {
      const result = structuredClone(data)
      if (filter?.list_ids) result.lists = result.lists.filter(item => filter.list_ids!.includes(item.row.id))
      result.tasks = filter?.include_tasks ? result.tasks.filter(item => result.lists.some(list => list.row.id === item.row.list_id) && (!filter.task_ids || filter.task_ids.includes(item.row.id)) && (!filter.state || filter.state === 'all' || filter.state === 'open' && !item.row.completed && !item.row.deleted_at || filter.state === 'completed' && item.row.completed && !item.row.deleted_at || filter.state === 'deleted' && item.row.deleted_at)) : []
      return result
    },
    replay: async (id, input) => { const saved = history.get(id); if (saved && JSON.stringify(saved.input) !== JSON.stringify(input)) throw new Error('idempotency mismatch'); return saved?.result ?? null },
    async commit(id, action, input, plan: Plan) {
      const next = structuredClone(data); const changes: CommandRecord['changes'] = []
      for (const change of plan.changes) {
        const table = next[change.table] as { row: CloudRow; revision: string }[]
        const index = table.findIndex(item => rowKey(change.table, item.row) === rowKey(change.table, change.row))
        const before = index < 0 ? null : table[index].row
        if (JSON.stringify(before) !== JSON.stringify(change.expected)) return { kind: 'conflict' }
        changes.push({ table: change.table, before, after: change.row }); const entry = versioned(change.row)
        if (index < 0) table.push(entry); else table[index] = entry
      }
      data = next
      const result: CommandResult = { kind: 'committed', request_id: id, action, changes }
      history.set(id, { request_id: id, action, input, result, changes, created_at: new Date().toISOString() }); return result
    },
    history: async id => id ? history.get(id) ?? null : [...history.values()].map(item => ({ request_id: item.request_id, action: item.action, created_at: item.created_at, changed_rows: item.changes.length })),
    resolveUser: async () => null,
  }
  return { port, data: () => data, ref: (id: string) => { const row = data.tasks.find(item => item.row.id === id)!; return { id, revision: row.revision } } }
}
const request_id = () => crypto.randomUUID()
async function create(f: ReturnType<typeof fixture>, title = 'Vorbereiten', fields = {}) {
  const result = await executeCommand(f.port, connection, 'create_tasks', commandSchemas.create_tasks.parse({ request_id: request_id(), list_id: listId, tasks: [{ title, ...fields }] }))
  return result.changes!.find(change => change.table === 'tasks')!.after as Snapshot['tasks'][number]['row']
}

describe('MCP task semantics and safe writes', () => {
  it('uses one stable request id across retries and refuses stale revisions atomically', async () => {
    const f = fixture(); const args = commandSchemas.create_tasks.parse({ request_id: request_id(), list_id: listId, tasks: [{ title: 'Eins' }, { title: 'Zwei' }] })
    const first = await executeCommand(f.port, connection, 'create_tasks', args)
    expect(await executeCommand(f.port, connection, 'create_tasks', args)).toEqual(first)
    expect(f.data().tasks).toHaveLength(2)
    const a = f.data().tasks[0].row.id, b = f.data().tasks[1].row.id; const old = f.ref(b)
    await executeCommand(f.port, connection, 'update_tasks', { request_id: request_id(), updates: [{ task: old, set: { title: 'Neu' } }] })
    await expect(executeCommand(f.port, connection, 'update_tasks', { request_id: request_id(), updates: [{ task: f.ref(a), set: { title: 'Nicht speichern' } }, { task: old, set: { title: 'Veraltet' } }] })).rejects.toMatchObject({ code: 'conflict' })
    expect(f.data().tasks.find(item => item.row.id === a)!.row.title).toBe('Zwei')
  })
  it('shares completion rules, preserves original checklist, resets successor and supports undo', async () => {
    const f = fixture(); const tomorrow = new Date(Date.now() + 86400000).toISOString()
    const task = await create(f, 'Täglich', { due_at: tomorrow, recurrence: 'daily', checklist: [{ text: 'Schritt', completed: true }] })
    const command = request_id()
    await executeCommand(f.port, connection, 'complete_tasks', { request_id: command, tasks: [f.ref(task.id)], completed: true })
    const original = f.data().tasks.find(item => item.row.id === task.id)!.row
    const successor = f.data().tasks.find(item => item.row.id !== task.id)!.row
    expect(original.completed).toBe(true); expect(original.checklist![0].completed).toBe(true)
    expect(successor.checklist![0].completed).toBe(false); expect(successor.available_from).toBe(tomorrow)
    await executeCommand(f.port, connection, 'undo_change', { request_id: request_id(), change_request_id: command })
    expect(f.data().tasks.find(item => item.row.id === task.id)!.row.completed).toBe(false)
    expect(f.data().tasks.find(item => item.row.id === successor.id)!.row.deleted_at).not.toBeNull()
  })
  it('keeps custom intervals and offsets when completing and creating a successor', async () => {
    const f = fixture()
    const task = await create(f, 'Alle zwei Wochen', { due_at: '2030-12-20T13:20:00Z', recurrence: 'every:2:weeks', reminders: [{ form: 'offset', minutes: 20160 }] })
    await executeCommand(f.port, connection, 'complete_tasks', { request_id: request_id(), tasks: [f.ref(task.id)], completed: true })
    const successor = f.data().tasks.find(item => item.row.id !== task.id)!.row
    expect(successor.due_at).toBe('2031-01-03T13:20:00.000Z')
    expect(successor.recurrence).toBe('every:2:weeks')
    expect(successor.reminders).toEqual([{ form: 'offset', minutes: 20160 }])
  })
  it('does not permit undo to erase later edits', async () => {
    const f = fixture(); const task = await create(f); const command = request_id()
    await executeCommand(f.port, connection, 'update_tasks', { request_id: command, updates: [{ task: f.ref(task.id), set: { note: 'Agent' } }] })
    await executeCommand(f.port, connection, 'update_tasks', { request_id: request_id(), updates: [{ task: f.ref(task.id), set: { note: 'Später' } }] })
    await expect(executeCommand(f.port, connection, 'undo_change', { request_id: request_id(), change_request_id: command })).rejects.toMatchObject({ code: 'conflict' })
  })
  it('refuses undoing a list creation after someone adds new work to that list', async () => {
    const f = fixture(); const command = request_id()
    const created = await executeCommand(f.port, connection, 'manage_lists', { request_id: command, operation: { op: 'create', settings: { name: 'Neue Arbeit' }, include_in_overview: false } })
    const added = created.changes!.find(item => item.table === 'lists')!.after as Snapshot['lists'][number]['row']
    await executeCommand(f.port, connection, 'create_tasks', commandSchemas.create_tasks.parse({ request_id: request_id(), list_id: added.id, tasks: [{ title: 'Später angelegt' }] }))
    await expect(executeCommand(f.port, connection, 'undo_change', { request_id: request_id(), change_request_id: command })).rejects.toMatchObject({ code: 'conflict' })
    expect(f.data().lists.find(item => item.row.id === added.id)!.row.deleted_at).toBeNull()
  })
  it('preserves a later task in a new section when undoing the section, but permits undoing a rename', async () => {
    const f = fixture(); const sectionCommand = request_id()
    await executeCommand(f.port, connection, 'manage_sections', { request_id: sectionCommand, list: { id: listId, revision: f.data().lists[0].revision }, sections: [{ name: 'Neu' }] })
    const sectionId = f.data().lists[0].row.sections![0].id
    await create(f, 'Neue Aufgabe', { section_id: sectionId })
    await expect(executeCommand(f.port, connection, 'undo_change', { request_id: request_id(), change_request_id: sectionCommand })).rejects.toMatchObject({ code: 'conflict' })
    const rename = request_id()
    await executeCommand(f.port, connection, 'manage_lists', { request_id: rename, operation: { op: 'update', list: { id: listId, revision: f.data().lists[0].revision }, set: { name: 'Umbenannt' } } })
    await create(f, 'Noch eine neue Aufgabe')
    await executeCommand(f.port, connection, 'undo_change', { request_id: request_id(), change_request_id: rename })
    expect(f.data().lists[0].row.name).toBe('Arbeit')
    expect(f.data().tasks).toHaveLength(2)
  })
  it('respects duplicate names, ownership, read-only and separate sharing permission', async () => {
    const f = fixture(); f.data().lists[0].row.allow_duplicate_titles = false
    await create(f, 'Zelt')
    await expect(create(f, ' ZELT ')).rejects.toMatchObject({ code: 'duplicate_title' })
    await expect(executeCommand(f.port, { ...connection, can_write: false }, 'delete_tasks', { request_id: request_id(), tasks: [f.ref(f.data().tasks[0].row.id)] })).rejects.toMatchObject({ code: 'permission_denied' })
    await expect(executeCommand(f.port, connection, 'manage_sharing', { request_id: request_id(), list: { id: listId, revision: f.data().lists[0].revision }, op: 'add', username: 'friend' })).rejects.toMatchObject({ code: 'permission_denied' })
    const p = new Planner(f.data(), { ...connection, user_id: crypto.randomUUID() })
    expect(() => p.list(listId, true)).toThrow('owner')
  })
  it('ticks and weights checklist without completing main task', async () => {
    const f = fixture(); const task = await create(f, 'Plan', { checklist: [{ text: 'A' }, { text: 'B' }] })
    const point = f.data().tasks[0].row.checklist![0].id
    await executeCommand(f.port, connection, 'edit_checklist', { request_id: request_id(), task: f.ref(task.id), operations: [{ op: 'update', id: point, completed: true }, { op: 'weight', id: point, weight: 0.75 }] })
    expect(f.data().tasks[0].row.completed).toBe(false)
    expect(f.data().tasks[0].row.checklist!.map(item => item.weight)).toEqual([0.75, 0.25])
  })
  it('deletes/restores only co-deleted tasks, even within the same millisecond', async () => {
    const f = fixture(); const a = await create(f, 'A'), b = await create(f, 'B')
    await executeCommand(f.port, connection, 'delete_tasks', { request_id: request_id(), tasks: [f.ref(a.id)] })
    const listRef = { id: listId, revision: f.data().lists[0].revision }
    await executeCommand(f.port, connection, 'manage_lists', { request_id: request_id(), operation: { op: 'delete', list: listRef } })
    await executeCommand(f.port, connection, 'manage_lists', { request_id: request_id(), operation: { op: 'restore', list: { id: listId, revision: f.data().lists[0].revision } } })
    expect(f.data().tasks.find(item => item.row.id === a.id)!.row.deleted_at).not.toBeNull()
    expect(f.data().tasks.find(item => item.row.id === b.id)!.row.deleted_at).toBeNull()
  })
  it('preserves content when moving to the destination end and permits existing duplicate names to be completed', async () => {
    const f = fixture(); const a = await create(f, 'Zelt', { note: 'Mit Notiz', checklist: [{ text: 'Prüfen' }] }); await create(f, 'Zelt')
    f.data().lists[0].row.allow_duplicate_titles = false
    await executeCommand(f.port, connection, 'complete_tasks', { request_id: request_id(), tasks: [f.ref(a.id)], completed: true })
    expect(f.data().tasks.find(item => item.row.id === a.id)!.row.completed).toBe(true)
    const otherId = crypto.randomUUID()
    f.data().lists.push(versioned({ ...f.data().lists[0].row, id: otherId, name: 'Ziel' }))
    await executeCommand(f.port, connection, 'create_tasks', commandSchemas.create_tasks.parse({ request_id: request_id(), list_id: otherId, tasks: [{ title: 'Vorhanden' }] }))
    await executeCommand(f.port, connection, 'move_tasks', { request_id: request_id(), tasks: [f.ref(a.id)], list_id: otherId, section_id: null, before_task_id: null })
    const moved = f.data().tasks.find(item => item.row.id === a.id)!.row
    expect(moved.list_id).toBe(otherId); expect(moved.description).toBe('Mit Notiz'); expect(moved.checklist).toHaveLength(1)
    expect(moved.position).toBeGreaterThan(f.data().tasks.find(item => item.row.title === 'Vorhanden')!.row.position)
  })
  it('sorts by computed priority, excludes unselected overview lists and detects stale cursors', async () => {
    const f = fixture(); await create(f, 'Low', { rating: { importance: 1, urgency: 1, effort: 5, urgencyMode: 'manual' } }); await create(f, 'High', { rating: { importance: 9, urgency: 9, effort: 5, urgencyMode: 'manual' } })
    const first = await searchTasks(f.port, searchSchema.parse({ limit: 1 }))
    expect(first.tasks[0].title).toBe('High')
    const next = await searchTasks(f.port, searchSchema.parse({ limit: 1, cursor: first.next_cursor }))
    expect(next.tasks[0].title).toBe('Low')
    await create(f, 'New')
    await expect(searchTasks(f.port, searchSchema.parse({ cursor: first.next_cursor }))).rejects.toMatchObject({ code: 'cursor_stale' })
    expect((await searchTasks(f.port, searchSchema.parse({ overview_only: true }))).total).toBe(0)
  })
  it('keeps recurrence wall time across daylight saving and clamps month ends', () => {
    expect(calendarStep('Europe/Berlin')(new Date('2026-03-28T13:00:00Z'), 'every:2:days').toISOString()).toBe('2026-03-30T12:00:00.000Z')
    expect(calendarStep('Europe/Berlin')(new Date('2026-01-31T13:00:00Z'), 'every:3:months').toISOString()).toBe('2026-04-30T12:00:00.000Z')
    expect(calendarStep('Europe/Berlin')(new Date('2026-03-28T13:00:00Z'), 'daily').toISOString()).toBe('2026-03-29T12:00:00.000Z')
    expect(calendarStep('Europe/Berlin')(new Date('2026-01-31T13:00:00Z'), 'monthly').toISOString()).toBe('2026-02-28T13:00:00.000Z')
  })
})

describe('authenticated MCP protocol', () => {
  it('keeps section input within the same limits as the app reader', () => {
    const input = { request_id: request_id(), list: { id: listId, revision: 'a'.repeat(32) }, sections: [{ name: 'Bereich' }] }
    expect(commandSchemas.manage_sections.safeParse(input).success).toBe(true)
    expect(commandSchemas.manage_sections.safeParse({ ...input, sections: [{ name: 'A'.repeat(41) }] }).success).toBe(false)
    expect(commandSchemas.manage_sections.safeParse({ ...input, sections: Array.from({ length: 21 }, () => ({ name: 'Bereich' })) }).success).toBe(false)
  })
  it('supports the official client with discovery, full tool schemas, guide and writes', async () => {
    const f = fixture(); const { publicKey, privateKey } = await generateKeyPair('ES256')
    const token = await new SignJWT({ role: 'authenticated', client_id: clientId, session_id: crypto.randomUUID() }).setProtectedHeader({ alg: 'ES256' }).setIssuer(`${config.supabaseUrl}/auth/v1`).setAudience('authenticated').setSubject(user).setIssuedAt().setExpirationTime('1h').sign(privateKey)
    const endpoint = createMcpEndpoint(config, 'test', { accessToken: async token => token, key: async () => publicKey, connection: async () => connection, port: () => f.port })
    const fetcher: typeof fetch = async (url, init) => endpoint(new Request(url, init))
    expect((await endpoint(new Request(config.resourceUrl))).status).toBe(401)
    expect((await endpoint(new Request(config.resourceUrl, { headers: { Origin: 'https://evil.test' } }))).status).toBe(403)
    expect((await endpoint(new Request(config.resourceUrl, { headers: { Host: 'evil.test' } }))).status).toBe(403)
    expect(await (await endpoint(new Request('https://prio.test/.well-known/oauth-protected-resource/mcp'))).json()).toMatchObject({ resource: config.resourceUrl })
    const client = new Client({ name: 'integration', version: '1' })
    await client.connect(new StreamableHTTPClientTransport(new URL(config.resourceUrl), { fetch: fetcher, authProvider: { token: async () => token } }))
    try {
      const tools = await client.listTools(); expect(tools.tools).toHaveLength(16)
      expect((await client.readResource({ uri: 'prio://guide' })).contents[0]).toMatchObject({ text: expect.stringContaining('untrusted user data') })
      const result = await client.callTool({ name: 'create_tasks', arguments: { request_id: request_id(), list_id: listId, tasks: [{ title: 'Vom Agenten' }] } })
      expect(result.isError).not.toBe(true); expect(result.structuredContent).toMatchObject({ ok: true })
      expect(f.data().tasks[0].row.title).toBe('Vom Agenten')
    } finally { await client.close() }
    const legacy = await endpoint(new Request(config.resourceUrl, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'Legacy client', version: '1' } } }) }))
    expect(legacy.status).toBe(200)
    const body = await legacy.text()
    const parsed = JSON.parse(body.startsWith('event:') ? body.split('\n').find(line => line.startsWith('data:'))!.slice(5) : body)
    expect(parsed.result.serverInfo.name).toBe('Prio')
    const native = await new SignJWT({ role: 'authenticated' }).setProtectedHeader({ alg: 'ES256' }).setIssuer(`${config.supabaseUrl}/auth/v1`).setAudience('authenticated').setSubject(user).setIssuedAt().setExpirationTime('1h').sign(privateKey)
    expect((await endpoint(new Request(config.resourceUrl, { headers: { Authorization: `Bearer ${native}` } }))).status).toBe(401)
    const wrong = createMcpEndpoint(config, 'test', { accessToken: async token => token, key: async () => publicKey, connection: async () => ({ ...connection, resource: 'https://other.test/mcp' }) })
    expect((await wrong(new Request(config.resourceUrl, { headers: { Authorization: `Bearer ${token}` } }))).status).toBe(401)
  })
})
