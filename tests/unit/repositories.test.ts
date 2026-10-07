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

    it('legt neue Aufgaben oben ab', async () => {
      const listId = await newList()
      const erste = await device.repositories.createTask({ listId, title: 'Erste' })
      const zweite = await device.repositories.createTask({ listId, title: 'Zweite' })
      const dritte = await device.repositories.createTask({ listId, title: 'Dritte' })

      // Jede neue Aufgabe bekommt die kleinste Position − 1; die Werte werden
      // dabei negativ, die Reihenfolge bleibt eindeutig.
      expect([erste.position, zweite.position, dritte.position]).toEqual([0, -1, -2])
      expect((await device.repositories.listTasks(listId)).map((task) => task.title)).toEqual([
        'Dritte',
        'Zweite',
        'Erste',
      ])
    })

    it('legt auch in einer Liste aus alter Zeit oben ab', async () => {
      // Aufgaben aus der Zeit vor der Reihenfolge-Funktion haben die Position 0
      // – oder gar keine. Beides darf eine neue Aufgabe nicht nach unten
      // sortieren.
      const listId = await newList()
      const alt = await device.repositories.createTask({ listId, title: 'Alt' })
      await device.db.tasks.update(alt.id, { position: undefined as unknown as number })

      const neu = await device.repositories.createTask({ listId, title: 'Neu' })

      expect(neu.position).toBeLessThan(0)
      expect((await device.repositories.listTasks(listId)).map((task) => task.title)).toEqual([
        'Neu',
        'Alt',
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
        recurrence: null,
        successor_id: null,
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

      // Einmal in die Ausgangsreihenfolge bringen: Neue Aufgaben landen oben,
      // hier sollen sie in Anlege-Reihenfolge stehen (Positionen 1, 2, 3).
      await device.repositories.reorderTasks(listId, [a.id, b.id, c.id])
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

  describe('Wiederkehrende Aufgaben', () => {
    /** Legt eine wiederkehrende Aufgabe an; der Termin liegt in der Zukunft. */
    async function neueWiederholung(listId: string, wiederholung = 'daily') {
      const termin = new Date(2099, 0, 15, 18, 30).toISOString()
      const task = await device.repositories.createTask({
        listId,
        title: 'Wiederkehrend',
        dueAt: termin,
        recurrence: wiederholung,
      })
      return { task, termin }
    }

    it('legt beim Abhaken den Nachfolger mit dem nächsten Termin an', async () => {
      const listId = await newList()
      const { task } = await neueWiederholung(listId)

      const erledigt = await device.repositories.setTaskCompleted(task.id, true)
      expect(erledigt.successor_id).not.toBeNull()

      const nachfolger = await device.repositories.getTask(erledigt.successor_id!)
      expect(nachfolger).toBeDefined()
      // Gleicher Titel, gleiche Liste, gleiche Wiederholung …
      expect(nachfolger?.title).toBe('Wiederkehrend')
      expect(nachfolger?.list_id).toBe(listId)
      expect(nachfolger?.recurrence).toBe('daily')
      // … und der Termin ist einen Tag weiter, zur selben Uhrzeit.
      expect(nachfolger?.due_at).toBe(new Date(2099, 0, 16, 18, 30).toISOString())
      expect(nachfolger?.completed).toBe(false)
    })

    it('behält den Platz in der Liste', async () => {
      const listId = await newList()
      // Neue Aufgaben stehen oben – deshalb von unten nach oben anlegen.
      await device.repositories.createTask({ listId, title: 'Danach' })
      const { task } = await neueWiederholung(listId)
      await device.repositories.createTask({ listId, title: 'Davor' })

      const erledigt = await device.repositories.setTaskCompleted(task.id, true)
      const nachfolger = await device.repositories.getTask(erledigt.successor_id!)

      // Der Nachfolger bleibt an seinem Platz, statt ans Ende zu rutschen.
      expect(nachfolger?.position).toBe(task.position)
      expect((await device.repositories.listTasks(listId)).map((t) => t.title)).toEqual([
        'Davor',
        'Wiederkehrend',
        'Danach',
      ])
    })

    it('erzeugt keinen Nachfolger ohne Wiederholung', async () => {
      const listId = await newList()
      const task = await device.repositories.createTask({ listId, title: 'Einmalig' })
      const erledigt = await device.repositories.setTaskCompleted(task.id, true)
      expect(erledigt.successor_id).toBeNull()
      expect(await device.repositories.listTasks(listId)).toHaveLength(0)
    })

    it('erzeugt keinen Nachfolger ohne Fälligkeit', async () => {
      const listId = await newList()
      const task = await device.repositories.createTask({
        listId,
        title: 'Ohne Termin',
        recurrence: 'daily',
      })
      const erledigt = await device.repositories.setTaskCompleted(task.id, true)
      expect(erledigt.successor_id).toBeNull()
    })

    it('nimmt den Nachfolger beim Wiederöffnen zurück', async () => {
      const listId = await newList()
      const { task } = await neueWiederholung(listId)

      const erledigt = await device.repositories.setTaskCompleted(task.id, true)
      const nachfolgerId = erledigt.successor_id!
      expect(await device.repositories.listTasks(listId)).toHaveLength(1)

      const wieder = await device.repositories.setTaskCompleted(task.id, false)

      expect(wieder.successor_id).toBeNull()
      expect(wieder.completed).toBe(false)
      // Nur die ursprüngliche Aufgabe steht noch in der Liste – nicht beide.
      const offen = await device.repositories.listTasks(listId)
      expect(offen.map((t) => t.id)).toEqual([task.id])
      // Der Nachfolger ist weich gelöscht, damit der Abgleich ihn zurücknimmt.
      const nachfolger = await device.repositories.getTask(nachfolgerId)
      expect(nachfolger).toBeUndefined()
    })

    it('zeigt auch die fortgeschriebene Aufgabe zum Wiederherstellen', async () => {
      const listId = await newList()
      const { task } = await neueWiederholung(listId)
      const erledigt = await device.repositories.setTaskCompleted(task.id, true)

      // Eine Regel für alle: sieben Tage ab dem Abhaken. Die abgehakte Fassung
      // bleibt auffindbar, während der nächste Termin offen in der Liste steht.
      const wiederherstellbar = await device.repositories.listRestorableTasks()
      expect(wiederherstellbar.map((t) => t.id)).toEqual([erledigt.id])
      expect((await device.repositories.listTasks(listId)).map((t) => t.title)).toEqual([
        'Wiederkehrend',
      ])
    })

    it('nimmt die fortgeschriebene Aufgabe nach sieben Tagen aus dem Fenster', async () => {
      const listId = await newList()
      const { task } = await neueWiederholung(listId)
      await device.repositories.setTaskCompleted(task.id, true)

      device.clock.advance(8 * 24 * 60 * 60 * 1000)

      expect(await device.repositories.listRestorableTasks()).toHaveLength(0)
    })

    it('legt denselben Nachfolger nicht zweimal an', async () => {
      const listId = await newList()
      const { task } = await neueWiederholung(listId)

      const erst = await device.repositories.setTaskCompleted(task.id, true)
      await device.repositories.setTaskCompleted(task.id, false)
      const zweit = await device.repositories.setTaskCompleted(task.id, true)

      // Gleiche Kennung, also weiterhin nur eine offene Aufgabe.
      expect(zweit.successor_id).toBe(erst.successor_id)
      expect(await device.repositories.listTasks(listId)).toHaveLength(1)
    })
  })

  describe('Erinnerungen', () => {
    const TERMIN = new Date(2099, 0, 15, 18, 30).toISOString()
    const FRUEHER = new Date(2099, 0, 15, 17, 0).toISOString()

    it('speichert bei einer einmaligen Aufgabe absolute Zeitpunkte', async () => {
      const listId = await newList()
      const task = await device.repositories.createTask({
        listId,
        title: 'Einmalig',
        dueAt: TERMIN,
        reminders: [{ form: 'absolute', at: FRUEHER }],
      })

      expect(task.reminders).toEqual([{ form: 'absolute', at: FRUEHER }])
    })

    it('trägt mehrere Erinnerungen', async () => {
      const listId = await newList()
      const task = await device.repositories.createTask({
        listId,
        title: 'Zweimal',
        dueAt: TERMIN,
        reminders: [
          { form: 'absolute', at: FRUEHER },
          { form: 'absolute', at: TERMIN },
        ],
      })

      expect(task.reminders).toHaveLength(2)
    })

    it('erlaubt eine Erinnerung ohne Fälligkeit', async () => {
      const listId = await newList()
      const task = await device.repositories.createTask({
        listId,
        title: 'Anrufen',
        reminders: [{ form: 'absolute', at: FRUEHER }],
      })

      expect(task.due_at).toBeNull()
      expect(task.reminders).toHaveLength(1)
    })

    it('macht aus absoluten Zeitpunkten Vorläufe, sobald die Aufgabe wiederkehrt', async () => {
      const listId = await newList()
      const task = await device.repositories.createTask({
        listId,
        title: 'Wird wiederkehrend',
        dueAt: TERMIN,
        reminders: [{ form: 'absolute', at: FRUEHER }],
      })

      const geaendert = await device.repositories.updateTask(task.id, { recurrence: 'daily' })

      // 18:30 minus 17:00 sind 90 Minuten.
      expect(geaendert.reminders).toEqual([{ form: 'offset', minutes: 90 }])
    })

    it('macht aus Vorläufen Zeitpunkte, sobald die Wiederholung wegfällt', async () => {
      const listId = await newList()
      const task = await device.repositories.createTask({
        listId,
        title: 'War wiederkehrend',
        dueAt: TERMIN,
        recurrence: 'daily',
        reminders: [{ form: 'offset', minutes: 90 }],
      })

      const geaendert = await device.repositories.updateTask(task.id, { recurrence: null })

      expect(geaendert.reminders).toEqual([{ form: 'absolute', at: FRUEHER }])
    })

    it('leert die Liste, wenn sie ausdrücklich geleert wird', async () => {
      const listId = await newList()
      const task = await device.repositories.createTask({
        listId,
        title: 'Mit Erinnerung',
        dueAt: TERMIN,
        recurrence: 'daily',
        reminders: [{ form: 'offset', minutes: 90 }],
      })

      const geaendert = await device.repositories.updateTask(task.id, { reminders: [] })
      expect(geaendert.reminders).toEqual([])
    })

    it('übernimmt die Erinnerungen in die Nachfolgeaufgabe', async () => {
      // Der Nachfolger erbt alle Felder – die Erinnerungen rücken dadurch von
      // allein mit, ohne eigenen Code im Abhaken.
      const listId = await newList()
      const task = await device.repositories.createTask({
        listId,
        title: 'Täglich',
        dueAt: TERMIN,
        recurrence: 'daily',
        reminders: [
          { form: 'offset', minutes: 30 },
          { form: 'offset', minutes: 1440 },
        ],
      })

      const erledigt = await device.repositories.setTaskCompleted(task.id, true)
      const nachfolger = await device.repositories.getTask(erledigt.successor_id!)

      expect(nachfolger?.reminders).toEqual([
        { form: 'offset', minutes: 30 },
        { form: 'offset', minutes: 1440 },
      ])
    })

    it('merkt sich Vorlaufzeiten und gibt sie in Reihenfolge zurück', async () => {
      expect(await device.repositories.listReminderPresets()).toEqual([])

      await device.repositories.setReminderPresets([90, -240, 0])
      expect(await device.repositories.listReminderPresets()).toEqual([90, -240, 0])
    })

    it('sortiert die gemerkten Vorlaufzeiten nicht um', async () => {
      // Die Reihenfolge ist die des Hinzufügens – daran hängt die Anzeige.
      await device.repositories.setReminderPresets([1440, 10])
      await device.repositories.setReminderPresets([1440, 10, 90])
      expect(await device.repositories.listReminderPresets()).toEqual([1440, 10, 90])
    })

    it('verwirft unbrauchbare gemerkte Werte', async () => {
      await device.repositories.setReminderPresets([90, Number.NaN, 99_999_999])
      expect(await device.repositories.listReminderPresets()).toEqual([90])
    })

    it('übersteht eine verbogene Zeile in den Einstellungen', async () => {
      await device.db.meta.put({ key: 'reminder_presets', value: 'kein json' })
      expect(await device.repositories.listReminderPresets()).toEqual([])
    })
  })

  describe('Abschnitte einer Liste', () => {
    it('legt einen Abschnitt an und merkt die Liste als geändert', async () => {
      const list = await device.repositories.createList('Einkauf', userId)
      expect(list.sections).toEqual([])

      device.clock.advance(1000)
      const id = await device.repositories.addListSection(list.id, 'Obst')

      const gespeichert = await device.repositories.getList(list.id)
      expect(gespeichert?.sections).toEqual([{ id, name: 'Obst' }])
      expect(gespeichert?.dirty).toBe(1)
      expect(gespeichert!.updated_at > list.updated_at).toBe(true)
    })

    it('lehnt einen leeren Namen ab', async () => {
      const list = await device.repositories.createList('Einkauf', userId)
      expect(await device.repositories.addListSection(list.id, '   ')).toBeNull()
      expect((await device.repositories.getList(list.id))?.dirty).toBe(1)
    })

    it('benennt einen Abschnitt um', async () => {
      const list = await device.repositories.createList('Einkauf', userId)
      const id = (await device.repositories.addListSection(list.id, 'Obst'))!

      await device.repositories.renameListSection(list.id, id, 'Frisches')

      expect((await device.repositories.getList(list.id))?.sections).toEqual([
        { id, name: 'Frisches' },
      ])
    })

    it('löscht einen Abschnitt und holt seine Aufgaben nach „ohne Bereich"', async () => {
      const list = await device.repositories.createList('Einkauf', userId)
      const obst = (await device.repositories.addListSection(list.id, 'Obst'))!
      const getraenke = (await device.repositories.addListSection(list.id, 'Getränke'))!
      const apfel = await device.repositories.createTask({
        listId: list.id,
        title: 'Äpfel',
        sectionId: obst,
      })
      const saft = await device.repositories.createTask({
        listId: list.id,
        title: 'Saft',
        sectionId: getraenke,
      })

      device.clock.advance(1000)
      await device.repositories.deleteListSection(list.id, obst)

      const gespeichert = await device.repositories.getList(list.id)
      expect(gespeichert?.sections).toEqual([{ id: getraenke, name: 'Getränke' }])

      // Die Aufgabe bleibt, nur ihr Verweis ist weg.
      expect((await device.repositories.getTask(apfel.id))?.section_id).toBeNull()
      expect((await device.repositories.getTask(apfel.id))?.deleted_at).toBeNull()
      expect((await device.repositories.getTask(saft.id))?.section_id).toBe(getraenke)
    })

    it('überträgt den Abschnitt beim Anlegen und beim Bearbeiten', async () => {
      const list = await device.repositories.createList('Einkauf', userId)
      const obst = (await device.repositories.addListSection(list.id, 'Obst'))!
      const task = await device.repositories.createTask({
        listId: list.id,
        title: 'Äpfel',
        sectionId: obst,
      })
      expect(task.section_id).toBe(obst)

      await device.repositories.updateTask(task.id, { sectionId: null })
      expect((await device.repositories.getTask(task.id))?.section_id).toBeNull()
    })

    it('schiebt eine Aufgabe beim Umsortieren in einen anderen Abschnitt', async () => {
      const list = await device.repositories.createList('Einkauf', userId)
      const obst = (await device.repositories.addListSection(list.id, 'Obst'))!
      const a = await device.repositories.createTask({ listId: list.id, title: 'A' })
      const b = await device.repositories.createTask({ listId: list.id, title: 'B' })

      device.clock.advance(1000)
      await device.repositories.reorderTasks(list.id, [b.id, a.id], { [b.id]: obst })

      const nachher = await device.repositories.listTasks(list.id)
      expect(nachher.map((task) => task.title)).toEqual(['B', 'A'])
      expect(nachher[0].section_id).toBe(obst)
      expect(nachher[0].position).toBe(1)
    })

    it('lädt Abschnittsplan und Zugehörigkeit mit dem Abgleich hoch und wieder herunter', async () => {
      const list = await device.repositories.createList('Einkauf', userId)
      const obst = (await device.repositories.addListSection(list.id, 'Obst'))!
      const apfel = await device.repositories.createTask({
        listId: list.id,
        title: 'Äpfel',
        sectionId: obst,
      })

      await device.engine.sync()

      expect(server.listById(list.id)?.sections).toEqual([{ id: obst, name: 'Obst' }])
      expect(server.taskById(apfel.id)?.section_id).toBe(obst)

      // Ein frisches Gerät holt beides wieder herunter.
      const frisch = await createDevice({ userId, gateway: server.gatewayFor(userId) })
      try {
        await frisch.engine.sync()

        const geladen = await frisch.repositories.listLists()
        expect(geladen[0].sections).toEqual([{ id: obst, name: 'Obst' }])

        const aufgaben = await frisch.repositories.listTasks(list.id)
        expect(aufgaben).toHaveLength(1)
        expect(aufgaben[0].section_id).toBe(obst)
      } finally {
        await frisch.dispose()
      }
    })
  })

  describe('Listen', () => {
    it('erstellt eine private Liste', async () => {
      const list = await device.repositories.createList('Privat', userId)
      expect(list.owner_id).toBe(userId)
      expect(list.is_shared).toBe(false)
      expect(list.dirty).toBe(1)
    })

    it('ergänzt den Abschnittsplan bei einer Liste aus alter Zeit', async () => {
      // Zeile aus einer Fassung vor Migration 0013: Das Feld fehlt, und Dexie
      // füllt es nicht nach. Ohne Ergänzung stürzt die Ansicht beim Gruppieren
      // ab – der schwarze Bildschirm nach dem Update.
      const list = await device.repositories.createList('Alt', userId)
      const roh = (await device.db.lists.get(list.id)) as unknown as Record<string, unknown>
      delete roh.sections
      await device.db.lists.put(roh as never)

      expect((await device.repositories.getList(list.id))?.sections).toEqual([])
      expect((await device.repositories.listLists())[0].sections).toEqual([])
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

    it('vergibt eine gültige Position, auch wenn ältere Aufgaben keine haben', async () => {
      // Der gemeldete Fehler: Aus einer fehlenden Position entstand `NaN`, und
      // `NaN` wird beim Senden zu `null`. Der Server lehnt das ab.
      const listId = await newList()
      await device.db.tasks.put({
        id: 'alt',
        list_id: listId,
        section_id: null,
        title: 'Aus alter Zeit',
        description: null,
        due_at: null,
        completed: false,
        completed_at: null,
        recurrence: null,
        successor_id: null,
        reminders: [],
        // Ohne `position` – so sah die Zeile vor Version 0.4.1 aus.
        position: undefined as unknown as number,
        created_at: device.clock.now(),
        updated_at: device.clock.now(),
        deleted_at: null,
        dirty: 0,
      })

      const neu = await device.repositories.createTask({ listId, title: 'Neu' })

      expect(Number.isFinite(neu.position)).toBe(true)
      // Oben, nicht unten: Die Altaufgabe steht auf 0, die neue muss davor.
      expect(neu.position).toBeLessThan(0)
      expect((await device.repositories.listTasks(listId)).map((t) => t.title)).toEqual([
        'Neu',
        'Aus alter Zeit',
      ])
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
