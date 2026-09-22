import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { deleteLocalDatabase, localDbName, openLocalDatabase } from '../../src/db/localDb'
import { createTestUserId } from '../support/harness'

/**
 * Upgrade einer bestehenden lokalen Datenbank (Integration).
 *
 * Wichtig für echte Nutzer: Wer die App schon benutzt hat, hat eine ältere
 * Datenbank. Beim Update kommen Tabelle und Reparaturen hinzu. Vorhandene
 * Aufgaben und Listen müssen dabei erhalten bleiben – ein stiller Datenverlust
 * wäre der schlimmste denkbare Fehler.
 */
describe('Upgrade der lokalen Datenbank', () => {
  const userId = createTestUserId('upgrade')

  afterEach(async () => {
    await deleteLocalDatabase(userId)
  })

  it('ergänzt die Erinnerungstabelle, ohne Daten zu verlieren', async () => {
    // Zustand vor dem Update nachstellen: nur Schema-Version 1.
    const alteVersion = new Dexie(localDbName(userId))
    alteVersion.version(1).stores({
      lists: 'id, owner_id, updated_at, dirty',
      list_members: '[list_id+user_id], list_id, user_id, updated_at, dirty',
      tasks: 'id, list_id, updated_at, dirty',
      meta: 'key',
    })
    await alteVersion.open()

    await alteVersion.table('lists').put({
      id: 'list-1',
      name: 'Bestandsliste',
      owner_id: userId,
      is_shared: false,
      icon: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      deleted_at: null,
      dirty: 0,
    })
    await alteVersion.table('tasks').put({
      id: 'task-1',
      list_id: 'list-1',
      title: 'Bestandsaufgabe',
      description: null,
      due_at: '2026-06-01T09:00:00.000Z',
      completed: false,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      deleted_at: null,
      dirty: 0,
    })
    alteVersion.close()

    // Jetzt die App öffnen – sie kennt nur die neue Klasse mit Version 2.
    const db = await openLocalDatabase(userId)

    expect(db.verno).toBe(3)
    expect(await db.tasks.count()).toBe(1)
    expect((await db.tasks.get('task-1'))?.title).toBe('Bestandsaufgabe')
    expect(await db.lists.count()).toBe(1)

    // Die neue Tabelle ist benutzbar und indexiert.
    await db.reminders.put({ taskId: 'task-1', notificationId: 1, at: '2026-06-01T09:00:00.000Z' })
    expect(await db.reminders.count()).toBe(1)
    expect((await db.reminders.get('task-1'))?.notificationId).toBe(1)

    db.close()
  })

  it('legt eine frische Datenbank direkt in der neuesten Version an', async () => {
    const db = await openLocalDatabase(createTestUserId('frisch'))
    expect(db.verno).toBe(3)
    expect(await db.reminders.count()).toBe(0)
    db.close()
  })

  it('gibt Aufgaben ohne Reihenfolge eine gültige Position', async () => {
    // Der gemeldete Fehler: Eine Aufgabe aus der Zeit vor der
    // Reihenfolge-Funktion hatte kein `position`. Beim Anlegen einer neuen
    // Aufgabe entstand daraus `NaN`, und `NaN` wird beim Senden zu `null` –
    // der Server lehnt das mit „null value in column position" ab.
    const alteVersion = new Dexie(localDbName(userId))
    alteVersion.version(1).stores({
      lists: 'id, owner_id, updated_at, dirty',
      list_members: '[list_id+user_id], list_id, user_id, updated_at, dirty',
      tasks: 'id, list_id, updated_at, dirty',
      meta: 'key',
    })
    await alteVersion.open()
    await alteVersion.table('tasks').put({
      id: 'task-alt',
      list_id: 'list-1',
      title: 'Aus alter Zeit',
      description: null,
      due_at: null,
      completed: false,
      // Kein `position` – so sah die Zeile vor Version 0.4.1 aus.
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      deleted_at: null,
      dirty: 0,
    })
    alteVersion.close()

    const db = await openLocalDatabase(userId)
    const repariert = await db.tasks.get('task-alt')

    expect(repariert?.position).toBe(0)
    // Als geändert markiert, damit die Reparatur hochgeladen wird.
    expect(repariert?.dirty).toBe(1)

    db.close()
  })
})
