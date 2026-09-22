import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ValidationError } from '../../src/db/validation'
import { createFakeServer, type FakeServer } from '../support/fakeGateway'
import { createDevice, createTestUserId, type DeviceHarness } from '../support/harness'
import { collectDirty, countDirty } from '../../src/sync/syncStore'

/**
 * Geschäftslogik der lokalen Datenbank (unit).
 *
 * Geprüft wird: Erstellen, Bearbeiten, Erledigen, Löschen (Soft Delete) und
 * die Sync-Markierung (`dirty`) jeder Operation.
 */
describe('Repositories (lokale Geschäftslogik)', () => {
  let device: DeviceHarness
  let server: FakeServer
  const userId = createTestUserId('repo')

  beforeEach(async () => {
    server = createFakeServer()
    device = await createDevice({ userId, gateway: server.gatewayFor(userId) })
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

    it('hängt neue Aufgaben unten an', async () => {
      const listId = await newList()
      const erste = await device.repositories.createTask({ listId, title: 'Erste' })
      const zweite = await device.repositories.createTask({ listId, title: 'Zweite' })
      const dritte = await device.repositories.createTask({ listId, title: 'Dritte' })

      expect([erste.position, zweite.position, dritte.position]).toEqual([1, 2, 3])
      expect((await device.repositories.listTasks(listId)).map((task) => task.title)).toEqual([
        'Erste',
        'Zweite',
        'Dritte',
      ])
    })

    it('blendet erledigte Aufgaben aus der Liste aus', async () => {
      const listId = await newList()
      const erste = await device.repositories.createTask({ listId, title: 'Erste' })
      await device.repositories.createTask({ listId, title: 'Zweite' })

      await device.repositories.setTaskCompleted(erste.id, true)

      // Abgehakt heißt: verschwindet. Auffindbar bleibt sie unter
      // „Aufgaben wiederherstellen“.
      expect((await device.repositories.listTasks(listId)).map((task) => task.title)).toEqual([
        'Zweite',
      ])
      expect((await device.repositories.listRestorableTasks()).map((task) => task.title)).toEqual([
        'Erste',
      ])
    })

    it('greift bei gleicher Position auf die früheren Regeln zurück', async () => {
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

      // Zustand vor der Reihenfolge-Funktion nachstellen.
      for (const task of [später, früher, ohneDatum]) {
        await device.db.tasks.update(task.id, { position: 0 })
      }

      // Alle offen: ohne Fälligkeit steht hinten.
      expect((await device.repositories.listTasks(listId)).map((task) => task.title)).toEqual([
        'Früher',
        'Später',
        'Ohne Datum',
      ])

      // Und erledigt fällt heraus, egal an welcher Position.
      await device.db.tasks.update(später.id, {
        completed: true,
        completed_at: device.clock.now(),
      })
      expect((await device.repositories.listTasks(listId)).map((task) => task.title)).toEqual([
        'Früher',
        'Ohne Datum',
      ])
    })

    it('setzt eine neue Reihenfolge', async () => {
      const listId = await newList()
      const a = await device.repositories.createTask({ listId, title: 'A' })
      const b = await device.repositories.createTask({ listId, title: 'B' })
      const c = await device.repositories.createTask({ listId, title: 'C' })

      device.clock.advance(1000)
      await device.repositories.reorderTasks(listId, [c.id, a.id, b.id])

      expect((await device.repositories.listTasks(listId)).map((task) => task.title)).toEqual([
        'C',
        'A',
        'B',
      ])
      expect((await device.repositories.getTask(c.id))?.position).toBe(1)
      expect((await device.repositories.getTask(a.id))?.position).toBe(2)
      expect((await device.repositories.getTask(b.id))?.position).toBe(3)
    })

    it('schreibt beim Umsortieren nur die tatsächlich betroffenen Aufgaben', async () => {
      const listId = await newList()
      const a = await device.repositories.createTask({ listId, title: 'A' })
      const b = await device.repositories.createTask({ listId, title: 'B' })
      const c = await device.repositories.createTask({ listId, title: 'C' })
      await device.engine.sync()
      expect(await countDirty(device.db)).toBe(0)

      // A und B tauschen – C behält Position 3 und darf nicht angefasst werden.
      device.clock.advance(1000)
      await device.repositories.reorderTasks(listId, [b.id, a.id, c.id])

      const dirty = await collectDirty(device.db)
      expect(dirty.tasks.map((task) => task.title).sort()).toEqual(['A', 'B'])
      expect((await device.repositories.getTask(c.id))?.dirty).toBe(0)
    })

    it('vergibt nach dem Umsortieren lückenlose Positionen', async () => {
      const listId = await newList()
      const a = await device.repositories.createTask({ listId, title: 'A' })
      const b = await device.repositories.createTask({ listId, title: 'B' })
      const c = await device.repositories.createTask({ listId, title: 'C' })

      await device.repositories.reorderTasks(listId, [b.id, c.id, a.id])

      const positionen = (await device.repositories.listTasks(listId)).map((task) => task.position)
      expect(positionen).toEqual([1, 2, 3])
    })

    it('ignoriert beim Umsortieren unbekannte IDs', async () => {
      const listId = await newList()
      const a = await device.repositories.createTask({ listId, title: 'A' })
      const b = await device.repositories.createTask({ listId, title: 'B' })

      await device.repositories.reorderTasks(listId, ['gibt-es-nicht', b.id, a.id])

      expect((await device.repositories.listTasks(listId)).map((task) => task.title)).toEqual([
        'B',
        'A',
      ])
    })

    it('überträgt die Reihenfolge beim nächsten Sync', async () => {
      const listId = await newList()
      const a = await device.repositories.createTask({ listId, title: 'A' })
      const b = await device.repositories.createTask({ listId, title: 'B' })
      await device.engine.sync()

      device.clock.advance(1000)
      await device.repositories.reorderTasks(listId, [b.id, a.id])
      await device.engine.sync()

      expect(server.taskById(b.id)?.position).toBe(1)
      expect(server.taskById(a.id)?.position).toBe(2)
    })

    it('vergibt für jede Aufgabe eine eigene ID', async () => {
      const listId = await newList()
      const a = await device.repositories.createTask({ listId, title: 'A' })
      const b = await device.repositories.createTask({ listId, title: 'B' })
      expect(a.id).not.toBe(b.id)
    })
  })

  describe('Erledigen und Wiederherstellen', () => {
    const TAG = 24 * 60 * 60 * 1000

    it('setzt den Zeitpunkt beim Abhaken und leert ihn beim Wiederöffnen', async () => {
      const listId = await newList()
      const task = await device.repositories.createTask({ listId, title: 'Test' })
      expect(task.completed_at).toBeNull()

      device.clock.advance(1000)
      const erledigt = await device.repositories.setTaskCompleted(task.id, true)
      expect(erledigt.completed_at).toBe(device.clock.now())

      device.clock.advance(1000)
      const offen = await device.repositories.setTaskCompleted(task.id, false)
      expect(offen.completed_at).toBeNull()
    })

    it('listet nur, was innerhalb des Fensters abgehakt wurde', async () => {
      const listId = await newList()
      const alt = await device.repositories.createTask({ listId, title: 'Zu alt' })
      await device.repositories.setTaskCompleted(alt.id, true)

      // Achteinhalb Tage später – das Fenster beträgt sieben.
      device.clock.advance(9 * TAG)
      const frisch = await device.repositories.createTask({ listId, title: 'Frisch' })
      await device.repositories.setTaskCompleted(frisch.id, true)

      expect((await device.repositories.listRestorableTasks()).map((task) => task.title)).toEqual([
        'Frisch',
      ])
    })

    it('sortiert die zuletzt abgehakte Aufgabe nach oben', async () => {
      const listId = await newList()
      const a = await device.repositories.createTask({ listId, title: 'Zuerst' })
      const b = await device.repositories.createTask({ listId, title: 'Danach' })

      await device.repositories.setTaskCompleted(a.id, true)
      device.clock.advance(60_000)
      await device.repositories.setTaskCompleted(b.id, true)

      expect((await device.repositories.listRestorableTasks()).map((task) => task.title)).toEqual([
        'Danach',
        'Zuerst',
      ])
    })

    it('ignoriert offene und gelöschte Aufgaben', async () => {
      const listId = await newList()
      const offen = await device.repositories.createTask({ listId, title: 'Offen' })
      const geloescht = await device.repositories.createTask({ listId, title: 'Gelöscht' })
      await device.repositories.setTaskCompleted(geloescht.id, true)
      await device.repositories.deleteTask(geloescht.id)

      const wiederherstellbar = await device.repositories.listRestorableTasks()
      expect(wiederherstellbar.map((task) => task.title)).toEqual([])
      expect(await device.repositories.getTask(offen.id)).toBeDefined()
    })

    it('stellt eine abgehakte Aufgabe wieder her', async () => {
      const listId = await newList()
      const task = await device.repositories.createTask({ listId, title: 'Zurück' })
      await device.repositories.setTaskCompleted(task.id, true)
      expect(await device.repositories.listTasks(listId)).toHaveLength(0)

      device.clock.advance(1000)
      const wieder = await device.repositories.setTaskCompleted(task.id, false)

      expect(wieder.completed).toBe(false)
      expect(wieder.completed_at).toBeNull()
      expect(wieder.dirty).toBe(1)
      expect((await device.repositories.listTasks(listId)).map((row) => row.title)).toEqual(['Zurück'])
      expect(await device.repositories.listRestorableTasks()).toHaveLength(0)
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

    it('setzt und entfernt das Symbol einer Liste', async () => {
      const list = await device.repositories.createList('Haushalt', userId)
      expect(list.icon).toBeNull()

      device.clock.advance(1000)
      const mitSymbol = await device.repositories.setListIcon(list.id, 'std:home')

      expect(mitSymbol.icon).toBe('std:home')
      expect(mitSymbol.dirty).toBe(1)
      expect(mitSymbol.updated_at).toBe(device.clock.now())

      const ohne = await device.repositories.setListIcon(list.id, null)
      expect(ohne.icon).toBeNull()
    })

    it('nimmt eine unbekannte Kennung an, ohne sie zu prüfen', async () => {
      // Eine spätere Symbolreihe soll keine Datenbankänderung brauchen; die
      // Oberfläche zeigt Unbekanntes einfach als „kein Symbol“.
      const list = await device.repositories.createList('Test', userId)
      const gesetzt = await device.repositories.setListIcon(list.id, 'std:gibtsnicht')
      expect(gesetzt.icon).toBe('std:gibtsnicht')
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

    it('lässt ein Mitglied die Liste selbst verlassen', async () => {
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
      await device.repositories.leaveList(list.id, 'user-b')

      const stored = await device.db.list_members.get([list.id, 'user-b'])
      expect(stored?.deleted_at).toBe(device.clock.now())
      expect(stored?.dirty).toBe(1)
      // Die Mitgliedschaft ist damit für die Liste nicht mehr sichtbar.
      expect(await device.repositories.listMembers(list.id)).toHaveLength(0)
    })

    it('verlässt eine Liste nur einmal', async () => {
      const list = await device.repositories.createList('Geteilt', userId)
      await device.db.list_members.put({
        list_id: list.id,
        user_id: 'user-b',
        created_at: device.clock.now(),
        updated_at: device.clock.now(),
        deleted_at: null,
        dirty: 0,
      })

      await device.repositories.leaveList(list.id, 'user-b')
      const nachErstem = await device.db.list_members.get([list.id, 'user-b'])

      // Ein zweiter Aufruf darf den Zeitpunkt nicht verändern.
      device.clock.advance(5000)
      await device.repositories.leaveList(list.id, 'user-b')

      const nachZweitem = await device.db.list_members.get([list.id, 'user-b'])
      expect(nachZweitem?.deleted_at).toBe(nachErstem?.deleted_at)
    })

    it('meldet eine unbekannte Mitgliedschaft beim Verlassen als Fehler', async () => {
      const list = await device.repositories.createList('Geteilt', userId)
      await expect(device.repositories.leaveList(list.id, 'unbekannt')).rejects.toBeInstanceOf(
        ValidationError,
      )
    })
  })
})
