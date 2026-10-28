// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { generateKeyPair, SignJWT } from 'jose'
import { completeFromWidget, createWidgetEndpoint, readWidgetPages, WidgetConflict, type WidgetPort } from '../../server/widget'
import { projectWidget, type WidgetCommand, type WidgetRows } from '../../src/widgets/model'
import { remoteList, remoteTask, localListPreference, localUserPreference } from '../support/factories'
import { ratingValues, startRating } from '../../src/domain/rating'
import { sameData } from '../../src/domain/equality'
import { planReminders } from '../../src/reminders/reminderPlan'
import { fromRemoteList, fromRemoteTask } from '../../src/domain/mapping'

const userId = '00000000-0000-4000-8000-000000000001'
const listId = '10000000-0000-4000-8000-000000000001'
const taskId = '20000000-0000-4000-8000-000000000001'
const now = '2026-10-21T08:00:00.000Z'
const command = (): WidgetCommand => ({ id: crypto.randomUUID(), userId, taskId, at: now })
function fixture() {
  const rows: WidgetRows = { lists: [remoteList({ id: listId, owner_id: userId })], tasks: [remoteTask({ id: taskId, list_id: listId })], preferences: [], userPreferences: [] }
  const receipts = new Map<string, string>(); let fail = false
  const port: WidgetPort = {
    rows: async () => structuredClone(rows),
    scope: async () => structuredClone({ list: rows.lists[0] ?? null, tasks: rows.tasks }),
    replay: async cmd => { const receipt = receipts.get(cmd.id); if (receipt && receipt !== JSON.stringify(cmd)) throw new Error('reused-id'); return receipt !== undefined },
    async commit(cmd, plan) {
      if (fail) { fail = false; return 'conflict' }
      const next = structuredClone(rows)
      for (const change of plan.changes) {
        const table = next[change.table]; const index = table.findIndex(row => row.id === change.row.id)
        if (!sameData(table[index] ?? null, change.expected)) return 'conflict'
        if (index === -1) table.push(change.row as never); else table[index] = change.row as never
      }
      Object.assign(rows, next); receipts.set(cmd.id, JSON.stringify(cmd)); return 'committed'
    },
  }
  return { rows, port, failNext: () => { fail = true } }
}

