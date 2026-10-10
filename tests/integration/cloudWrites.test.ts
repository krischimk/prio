import { afterEach, describe, expect, it } from 'vitest'
import { createFakeServer } from '../support/fakeGateway'
import { createDevice, createTestUserId, type DeviceHarness } from '../support/harness'
import { RemoteError } from '../../src/sync/remoteGateway'
import { countAbgelehnt, countDirty } from '../../src/sync/syncStore'

const devices: DeviceHarness[] = []
afterEach(async () => { await Promise.all(devices.splice(0).map(device => device.dispose())) })

async function pair() {
  const server = createFakeServer()
  const userId = createTestUserId('cloud-writes')
  const a = await createDevice({ userId, gateway: server.gatewayFor(userId) })
  const b = await createDevice({ userId, gateway: server.gatewayFor(userId) })
  devices.push(a, b)
  const list = await a.repositories.createList('Liste', userId)
  const task = await a.repositories.createTask({ listId: list.id, title: 'Anfang' })
  await a.engine.sync()
  await b.engine.sync()
  return { server, a, b, list, task }
}

describe('Geschützte Cloud-Schreibvorgänge', () => {
  it('legt vorübergehende Serverfehler auch nach mehreren Versuchen nicht beiseite', async () => {
    const { server, a, task } = await pair()
    await a.repositories.updateTask(task.id, { title: 'Noch zu übertragen' })
    server.failPushWith = new RemoteError('server', 'Dienst vorübergehend nicht verfügbar.', { retryable: true })
    for (let attempt = 0; attempt < 4; attempt += 1) await a.engine.sync()
    expect(await countAbgelehnt(a.db)).toBe(0)
    expect(await countDirty(a.db)).toBe(1)

    server.failPushWith = null
    await a.engine.sync()
    expect(server.taskById(task.id)?.title).toBe('Noch zu übertragen')
  })

  it.each([0, 120_000])('überschreibt keinen inzwischen geänderten Titel, auch mit Uhrversatz %i', async offset => {
    const { server, a, b, task } = await pair()
    await b.repositories.updateTask(task.id, { title: 'Bereits in der Cloud' })
    await b.engine.sync()
    a.clock.advance(offset)
    await a.repositories.updateTask(task.id, { title: 'Meine Offline-Eingabe' })
    await a.engine.sync()
    expect(server.taskById(task.id)?.title).toBe('Bereits in der Cloud')
    expect((await a.repositories.getTask(task.id))?.title).toBe('Meine Offline-Eingabe')
  })

  it('führt unabhängige Felder aus zwei Geräten zusammen', async () => {
    const { server, a, b, task } = await pair()
    await b.repositories.updateTask(task.id, { description: 'Cloud-Notiz' })
    await b.engine.sync()
    a.clock.advance(120_000)
    await a.repositories.updateTask(task.id, { title: 'Mein Titel' })
    await a.engine.sync()
    expect(server.taskById(task.id)).toMatchObject({ title: 'Mein Titel', description: 'Cloud-Notiz' })
    expect((await a.repositories.getTask(task.id))?.dirty).toBe(0)
  })

  it('übernimmt auf einem sauberen Gerät den Cloud-Stand auch bei identischen Zeitstempeln', async () => {
    const { a, b, task } = await pair()
    await b.repositories.updateTask(task.id, { title: 'Gleiche Millisekunde' })
    await b.engine.sync()
    await a.engine.sync()
    expect((await a.repositories.getTask(task.id))?.title).toBe('Gleiche Millisekunde')
  })

  it.each(['remote','local'] as const)('klärt einen Titelkonflikt ausdrücklich mit %s und behält andere Cloud-Felder',async choice=>{
    const {server,a,b,task}=await pair()
    await b.repositories.updateTask(task.id,{title:'Cloud',description:'Notiz'})
    await b.engine.sync()
    await a.repositories.updateTask(task.id,{title:'Lokal'})
    expect((await a.engine.sync()).kind).toBe('conflict')
    const [conflict]=await a.repositories.listCloudConflicts()
    const calls=server.pushCalls
    await a.engine.sync()
    expect(server.pushCalls).toBe(calls)
    await a.repositories.resolveCloudConflict(conflict,choice)
    await a.engine.sync()
    expect(server.taskById(task.id)).toMatchObject({title:choice==='local'?'Lokal':'Cloud',description:'Notiz'})
    expect(await a.repositories.listCloudConflicts()).toEqual([])
  })

  it('eine alte Konfliktentscheidung verwirft keine danach neu eingegebenen Werte',async()=>{
    const {a,b,task}=await pair()
    await b.repositories.updateTask(task.id,{title:'Cloud'})
    await b.engine.sync()
    await a.repositories.updateTask(task.id,{title:'Lokal'})
    await a.engine.sync()
    const [conflict]=await a.repositories.listCloudConflicts()
    await a.repositories.updateTask(task.id,{title:'Noch neuer'})
    await expect(a.repositories.resolveCloudConflict(conflict,'remote')).rejects.toThrow('erneut geändert')
    expect((await a.repositories.getTask(task.id))?.title).toBe('Noch neuer')
  })

  it('Bestandsdaten ohne bestätigte Basis überschreiben die Cloud nicht',async()=>{
    const {server,a,b,task}=await pair()
    await a.db.meta.where('key').startsWith('cloud-row:').delete()
    await b.repositories.updateTask(task.id,{title:'Cloud'})
    await b.engine.sync()
    await a.repositories.updateTask(task.id,{title:'Alte Offline-Eingabe'})
    await a.engine.sync()
    expect(server.taskById(task.id)?.title).toBe('Cloud')
    expect((await a.repositories.listCloudConflicts())[0].fields).toEqual(['unknown-base'])
  })

  it('prüft alte quarantänisierte Offline-Eingaben nach dem Update wieder sicher', async () => {
    const { server, a, b, task } = await pair()
    await a.db.meta.where('key').startsWith('cloud-row:').delete()
    await b.repositories.updateTask(task.id, { title: 'Cloud' })
    await b.engine.sync()
    await a.repositories.updateTask(task.id, { title: 'Alte Offline-Eingabe' })
    const local = await a.repositories.getTask(task.id)
    await a.db.meta.put({ key: 'rejected_rows', value: JSON.stringify([{
      tabelle: 'tasks', id: task.id, updated_at: local!.updated_at,
      versuche: 3, message: 'Alte App-Schreibrechte gesperrt.', at: local!.updated_at,
    }]) })
    const calls = server.pushCalls

    expect((await a.engine.sync()).kind).toBe('conflict')
    expect(server.pushCalls).toBeGreaterThan(calls)
    expect(server.taskById(task.id)?.title).toBe('Cloud')
    expect((await a.repositories.getTask(task.id))?.title).toBe('Alte Offline-Eingabe')
    expect((await a.repositories.listCloudConflicts())[0].fields).toEqual(['unknown-base'])
    const [conflict] = await a.repositories.listCloudConflicts()
    await a.repositories.resolveCloudConflict(conflict, 'remote')
    await a.engine.sync()
    expect(await countAbgelehnt(a.db)).toBe(0)
  })
})
