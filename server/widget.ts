import { createClient } from '@supabase/supabase-js'
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import { z } from 'zod'
import { canonicalCloudRow, mergeCloudRow } from '../src/domain/cloudMerge'
import { sameData } from '../src/domain/equality'
import { setChecklistCompleted } from '../src/domain/checklist'
import { fromRemoteList, fromRemoteTask, toRemoteTask } from '../src/domain/mapping'
import { planTaskCompletion } from '../src/domain/taskCompletion'
import type { RemoteList, RemoteTask } from '../src/domain/types'
import { projectWidget, WIDGET_PROTOCOL, type WidgetCommand, type WidgetRows } from '../src/widgets/model'
import { signRequest } from './mcp/cloud'
import { calendarStep } from './mcp/calendar'
import type { McpConfig } from './mcp/types'

interface Scope { list: RemoteList | null; tasks: RemoteTask[] }
interface WidgetPlan { changes: { table: 'tasks' | 'lists'; row: RemoteTask | RemoteList; expected: RemoteTask | RemoteList | null }[]; guards: { list_id: string; row: RemoteList; positions: unknown[] }[] }
export interface WidgetPort {
  rows(): Promise<WidgetRows>
  scope(taskId: string, listId?: string): Promise<Scope>
  replay(command: WidgetCommand): Promise<boolean>
  commit(command: WidgetCommand, plan: WidgetPlan): Promise<'committed' | 'conflict'>
}
export class WidgetConflict extends Error {}

/** PostgREST begrenzt jede Antwort; ein großes limit allein lädt nicht alle Zeilen. */
export async function readWidgetPages<T>(page: (offset: number) => PromiseLike<{ data: T[] | null; error: unknown }>, maximum: number): Promise<T[]> {
  const rows: T[] = []
  for (;;) {
    const result = await page(rows.length)
    if (result.error || !result.data) throw new Error('Widget database request failed')
    rows.push(...result.data)
    if (rows.length > maximum) throw new Error('Widget scope too large')
    if (result.data.length < 1000) return rows
  }
}

class WidgetRequestTooLarge extends Error {}
async function readWidgetRequest(request: Request): Promise<string> {
  const reader = request.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []; let size = 0
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break
      size += chunk.value.length
      if (size > 2 * 1024 * 1024) { await reader.cancel(); throw new WidgetRequestTooLarge() }
      chunks.push(chunk.value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return new TextDecoder().decode(bytes)
}

/** Enger Fachbefehl statt Schreibkopie einer alten Widget-Zeile. */
export async function completeFromWidget(port: WidgetPort, command: WidgetCommand, timeZone: string) {
  if (await port.replay(command)) return
  for (let attempt = 0; attempt < 3; attempt++) {
    const scope = await port.scope(command.taskId, command.local?.task.list_id)
    const current = scope.tasks.find(task => task.id === command.taskId) ?? null
    let task = current
    let list = scope.list
    if (command.local) {
      if (command.local.task.id !== command.taskId || command.local.list.id !== command.local.task.list_id) throw new WidgetConflict('Ungültige lokale Zuordnung.')
      const mergedTask = mergeCloudRow('tasks', command.local.base, command.local.task, current)
      const mergedList = mergeCloudRow('lists', command.local.listBase, command.local.list, list)
      if (mergedTask.fields.length || mergedList.fields.length) throw new WidgetConflict('Diese Aufgabe wurde gleichzeitig geändert. Bitte in Prio abgleichen.')
      task = mergedTask.dirty ? mergedTask.row as RemoteTask : current
      list = mergedList.dirty ? mergedList.row as RemoteList : scope.list
      if (task && current) task = { ...task, created_at: current.created_at }
      if (list && scope.list) list = { ...list, created_at: scope.list.created_at }
    }
    // Löschen und Rechteentzug werden niemals durch einen alten Klick rückgängig gemacht.
    if (!task || !list || task.deleted_at || task.expired_at || list.deleted_at) {
      if (!command.local) {
        if (await port.commit(command, { changes: [], guards: [] }) === 'committed') return
        continue
      }
      throw new WidgetConflict('Aufgabe oder Liste ist nicht mehr verfügbar.')
    }
    const peers = scope.tasks.filter(row => row.id !== task!.id).map(fromRemoteTask)
    peers.push(fromRemoteTask(task))
    const source = fromRemoteTask(task)
    const at = new Date(command.at).toISOString()
    const checklist = command.checklist
    const plan = checklist
      ? { changes: [{ ...source, checklist: setChecklistCompleted(source.checklist, checklist.id, checklist.completed), updated_at: at, dirty: 1 as const }] }
      : await planTaskCompletion(source, fromRemoteList(list), peers, true, at, calendarStep(timeZone))
    const changes: WidgetPlan['changes'] = []
    if (!sameData(list, scope.list)) changes.push({ table: 'lists', row: list, expected: scope.list })
    for (const row of plan.changes.length ? plan.changes : [fromRemoteTask(task)]) {
      const expected = scope.tasks.find(value => value.id === row.id) ?? null
      const after = { ...toRemoteTask(row), created_at: expected?.created_at ?? row.created_at }
      if (!expected || !sameData(canonicalCloudRow('tasks', after), canonicalCloudRow('tasks', expected))) changes.push({ table: 'tasks', row: after, expected })
    }
    const guards = scope.list ? [{ list_id: scope.list.id, row: scope.list, positions: scope.tasks.map(row => ({ id: row.id, section_id: row.section_id ?? null, position: row.position, completed: row.completed, deleted_at: row.deleted_at })).sort((a, b) => a.id.localeCompare(b.id)) }] : []
    if (await port.commit(command, { changes, guards }) === 'committed') return
  }
  throw new WidgetConflict('Der Listenbestand hat sich während des Abgleichs geändert.')
}

const commandSchema = z.object({ id: z.uuid(), userId: z.uuid(), taskId: z.uuid(), at: z.iso.datetime(), checklist: z.object({ id: z.string().min(1).max(200), completed: z.boolean() }).optional(), local: z.object({
  task: z.object({ id: z.uuid(), list_id: z.uuid(), title: z.string().min(1).max(2000), created_at: z.string(), updated_at: z.string() }).loose(),
  base: z.object({ id: z.uuid() }).loose().nullable(), list: z.object({ id: z.uuid(), name: z.string(), owner_id: z.uuid() }).loose(), listBase: z.object({ id: z.uuid() }).loose().nullable(),
}).optional() })

export function createWidgetEndpoint(config: McpConfig, secret: string, options: { key?: JWTVerifyGetKey; port?: (token: string, userId: string) => WidgetPort } = {}) {
  const issuer = `${config.supabaseUrl}/auth/v1`
  const keys = options.key ?? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))
  const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } })
  return async (request: Request) => {
    if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405)
    // Nur die native App; fremde Webseiten bekommen weder CORS noch einen Sitzungszugang.
    if (request.headers.has('Origin')) return reply({ error: 'invalid_origin' }, 403)
    const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1]
    if (!token) return reply({ error: 'authentication_required' }, 401)
    let userId: string
    try {
      const { payload } = await jwtVerify(token, keys, { issuer, audience: 'authenticated', algorithms: ['ES256', 'RS256'], requiredClaims: ['sub', 'exp', 'session_id'] })
      if (payload.role !== 'authenticated' || payload.client_id || typeof payload.sub !== 'string') return reply({ error: 'native_session_required' }, 403)
      userId = payload.sub
    } catch { return reply({ error: 'invalid_session' }, 401) }
    try {
      const raw = await readWidgetRequest(request)
      const body = z.object({ protocol: z.literal(WIDGET_PROTOCOL), timeZone: z.string().max(100), commands: z.array(commandSchema).max(100) }).parse(JSON.parse(raw))
      new Intl.DateTimeFormat('de', { timeZone: body.timeZone }).format()
      const port = options.port?.(token, userId) ?? widgetCloud(config, token, userId, secret)
      const acknowledged: string[] = []; const conflicts: string[] = []
      for (const command of body.commands) {
        if (command.userId !== userId) return reply({ error: 'wrong_account' }, 403)
        try { await completeFromWidget(port, command as WidgetCommand, body.timeZone); acknowledged.push(command.id) }
        catch (error) { if (!(error instanceof WidgetConflict)) throw error; conflicts.push(command.id) }
      }
      return reply({ acknowledged, conflicts, snapshot: projectWidget(await port.rows(), userId, Date.now(), body.timeZone) })
    } catch (error) {
      if (error instanceof WidgetRequestTooLarge) return reply({ error: 'request_too_large' }, 413)
      if (error instanceof z.ZodError || error instanceof SyntaxError || error instanceof RangeError) return reply({ error: 'invalid_request' }, 400)
      return reply({ error: 'temporarily_unavailable' }, 503)
    }
  }
}