describe('Android-Widget: gemeinsame Fachregeln und sichere Aufträge', () => {
  it('hides completed points without losing counts or the ability to reopen them', async () => {
    const f = fixture()
    Object.assign(f.rows.tasks[0], { checklist_hide_completed: true, checklist: [
      { id: 'a', text: 'Einpacken', completed: true, deleted_at: null },
      { id: 'b', text: 'Losgehen', completed: false, deleted_at: null },
    ] })
    const snapshot = projectWidget(f.rows, userId, Date.parse(now), 'Europe/Berlin')
    expect(snapshot.tasks[0]).toMatchObject({ checklistDone: 1, checklistTotal: 2, checklistHideCompleted: true, checklist: [{ id: 'b' }] })
    expect(snapshot.tasks[0].checklist).toHaveLength(1)
    await completeFromWidget(f.port, { ...command(), checklist: { id: 'a', completed: false } }, 'Europe/Berlin')
    expect(projectWidget(f.rows, userId, Date.parse(now), 'Europe/Berlin').tasks[0].checklist).toHaveLength(2)
    expect(f.rows.tasks[0].completed).toBe(false)
  })
  it('checks individual items without completing the task or altering other items, also on retry', async () => {
    const f = fixture()
    Object.assign(f.rows.tasks[0], { recurrence: 'daily', due_at: now, checklist: [
      { id: 'a', text: 'Erster Punkt', completed: false, deleted_at: null },
      { id: 'b', text: 'Zweiter Punkt', completed: false, deleted_at: null },
    ] })
    const cmd = { ...command(), checklist: { id: 'a', completed: true } }
    await completeFromWidget(f.port, cmd, 'Europe/Berlin')
    expect(f.rows.tasks).toHaveLength(1)
    expect(f.rows.tasks[0]).toMatchObject({ completed: false, checklist: [{ completed: true }, { completed: false }] })
    const first = structuredClone(f.rows)
    await completeFromWidget(f.port, cmd, 'Europe/Berlin'); expect(f.rows).toEqual(first)
    await completeFromWidget(f.port, { ...command(), checklist: { id: 'a', completed: false } }, 'Europe/Berlin')
    expect(f.rows.tasks[0].checklist![0].completed).toBe(false)
  })
  it('survives a lost response and repeated submission without duplicate recurrence', async () => {
    const f = fixture(); Object.assign(f.rows.tasks[0], { due_at: '2026-10-21T12:00:00.000Z', recurrence: 'every:2:days', checklist: [{ id: 'part', text: 'Schritt', completed: true, deleted_at: null }], reminders: [{ form: 'offset', minutes: 90 }] })
    const cmd = command(); await completeFromWidget(f.port, cmd, 'Europe/Berlin')
    const first = structuredClone(f.rows)
    await completeFromWidget(f.port, structuredClone(cmd), 'Europe/Berlin')
    expect(f.rows).toEqual(first); expect(f.rows.tasks).toHaveLength(2)
    expect(f.rows.tasks[0].checklist![0].completed).toBe(true)
    expect(f.rows.tasks[1]).toMatchObject({ due_at: '2026-10-23T12:00:00.000Z', available_from: '2026-10-21T12:00:00.000Z', checklist: [{ completed: false }], reminders: [{ form: 'offset', minutes: 90 }] })
    // Eine spätere bewusste Wiederöffnung darf ein alter Retry nicht zurücknehmen.
    f.rows.tasks[0].completed = false
    await completeFromWidget(f.port, cmd, 'Europe/Berlin'); expect(f.rows.tasks[0].completed).toBe(false)
  })
  it('merges an offline note and due-date edit before deriving the next recurrence', async () => {
    const f = fixture(); Object.assign(f.rows.tasks[0], { due_at: '2026-10-22T08:00:00.000Z', recurrence: 'daily' })
    const base = structuredClone(f.rows.tasks[0]); const cmd = command()
    cmd.local = { task: { ...base, description: 'Notiz vom Handy', due_at: '2026-10-23T08:00:00.000Z' }, base, list: f.rows.lists[0], listBase: f.rows.lists[0] }
    f.rows.tasks[0].title = 'Titel vom anderen Gerät'
    f.failNext(); await completeFromWidget(f.port, cmd, 'Europe/Berlin')
    expect(f.rows.tasks[0]).toMatchObject({ title: 'Titel vom anderen Gerät', description: 'Notiz vom Handy', completed: true })
    expect(f.rows.tasks[1]).toMatchObject({ title: 'Titel vom anderen Gerät', description: 'Notiz vom Handy', due_at: '2026-10-24T08:00:00.000Z' })
  })
  it('keeps conflicting edits pending instead of choosing a device clock winner', async () => {
    const f = fixture(); const base = structuredClone(f.rows.tasks[0]); const cmd = command()
    cmd.local = { task: { ...base, description: 'Lokal' }, base, list: f.rows.lists[0], listBase: f.rows.lists[0] }
    f.rows.tasks[0].description = 'Cloud'
    await expect(completeFromWidget(f.port, cmd, 'Europe/Berlin')).rejects.toBeInstanceOf(WidgetConflict)
    expect(f.rows.tasks[0]).toMatchObject({ description: 'Cloud', completed: false })
  })
  it('does not revive deleted tasks or lists, and rejects reused request ids', async () => {
    const f = fixture(); const cmd = command(); f.rows.tasks[0].deleted_at = now
    await completeFromWidget(f.port, cmd, 'Europe/Berlin')
    expect(f.rows.tasks[0].completed).toBe(false)
    await expect(completeFromWidget(f.port, { ...cmd, taskId: crypto.randomUUID() }, 'Europe/Berlin')).rejects.toThrow('reused-id')
  })
  it('shares ratings, checklist progress, tags, ordering and reminder plans with the app', () => {
    const f = fixture(); f.rows.lists[0].ratings_enabled = true
    Object.assign(f.rows.tasks[0], { rating: { ...startRating(8), urgencyMode: 'manual', urgency: 0 }, due_at: '2026-10-24T08:00:00.000Z', tags: [' UNI ', 'Wichtig'], checklist: [{ id: 'a', text: 'Eins', completed: true, deleted_at: null }, { id: 'b', text: 'Zwei', completed: false, deleted_at: null }], reminders: [{ form: 'offset', minutes: 30 }] })
    f.rows.preferences = [localListPreference({ list_id: listId, user_id: userId, include_in_overview: true })]
    f.rows.userPreferences = [localUserPreference({ id: userId, detailed_ratings: false })]
    const result = projectWidget(f.rows, userId, Date.parse(now), 'Europe/Berlin')
    const task = fromRemoteTask(f.rows.tasks[0]); const list = fromRemoteList(f.rows.lists[0])
    expect(result.tasks[0]).toMatchObject({ priority: ratingValues(task.rating!, task.due_at, Date.parse(now), task.checklist, false).priority, checklistDone: 1, checklistTotal: 2, tagKeys: ['uni', 'wichtig'], due: 'In 3 Tagen (Sa)' })
    expect(result.reminders).toEqual(planReminders([task], [list], Date.parse(now), userId))
    expect(result.lists[0].overview).toBe(true)
    expect(JSON.stringify(result)).not.toContain('description')
  })
  it('uses exact clock times below 24 hours so a suspended widget never promises a stale countdown', () => {
    const f = fixture(); f.rows.tasks[0].due_at = '2026-10-21T09:30:00.000Z'
    expect(projectWidget(f.rows, userId, Date.parse(now), 'Europe/Berlin').tasks[0].due).toBe('21.10.2026, 11:30')
  })
  it('keeps calendar repeats at local wall-clock time across a daylight-saving change', async () => {
    const f = fixture(); Object.assign(f.rows.tasks[0], { due_at: '2026-10-24T08:00:00.000Z', recurrence: 'daily' })
    await completeFromWidget(f.port, command(), 'Europe/Berlin')
    expect(f.rows.tasks[1].due_at).toBe('2026-10-25T09:00:00.000Z')
  })
})

