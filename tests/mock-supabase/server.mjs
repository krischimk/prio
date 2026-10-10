/**
 * Mock von Supabase für die E2E-Tests.
 *
 * Warum ein eigener Server?
 *   Die E2E-Tests sollen den echten Client-Code prüfen – also `@supabase/supabase-js`
 *   gegen echte HTTP-Endpunkte. Deshalb wird hier ein kleiner Server gestartet,
 *   der die benötigten Teile von GoTrue (Auth) und PostgREST (Datenbank)
 *   nachbildet: Registrierung, Anmeldung, Sitzung, Tabellen-Upserts, Reads und
 *   die RPC `share_list_by_email`.
 *
 *   Zusätzlich werden die Sichtbarkeitsregeln der RLS-Policies nachgebildet,
 *   damit Mehrbenutzer-Tests aussagekräftig sind.
 *
 * Kein Produktivcode, keine Secrets, keine Abhängigkeiten – nur `node:http`.
 *
 * Start: node tests/mock-supabase/server.mjs [port]
 */
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'

const PORT = Number(process.argv[2] ?? process.env.MOCK_SUPABASE_PORT ?? 54321)

/** @type {{users: Map<string, any>, sessions: Map<string, string>, refreshTokens: Map<string, string>, lists: Map<string, any>, members: Map<string, any>, tasks: Map<string, any>, preferences: Map<string, any>, userPreferences: Map<string, any>}} */
let state = emptyState()

function emptyState() {
  return {
    users: new Map(),
    sessions: new Map(), // access_token -> user_id
    refreshTokens: new Map(), // refresh_token -> user_id
    lists: new Map(),
    members: new Map(), // `${list_id}:${user_id}` -> row
    tasks: new Map(),
    preferences: new Map(),
    userPreferences: new Map(),
  }
}

const memberKey = (listId, userId) => `${listId}:${userId}`

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]))
  return value
}


function canAccessList(userId, list) {
  if (!list) return false
  if (list.owner_id === userId) return true
  if (list.deleted_at !== null) return false
  const membership = state.members.get(memberKey(list.id, userId))
  return Boolean(membership) && membership.deleted_at === null
}

function expireCompleted() {
  const now = new Date().toISOString()
  for (const [id, task] of state.tasks) {
    if (task.completed && !task.expired_at && task.completed_expires_at && Date.parse(task.completed_expires_at) <= Date.now()) {
      state.tasks.set(id, { ...task, expired_at: now, deleted_at: now, updated_at: now, title: 'Abgelaufene Aufgabe', description: null, due_at: null, reminders: [], recurrence: null, successor_id: null, section_id: null, reopen_context: null })
    }
  }
}

function publicUser(user) {
  return {
    id: user.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: user.email,
    email_confirmed_at: user.created_at,
    phone: '',
    confirmed_at: user.created_at,
    last_sign_in_at: user.created_at,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    created_at: user.created_at,
    updated_at: user.created_at,
  }
}

function createSession(user) {
  const accessToken = `access-${randomUUID()}`
  const refreshToken = `refresh-${randomUUID()}`
  state.sessions.set(accessToken, user.id)
  state.refreshTokens.set(refreshToken, user.id)
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_in_ms: 3_600_000,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: refreshToken,
    user: publicUser(user),
  }
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => {
      if (chunks.length === 0) return resolve(undefined)
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

function send(response, status, payload, extraHeaders = {}) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Expose-Headers': 'content-range, content-profile',
    ...extraHeaders,
  }
  if (payload === undefined) {
    response.writeHead(status, headers)
    response.end()
    return
  }
  const body = JSON.stringify(payload)
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  })
  response.end(body)
}

/** PostgREST-Fehlerformat – supabase-js wertet `message` und `code` aus. */
function sendPostgrestError(response, status, message, code = 'P0001') {
  send(response, status, { message, code, details: null, hint: null })
}

function authenticatedUser(request) {
  const header = request.headers.authorization ?? ''
  const token = header.replace(/^Bearer\s+/i, '')
  const userId = state.sessions.get(token)
  return userId ? state.users.get(userId) : undefined
}

const server = createServer((request, response) => {
  void handle(request, response).catch((error) => {
    sendPostgrestError(response, 500, `Mock-Server-Fehler: ${String(error)}`, 'XX000')
  })
})

