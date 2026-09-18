import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ValidationError } from '../../src/db/validation'
import { createFakeServer } from '../support/fakeGateway'
import { createDevice, createTestUserId, type DeviceHarness } from '../support/harness'

/**
 * Geschäftslogik der lokalen Datenbank (unit).
 *
 * Geprüft wird: Erstellen, Bearbeiten, Erledigen, Löschen (Soft Delete) und
 * die Sync-Markierung (`dirty`) jeder Operation.
 */
describe('Repositories (lokale Geschäftslogik)', () => {
  let device: DeviceHarness
  const userId = createTestUserId('repo')

  beforeEach(async () => {
    device = await createDevice({ userId, gateway: createFakeServer().gatewayFor(userId) })
  })

  afterEach(async () => {
    await device.dispose()
  })

  async function newList(): Promise<string> {
    const list = await device.repositories.createList('Arbeit', userId)
    return list.id
  }

  describe('Aufgaben', () => {
    it('erstellt eine Aufgabe lokal mit Sync-Markierung', async () => {
      const listId = await newList()
      const task = await device.repositories.createTask({ listId, title: '  Bericht schreiben  ' })

      expect(task.title).toBe('Bericht schreiben')
      expect(task.completed).toBe(false)
      expect(task.deleted_at).toBeNull()
      expect(task.dirty).toBe(1)
      expect(task.created_at).toBe(device.clock.now())

      const stored = await device.db.tasks.get(task.id)
      expect(stored).toBeDefined()
    })

    it('lehnt eine Aufgabe ohne Titel ab', async () => {
      const listId = await newList()
      await expect(device.repositories.createTask({ listId, title: '   ' })).rejects.toBeInstanceOf(
        ValidationError,
      )
    })

    it('lehnt eine Aufgabe für eine unbekannte Liste ab', async () => {
      await expect(
        device.repositories.createTask({ listId: 'gibt-es-nicht', title: 'Test' }),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('wandelt leere Beschreibung und leeres Fälligkeitsdatum in null', async () => {
      const listId = await newList()
      const task = await device.repositories.createTask({
        listId,
        title: 'Test',
        description: '   ',
        dueAt: '',
      })
      expect(task.description).toBeNull()
      expect(task.due_at).toBeNull()
    })

    it('speichert ein Fälligkeitsdatum mit Uhrzeit', async () => {
      const listId = await newList()
      const due = '2026-02-01T09:30:00.000Z'
      const task = await device.repositories.createTask({ listId, title: 'Test', dueAt: due })
      expect(task.due_at).toBe(due)
    })

    it('bearbeitet eine Aufgabe und markiert sie als schmutzig', async () => {
      const listId = await newList()
      const task = await device.repositories.createTask({ listId, title: 'Alt' })
      await device.engine.sync()

      device.clock.advance(1000)
      const updated = await device.repositories.updateTask(task.id, {
        title: 'Neu',
        description: 'Beschreibung',
      })

      expect(updated.title).toBe('Neu')
      expect(updated.description).toBe('Beschreibung')
      expect(updated.updated_at).toBe(device.clock.now())
      expect(updated.updated_at > task.updated_at).toBe(true)
      expect(updated.dirty).toBe(1)
    })

    it('erledigt eine Aufgabe und öffnet sie wieder', async () => {
      const listId = await newList()
      const task = await device.repositories.createTask({ listId, title: 'Test' })

      device.clock.advance(1000)
      const done = await device.repositories.setTaskCompleted(task.id, true)
      expect(done.completed).toBe(true)
      expect(done.dirty).toBe(1)

      device.clock.advance(1000)
      const reopened = await device.repositories.setTaskCompleted(task.id, false)
      expect(reopened.completed).toBe(false)
    })

    it('verschiebt eine Aufgabe in eine andere Liste', async () => {
      const quelle = await newList()
      const ziel = await device.repositories.createList('Ziel', userId)
      const task = await device.repositories.createTask({ listId: quelle, title: 'Wandert' })

      device.clock.advance(1000)
      const moved = await device.repositories.moveTask(task.id, ziel.id)

      expect(moved.list_id).toBe(ziel.id)
      expect(moved.dirty).toBe(1)
      expect(moved.updated_at > task.updated_at).toBe(true)

      // Aus der Quellliste verschwunden, in der Zielliste angekommen.
      expect(await device.repositories.listTasks(quelle)).toHaveLength(0)
      expect((await device.repositories.listTasks(ziel.id)).map((row) => row.title)).toEqual(['Wandert'])
    })

    it('ändert beim Verschieben in dieselbe Liste nichts', async () => {
      const listId = await newList()
      const task = await device.repositories.createTask({ listId, title: 'Bleibt' })
      await device.engine.sync()

      device.clock.advance(60_000)
      const same = await device.repositories.moveTask(task.id, listId)

      expect(same.updated_at).toBe(task.updated_at)
      expect(same.dirty).toBe(0)
    })

    it('lehnt das Verschieben in eine unbekannte Liste ab', async () => {
      const listId = await newList()
      const task = await device.repositories.createTask({ listId, title: 'Test' })
      await expect(device.repositories.moveTask(task.id, 'gibt-es-nicht')).rejects.toBeInstanceOf(
        ValidationError,
      )
    })

    it('überträgt das Verschieben beim nächsten Sync', async () => {
      const quelle = await newList()
      const ziel = await device.repositories.createList('Ziel', userId)
      const task = await device.repositories.createTask({ listId: quelle, title: 'Wandert' })
      await device.engine.sync()

      device.clock.advance(60_000)
      await device.repositories.moveTask(task.id, ziel.id)
      await device.engine.sync()

      const list = await device.repositories.getTask(task.id)
      expect(list?.list_id).toBe(ziel.id)
    })

    it('löscht eine Aufgabe als Soft Delete', async () => {
      const listId = await newList()
      const task = await device.repositories.createTask({ listId, title: 'Test' })

      device.clock.advance(1000)
      await device.repositories.deleteTask(task.id)

      // Zeile bleibt erhalten – nur so kann die Löschung synchronisiert werden.
      const stored = await device.db.tasks.get(task.id)
      expect(stored?.deleted_at).toBe(device.clock.now())
      expect(stored?.dirty).toBe(1)

      expect(await device.repositories.listTasks(listId)).toHaveLength(0)
      expect(await device.repositories.getTask(task.id)).toBeUndefined()
    })

    it('sortiert offene Aufgaben vor erledigten und dann nach Fälligkeit', async () => {
      const listId = await newList()
      const später = await device.repositories.createTask({
        listId,
        title: 'Später',
        dueAt: '2026-03-01T10:00:00.000Z',
      })
      const früher = await device.repositories.createTask({
        listId,
        title: 'Früher',
        dueAt: '2026-02-01T10:00:00.000Z',
      })
      const ohneDatum = await device.repositories.createTask({ listId, title: 'Ohne Datum' })
      await device.repositories.setTaskCompleted(ohneDatum.id, true)

      const tasks = await device.repositories.listTasks(listId)
      expect(tasks.map((task) => task.title)).toEqual(['Früher', 'Später', 'Ohne Datum'])
      expect(tasks[2]?.id).toBe(ohneDatum.id)
      expect(früher.id).not.toBe(später.id)
    })

    it('vergibt für jede Aufgabe eine eigene ID', async () => {
      const listId = await newList()
      const a = await device.repositories.createTask({ listId, title: 'A' })
      const b = await device.repositories.createTask({ listId, title: 'B' })
      expect(a.id).not.toBe(b.id)
    })
  })

  describe('Listen', () => {
    it('erstellt eine private Liste', async () => {
      const list = await device.repositories.createList('Privat', userId)
      expect(list.owner_id).toBe(userId)
      expect(list.is_shared).toBe(false)
      expect(list.dirty).toBe(1)
    })

    it('benennt eine Liste um', async () => {
      const list = await device.repositories.createList('Alt', userId)
      device.clock.advance(1000)
      const renamed = await device.repositories.renameList(list.id, 'Neu')
      expect(renamed.name).toBe('Neu')
      expect(renamed.dirty).toBe(1)
      expect(renamed.updated_at > list.updated_at).toBe(true)
    })

    it('löscht eine Liste samt Aufgaben als Soft Delete', async () => {
      const list = await device.repositories.createList('Liste', userId)
      const task = await device.repositories.createTask({ listId: list.id, title: 'Aufgabe' })

      device.clock.advance(1000)
      await device.repositories.deleteList(list.id)

      expect(await device.repositories.listLists()).toHaveLength(0)
      expect(await device.repositories.getList(list.id)).toBeUndefined()

      const storedTask = await device.db.tasks.get(task.id)
      expect(storedTask?.deleted_at).toBe(device.clock.now())
      expect(storedTask?.dirty).toBe(1)
    })

    it('markiert eine Liste als geteilt', async () => {
      const list = await device.repositories.createList('Liste', userId)
      await device.repositories.markListShared(list.id)
      const stored = await device.repositories.getList(list.id)
      expect(stored?.is_shared).toBe(true)
      expect(stored?.dirty).toBe(1)
    })

    it('verweigert das Anlegen einer Liste ohne Namen', async () => {
      await expect(device.repositories.createList('  ', userId)).rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('Mitgliedschaften', () => {
    it('entfernt ein Mitglied als Soft Delete, damit der Sync es übertragen kann', async () => {
      const list = await device.repositories.createList('Geteilt', userId)
      await device.db.list_members.put({
        list_id: list.id,
        user_id: 'user-b',
        created_at: device.clock.now(),
        updated_at: device.clock.now(),
        deleted_at: null,
        dirty: 0,
      })

      device.clock.advance(1000)
      await device.repositories.removeMember(list.id, 'user-b')

      const stored = await device.db.list_members.get([list.id, 'user-b'])
      expect(stored?.deleted_at).toBe(device.clock.now())
      expect(stored?.dirty).toBe(1)
      expect(await device.repositories.listMembers(list.id)).toHaveLength(0)
    })

    it('meldet ein unbekanntes Mitglied als Fehler', async () => {
      const list = await device.repositories.createList('Geteilt', userId)
      await expect(device.repositories.removeMember(list.id, 'unbekannt')).rejects.toBeInstanceOf(
        ValidationError,
      )
    })
  })
})
