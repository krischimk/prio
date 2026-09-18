import type { LocalList, LocalListMember, LocalTask, PushPayload } from '../domain/types'
import type { LocalDatabase } from '../db/localDb'

/**
 * Persistenz-Helfer für die Sync-Engine.
 *
 * Die "Sync-Queue" ist bewusst keine eigene Tabelle, sondern das `dirty`-Flag
 * direkt an der Zeile. Vorteile für Version 0.1:
 *  - kein zweiter Zustand, der auseinanderlaufen kann,
 *  - eine Änderung an derselben Zeile erzeugt keinen doppelten Queue-Eintrag,
 *  - die Queue ist per Index abfragbar (`dirty = 1`).
 * Nachteil: Es gibt keine Historie und keine Reihenfolge – für 0.1 irrelevant,
 * weil pro Sync immer der komplette lokale Stand der schmutzigen Zeilen
 * hochgeladen wird (Idempotenz über Upsert).
 */

export const META_LAST_SYNC_AT = 'last_sync_at'
export const META_LAST_SYNC_STATUS = 'last_sync_status'

export interface DirtyRows {
  lists: LocalList[]
  members: LocalListMember[]
  tasks: LocalTask[]
}

export async function collectDirty(db: LocalDatabase): Promise<DirtyRows> {
  const [lists, members, tasks] = await Promise.all([
    db.lists.where('dirty').equals(1).toArray(),
    db.list_members.where('dirty').equals(1).toArray(),
    db.tasks.where('dirty').equals(1).toArray(),
  ])
  return { lists, members, tasks }
}

export async function countDirty(db: LocalDatabase): Promise<number> {
  const [lists, members, tasks] = await Promise.all([
    db.lists.where('dirty').equals(1).count(),
    db.list_members.where('dirty').equals(1).count(),
    db.tasks.where('dirty').equals(1).count(),
  ])
  return lists + members + tasks
}

/**
 * Setzt `dirty` zurück – aber nur für Zeilen, die sich seit dem Upload nicht
 * erneut geändert haben. Verglichen wird deshalb `updated_at` (und sicherheits-
 * halber `deleted_at`). Ohne diese Prüfung ginge eine Änderung verloren, die
 * während des Uploads lokal passiert ist.
 */
export async function markPushed(db: LocalDatabase, payload: PushPayload): Promise<void> {
  await db.transaction('rw', db.lists, db.list_members, db.tasks, async () => {
    for (const row of payload.lists) {
      const local = await db.lists.get(row.id)
      if (local && local.updated_at === row.updated_at && local.deleted_at === row.deleted_at) {
        await db.lists.update(row.id, { dirty: 0 })
      }
    }
    for (const row of payload.members) {
      const local = await db.list_members.get([row.list_id, row.user_id])
      if (local && local.updated_at === row.updated_at && local.deleted_at === row.deleted_at) {
        await db.list_members.update([row.list_id, row.user_id], { dirty: 0 })
      }
    }
    for (const row of payload.tasks) {
      const local = await db.tasks.get(row.id)
      if (local && local.updated_at === row.updated_at && local.deleted_at === row.deleted_at) {
        await db.tasks.update(row.id, { dirty: 0 })
      }
    }
  })
}

export async function readMeta(db: LocalDatabase, key: string): Promise<string | null> {
  const row = await db.meta.get(key)
  return row ? row.value : null
}

export async function writeMeta(db: LocalDatabase, key: string, value: string): Promise<void> {
  await db.meta.put({ key, value })
}