function widgetCloud(config: McpConfig, token: string, userId: string, secret: string): WidgetPort {
  const client = createClient(config.supabaseUrl, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { headers: { Authorization: `Bearer ${token}` }, fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20_000) }) } })
  const checked = <T,>({ data, error }: { data: T; error: unknown }) => { if (error) throw new Error('Widget database request failed'); return data }
  return {
    async rows() {
      const [lists, tasks, preferences, userPreferences] = await Promise.all([
        readWidgetPages(offset => client.from('lists').select('*').is('deleted_at', null).order('id').range(offset, offset + 999), 1000),
        readWidgetPages(offset => client.from('tasks').select('*').eq('completed', false).is('deleted_at', null).is('expired_at', null).order('id').range(offset, offset + 999), 10000),
        readWidgetPages(offset => client.from('list_preferences').select('*').eq('user_id', userId).order('list_id').range(offset, offset + 999), 1000),
        client.from('user_preferences').select('*').eq('id', userId),
      ])
      return { lists, tasks, preferences, userPreferences: checked(userPreferences)! } as WidgetRows
    },
    async scope(taskId, localListId) {
      const task = checked(await client.from('tasks').select('list_id').eq('id', taskId).maybeSingle())
      const listId = task?.list_id ?? localListId
      if (!listId) return { list: null, tasks: [] }
      const [list, tasks] = await Promise.all([client.from('lists').select('*').eq('id', listId).maybeSingle(),
        readWidgetPages(offset => client.from('tasks').select('*').eq('list_id', listId).order('id').range(offset, offset + 999), 10000)])
      return { list: checked(list) as RemoteList | null, tasks: tasks as RemoteTask[] }
    },
    async replay(command) { return checked(await client.rpc('widget_replay', { p_id: command.id, p_input: command })) === true },
    async commit(command, plan) {
      if (!secret) throw new Error('Widget writer not configured')
      const request = JSON.stringify({ purpose: 'prio-widget-v1', user_id: userId, issued_at: Math.floor(Date.now() / 1000), command, ...plan })
      const result = checked(await client.rpc('widget_commit', { p_request: request, p_proof: await signRequest(request, secret) }))
      if (result !== 'committed' && result !== 'conflict') throw new Error('Widget write rejected')
      return result
    },
  }
}
