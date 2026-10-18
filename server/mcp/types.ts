import type { RemoteList, RemoteTask, RemoteListMember, RemoteListPreference, RemoteUserPreference, RemoteTable } from '../../src/domain/types'

export interface McpConfig { supabaseUrl: string; publishableKey: string; resourceUrl: string; version: string }
export interface Connection {
  user_id: string; client_id: string; resource: string; can_write: boolean; can_share: boolean
  time_zone: string; now: string; username: string | null
}
export interface Versioned<T> { row: T; revision: string }
export interface Snapshot {
  lists: Versioned<RemoteList>[]; tasks: Versioned<RemoteTask>[]; members: Versioned<RemoteListMember>[]
  preferences: Versioned<RemoteListPreference>[]; userPreferences: Versioned<RemoteUserPreference>[]
  profiles: { id: string; username: string | null }[]
}
export type Table = 'lists' | 'tasks' | 'members' | 'preferences' | 'userPreferences'
export type CloudRow = RemoteList | RemoteTask | RemoteListMember | RemoteListPreference | RemoteUserPreference
export interface Change { table: Table; row: CloudRow; expected: CloudRow | null }
export interface AuditChange { table: Table; before: CloudRow | null; after: CloudRow }
export interface CommandResult {
  kind: 'committed' | 'conflict' | 'scope_conflict' | 'rejected'
  request_id?: string; action?: string; changes?: AuditChange[]; effects?: unknown; saved_at?: string
  detail?: unknown; code?: string; message?: string
}
export interface Guard { list_id: string; row: RemoteList; positions: unknown[] }
export interface Plan { changes: Change[]; guards: Guard[]; effects?: unknown }
export interface CommandRecord { request_id: string; action: string; input: unknown; result: CommandResult; changes: AuditChange[]; created_at: string }
export interface SnapshotFilter {
  include_tasks?: boolean; list_ids?: string[]; task_ids?: string[]; state?: 'open' | 'completed' | 'deleted' | 'all'
  tags?: string[]; text?: string; due_before?: string; due_after?: string; available_now?: boolean; limit?: number; after?: string
}
export interface CloudPort {
  context(): Promise<Connection>
  snapshot(filter?: SnapshotFilter): Promise<Snapshot>
  replay(requestId: string, input: unknown): Promise<CommandResult | null>
  commit(requestId: string, action: string, input: unknown, plan: Plan): Promise<CommandResult>
  history(id?: string, limit?: number): Promise<CommandRecord | null | { request_id: string; action: string; created_at: string; changed_rows: number }[]>
  resolveUser(username: string): Promise<{ id: string; username: string } | null>
}
export const remoteTable: Record<Table, RemoteTable> = { lists: 'lists', tasks: 'tasks', members: 'list_members', preferences: 'list_preferences', userPreferences: 'user_preferences' }

export class CommandError extends Error {
  readonly code: string
  readonly detail?: unknown
  constructor(code: string, message: string, detail?: unknown) { super(message); this.name = 'CommandError'; this.code = code; this.detail = detail }
}
