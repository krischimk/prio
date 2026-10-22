import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { WIDGET_PROTOCOL } from '../../src/widgets/model'
import { startRating } from '../../src/domain/rating'

/** Native Hintergrund-API mit einem Testkonto; keine geöffnete Prio-WebView. */
test('Widget gleicht ohne geöffnete App ab und bestätigt einen Retry genau einmal', async ({ request }) => {
  try { process.loadEnvFile('.env') } catch { /* CI liefert die öffentlichen Werte direkt. */ }
  const credentials: Record<string, string | undefined> = { ...process.env }
  if (!credentials.PRIO_TEST_A_EMAIL || !credentials.PRIO_TEST_A_PASSWORT) {
    try {
      for (const line of readFileSync(join(homedir(), '.prio-android/testkonten.env'), 'utf8').split('\n')) {
        const match = /^([A-Z_]+)\s*=\s*(.*)$/.exec(line.trim()); if (match) credentials[match[1]] = match[2]
      }
    } catch { /* Ohne Testkonto wird der Ablauf ausdrücklich übersprungen. */ }
  }
  const url = credentials.VITE_SUPABASE_URL
  const key = credentials.VITE_SUPABASE_PUBLISHABLE_KEY
  test.skip(!url || !key || !credentials.PRIO_TEST_A_EMAIL || !credentials.PRIO_TEST_A_PASSWORT, 'Öffentliche Konfiguration und Testkonto fehlen.')
  const client = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const auth = await client.auth.signInWithPassword({ email: credentials.PRIO_TEST_A_EMAIL!, password: credentials.PRIO_TEST_A_PASSWORT! })
  expect(auth.error).toBeNull(); const userId = auth.data.user!.id
  const listId = crypto.randomUUID(); const taskId = crypto.randomUUID(); const at = new Date().toISOString()
  const list = { id: listId, owner_id: userId, name: 'Widget-Rauchprüfung', is_shared: false, icon: 'std:prio', sections: [], keep_completed: true, ratings_enabled: true, allow_duplicate_titles: true, completion_retention_started_at: at, created_at: at, updated_at: at, deleted_at: null }
  const task = { id: taskId, list_id: listId, title: 'Widget: tägliche Wiederholung', description: 'Diese Notiz muss erhalten bleiben.', checklist: [{ id: crypto.randomUUID(), text: 'Vorbereiten', completed: true, deleted_at: null }], tags: ['Widgettest'], rating: startRating(7), due_at: new Date(Date.now() + 86400000).toISOString(), available_from: null, completed: false, completed_at: null, completed_expires_at: null, expired_at: null, reopen_context: null, recurrence: 'daily', recurrence_series_id: null, successor_id: null, reminders: [{ form: 'offset', minutes: 90 }], section_id: null, position: 0, created_at: at, updated_at: at, deleted_at: null }
  try {
    const created = await client.rpc('sync_push', { p_changes: [{ table: 'lists', row: list, expected: null }, { table: 'tasks', row: task, expected: null }] })
    expect(created.error).toBeNull(); expect(created.data.every((row: { kind: string }) => row.kind === 'written')).toBe(true)
    const point = { id: crypto.randomUUID(), userId, taskId, at, checklist: { id: task.checklist[0].id, completed: false } }
    const pointResponse = await request.post('/api/widget', { headers: { Authorization: `Bearer ${auth.data.session!.access_token}` }, data: { protocol: WIDGET_PROTOCOL, timeZone: 'Europe/Berlin', commands: [point] } })
    expect(pointResponse.status(), await pointResponse.text()).toBe(200)
    const open = await client.from('tasks').select('*').eq('id', taskId).single()
    expect(open.data).toMatchObject({ completed: false, checklist: [{ completed: false }] })
    const command = { id: crypto.randomUUID(), userId, taskId, at }
    const body = { protocol: WIDGET_PROTOCOL, timeZone: 'Europe/Berlin', commands: [command] }
    for (let retry = 0; retry < 2; retry++) {
      const response = await request.post('/api/widget', { headers: { Authorization: `Bearer ${auth.data.session!.access_token}` }, data: body })
      expect(response.status(), await response.text()).toBe(200)
      const result = await response.json(); expect(result.acknowledged).toContain(command.id); expect(result.conflicts).toEqual([])
      expect(result.snapshot.tasks.some((row: { id: string }) => row.id === taskId)).toBe(false)
    }
    const result = await client.from('tasks').select('*').eq('list_id', listId)
    expect(result.error).toBeNull(); expect(result.data).toHaveLength(2)
    expect(result.data!.find(row => row.id === taskId)).toMatchObject({ completed: true, description: task.description, checklist: [{ completed: false }] })
    const successor = result.data!.find(row => row.id !== taskId)!
    expect(successor).toMatchObject({ completed: false, description: task.description, checklist: [{ completed: false }] })
    expect(Date.parse(successor.available_from)).toBe(Date.parse(task.due_at))
  } finally {
    const tasks = await client.from('tasks').select('*').eq('list_id', listId)
    const current = await client.from('lists').select('*').eq('id', listId).maybeSingle()
    const deletedAt = new Date().toISOString()
    const changes = (tasks.data ?? []).map(row => ({ table: 'tasks', row: { ...row, deleted_at: deletedAt, updated_at: deletedAt }, expected: row }))
    if (current.data) changes.push({ table: 'lists', row: { ...current.data, deleted_at: deletedAt, updated_at: deletedAt }, expected: current.data })
    if (changes.length) { const cleanup = await client.rpc('sync_push', { p_changes: changes }); expect(cleanup.error).toBeNull() }
    await client.auth.signOut({ scope: 'local' })
  }
})
