import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'

/** Called only by db-test.mjs after its local disposable-database guard. */
export function testMcp(sql) {
  const actor = randomUUID(), other = randomUUID(), client = randomUUID(), session = randomUUID(), listId = randomUUID(), taskId = randomUUID()
  const secret = 'test-only-command-attestation'; const resource = 'https://prio-krischi.pages.dev/mcp'
  const at = new Date().toISOString(); const authorization = randomUUID()
  sql(`create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions;
    create table auth.oauth_clients(id uuid primary key,client_name text,deleted_at timestamptz);
    create table auth.oauth_authorizations(authorization_id text primary key,client_id uuid,user_id uuid,resource text,redirect_uri text,expires_at timestamptz,status text);
    create table auth.sessions(id uuid primary key,user_id uuid,oauth_client_id uuid,not_after timestamptz);
    create table auth.oauth_consents(id uuid default gen_random_uuid(),user_id uuid,client_id uuid,revoked_at timestamptz);
    insert into auth.users(id,email) values('${actor}','mcp-a@prio.test'),('${other}','mcp-b@prio.test');
    insert into auth.oauth_clients values('${client}','Test agent',null);
    insert into private.mcp_oauth_clients(id,secret_cipher,metadata) values('${client}','encrypted-test-secret','{}');
    insert into auth.oauth_authorizations values('${authorization}','${client}','${actor}','${resource}','http://127.0.0.1/callback',clock_timestamp()+interval '5 minutes','pending');
    insert into auth.sessions values('${session}','${actor}','${client}',null);
    insert into auth.oauth_consents(user_id,client_id) values('${actor}','${client}');
    update private.mcp_settings set command_key='${secret}' where singleton;`)
  const native = query => sql(`begin;set local role authenticated;set local request.jwt.claim.sub='${actor}';set local request.jwt.claims='{"sub":"${actor}"}';${query};commit;`)
  const claims = { sub: actor, client_id: client, session_id: session, iat: Math.floor(Date.now() / 1000) }
  const oauth = (query, path = '/rpc/mcp_context') => sql(`begin;set local role authenticated;set local request.jwt.claim.sub='${actor}';set local request.jwt.claims='${JSON.stringify(claims)}';set local request.method='POST';set local request.path='${path}';select private.mcp_request_guard();${query};commit;`).trim()
  // Eine neue Freigabe liefert im echten OAuth-Ablauf ein neues Token. Der
  // Test bildet dessen Ausstellungszeit ab, unabhängig vom Tempo des Rechners.
  const renewedToken = () => { claims.iat = Number(sql(`select floor(extract(epoch from approved_at)) from private.mcp_connections where user_id='${actor}' and client_id='${client}'`)) }
  const json = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`
  const last = value => value.split('\n').at(-1)
  let checks = 0
  function check(name, fn) { fn(); checks++; console.log(`✓ MCP ${name}`) }
  function command(changes, extra = {}) {
    const body = { user_id: actor, client_id: client, resource, issued_at: Math.floor(Date.now() / 1000), request_id: randomUUID(), action: 'test', input: { intent: randomUUID() }, guards: [], changes, ...extra }
    const text = JSON.stringify(body); const proof = createHmac('sha256', secret).update(text).digest('hex')
    return { body, query: `select public.mcp_commit('${text.replaceAll("'", "''")}','${proof}')` }
  }
  function vault(operation, data) {
    const request = JSON.stringify({ purpose: 'prio-mcp-vault-v1', resource, issued_at: Math.floor(Date.now() / 1000), operation, data })
    const proof = createHmac('sha256', secret).update(request).digest('hex')
    return JSON.parse(sql(`begin;set local role anon;select public.mcp_vault('${request.replaceAll("'", "''")}','${proof}');commit;`) || 'null')
  }
  check('unapproved OAuth, forged callback resource and native-management bypass are rejected', () => {
    assert.throws(() => oauth('select public.mcp_context()'), /nicht freigegeben/)
    sql(`update auth.oauth_authorizations set resource='https://evil.test/mcp' where authorization_id='${authorization}'`)
    assert.throws(() => native(`select public.mcp_manage('authorize',${json({ authorization_id: authorization })})`), /ungültig/)
    sql(`update auth.oauth_authorizations set resource='${resource}' where authorization_id='${authorization}'`)
    native(`select public.mcp_manage('authorize',${json({ authorization_id: authorization, can_write: true, can_share: false, time_zone: 'Europe/Berlin' })})`)
    renewedToken()
    assert.equal(JSON.parse(last(oauth('select public.mcp_context()'))).can_share, false)
    assert.throws(() => oauth("select public.mcp_manage('list')", '/rpc/mcp_manage'), /ausschließlich/)
    assert.throws(() => oauth("select public.sync_push('[]')", '/rpc/sync_push'), /ausschließlich/)
    assert.throws(() => oauth('select count(*) from public.tasks', '/tasks'), /ausschließlich/)
    assert.throws(() => oauth("select public.mcp_manage('list')"), /Kontoseite/)
    assert.equal(native("select count(*) from public.username_available('testname')"), '1')
    assert.equal(sql("begin;set local role anon;select private.mcp_request_guard();select public.username_available('freeusername');commit").trim(), 't')
  })
  const list = { id: listId, owner_id: actor, name: 'Agent list', is_shared: false, icon: null, sections: [], keep_completed: true, ratings_enabled: true, allow_duplicate_titles: false, completion_retention_started_at: at, created_at: at, updated_at: at, deleted_at: null }
  const task = { id: taskId, list_id: listId, title: 'Plan', description: 'Private note', checklist: [], tags: ['Uni', 'A'], rating: null, due_at: null, available_from: null, completed: false, completed_at: null, completed_expires_at: null, expired_at: null, reopen_context: null, recurrence: null, successor_id: null, recurrence_series_id: null, reminders: [], section_id: null, position: 0, created_at: at, updated_at: at, deleted_at: null }
  const current = (table, id) => JSON.parse(sql(`select to_jsonb(t) from public.${table} t where id='${id}'`))
  check('attestation required, atomic create, exact saved response and idempotent replay', () => {
    assert.throws(() => oauth("select public.mcp_commit('{}','" + '0'.repeat(64) + "')"), /Befehlsbestätigung/)
    const c = command([{ table: 'lists', row: list, expected: null }, { table: 'tasks', row: task, expected: null }])
    const result = JSON.parse(last(oauth(c.query, '/rpc/mcp_commit')))
    assert.equal(result.kind, 'committed'); assert.equal(result.changes.length, 2)
    assert.deepEqual(result.changes.find(change => change.table === 'tasks').after, current('tasks', taskId))
    assert.deepEqual(JSON.parse(last(oauth(c.query, '/rpc/mcp_commit'))), result)
    assert.throws(() => oauth(`select public.mcp_replay('${c.body.request_id}','{}')`), /anderen Auftrag/)
  })
  check('stale second row rolls back the whole batch; list guards catch concurrent insertions', () => {
    const before = current('tasks', taskId), beforeList = current('lists', listId)
    const result = JSON.parse(last(oauth(command([{ table: 'tasks', row: { ...before, title: 'Must roll back', updated_at: new Date().toISOString() }, expected: before }, { table: 'lists', row: { ...beforeList, name: 'Conflict' }, expected: null }]).query)))
    assert.equal(result.kind, 'conflict'); assert.equal(current('tasks', taskId).title, 'Plan')
    const guard = { list_id: listId, row: beforeList, positions: [] }
    assert.equal(JSON.parse(last(oauth(command([], { guards: [guard] }).query))).kind, 'scope_conflict')
  })
  check('duplicate title and inaccessible-list writes are rejected without partial effects', () => {
    const before = current('tasks', taskId)
    const result = JSON.parse(last(oauth(command([{ table: 'tasks', row: { ...task, id: randomUUID(), title: ' PLAN ' }, expected: null }, { table: 'tasks', row: { ...before, title: 'Changed' }, expected: before }]).query)))
    assert.notEqual(result.kind, 'committed'); assert.equal(current('tasks', taskId).title, 'Plan')
    sql(`insert into public.lists(id,owner_id,name) values('${other}','${other}','Other account')`)
    assert.notEqual(JSON.parse(last(oauth(command([{ table: 'tasks', row: { ...task, id: randomUUID(), list_id: other }, expected: null }]).query))).kind, 'committed')
  })
  check('snapshot filters enforce tags AND, privacy and ownership', () => {
    const read = filter => JSON.parse(last(oauth(`select public.mcp_snapshot(${json({ include_tasks: true, ...filter })})`)))
    assert.equal(read({ tags: ['Uni', 'A'] }).tasks.length, 1); assert.equal(read({ tags: ['Uni', 'Missing'] }).tasks.length, 0)
    assert.equal(read({ tags: ['uni', 'a'] }).tasks.length, 1)
    sql(`update public.tasks set checklist='[{"id":"${randomUUID()}","text":"Active checklist text","completed":false,"deleted_at":null},{"id":"${randomUUID()}","text":"Removed checklist text","completed":false,"deleted_at":"${at}"}]'::jsonb where id='${taskId}'`)
    assert.equal(read({ text: 'Active checklist text' }).tasks.length, 1)
    assert.equal(read({ text: 'Removed checklist text' }).tasks.length, 0)
    assert.equal(read({ text: 'deleted_at' }).tasks.length, 0)
    assert.equal(read({ text: 'private NOTE' }).tasks.length, 1)
    assert.equal(read({ list_ids: [other] }).lists.length, 0)
    const snapshot = read({}); assert.ok(snapshot.tasks[0].revision); assert.equal(snapshot.profiles.some(profile => 'email' in profile), false)
  })
  check('OAuth vault requires server attestation, rotates refresh once and permits a brief safe retry', () => {
    assert.throws(() => sql("begin;set local role anon;select public.mcp_vault('{}','" + '0'.repeat(64) + "');commit;"), /Tresorbestätigung/)
    assert.throws(() => oauth("select public.mcp_vault('{}','x')", '/rpc/mcp_vault'), /ausschließlich/)
    const base = { access_hash: 'a'.repeat(64), refresh_hash: 'b'.repeat(64), bundle_cipher: 'encrypted-bundle', user_id: actor, client_id: client, session_id: session, expires_at: new Date(Date.now()+3600000).toISOString() }
    assert.equal(vault('token_put',base).stored,true)
    assert.equal(vault('access_get',{hash:base.access_hash}).cipher,'encrypted-bundle')
    const lease=randomUUID()
    assert.equal(vault('refresh_get',{hash:base.refresh_hash,client_id:client,lease}).replay,false)
    assert.equal(vault('refresh_get',{hash:base.refresh_hash,client_id:client,lease:randomUUID()}).busy,true)
    assert.equal(vault('token_put',{...base,access_hash:'c'.repeat(64),refresh_hash:'d'.repeat(64),bundle_cipher:'new-bundle',old_refresh_hash:base.refresh_hash,lease}).stored,true)
    assert.deepEqual(vault('refresh_get',{hash:base.refresh_hash,client_id:client,lease:randomUUID()}),{cipher:'new-bundle',replay:true})
    sql(`update private.mcp_oauth_tokens set used_at=clock_timestamp()-interval '31 seconds' where access_hash='${base.access_hash}'`)
    assert.equal(vault('refresh_get',{hash:base.refresh_hash,client_id:client,lease:randomUUID()}),null)
    assert.equal(sql("select has_table_privilege('anon','private.mcp_oauth_tokens','SELECT')"),'f')
  })
  check('sharing is a separate grant, read-only revokes writes, revocation is immediate', () => {
    assert.throws(() => oauth(command([{ table: 'members', row: { list_id: listId, user_id: other, created_at: at, updated_at: at, deleted_at: null }, expected: null }]).query), /keine Erlaubnis/)
    native(`select public.mcp_manage('permissions',${json({ client_id: client, can_share: true })})`)
    assert.equal(JSON.parse(last(oauth(command([{ table: 'members', row: { list_id: listId, user_id: other, created_at: at, updated_at: at, deleted_at: null }, expected: null }]).query))).kind, 'committed')
    native(`select public.mcp_manage('permissions',${json({ client_id: client, can_write: false })})`)
    assert.throws(() => oauth(command([]).query), /keine Erlaubnis/)
    assert.ok(JSON.parse(last(oauth('select public.mcp_snapshot()'))).lists.length)
    native(`select public.mcp_manage('revoke',${json({ client_id: client })})`)
    assert.throws(() => oauth('select public.mcp_context()'), /widerrufen/)
    native(`select public.mcp_manage('authorize',${json({ authorization_id: authorization })})`)
    renewedToken()
    claims.iat -= 1
    assert.throws(() => oauth('select public.mcp_context()'), /nicht freigegeben/)
    renewedToken()
    sql(`update auth.oauth_consents set revoked_at=clock_timestamp() where user_id='${actor}'`)
    assert.throws(() => oauth('select public.mcp_context()'), /nicht mehr aktiv/)
  })
  check('final task expiry erases note copies from history without losing idempotency', () => {
    sql(`update auth.oauth_consents set revoked_at=null where user_id='${actor}'`)
    native(`select public.mcp_manage('permissions',${json({ client_id: client, can_write: true })})`)
    const before = current('tasks', taskId)
    const c = command([{ table: 'tasks', row: { ...before, description: 'Erased private text' }, expected: before }])
    assert.equal(JSON.parse(last(oauth(c.query))).kind, 'committed')
    sql(`update public.tasks set expired_at=clock_timestamp(),description=null where id='${taskId}'`)
    assert.equal(sql(`select count(*) from private.mcp_commands where input::text like '%Erased private text%' or changes::text like '%Erased private text%' or result::text like '%Erased private text%'`), '0')
    assert.equal(JSON.parse(last(oauth(`select public.mcp_replay('${c.body.request_id}',${json(c.body.input)})`))).history_erased, true)
  })
  return checks
}
