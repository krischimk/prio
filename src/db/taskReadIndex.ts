import Dexie from 'dexie'
import { parseTags, tagKey } from '../domain/tags'
import type { LocalTask } from '../domain/types'
import type { LocalDatabase } from './localDb'

/** Nur IndexedDB-Indexwerte; der Leserand und das Cloud-Mapping geben sie nicht weiter. */
export interface TaskReadIndex {
  read_state: 'open' | 'completed' | 'deleted'
  read_until: number
  read_tag_keys: Array<[string, string, string, number, string]>
}
export function taskReadIndex(task: LocalTask): TaskReadIndex {
  const read_state = task.deleted_at != null || task.expired_at != null ? 'deleted' : task.completed ? 'completed' : 'open'
  const deadline = task.completed && task.completed_expires_at ? Date.parse(task.completed_expires_at) : NaN
  const read_until = Number.isFinite(deadline) ? deadline : Number.MAX_SAFE_INTEGER
  return { read_state, read_until, read_tag_keys: read_state === 'deleted' ? [] : parseTags(task.tags).map(tag => [task.list_id, read_state, tagKey(tag), read_until, tag]) }
}

/** Pflegt den abgeleiteten Index in derselben Schreibung, auch beim Sync/bulkPut. */
export function installTaskReadIndex(db: LocalDatabase) {
  db.tasks.hook('creating', (_key, task) => { Object.assign(task, taskReadIndex(task)) })
  db.tasks.hook('updating', (changes, _key, old) => {
    const relevant = ['list_id', 'completed', 'deleted_at', 'expired_at', 'completed_expires_at', 'tags', 'read_state', 'read_until', 'read_tag_keys']
    if (!Object.keys(changes).some(path => relevant.includes(path.split('.')[0]))) return
    // Updating-Hooks verändern weder das alte Objekt noch die Modifikationen.
    const next = structuredClone(old)
    for (const [path, value] of Object.entries(changes)) Dexie.setByKeyPath(next, path, value)
    return taskReadIndex(next)
  })
}

/** AND-Schnittmenge ausschließlich über Primärschlüssel, ohne Aufgabeninhalte. */
export async function completedTaskIdsWithTags(db: LocalDatabase, listId: string, tags: string[], now: number): Promise<string[]> {
  const keys = parseTags(tags).map(tagKey)
  let matching: Set<string> | null = null
  for (const tag of keys) {
    const ids = await db.tasks.where('read_tag_keys').between(
      [listId, 'completed', tag, now, Dexie.maxKey],
      [listId, 'completed', tag, Number.MAX_SAFE_INTEGER, Dexie.maxKey], false, true,
    ).primaryKeys()
    matching = matching === null ? new Set(ids) : new Set(ids.filter(id => matching!.has(id)))
    if (matching.size === 0) break
  }
  return [...(matching ?? [])]
}