async function handle(request, response) {
  const url = new URL(request.url, `http://127.0.0.1:${PORT}`)
  const path = url.pathname

  if (request.method === 'OPTIONS') {
    send(response, 204)
    return
  }

  // --- Steuerendpunkte für die Tests ---------------------------------------
  if (path === '/__test__/reset') {
    state = emptyState()
    send(response, 200, { ok: true })
    return
  }
  if (path === '/__test__/state') {
    send(response, 200, {
      users: state.users.size,
      lists: [...state.lists.values()],
      members: [...state.members.values()],
      tasks: [...state.tasks.values()],
      preferences: [...state.preferences.values()],
      userPreferences: [...state.userPreferences.values()],
    })
    return
  }
  if (path === '/__test__/health') {
    send(response, 200, { ok: true })
    return
  }

  // --- Auth (GoTrue) --------------------------------------------------------
  if (path === '/auth/v1/signup' && request.method === 'POST') {
    const body = await readBody(request)
    const email = String(body?.email ?? '').trim().toLowerCase()
    const password = String(body?.password ?? '')
    if (!email || !password) {
      send(response, 400, { message: 'E-Mail und Passwort erforderlich.', error_description: 'invalid_request' })
      return
    }
    if ([...state.users.values()].some((user) => user.email === email)) {
      send(response, 422, {
        message: 'User already registered',
        msg: 'User already registered',
        code: 'user_already_exists',
      })
      return
    }
    const user = { id: randomUUID(), email, password, created_at: new Date().toISOString() }
    state.users.set(user.id, user)
    send(response, 200, createSession(user))
    return
  }

  if (path === '/auth/v1/token' && request.method === 'POST') {
    const body = await readBody(request)
    const grantType = url.searchParams.get('grant_type')

    if (grantType === 'password') {
      const email = String(body?.email ?? '').trim().toLowerCase()
      const user = [...state.users.values()].find((candidate) => candidate.email === email)
      if (!user || user.password !== String(body?.password ?? '')) {
        send(response, 400, {
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
          message: 'Invalid login credentials',
        })
        return
      }
      send(response, 200, createSession(user))
      return
    }

    if (grantType === 'refresh_token') {
      const userId = state.refreshTokens.get(String(body?.refresh_token ?? ''))
      const user = userId ? state.users.get(userId) : undefined
      if (!user) {
        send(response, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' })
        return
      }
      send(response, 200, createSession(user))
      return
    }

    send(response, 400, { error: 'unsupported_grant_type', error_description: 'grant_type fehlt' })
    return
  }

  if (path === '/auth/v1/user' && request.method === 'GET') {
    const user = authenticatedUser(request)
    if (!user) {
      send(response, 401, { message: 'invalid claim: missing sub claim', error_description: 'invalid_token' })
      return
    }
    send(response, 200, publicUser(user))
    return
  }

  if (path === '/auth/v1/logout' && request.method === 'POST') {
    const header = request.headers.authorization ?? ''
    state.sessions.delete(header.replace(/^Bearer\s+/i, ''))
    send(response, 204)
    return
  }

  // --- PostgREST ------------------------------------------------------------
  if (path.startsWith('/rest/v1/rpc/')) {
    await handleRpc(path.replace('/rest/v1/rpc/', ''), request, response)
    return
  }

  const tableMatch = /^\/rest\/v1\/([a-z_]+)$/.exec(path)
  if (tableMatch) {
    await handleTable(tableMatch[1], request, response, url)
    return
  }

  send(response, 404, { message: `Unbekannter Endpunkt: ${path}`, code: 'PGRST404' })
}

async function handleTable(table, request, response, url) {
  const user = authenticatedUser(request)
  if (!user) {
    sendPostgrestError(response, 401, 'JWT expired', 'PGRST301')
    return
  }

  if (request.method === 'GET') {
    expireCompleted()
    const rows =
      table === 'lists'
        ? [...state.lists.values()].filter((list) => canAccessList(user.id, list))
        : table === 'list_members'
          ? [...state.members.values()].filter(
              (member) =>
                member.user_id === user.id || state.lists.get(member.list_id)?.owner_id === user.id,
            )
          : table === 'list_preferences'
            ? [...state.preferences.values()].filter(pref => pref.user_id === user.id)
          : table === 'user_preferences'
            ? [...state.userPreferences.values()].filter(pref => pref.id === user.id)
          : [...state.tasks.values()].filter((task) =>
              canAccessList(user.id, state.lists.get(task.list_id)),
            )
    const composite = table === 'list_members' || table === 'list_preferences'
    const ordered = rows.sort((a,b) => (composite ? memberKey(a.list_id,a.user_id) : a.id).localeCompare(composite ? memberKey(b.list_id,b.user_id) : b.id))
    const start=Number(url.searchParams.get('offset') ?? 0)
    const limit=Number(url.searchParams.get('limit') ?? rows.length)
    const page=ordered.slice(start,start+limit)
    send(response, 200, page, { 'Content-Range': `${start}-${Math.max(start+page.length-1,start)}/${rows.length}` })
    return
  }

  if (request.method === 'POST') {
    sendPostgrestError(response,403,'Diese App-Version benötigt den geschützten Schreibweg.','42501')
    return
  }

  sendPostgrestError(response, 405, `Methode ${request.method} wird nicht unterstützt.`)
}

async function handleRpc(name, request, response) {
  const user = authenticatedUser(request)
  if (!user) {
    sendPostgrestError(response, 401, 'JWT expired', 'PGRST301')
    return
  }

  if (name === 'sync_push') {
    const body = await readBody(request)
    const result=[]
    for (const change of body?.p_changes ?? []) {
      const {table,row,expected}=change
      const id=table === 'members' || table === 'preferences' ? memberKey(row.list_id,row.user_id) : row.id
      const store=state[table]
      expireCompleted()
      const current=store?.get(id)
      const rejected=(message,code='42501')=>result.push({table,id,kind:'rejected',message,code})
      if (!store) { rejected('Ungültige Tabelle.','22023'); continue }
      if (table === 'lists' && (row.owner_id !== user.id || (current && current.owner_id !== user.id))) { rejected('Nur der Besitzer darf die Liste ändern.'); continue }
      if (table === 'members') {
        const ownLeave=current && row.user_id === user.id && row.deleted_at !== null && row.created_at === current.created_at
        if (state.lists.get(row.list_id)?.owner_id !== user.id && !ownLeave) { rejected('Diese Mitgliedschaft darfst du nicht ändern.'); continue }
      }
      if (table === 'tasks' && (!canAccessList(user.id,state.lists.get(row.list_id)) || (current && !canAccessList(user.id,state.lists.get(current.list_id))))) { rejected('Kein Zugriff auf die Aufgabe.'); continue }
      if (table === 'preferences' && (row.user_id !== user.id || !canAccessList(user.id,state.lists.get(row.list_id)))) { rejected('Nur deine eigene Listenauswahl darf geändert werden.'); continue }
      if (table === 'userPreferences' && (row.id !== user.id || !['by_list','newest'].includes(row.overview_mode))) { rejected('Ungültige persönliche Einstellung.'); continue }
      if (table === 'userPreferences' && row.default_list_id && row.default_list_id !== current?.default_list_id && !canAccessList(user.id,state.lists.get(row.default_list_id))) { rejected('Kein Zugriff auf die Standardliste.'); continue }
      if ((table==='tasks' && !row.title?.trim()) || (table==='lists' && !row.name?.trim())) { rejected('Name darf nicht leer sein.','23514'); continue }
      if (current && row.created_at !== current.created_at) { rejected('Der Erstellzeitpunkt ist unveränderlich.','22023'); continue }
      if (table === 'tasks' && current?.expired_at && JSON.stringify(canonical(current)) !== JSON.stringify(canonical(row))) {
        result.push({table,id,kind:'conflict',current}); continue
      }
      if (JSON.stringify(canonical(current ?? null)) !== JSON.stringify(canonical(row)) && JSON.stringify(canonical(current ?? null)) !== JSON.stringify(canonical(expected ?? null))) {
        result.push({table,id,kind:'conflict',current:current ?? null}); continue
      }
      let saved=row
      const now=new Date().toISOString()
      if (table === 'lists') {
        saved={...row,completion_retention_started_at:!current ? new Date(Math.min(Date.parse(row.completion_retention_started_at ?? now),Date.now())).toISOString() : current.keep_completed && !row.keep_completed ? now : current.completion_retention_started_at ?? null}
      } else if (table === 'tasks') {
        if (current?.completed && row.completed && current.completed_at !== row.completed_at) { rejected('Der Abschlusszeitpunkt bleibt erhalten.','22023'); continue }
        if ((row.expired_at ?? null) !== (current?.expired_at ?? null)) { rejected('Der Ablauf gehört dem Server.','22023'); continue }
        const keep=state.lists.get(row.list_id)?.keep_completed === true
        const expires=from=>keep ? null : new Date(Date.parse(from)+7*24*60*60*1000).toISOString()
        saved={...row,completed_expires_at:!row.completed ? null : current?.completed && current.list_id !== row.list_id ? expires(now) : current?.completed && current.completed_at === row.completed_at ? current.completed_expires_at ?? null : expires(new Date(Math.max(Math.min(Date.parse(row.completed_at),Date.now()),Date.parse(state.lists.get(row.list_id)?.completion_retention_started_at ?? row.completed_at))).toISOString())}
      }
      store.set(id,saved)
      if (table === 'lists' && current && current.keep_completed !== row.keep_completed) {
        for (const [taskId,task] of state.tasks) if (task.list_id === id && task.completed && !task.expired_at) {
          state.tasks.set(taskId,{...task,completed_expires_at:row.keep_completed ? null : new Date(Date.now()+7*24*60*60*1000).toISOString(),updated_at:now})
        }
      }
      expireCompleted()
      result.push({table,id,kind:JSON.stringify(canonical(store.get(id))) === JSON.stringify(canonical(row)) ? 'written' : 'conflict',current:store.get(id)})
    }
    send(response,200,result); return
  }

  // Adressen der Personen, mit denen der Aufrufer eine Liste teilt. Dieselbe
  // Sicht wie die Serverfunktion in `0012_co_member_contacts.sql`.
  if (name === 'co_member_contacts') {
    // Beteiligt ist, wer die Liste besitzt **oder** aktives Mitglied ist – der
    // Besitzer hat keine eigene Mitgliedszeile.
    const meineListen = [...state.lists.values()].filter(
      (liste) =>
        !liste.deleted_at &&
        (liste.owner_id === user.id ||
          [...state.members.values()].some(
            (m) => m.list_id === liste.id && m.user_id === user.id && !m.deleted_at,
          )),
    )

    const kontakte = new Map()
    for (const liste of meineListen) {
      const beteiligte = [liste.owner_id]
      for (const m of state.members.values()) {
        if (m.list_id === liste.id && !m.deleted_at) beteiligte.push(m.user_id)
      }
      for (const userId of beteiligte) {
        if (userId === user.id || kontakte.has(userId)) continue
        const person = [...state.users.values()].find((kandidat) => kandidat.id === userId)
        if (person && person.email) kontakte.set(userId, String(person.email).toLowerCase())
      }
    }

    const zeilen = [...kontakte]
      .map(([userId, email]) => ({ user_id: userId, email }))
      .sort((a, b) => a.email.localeCompare(b.email))
    send(response, 200, zeilen)
    return
  }

  if (name !== 'share_list_by_email') {
    sendPostgrestError(response, 404, `Unbekannte Funktion: ${name}`, 'PGRST202')
    return
  }

  const body = await readBody(request)
  const listId = String(body?.p_list_id ?? '')
  const email = String(body?.p_email ?? '').trim().toLowerCase()

  const list = state.lists.get(listId)
  if (!list || list.owner_id !== user.id) {
    sendPostgrestError(response, 403, 'Nur der Besitzer kann diese Liste teilen.', '42501')
    return
  }

  const target = [...state.users.values()].find((candidate) => candidate.email === email)
  if (!target) {
    sendPostgrestError(
      response,
      400,
      'Es gibt keinen registrierten Nutzer mit dieser E-Mail-Adresse.',
      'P0002',
    )
    return
  }
  if (target.id === user.id) {
    sendPostgrestError(response, 400, 'Du bist bereits Besitzer dieser Liste.', 'P0001')
    return
  }

  const now = new Date().toISOString()
  const key = memberKey(listId, target.id)
  const existing = state.members.get(key)
  state.members.set(key, {
    list_id: listId,
    user_id: target.id,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    deleted_at: null,
  })
  state.lists.set(listId, { ...list, is_shared: true })

  send(response, 200, target.id)
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Mock-Supabase läuft auf http://127.0.0.1:${PORT}`)
})
