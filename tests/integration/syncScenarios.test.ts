import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RemoteError } from '../../src/sync/remoteGateway'
import { collectDirty, countDirty } from '../../src/sync/syncStore'
import { createFakeServer, type FakeServer } from '../support/fakeGateway'
import { createDevice, createTestUserId, type DeviceHarness } from '../support/harness'
import { T2 } from '../support/factories'

/**
 * Offline-/Sync-Szenarien aus der Aufgabenstellung (Integration).
 *
 * Getestet wird die echte Sync-Engine gegen echtes Dexie (fake-indexeddb) und
 * einen In-Memory-Server. Es läuft kein React und keine Cloud.
 */
describe('Sync-Szenarien', () => {
  let server: FakeServer
  let device: DeviceHarness
  let online: boolean
  const userId = createTestUserId('szenario')

  beforeEach(async () => {
    server = createFakeServer()
    online = true
    device = await createDevice({
      userId,
      gateway: server.gatewayFor(userId),
      isOnline: () => online,
    })
  })

  afterEach(async () => {
    await device.dispose()
  })

  it('Szenario 1: offline erstellte Aufgabe existiert lokal und steht in der Queue', async () => {
    online = false
    const list = await device.repositories.createList('Privat', userId)
    const task = await device.repositories.createTask({ listId: list.id, title: 'Offline erstellt' })

    const result = await device.engine.sync()

    expect(result.kind).toBe('offline')
    expect(result.message).toBe('Offline – Änderungen werden später synchronisiert.')

    const localTasks = await device.repositories.listTasks(list.id)
    expect(localTasks.map((row) => row.title)).toEqual(['Offline erstellt'])

    const dirty = await collectDirty(device.db)
    expect(dirty.tasks.map((row) => row.id)).toEqual([task.id])
    expect(dirty.lists.map((row) => row.id)).toEqual([list.id])

    // Ohne Verbindung wird der Server gar nicht erst kontaktiert.
    expect(server.pullCalls).toBe(0)
    expect(server.pushCalls).toBe(0)
  })

  it('Szenario 2: sobald das Gerät online ist, wird hochgeladen und die Queue bereinigt', async () => {
    online = false
    const list = await device.repositories.createList('Privat', userId)
    const task = await device.repositories.createTask({ listId: list.id, title: 'Offline erstellt' })
    await device.engine.sync()

    online = true
    const result = await device.engine.sync()

    expect(result.kind).toBe('ok')
    expect(result.pushed).toBe(2)
    expect(server.taskById(task.id)?.title).toBe('Offline erstellt')
    expect(server.listById(list.id)?.name).toBe('Privat')
    expect(await countDirty(device.db)).toBe(0)
  })

  it('Szenario 3: nicht erreichbarer Server verursacht keinen Datenverlust', async () => {
    const list = await device.repositories.createList('Privat', userId)
    const task = await device.repositories.createTask({ listId: list.id, title: 'Bleibt erhalten' })
    await device.engine.sync()

    device.clock.advance(1000)
    await device.repositories.updateTask(task.id, { title: 'Neuer Titel' })

    // Push schlägt fehl, obwohl das Gerät "online" glaubt (z. B. pausiertes Projekt).
    server.failPushWith = new RemoteError('offline', 'Netzwerk nicht erreichbar.')
    const failed = await device.engine.sync()
    expect(failed.kind).toBe('offline')
    expect(await countDirty(device.db)).toBe(1)

    // Lokale Änderung ist unverändert vorhanden.
    expect((await device.repositories.getTask(task.id))?.title).toBe('Neuer Titel')

    // Späterer Versuch klappt.
    server.failPushWith = null
    const retried = await device.engine.sync()
    expect(retried.kind).toBe('ok')
    expect(server.taskById(task.id)?.title).toBe('Neuer Titel')
    expect(await countDirty(device.db)).toBe(0)
  })

  it('Szenario 4: eine neuere Serverversion gewinnt', async () => {
    const list = await device.repositories.createList('Privat', userId)
    const task = await device.repositories.createTask({ listId: list.id, title: 'Alte Fassung' })
    await device.engine.sync()

    // Anderes Gerät hat die Aufgabe später bearbeitet.
    const remote = server.taskById(task.id)
    expect(remote).toBeDefined()
    server.tasks.set(task.id, { ...remote!, title: 'Neue Fassung vom Server', updated_at: T2 })

    const result = await device.engine.sync()

    expect(result.kind).toBe('ok')
    expect((await device.repositories.getTask(task.id))?.title).toBe('Neue Fassung vom Server')
    expect(await countDirty(device.db)).toBe(0)
  })

  it('Szenario 5: eine neuere lokale Version wird hochgeladen', async () => {
    const list = await device.repositories.createList('Privat', userId)
    const task = await device.repositories.createTask({ listId: list.id, title: 'Alte Fassung' })
    await device.engine.sync()

    device.clock.advance(60_000)
    await device.repositories.updateTask(task.id, { title: 'Lokal neuer' })

    const result = await device.engine.sync()

    expect(result.kind).toBe('ok')
    expect(server.taskById(task.id)?.title).toBe('Lokal neuer')
    expect(await countDirty(device.db)).toBe(0)
  })

  it('Szenario 6: offline gelöschte Aufgabe wird als Soft Delete synchronisiert', async () => {
    const list = await device.repositories.createList('Privat', userId)
    const task = await device.repositories.createTask({ listId: list.id, title: 'Wird gelöscht' })
    await device.engine.sync()

    online = false
    device.clock.advance(60_000)
    await device.repositories.deleteTask(task.id)

    // Lokal: Soft Delete, kein Hard Delete.
    const stored = await device.db.tasks.get(task.id)
    expect(stored).toBeDefined()
    expect(stored?.deleted_at).toBe(device.clock.now())
    expect(await device.repositories.listTasks(list.id)).toHaveLength(0)

    online = true
    await device.engine.sync()

    expect(server.taskById(task.id)?.deleted_at).toBe(device.clock.now())
    expect(await countDirty(device.db)).toBe(0)
  })

  it('lädt lokale Änderungen auch dann herunter, wenn der Upload scheitert', async () => {
    await device.repositories.createList('Privat', userId)

    // Server lehnt das Schreiben ab (z. B. RLS), Lesen funktioniert weiter.
    server.failPushWith = new RemoteError('server', 'Kein Zugriff.')
    const remoteList = {
      id: 'fremde-liste',
      owner_id: userId,
      name: 'Vom Server',
      is_shared: false,
      created_at: T2,
      updated_at: T2,
      deleted_at: null,
    }
    server.lists.set(remoteList.id, remoteList)

    const result = await device.engine.sync()

    expect(result.kind).toBe('partial')
    expect((await device.repositories.getList('fremde-liste'))?.name).toBe('Vom Server')
    // Die abgelehnte lokale Änderung bleibt in der Queue.
    expect(await countDirty(device.db)).toBe(1)
  })
})
