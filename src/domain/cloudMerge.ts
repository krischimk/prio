import { sameData } from './equality'
import { fromRemoteList, fromRemoteMember, fromRemoteTask, fromRemotePreference, fromRemoteUserPreference, toRemoteList, toRemoteMember, toRemoteTask, toRemotePreference, toRemoteUserPreference } from './mapping'
import type { RemoteList, RemoteListMember, RemoteListPreference, RemoteTask, RemoteUserPreference } from './types'
import { optionalText } from './validation'

export const CLOUD_TABLES = ['lists', 'members', 'tasks', 'preferences', 'userPreferences'] as const
export type CloudTable = typeof CLOUD_TABLES[number]
export type CloudRow = RemoteList | RemoteListMember | RemoteTask | RemoteListPreference | RemoteUserPreference
export interface CloudConflict {
  table: CloudTable
  id: string
  base?: CloudRow | null
  local: CloudRow
  remote: CloudRow | null
  fields: string[]
}

export function cloudRowId(table: CloudTable, row: CloudRow): string {
  return table === 'members' || table === 'preferences'
    ? `${(row as RemoteListMember).list_id}:${(row as RemoteListMember).user_id}`
    : (row as RemoteList | RemoteTask | RemoteUserPreference).id
}

/** Gleiche Normalisierung für alte Zeilen und verschieden formatierte Zeitpunkte. */
export function canonicalCloudRow(table: CloudTable, row: CloudRow): CloudRow {
  if (table === 'lists') return toRemoteList(fromRemoteList(row as RemoteList))
  if (table === 'members') return toRemoteMember(fromRemoteMember(row as RemoteListMember))
  if (table === 'preferences') return toRemotePreference(fromRemotePreference(row as RemoteListPreference))
  if (table === 'userPreferences') return toRemoteUserPreference(fromRemoteUserPreference(row as RemoteUserPreference))
  const task = toRemoteTask(fromRemoteTask(row as RemoteTask))
  return { ...task, description: optionalText(task.description) }
}

function groups(table: CloudTable, row: CloudRow): string[][] {
  const coupled = table === 'tasks' ? [
    ['due_at', 'recurrence', 'reminders', 'completed', 'completed_at', 'successor_id', 'reopen_context'],
    ['list_id', 'section_id', 'position'],
  ] : []
  const included = new Set(coupled.flat())
  return [...coupled, ...Object.keys(row)
    .filter(field => field !== 'updated_at' && !(table === 'tasks' && ['completed_expires_at', 'expired_at'].includes(field)) && !(table === 'lists' && field === 'completion_retention_started_at') && !included.has(field))
    .map(field => [field])]
}

function values(row: CloudRow, fields: string[]): unknown[] {
  return fields.map(field => (row as unknown as Record<string, unknown>)[field])
}

/**
 * Drei Stände, keine Entscheidung anhand von Geräteuhren. Unabhängige Felder
 * werden zusammengeführt; gekoppelte Änderungen brauchen eine bewusste Wahl.
 * Eine alte Offline-Zeile ohne bekannte Basis wird niemals blind neu basiert.
 */
export function mergeCloudRow(table: CloudTable, base: CloudRow | null | undefined, local: CloudRow, remote: CloudRow | null, preferLocal = false): {
  row: CloudRow
  dirty: boolean
  fields: string[]
} {
  const l = canonicalCloudRow(table, local)
  if (!remote) return { row: l, dirty: true, fields: base && !preferLocal ? ['missing'] : [] }
  const r = canonicalCloudRow(table, remote)
  // Endgültiger Ablauf ist keine wählbare Lösch-/Bearbeitungs-Kollision.
  if (table === 'tasks' && (r as RemoteTask).expired_at) return { row: r, dirty: false, fields: [] }
  let parts = groups(table, l)
  if (!base) {
    const equal = parts.every(fields => sameData(values(l, fields), values(r, fields)))
    return equal ? { row: r, dirty: false, fields: [] }
      : { row: preferLocal ? l : local, dirty: true, fields: preferLocal ? [] : ['unknown-base'] }
  }
  const b = canonicalCloudRow(table, base)
  // Löschen und gleichzeitiges Bearbeiten betrifft den ganzen Datensatz.
  if (l.deleted_at !== b.deleted_at || r.deleted_at !== b.deleted_at) {
    parts = [groups(table, l).flat()]
  }
  const merged = { ...r } as unknown as Record<string, unknown>
  const conflicts: string[] = []
  for (const fields of parts) {
    if (sameData(values(l, fields), values(b, fields))) continue
    if (!preferLocal && !sameData(values(r, fields), values(b, fields)) && !sameData(values(l, fields), values(r, fields))) {
      conflicts.push(...fields)
    }
    for (const field of fields) merged[field] = (l as unknown as Record<string, unknown>)[field]
  }
  const dirty = parts.some(fields => !sameData(fields.map(field => merged[field]), values(r, fields)))
  if (dirty) merged.updated_at = l.updated_at
  return { row: conflicts.length ? local : merged as unknown as CloudRow, dirty, fields: conflicts }
}
