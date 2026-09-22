import Dexie, { type Table } from 'dexie'
import type { LocalList, LocalListMember, LocalMeta, LocalReminder, LocalTask } from '../domain/types'

/**
 * Lokale Datenbank (IndexedDB via Dexie).
 *
 * Pro Benutzer wird eine eigene Datenbank geöffnet (`prio-user-<uuid>`).
 * Grund: Auf demselben Gerät können sich nacheinander mehrere Konten anmelden.
 * Mit einer gemeinsamen Datenbank würden sich die Daten vermischen und der
 * Sync könnte fremde, noch nicht hochgeladene Datensätze pushen. Eine DB pro
 * Benutzer ist die einfachste Variante, die das zuverlässig verhindert –
 * und ein Logout löscht keine Daten, sondern schließt nur die DB.
 *
 * In der Datenbank liegen ausschließlich Daten dieses einen Benutzers:
 * eigene Listen, Listen mit Mitgliedschaft, deren Aufgaben sowie die
 * eigenen Mitgliedschaftszeilen. Welche Zeilen sichtbar sind, entscheidet
 * serverseitig die Row Level Security; lokal wird nur gespeichert, was
 * heruntergeladen wurde.
 */
export const LOCAL_DB_PREFIX = 'prio'

export function localDbName(userId: string): string {
  return `${LOCAL_DB_PREFIX}-user-${userId}`
}

export class LocalDatabase extends Dexie {
  lists!: Table<LocalList, string>
  list_members!: Table<LocalListMember, [string, string]>
  tasks!: Table<LocalTask, string>
  meta!: Table<LocalMeta, string>
  reminders!: Table<LocalReminder, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      lists: 'id, owner_id, updated_at, dirty',
      list_members: '[list_id+user_id], list_id, user_id, updated_at, dirty',
      tasks: 'id, list_id, updated_at, dirty',
      meta: 'key',
    })

    // Version 2 ergänzt die vorgemerkten Erinnerungen. Bestehende Datenbanken
    // bekommen die Tabelle beim Öffnen automatisch dazu.
    this.version(2).stores({
      lists: 'id, owner_id, updated_at, dirty',
      list_members: '[list_id+user_id], list_id, user_id, updated_at, dirty',
      tasks: 'id, list_id, updated_at, dirty',
      meta: 'key',
      reminders: 'taskId, notificationId, at',
    })

    /*
     * Version 3 repariert Aufgaben aus der Zeit vor der Reihenfolge-Funktion.
     *
     * Ihnen fehlt `position`. Das fiel lange nicht auf, weil der Wert nur beim
     * Anlegen einer neuen Aufgabe gelesen wird – dort entstand dann `NaN`, und
     * das wird beim Senden zu `null`. Der Server lehnt das ab, und der Sync
     * scheiterte dauerhaft.
     *
     * Die 0 ist der richtige Ersatz: Bei gleicher Position greifen die
     * früheren Regeln (Fälligkeit, Erstellzeit). Die Reihenfolge bleibt damit
     * so, wie sie vorher angezeigt wurde.
     */
    this.version(3)
      .stores({
        lists: 'id, owner_id, updated_at, dirty',
        list_members: '[list_id+user_id], list_id, user_id, updated_at, dirty',
        tasks: 'id, list_id, updated_at, dirty',
        meta: 'key',
        reminders: 'taskId, notificationId, at',
      })
      .upgrade((tx) =>
        tx
          .table('tasks')
          .toCollection()
          .modify((task: LocalTask) => {
            if (!Number.isFinite(task.position)) {
              task.position = 0
              // Als geändert markieren, damit die Reparatur auch ankommt.
              task.dirty = 1
            }
          }),
      )
  }
}

/**
 * Offene Datenbanken werden zwischengespeichert. Gründe:
 *  - Reacts StrictMode führt Effekte doppelt aus; ohne Cache entstünden zwei
 *    Dexie-Instanzen auf derselben IndexedDB.
 *  - Beim Wechsel zwischen Konten bleibt die jeweils andere DB geöffnet und
 *    muss nicht erneut aufgebaut werden.
 */
const openDatabases = new Map<string, Promise<LocalDatabase>>()

/** Öffnet (oder erstellt) die lokale Datenbank eines Benutzers. */
export function openLocalDatabase(userId: string): Promise<LocalDatabase> {
  const cached = openDatabases.get(userId)
  if (cached) return cached
  const opening = (async () => {
    const db = new LocalDatabase(localDbName(userId))
    await db.open()
    return db
  })()
  openDatabases.set(userId, opening)
  opening.catch(() => openDatabases.delete(userId))
  return opening
}

/** Schließt die lokale Datenbank eines Benutzers (z. B. beim Logout). */
export async function closeLocalDatabase(userId: string): Promise<void> {
  const cached = openDatabases.get(userId)
  if (!cached) return
  openDatabases.delete(userId)
  const db = await cached
  db.close()
}

/** Löscht die lokale Datenbank eines Benutzers – nur für Tests und Reset. */
export async function deleteLocalDatabase(userId: string): Promise<void> {
  openDatabases.delete(userId)
  await Dexie.delete(localDbName(userId))
}
