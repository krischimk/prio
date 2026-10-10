import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createFakeServer } from '../support/fakeGateway'
import { createDevice, type DeviceHarness } from '../support/harness'
import { LocalDatabase } from '../../src/db/localDb'
import { localList, localTask } from '../support/factories'

describe('Persönliche Listenauswahl', () => {
  let device: DeviceHarness
  beforeEach(async () => { device = await createDevice({ userId: 'owner', gateway: createFakeServer().gatewayFor('owner') }) })
  afterEach(async () => { await device.dispose() })

  it('aktiviert neue Listen erst ausdrücklich und erzeugt für den Default keinen Upload', async () => {
    const list = await device.repositories.createList('Liste', 'owner')
    expect(await device.repositories.listListPreferences('owner')).toEqual([])
    await device.repositories.setListInOverview(list.id, 'owner', false)
    expect(await device.db.list_preferences.count()).toBe(0)
    await device.repositories.setListInOverview(list.id, 'owner', true)
    expect(await device.repositories.listListPreferences('owner')).toEqual([expect.objectContaining({ list_id: list.id, user_id: 'owner', include_in_overview: true, dirty: 1 })])
    expect((await device.repositories.getList(list.id))?.updated_at).toBe(list.updated_at)
  })

  it('trennt die Auswahl verschiedener Benutzer auch bei derselben Liste', async () => {
    const list = await device.repositories.createList('Geteilt', 'owner')
    await device.repositories.setListInOverview(list.id, 'owner', true)
    await device.repositories.setListInOverview(list.id, 'member', true)
    await device.repositories.setListInOverview(list.id, 'member', false)
    expect(await device.repositories.listListPreferences('owner')).toEqual([expect.objectContaining({ include_in_overview: true })])
    expect(await device.repositories.listListPreferences('member')).toEqual([expect.objectContaining({ include_in_overview: false })])
  })

  it('verliert bei gleichzeitiger Auswahl mehrerer Listen keine Änderung', async () => {
    const lists = await Promise.all(['A', 'B'].map(name => device.repositories.createList(name, 'owner')))
    await Promise.all(lists.map(list => device.repositories.setListInOverview(list.id, 'owner', true)))
    expect(await device.repositories.listListPreferences('owner')).toHaveLength(2)
    const first = (await device.repositories.listListPreferences('owner'))[0]
    await device.db.list_preferences.update([first.list_id, 'owner'], { dirty: 0 })
    device.clock.advance(1000)
    await device.repositories.setListInOverview(first.list_id, 'owner', true)
    expect(await device.db.list_preferences.get([first.list_id, 'owner'])).toMatchObject({ dirty: 0, updated_at: first.updated_at })
  })

  it('übernimmt die bisherige Datenbank ohne automatisches Aktivieren oder Datenverlust', async () => {
    const name = `prio-preference-upgrade-${crypto.randomUUID()}`
    const old = new Dexie(name)
    old.version(7).stores({
      lists: 'id, owner_id, updated_at, dirty, deleted_at',
      list_members: '[list_id+user_id], list_id, user_id, updated_at, dirty',
      tasks: 'id, list_id, updated_at, dirty, completed_at, deleted_at',
      meta: 'key', reminders: '[taskId+at], taskId, notificationId, at',
    })
    await old.table('lists').put(localList())
    await old.table('tasks').put(localTask())
    old.close()
    const upgraded = new LocalDatabase(name)
    try {
      await upgraded.open()
      expect(await upgraded.list_preferences.count()).toBe(0)
      expect(await upgraded.tasks.get('task-1')).toEqual(localTask())
      expect(await upgraded.lists.get('list-1')).toEqual(localList())
    } finally { await upgraded.delete() }
  })

  it('setzt keine Standardliste beim Anlegen und behält unabhängige persönliche Änderungen', async () => {
    const list = await device.repositories.createList('Liste', 'owner')
    expect(await device.repositories.getUserPreferences('owner')).toBeUndefined()
    await Promise.all([
      device.repositories.updateUserPreferences('owner', { defaultListId: list.id }),
      device.repositories.updateUserPreferences('owner', { overviewMode: 'newest' }),
    ])
    expect(await device.repositories.getUserPreferences('owner')).toMatchObject({ default_list_id: list.id, overview_mode: 'newest', dirty: 1 })
    await device.repositories.updateUserPreferences('owner', { defaultListId: null })
    expect(await device.repositories.getUserPreferences('owner')).toMatchObject({ default_list_id: null, overview_mode: 'newest' })
  })

  it('weist unbekannte Modi und nicht verfügbare Standardlisten ohne Teiländerung zurück', async () => {
    await device.repositories.updateUserPreferences('owner', { overviewMode: 'newest' })
    await expect(device.repositories.updateUserPreferences('owner', { defaultListId: 'missing', overviewMode: 'by_list' })).rejects.toThrow()
    await expect(device.repositories.updateUserPreferences('owner', { overviewMode: 'wrong' as never })).rejects.toThrow()
    expect(await device.repositories.getUserPreferences('owner')).toMatchObject({ default_list_id: null, overview_mode: 'newest' })
  })
})