describe('Native Widget-HTTP-Grenze', () => {
  it('loads every PostgREST page instead of silently truncating a large list', async () => {
    const rows = Array.from({ length: 2103 }, (_, id) => ({ id }))
    const offsets: number[] = []
    const page = async (offset: number) => { offsets.push(offset); return { data: rows.slice(offset, offset + 1000), error: null } }
    expect(await readWidgetPages(page, 10000)).toEqual(rows)
    expect(offsets).toEqual([0, 1000, 2000])
    await expect(readWidgetPages(page, 2000)).rejects.toThrow('scope too large')
    await expect(readWidgetPages(async () => ({ data: null, error: new Error('offline') }), 10000)).rejects.toThrow('database request failed')
  })
  it('requires a native user session, binds commands to the account and sends no CORS access', async () => {
    const f = fixture(); const keys = await generateKeyPair('ES256')
    const config = { supabaseUrl: 'https://test.supabase.co', publishableKey: 'public', resourceUrl: 'https://prio.test/mcp', version: 'test' }
    const endpoint = createWidgetEndpoint(config, 'secret', { key: async () => keys.publicKey, port: () => f.port })
    const token = async (claims = {}) => new SignJWT({ role: 'authenticated', session_id: crypto.randomUUID(), ...claims }).setProtectedHeader({ alg: 'ES256' }).setSubject(userId).setIssuer(`${config.supabaseUrl}/auth/v1`).setAudience('authenticated').setExpirationTime('10m').sign(keys.privateKey)
    const request = (access: string, commands: WidgetCommand[] = [], extra = {}) => new Request('https://prio.test/api/widget', { method: 'POST', headers: { Authorization: `Bearer ${access}`, ...extra }, body: JSON.stringify({ protocol: 1, timeZone: 'Europe/Berlin', commands }) })
    expect((await endpoint(request('invalid'))).status).toBe(401)
    expect((await endpoint(request(await token({ client_id: crypto.randomUUID() })))).status).toBe(403)
    expect((await endpoint(request(await token(), [], { Origin: 'https://evil.test' }))).status).toBe(403)
    expect((await endpoint(request(await token(), [{ ...command(), userId: crypto.randomUUID() }]))).status).toBe(403)
    const oversized = new Request('https://prio.test/api/widget', { method: 'POST', headers: { Authorization: `Bearer ${await token()}` }, body: 'ä'.repeat(1024 * 1024 + 1) })
    expect((await endpoint(oversized)).status).toBe(413)
    const cmd = command(); const response = await endpoint(request(await token(), [cmd]))
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toMatchObject({ acknowledged: [cmd.id], conflicts: [], snapshot: { userId, tasks: [] } })
  })
})
