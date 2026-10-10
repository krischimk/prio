import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { toPushPayload } from '../../src/domain/mapping'
import { collectDirty, countDirty, markPushed, META_LAST_SYNC_AT, readMeta, writeMeta } from '../../src/sync/syncStore'
import { createFakeServer } from '../support/fakeGateway'
import { createDevice, createTestUserId, type DeviceHarness } from '../support/harness'
import { readCloudState } from '../../src/db/cloudState'

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

  it('eine ältere Einstellungsbestätigung löscht bei gleicher Millisekunde keine neue Auswahl', async () => {
    const list = await device.repositories.createList('Liste', userId)
    await device.repositories.setListInOverview(list.id, userId, true)
    await device.repositories.updateUserPreferences(userId, { overviewMode: 'newest' })
    const dirty = await collectDirty(device.db)
    const payload = toPushPayload(dirty.lists, dirty.members, dirty.tasks, dirty.preferences, dirty.userPreferences)
    await device.repositories.setListInOverview(list.id, userId, false)
    await device.repositories.updateUserPreferences(userId, { overviewMode: 'by_list' })
    await markPushed(device.db, payload)
    expect(await device.db.list_preferences.get([list.id, userId])).toMatchObject({ include_in_overview: false, dirty: 1 })
    expect(await device.db.user_preferences.get(userId)).toMatchObject({ overview_mode: 'by_list', dirty: 1 })
    const latest = await collectDirty(device.db)
    await markPushed(device.db, toPushPayload(latest.lists, latest.members, latest.tasks, latest.preferences, latest.userPreferences))
    expect(await countDirty(device.db)).toBe(0)
  })

  it('bewahrt die genaue Serverbasis, ohne wegen Zeitformaten einen Upload offen zu lassen', async () => {
    const list = await device.repositories.createList('Liste', userId)
    await device.db.lists.update(list.id, { created_at: '2026-01-01T12:00:00.123Z' })
    const saved = { ...toPushPayload((await collectDirty(device.db)).lists, [], []).lists[0], created_at: '2026-01-01T12:00:00.123456+00:00' }
    await markPushed(device.db, { lists: [saved], members: [], tasks: [] })

    expect((await device.db.lists.get(list.id))?.dirty).toBe(0)
    expect((await readCloudState(device.db, 'lists', list.id)).base?.created_at).toBe(saved.created_at)
  })

  it('bestätigt bei gleichem Zeitstempel keinen inzwischen geänderten Inhalt', async () => {
    const list = await device.repositories.createList('Alt', userId)
    const task = await device.repositories.createTask({ listId: list.id, title: 'Alt' })
    const dirty = await collectDirty(device.db)
    const payload = toPushPayload(dirty.lists, dirty.members, dirty.tasks)
    await device.repositories.updateTask(task.id, { title: 'Neu' })
    await device.repositories.renameList(list.id, 'Neu')
    await markPushed(device.db, payload)
    expect((await device.db.tasks.get(task.id))?.dirty).toBe(1)
    expect((await device.db.lists.get(list.id))?.dirty).toBe(1)
    const latest = await collectDirty(device.db)
    await markPushed(device.db, toPushPayload(latest.lists, latest.members, latest.tasks))
    expect(await countDirty(device.db)).toBe(0)
  })
})
