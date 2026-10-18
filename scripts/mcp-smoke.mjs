/** Live OAuth/PKCE and MCP round-trip, solely with the dedicated test account. */
import assert from 'node:assert/strict'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'

const config = { supabaseUrl: process.env.VITE_SUPABASE_URL, publishableKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY, resourceUrl: 'https://prio-krischi.pages.dev/mcp', version: 'smoke' }
if (!config.supabaseUrl || !config.publishableKey || !process.env.PRIO_TEST_A_EMAIL || !process.env.PRIO_TEST_A_PASSWORT) throw new Error('Öffentliche Konfiguration und separates Prio-Testkonto fehlen.')
if (!/supabase\.co$/.test(new URL(config.supabaseUrl).hostname)) throw new Error('Diese Rauchprüfung erwartet das echte Supabase-Projekt.')
let request = fetch
let unwrap
if (process.env.PRIO_MCP_LOCAL_MODULE) {
  const { createMcpEndpoint, createOAuthFacade } = await import(pathToFileURL(process.env.PRIO_MCP_LOCAL_MODULE).href)
  const facade = createOAuthFacade(config, process.env.PRIO_MCP_COMMAND_KEY)
  unwrap = facade.accessToken
  const endpoint = createMcpEndpoint(config, process.env.PRIO_MCP_COMMAND_KEY, { accessToken: facade.accessToken })
  request = async (url, init) => {
    const req = new Request(url, init); const parsed = new URL(req.url)
    if (parsed.origin !== new URL(config.resourceUrl).origin) return fetch(req)
    return parsed.pathname.startsWith('/oauth/') || parsed.pathname === '/.well-known/oauth-authorization-server' ? facade.fetch(req) : endpoint(req)
  }
}
const native = createClient(config.supabaseUrl, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
const login = await native.auth.signInWithPassword({ email: process.env.PRIO_TEST_A_EMAIL, password: process.env.PRIO_TEST_A_PASSWORT })
if (login.error) throw new Error(`Testkonto-Anmeldung fehlgeschlagen: ${login.error.message}`)
const base = new URL(config.resourceUrl).origin
const callback = 'http://127.0.0.1:8999/prio-smoke-callback'
const registeredResponse = await request(`${base}/oauth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: 'Prio MCP Rauchprüfung', redirect_uris: [callback], token_endpoint_auth_method: 'none' }) })
assert.equal(registeredResponse.status, 201, `Registrierung fehlgeschlagen (${registeredResponse.status})`)
const registered = await registeredResponse.json(); assert.ok(registered.client_id); assert.equal(registered.client_secret, undefined)
const clientId = registered.client_id
const verifier = randomBytes(48).toString('base64url'), state = randomUUID()
const authorization = new URL(`${base}/oauth/authorize`)
authorization.search = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: callback, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', state, scope: 'profile offline_access', resource: config.resourceUrl }).toString()
let client; const createdLists = []
try {
  const intermediary = await request(authorization, { redirect: 'manual' }); assert.equal(intermediary.status, 302)
  const provider = await fetch(intermediary.headers.get('Location'), { redirect: 'manual', headers: { apikey: config.publishableKey } }); assert.equal(provider.status, 302)
  const consentUrl = new URL(provider.headers.get('Location')); const authorizationId = consentUrl.searchParams.get('authorization_id'); assert.ok(authorizationId)
  const details = await native.auth.oauth.getAuthorizationDetails(authorizationId)
  if (details.error) throw new Error(`Freigabe-Anfrage: ${details.error.message}`)
  assert.equal(details.data.client.id, clientId)
  const grant = await native.rpc('mcp_manage', { p_action: 'authorize', p_data: { authorization_id: authorizationId, can_write: true, can_share: false, time_zone: 'Europe/Berlin' } })
  if (grant.error) throw new Error(`Prio-Freigabe: ${grant.error.message}`)
  const approval = await native.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
  if (approval.error) throw new Error(`OAuth-Freigabe: ${approval.error.message}`)
  const redirect = new URL(approval.data.redirect_url); assert.equal(redirect.origin, new URL(callback).origin); assert.equal(redirect.searchParams.get('state'), state)
  const exchange = async params => {
    const response = await request(`${base}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, resource: config.resourceUrl, ...params }).toString() })
    assert.equal(response.status, 200, `Tokenaustausch fehlgeschlagen (${response.status}): ${await response.clone().text()}`)
    const data = await response.json(); assert.match(data.access_token, /^prio_access_/); assert.match(data.refresh_token, /^prio_refresh_/); assert.equal(data.id_token, undefined); return data
  }
  let tokens = await exchange({ grant_type: 'authorization_code', code: redirect.searchParams.get('code'), code_verifier: verifier, redirect_uri: callback })
  if (unwrap) {
    const upstream = await unwrap(tokens.access_token)
    const bypass = await fetch(`${config.supabaseUrl}/rest/v1/rpc/sync_push`, { method: 'POST', headers: { apikey: config.publishableKey, Authorization: `Bearer ${upstream}`, 'Content-Type': 'application/json' }, body: '{"p_changes":[]}' })
    assert.equal(bypass.status,403,'Der native Schreibweg darf die OAuth-Freigabe nicht umgehen.')
  }
  const direct = await fetch(`${config.supabaseUrl}/auth/v1/user`, { method: 'PUT', headers: { apikey: config.publishableKey, Authorization: `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json' }, body: '{}' })
  assert.notEqual(direct.status, 200, 'Ein Prio-Token darf keine native Kontositzung sein.')
  client = new Client({ name: 'Prio smoke', version: '1' })
  await client.connect(new StreamableHTTPClientTransport(new URL(config.resourceUrl), { fetch: request, authProvider: { token: async () => tokens.access_token } }))
  const call = async (name, args = {}, failure = false) => {
    const result = await client.callTool({ name, arguments: args }); const output = result.structuredContent
    assert.equal(output?.ok, !failure, `MCP ${name}: ${output?.error?.message ?? 'unerwartete Antwort'}`)
    return failure ? output.error : output.data
  }
  assert.equal((await client.listTools()).tools.length, 16)
  const workspace = await call('get_workspace'); assert.equal(workspace.account.can_share, false)
  const listRequestId = randomUUID()
  const list = await call('manage_lists', { request_id: listRequestId, operation: { op: 'create', settings: { name: `MCP-Rauchprüfung ${Date.now()}`, keep_completed: true, allow_duplicate_titles: false }, include_in_overview: true } })
  const listId = list.changes.find(change => change.table === 'lists').after.id; createdLists.push(listId)
  const createArgs = { request_id: randomUUID(), list_id: listId, tasks: [{ title: 'Täglich prüfen', note: '**Notiz**\n\nMit Absatz.', due_at: new Date(Date.now()+86400000).toISOString(), recurrence: 'daily', checklist: [{ text: 'Erster Schritt' }, { text: 'Zweiter Schritt' }], tags: ['PrioSmoke'], rating: { importance: 8, urgency: 5, effort: 5, urgencyMode: 'auto', effortFromChecklist: true } }] }
  const made = await call('create_tasks', createArgs); assert.deepEqual(await call('create_tasks',createArgs),made)
  const taskId = made.changes.find(change => change.table === 'tasks').after.id
  assert.equal((await call('undo_change', { request_id: randomUUID(), change_request_id: listRequestId }, true)).code, 'conflict')
  assert.equal((await call('search_tasks', { list_ids: [listId], tags: ['priosmoke'] })).total, 1)
  assert.equal((await call('search_tasks', { list_ids: [listId], text: 'deleted_at' })).total, 0)
  let task = (await call('get_tasks', { ids: [taskId] })).tasks[0]
  const stale = { id: task.id, revision: task.revision }
  await call('edit_checklist', { request_id: randomUUID(), task: stale, operations: [{ op: 'update', id: task.checklist[0].id, completed: true }] })
  assert.equal((await call('update_tasks', { request_id: randomUUID(), updates: [{ task: stale, set: { title: 'Veralteter Titel' } }] }, true)).code, 'conflict')
  task = (await call('get_tasks', { ids: [taskId] })).tasks[0]; assert.equal(task.completed,false); assert.equal(task.checklist_progress.completed,1)
  const completedId = randomUUID()
  await call('complete_tasks', { request_id: completedId, tasks: [{ id: task.id, revision: task.revision }], completed: true })
  const successor = await call('search_tasks', { list_ids: [listId], state: 'open' }); assert.equal(successor.total,1); assert.equal(successor.tasks[0].available,false); assert.equal(successor.tasks[0].checklist_progress.completed,0)
  assert.equal((await call('search_tasks', { list_ids: [listId], available_now: true })).total,0)
  await call('undo_change', { request_id: randomUUID(), change_request_id: completedId })
  assert.equal((await call('get_tasks', { ids: [taskId] })).tasks[0].completed,false)
  const current = (await call('get_workspace')).lists.find(row => row.id === listId)
  assert.equal((await call('manage_sharing', { request_id: randomUUID(), list: { id:listId,revision:current.revision }, op:'add',username:'nobody' }, true)).code,'permission_denied')
  tokens = await exchange({ grant_type:'refresh_token',refresh_token:tokens.refresh_token })
  assert.equal((await call('get_workspace')).account.client_id,clientId)
  console.log('MCP live: PKCE, begrenzte Tokens, echter Client, Fachregeln, atomare Änderungen, Konflikte, Rückgängig und Tokenrotation bestanden.')
} finally {
  if (client) {
    for (const listId of createdLists) {
      try {
        const result = await client.callTool({ name:'get_workspace',arguments:{} }); const row=result.structuredContent?.data?.lists.find(row=>row.id===listId)
        if(row && !row.deleted_at) await client.callTool({name:'manage_lists',arguments:{request_id:randomUUID(),operation:{op:'delete',list:{id:listId,revision:row.revision}}}})
      } catch { console.error('Hinweis: Testliste konnte nicht automatisch in den Papierkorb verschoben werden.') }
    }
    await client.close()
  }
  await native.rpc('mcp_manage',{p_action:'revoke',p_data:{client_id:clientId}})
  await native.auth.oauth.revokeGrant({clientId})
  await native.auth.signOut()
}
