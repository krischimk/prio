import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { toPushPayload } from '../../src/domain/mapping'
import { collectDirty, countDirty, markPushed, META_LAST_SYNC_AT, readMeta, writeMeta } from '../../src/sync/syncStore'
import { createFakeServer } from '../support/fakeGateway'
import { createDevice, createTestUserId, type DeviceHarness } from '../support/harness'

/**
 * Lokale Sync-Einträge (unit).
 *
 * Die "Queue" ist das `dirty`-Flag an der Zeile. Getestet wird, dass Einträge
 * entstehen, gezählt und nach erfolgreichem Upload wieder entfernt werden –
 * ohne dabei Änderungen zu verlieren, die währenddessen passiert sind.
 */
describe('Sync-Queue (dirty-Flags)', () => {
  let device: DeviceHarness
  const userId = createTestUserId('queue')

  beforeEach(async () => {
    device = await createDevice({ userId, gateway: createFakeServer().gatewayFor(userId) })
  })

  afterEach(async () => {
    await device.dispose()
  })

  it('meldet neue Datensätze als offene Sync-Einträge', async () => {
    expect(await countDirty(device.db)).toBe(0)

    const list = await device.repositories.createList('Liste', userId)
    const task = await device.repositories.createTask({ listId: list.id, title: 'Aufgabe' })

    const dirty = await collectDirty(device.db)
    expect(dirty.lists.map((row) => row.id)).toEqual([list.id])
    expect(dirty.tasks.map((row) => row.id)).toEqual([task.id])
    expect(await countDirty(device.db)).toBe(2)
  })

  it('erzeugt beim erneuten Bearbeiten keinen zweiten Eintrag', async () => {
    const list = await device.repositories.createList('Liste', userId)
    const task = await device.repositories.createTask({ listId: list.id, title: 'Erst' })

    device.clock.advance(1000)
    await device.repositories.updateTask(task.id, { title: 'Dann' })
    device.clock.advance(1000)
    await device.repositories.updateTask(task.id, { title: 'Zuletzt' })

    const dirty = await collectDirty(device.db)
    expect(dirty.tasks).toHaveLength(1)
    expect(dirty.tasks[0]?.title).toBe('Zuletzt')
  })

  it('bereinigt den Eintrag nach erfolgreichem Upload', async () => {
    const list = await device.repositories.createList('Liste', userId)
    await device.repositories.createTask({ listId: list.id, title: 'Aufgabe' })

    const result = await device.engine.sync()

    expect(result.kind).toBe('ok')
    expect(result.pushed).toBe(2)
    expect(await countDirty(device.db)).toBe(0)
  })

  it('lässt eine Änderung schmutzig, die während des Uploads passiert ist', async () => {
    const list = await device.repositories.createList('Liste', userId)
    const task = await device.repositories.createTask({ listId: list.id, title: 'Ursprünglich' })

    // Zustand simulieren, der gerade hochgeladen wird …
    const dirty = await collectDirty(device.db)
    const payload = toPushPayload(dirty.lists, dirty.members, dirty.tasks)

    // … und währenddessen lokal weiterbearbeiten.
    device.clock.advance(1000)
    await device.db.tasks.put({
      ...task,
      title: 'Zwischenzeitlich geändert',
      updated_at: device.clock.now(),
      dirty: 1,
    })

    await markPushed(device.db, payload)

    const stored = await device.db.tasks.get(task.id)
    expect(stored?.dirty).toBe(1)
    expect(stored?.title).toBe('Zwischenzeitlich geändert')
  })

  it('speichert und liest den Zeitpunkt des letzten Syncs', async () => {
    expect(await readMeta(device.db, META_LAST_SYNC_AT)).toBeNull()
    await writeMeta(device.db, META_LAST_SYNC_AT, device.clock.now())
    expect(await readMeta(device.db, META_LAST_SYNC_AT)).toBe(device.clock.now())
  })
})
