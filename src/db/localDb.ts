import Dexie, { type Table } from 'dexie'
import type { TaskReminder } from '../domain/reminder'
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

    /*
     * Version 4 und 5: Eine Aufgabe kann mehrere Erinnerungen tragen.
     *
     * Die Buchhaltung wird über **Aufgabe und Zeitpunkt** zusammen
     * geschlüsselt statt nur über die Aufgabe. Dexie kann einen Primärschlüssel
     * nicht in derselben Version ändern, deshalb in zwei Schritten: erst die
     * alte Tabelle weg, dann die neue anlegen.
     *
     * Das kostet nichts: Die Tabelle ist eine Momentaufnahme dessen, was beim
     * Betriebssystem liegt, und wird beim nächsten Abgleich ohnehin neu
     * aufgebaut.
     *
     * Die Aufgaben selbst werden hier ebenfalls umgezogen: Aus `remind_at` bzw.
     * `reminder_offset_minutes` wird die Liste. Ohne das hätte eine bestehende
     * Zeile das Feld gar nicht, und die Oberfläche stürzte beim Lesen ab –
     * derselbe Fehler wie damals bei `position`, nur an anderer Stelle.
     */
    this.version(4).stores({
      lists: 'id, owner_id, updated_at, dirty',
      list_members: '[list_id+user_id], list_id, user_id, updated_at, dirty',
      tasks: 'id, list_id, updated_at, dirty',
      meta: 'key',
      reminders: null,
    })

    this.version(5)
      .stores({
        lists: 'id, owner_id, updated_at, dirty',
        list_members: '[list_id+user_id], list_id, user_id, updated_at, dirty',
        tasks: 'id, list_id, updated_at, dirty',
        meta: 'key',
        reminders: '[taskId+at], taskId, notificationId, at',
      })
      .upgrade((tx) =>
        tx
          .table('tasks')
          .toCollection()
          .modify((task: AlteAufgabe) => {
            if (Array.isArray(task.reminders)) return

            const reminders: TaskReminder[] = []
            if (
              task.recurrence !== null &&
              task.due_at !== null &&
              typeof task.reminder_offset_minutes === 'number'
            ) {
              reminders.push({ form: 'offset', minutes: task.reminder_offset_minutes })
            } else if (typeof task.remind_at === 'string' && task.remind_at !== '') {
              reminders.push({ form: 'absolute', at: task.remind_at })
            }

            task.reminders = reminders
            delete task.remind_at
            delete task.reminder_offset_minutes
            // Als geändert markieren, damit die neue Form auch ankommt.
            task.dirty = 1
          }),
      )

    /*
     * `completed_at` wird indiziert.
     *
     * „Aufgaben wiederherstellen“ suchte die abgehakten Aufgaben bisher mit
     * `db.tasks.toArray()` – einem Lesevorgang über **alle** Aufgaben der
     * Datenbank, nur um danach in JavaScript zu filtern. Mit dem Index liest
     * die Abfrage genau den Zeitraum.
     *
     * Ein reiner Index-Zusatz: Es gibt keine Daten umzuschreiben, und Dexie
     * legt den Index beim Öffnen selbst an (kein `upgrade`-Rückruf nötig).
     */
    this.version(6).stores({
      lists: 'id, owner_id, updated_at, dirty',
      list_members: '[list_id+user_id], list_id, user_id, updated_at, dirty',
      tasks: 'id, list_id, updated_at, dirty, completed_at',
      meta: 'key',
      reminders: '[taskId+at], taskId, notificationId, at',
    })
  }
}

/**
 * Eine Aufgabe, wie sie vor Version 5 in der lokalen Datenbank lag: mit zwei
 * einzelnen Erinnerungsfeldern statt einer Liste.
 */
type AlteAufgabe = LocalTask & {
  reminders?: TaskReminder[]
  remind_at?: string | null
  reminder_offset_minutes?: number | null
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
