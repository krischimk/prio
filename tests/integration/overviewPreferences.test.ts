import { afterEach, describe, expect, it } from 'vitest'
import { createFakeServer } from '../support/fakeGateway'
import { createDevice, type DeviceHarness } from '../support/harness'
import { countDirty } from '../../src/sync/syncStore'

const devices: DeviceHarness[] = []
afterEach(async () => { await Promise.all(devices.splice(0).map(device => device.dispose())) })

async function pair() {
  const server = createFakeServer()
  const a = await createDevice({ userId: 'owner', gateway: server.gatewayFor('owner') })
  const b = await createDevice({ userId: 'owner', gateway: server.gatewayFor('owner') })
  devices.push(a, b)
  const list = await a.repositories.createList('Liste', 'owner')
  await a.engine.sync(); await b.engine.sync()
  return { server, a, b, list }
}

describe('Persönliche Gesamtansicht auf mehreren Geräten', () => {
  it('überträgt die gewählte Ansicht, die manuelle Standardliste und die Aufnahme', async () => {
    const { a, b, list } = await pair()
    await a.repositories.setListInOverview(list.id, 'owner', true)
    await a.repositories.updateUserPreferences('owner', { overviewMode: 'newest', defaultListId: list.id })
    await a.engine.sync(); await b.engine.sync()
    expect(await b.repositories.getUserPreferences('owner')).toMatchObject({ overview_mode: 'newest', default_list_id: list.id, dirty: 0 })
    expect(await b.repositories.listListPreferences('owner')).toEqual([expect.objectContaining({ include_in_overview: true, dirty: 0 })])
    expect(await countDirty(a.db)).toBe(0)
    // Auch erneutes Öffnen derselben Datenbank verwendet den gespeicherten Modus.
    b.db.close(); await b.db.open()
    expect((await b.repositories.getUserPreferences('owner'))?.overview_mode).toBe('newest')
  })

  it('führt Änderungen am Modus und an der Standardliste zusammen', async () => {
    const { a, b, list } = await pair()
    await a.repositories.updateUserPreferences('owner', { overviewMode: 'newest' })
    await a.engine.sync(); await b.engine.sync()
    await b.repositories.updateUserPreferences('owner', { defaultListId: list.id })
    await b.engine.sync()
    await a.repositories.updateUserPreferences('owner', { overviewMode: 'by_list' })
    await a.engine.sync(); await b.engine.sync()
    expect(await a.repositories.listCloudConflicts()).toEqual([])
    expect(await b.repositories.getUserPreferences('owner')).toMatchObject({ overview_mode: 'by_list', default_list_id: list.id, dirty: 0 })
  })

  it('trennt Besitzer- und Mitgliedsauswahl und gibt fremde Einstellungen nicht heraus', async () => {
    const { server, a, list } = await pair()
    server.registerAccount('member@prio.test', 'member')
    await server.gatewayFor('owner').shareListByEmail(list.id, 'member@prio.test')
    const member = await createDevice({ userId: 'member', gateway: server.gatewayFor('member') })
    devices.push(member)
    await member.engine.sync()
    await member.repositories.setListInOverview(list.id, 'member', true)
    await member.repositories.updateUserPreferences('member', { overviewMode: 'newest' })
    await member.engine.sync(); await a.engine.sync()
    expect(await a.repositories.listListPreferences('owner')).toEqual([])
    expect(await a.repositories.getUserPreferences('owner')).toBeUndefined()
    expect(await a.db.user_preferences.get('member')).toBeUndefined()
    expect(await a.db.list_preferences.get([list.id, 'member'])).toBeUndefined()
    const forged = server.preferences.get(`${list.id}:member`)!
    const result = await server.gatewayFor('owner').push({ lists: [], members: [], tasks: [], preferences: [{ ...forged, include_in_overview: false }] })
    expect(result.fehler).toHaveLength(1)
    expect(server.preferences.get(`${list.id}:member`)?.include_in_overview).toBe(true)
  })

  it('verliert konkurrierende Standardlisten nicht und klärt sie ohne Zurücksetzen der Ansicht', async () => {
    const { a, b, list } = await pair()
    const second = await a.repositories.createList('Andere Liste', 'owner')
    await a.repositories.updateUserPreferences('owner', { overviewMode: 'newest' })
    await a.engine.sync(); await b.engine.sync()
    await b.repositories.updateUserPreferences('owner', { defaultListId: list.id })
    await b.engine.sync()
    await a.repositories.updateUserPreferences('owner', { defaultListId: second.id })
    await a.engine.sync()
    const [conflict] = await a.repositories.listCloudConflicts()
    expect(conflict).toMatchObject({ table: 'userPreferences', fields: ['default_list_id'] })
    expect(await a.repositories.getUserPreferences('owner')).toMatchObject({ default_list_id: second.id, overview_mode: 'newest' })
    await a.repositories.resolveCloudConflict(conflict, 'remote')
    await a.engine.sync()
    expect(await a.repositories.getUserPreferences('owner')).toMatchObject({ default_list_id: list.id, overview_mode: 'newest', dirty: 0 })
  })
})
