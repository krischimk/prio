import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

/** Ausschließlich aus dem gegen localhost abgesicherten Datenbank-Testlauf. */
export async function testWidgets(sql, asyncSql) {
  const actor = randomUUID(), other = randomUUID(), listId = randomUUID(), taskId = randomUUID()
  const secret = 'widget-test-attestation'; const at = new Date().toISOString()
  const json = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`
  const native = (query, user = actor) => `begin;set local role authenticated;set local request.jwt.claim.sub='${user}';set local request.jwt.claims='{"sub":"${user}"}';${query};commit;`
  const current = id => JSON.parse(sql(`select to_jsonb(t) from public.tasks t where id='${id}'`))
  const list = { id: listId, owner_id: actor, name: 'Widget', is_shared: false, icon: null, sections: [], keep_completed: true, ratings_enabled: false, allow_duplicate_titles: true, completion_retention_started_at: at, created_at: at, updated_at: at, deleted_at: null }
  const task = { id: taskId, list_id: listId, title: 'Offline abhaken', description: 'Private Notiz', checklist: [], tags: [], rating: null, due_at: null, available_from: null, completed: false, completed_at: null, completed_expires_at: null, expired_at: null, reopen_context: null, recurrence: null, successor_id: null, recurrence_series_id: null, reminders: [], section_id: null, position: 0, created_at: at, updated_at: at, deleted_at: null }
  sql(`insert into auth.users(id,email) values('${actor}','widget-a@prio.test'),('${other}','widget-b@prio.test');update private.mcp_settings set command_key='${secret}' where singleton;`)
  const initial = JSON.parse(sql(native(`select public.sync_push(${json([{ table: 'lists', row: list, expected: null }, { table: 'tasks', row: task, expected: null }])})`)))
  assert.ok(initial.every(row => row.kind === 'written'), JSON.stringify(initial))
  let checks = 0
  function check(label, fn) { fn(); checks++; console.log(`✓ Widget ${label}`) }
  function command(changes, extra = {}) {
    const command = { id: randomUUID(), userId: actor, taskId, at }
    const body = { purpose: 'prio-widget-v1', user_id: actor, issued_at: Math.floor(Date.now() / 1000), command, guards: [], changes, ...extra }
    const text = JSON.stringify(body); const proof = createHmac('sha256', secret).update(text).digest('hex')
    return { body, query: `select public.widget_commit('${text.replaceAll("'", "''")}','${proof}')` }
  }
  check('nur native Sitzung, kein Tabellenzugriff und keine gefälschten Pläne', () => {
    assert.equal(sql("select has_table_privilege('authenticated','private.widget_commands','SELECT')"), 'f')
    assert.equal(sql("select has_function_privilege('anon','public.widget_commit(text,text)','EXECUTE')"), 'f')
    assert.throws(() => sql(native(`select public.widget_commit('{}','${'0'.repeat(64)}')`)), /Bestätigung/)
    assert.throws(() => sql(`begin;set local role authenticated;set local request.jwt.claim.sub='${actor}';set local request.jwt.claims='{"sub":"${actor}","client_id":"${randomUUID()}"}';select public.widget_replay('${randomUUID()}','{}');commit;`), /Kontoseite/)
    assert.throws(() => sql(native(command([], { user_id: other }).query)), /Widget-Auftrag/)
  })
  check('veraltete zweite Zeile setzt den gesamten Abschluss zurück', () => {
    const before = current(taskId); const successor = { ...task, id: randomUUID(), title: 'Nachfolger' }
    const result = sql(native(command([{ table: 'tasks', row: successor, expected: null }, { table: 'tasks', row: { ...before, completed: true, completed_at: at }, expected: null }]).query))
    assert.equal(result, 'conflict'); assert.equal(sql(`select count(*) from public.tasks where id='${successor.id}'`), '0'); assert.deepEqual(current(taskId), before)
  })
  const before = current(taskId); const cmd = command([{ table: 'tasks', row: { ...before, completed: true, completed_at: at }, expected: before }])
  const results = await Promise.all([asyncSql(native(cmd.query)), asyncSql(native(cmd.query))])
  assert.deepEqual(results, ['committed', 'committed']); checks++; console.log('✓ Widget gleichzeitige Retries werden genau einmal bestätigt')
  check('spätere Wiederöffnung wird von einem alten Auftrag nicht überschrieben', () => {
    const completed = current(taskId)
    sql(native(`select public.sync_push(${json([{ table: 'tasks', row: { ...completed, completed: false, completed_at: null }, expected: completed }])})`))
    assert.equal(sql(native(cmd.query)), 'committed'); assert.equal(current(taskId).completed, false)
    assert.throws(() => sql(native(`select public.widget_replay('${cmd.body.command.id}','{}')`)), /wiederverwendet/)
    assert.equal(sql(native(`select public.widget_replay('${cmd.body.command.id}',${json(cmd.body.command)})`, other)), 'f')
    assert.equal(sql(`select count(*) from private.widget_commands where user_id='${actor}' and input_digest like '%Private%'`), '0')
  })
  check('erneutes Einspielen erhält Aufträge und entzieht keine Zugriffsgrenzen', () => {
    sql(readFileSync(new URL('../supabase/migrations/0029_android_widgets.sql', import.meta.url), 'utf8'))
    assert.equal(sql(`select count(*) from private.widget_commands where user_id='${actor}'`), '1')
    assert.equal(sql("select has_function_privilege('anon','public.widget_commit(text,text)','EXECUTE')"), 'f')
  })
  return checks
}
