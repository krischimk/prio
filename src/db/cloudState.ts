import { canonicalCloudRow, cloudRowId, mergeCloudRow, type CloudConflict, type CloudRow, type CloudTable } from '../domain/cloudMerge'
import { sameData } from '../domain/equality'
import { fromRemoteList, fromRemoteMember, fromRemoteTask, fromRemotePreference, fromRemoteUserPreference, toRemoteList, toRemoteMember, toRemoteTask, toRemotePreference, toRemoteUserPreference } from '../domain/mapping'
import type { RemoteList, RemoteListMember, RemoteListPreference, RemoteTask, RemoteUserPreference } from '../domain/types'
import type { LocalDatabase } from './localDb'
import { readMeta, writeMeta } from './metaStore'

interface CloudState { base?: CloudRow | null; conflict?: CloudConflict }
const PREFIX = 'cloud-row:'
function key(table: CloudTable, id: string) { return `${PREFIX}${table}:${id}` }

function parseState(value: string | null): CloudState {
  if (!value) return {}
  try {
    const state: unknown = JSON.parse(value)
    return state && typeof state === 'object' && !Array.isArray(state) ? state as CloudState : {}
  } catch { return {} }
}

export async function readCloudState(db: LocalDatabase, table: CloudTable, id: string): Promise<CloudState> {
  const value = await readMeta(db, key(table, id))
  return parseState(value)
}
export async function writeCloudState(db: LocalDatabase, table: CloudTable, id: string, state: CloudState) {
  await writeMeta(db, key(table, id), JSON.stringify(state))
}

export async function readCloudConflicts(db: LocalDatabase): Promise<CloudConflict[]> {
  const rows = await db.meta.where('key').startsWith(PREFIX).toArray()
  const conflicts = rows.flatMap(row => {
    const state = parseState(row.value)
    return state.conflict ? [state.conflict] : []
  })
  // Nach Rechteentzug entfernt der Sync die fremde Liste lokal. Der gesicherte
  // Eingabeinhalt bleibt erhalten, ist aber kein im UI lösbarer Konflikt mehr.
  const available = await Promise.all(conflicts.map(async conflict =>
    await readLocalCloudRow(db, conflict.table, conflict.id) ? conflict : null,
  ))
  return available.filter((conflict): conflict is CloudConflict => conflict !== null)
}

export async function readLocalCloudRow(db: LocalDatabase, table: CloudTable, id: string): Promise<{ row: CloudRow; dirty: number } | undefined> {
  if (table === 'lists') {
    const row = await db.lists.get(id)
    return row && { row: toRemoteList(row), dirty: row.dirty }
  }
  if (table === 'tasks') {
    const row = await db.tasks.get(id)
    return row && { row: toRemoteTask(row), dirty: row.dirty }
  }
  if (table === 'userPreferences') {
    const row = await db.user_preferences.get(id)
    return row && { row: toRemoteUserPreference(row), dirty: row.dirty }
  }
  const [listId, userId] = id.split(':')
  if (table === 'preferences') {
    const row = await db.list_preferences.get([listId, userId])
    return row && { row: toRemotePreference(row), dirty: row.dirty }
  }
  const row = await db.list_members.get([listId, userId])
  return row && { row: toRemoteMember(row), dirty: row.dirty }
}

export async function putLocalCloudRow(db: LocalDatabase, table: CloudTable, row: CloudRow, dirty: boolean) {
  if (table === 'lists') await db.lists.put({ ...fromRemoteList(row as RemoteList), dirty: dirty ? 1 : 0 })
  else if (table === 'tasks') await db.tasks.put({ ...fromRemoteTask(row as RemoteTask), dirty: dirty ? 1 : 0 })
  else if (table === 'preferences') await db.list_preferences.put({ ...fromRemotePreference(row as RemoteListPreference), dirty: dirty ? 1 : 0 })
  else if (table === 'userPreferences') await db.user_preferences.put({ ...fromRemoteUserPreference(row as RemoteUserPreference), dirty: dirty ? 1 : 0 })
  else await db.list_members.put({ ...fromRemoteMember(row as RemoteListMember), dirty: dirty ? 1 : 0 })
}

/** Aufrufer hält die Transaktion über Entität und meta. */
export async function acceptCloudRow(db: LocalDatabase, table: CloudTable, remote: CloudRow): Promise<'inserted' | 'remote-wins' | 'local-wins' | 'unchanged'> {
  const id = cloudRowId(table, remote)
  const local = await readLocalCloudRow(db, table, id)
  const state = await readCloudState(db, table, id)
  if (!local || local.dirty === 0) {
    const changed = !local || !sameData(canonicalCloudRow(table, local.row), canonicalCloudRow(table, remote))
    if (changed) await putLocalCloudRow(db, table, remote, false)
    await writeCloudState(db, table, id, { base: remote })
    return !local ? 'inserted' : changed ? 'remote-wins' : 'unchanged'
  }
  const merged = mergeCloudRow(table, state.base, local.row, remote)
  if (merged.fields.length) {
    await writeCloudState(db, table, id, { ...state, conflict: { table, id, base: state.base, local: local.row, remote, fields: merged.fields } })
    return 'local-wins'
  }
  await putLocalCloudRow(db, table, merged.row, merged.dirty)
  await writeCloudState(db, table, id, { base: remote })
  return merged.dirty ? 'local-wins' : 'remote-wins'
}

export async function resolveCloudConflict(db: LocalDatabase, conflict: CloudConflict, choice: 'local' | 'remote', at: string): Promise<void> {
  await db.transaction('rw', [db.lists, db.tasks, db.list_members, db.list_preferences, db.user_preferences, db.meta], async () => {
    const state = await readCloudState(db, conflict.table, conflict.id)
    const local = await readLocalCloudRow(db, conflict.table, conflict.id)
    if (!sameData(state.conflict, conflict) || !local || !sameData(local.row, conflict.local)) {
      throw new Error('Der Stand hat sich erneut geändert. Öffne die Konfliktübersicht noch einmal.')
    }
    if (choice === 'remote') {
      const row = conflict.remote ?? { ...local.row, deleted_at: at, updated_at: at }
      await putLocalCloudRow(db, conflict.table, row, false)
    } else {
      const merged = mergeCloudRow(conflict.table, conflict.base, local.row, conflict.remote, true)
      await putLocalCloudRow(db, conflict.table, { ...merged.row, updated_at: at }, true)
    }
    await writeCloudState(db, conflict.table, conflict.id, { base: conflict.remote })
  })
}
