import { afterEach, describe, expect, it } from 'vitest'
import { createFixedClock } from '../../src/domain/clock'
import { createFakeServer } from '../support/fakeGateway'
import { createDevice, type DeviceHarness } from '../support/harness'

/**
 * Mehrere Geräte desselben Kontos (Integration).
 *
 * Ablauf aus der Aufgabenstellung:
 *   1./2. Gerät A meldet sich an und erstellt eine Aufgabe.
 *   3.    Die Aufgabe wird synchronisiert.
 *   4./5. Gerät B meldet sich an und sieht die Aufgabe.
 *   6./7. Gerät B bearbeitet sie und synchronisiert.
 *   8.    Gerät A erhält die Änderung beim nächsten Sync.
 *
 * Beide Geräte haben eine eigene lokale Datenbank, teilen aber den Server.
 */
describe('Mehrere Geräte', () => {
  const devices: DeviceHarness[] = []

  afterEach(async () => {
    await Promise.all(devices.splice(0).map((device) => device.dispose()))
  })

  it('überträgt eine Aufgabe von Gerät A zu Gerät B und die Bearbeitung zurück', async () => {
    const server = createFakeServer()
    const userId = 'user-gemeinsam'

    const deviceA = await createDevice({
      userId,
      gateway: server.gatewayFor(userId),
      clock: createFixedClock(Date.parse('2026-01-01T00:00:00.000Z')),
    })
    const deviceB = await createDevice({
      userId,
      gateway: server.gatewayFor(userId),
      clock: createFixedClock(Date.parse('2026-01-01T00:30:00.000Z')),
    })
    devices.push(deviceA, deviceB)

    // 1./2. A erstellt Liste und Aufgabe.
    const list = await deviceA.repositories.createList('Meine Liste', userId)
    const task = await deviceA.repositories.createTask({ listId: list.id, title: 'Aufgabe von A' })

    // 3. A synchronisiert.
    expect((await deviceA.engine.sync()).kind).toBe('ok')

    // 4./5. B synchronisiert und sieht die Aufgabe.
    await deviceB.engine.sync()
    expect(await deviceB.repositories.listLists()).toHaveLength(1)
    const tasksOnB = await deviceB.repositories.listTasks(list.id)
    expect(tasksOnB.map((row) => row.title)).toEqual(['Aufgabe von A'])

    // 6./7. B bearbeitet und synchronisiert.
    deviceB.clock.advance(60_000)
    await deviceB.repositories.updateTask(task.id, { title: 'Von B bearbeitet', description: 'Notiz von B' })
    expect((await deviceB.engine.sync()).kind).toBe('ok')

    // 8. A erhält die Änderung beim nächsten Sync.
    const resultOnA = await deviceA.engine.sync()
    expect(resultOnA.kind).toBe('ok')
    const taskOnA = await deviceA.repositories.getTask(task.id)
    expect(taskOnA?.title).toBe('Von B bearbeitet')
    expect(taskOnA?.description).toBe('Notiz von B')
  })

  it('übernimmt die Serverversion, wenn beide Geräte dieselbe Aufgabe geändert haben', async () => {
    const server = createFakeServer()
    const userId = 'user-konflikt'

    const deviceA = await createDevice({
      userId,
      gateway: server.gatewayFor(userId),
      clock: createFixedClock(Date.parse('2026-01-01T00:00:00.000Z')),
    })
    const deviceB = await createDevice({
      userId,
      gateway: server.gatewayFor(userId),
      clock: createFixedClock(Date.parse('2026-01-01T00:00:00.000Z')),
    })
    devices.push(deviceA, deviceB)

    const list = await deviceA.repositories.createList('Meine Liste', userId)
    const task = await deviceA.repositories.createTask({ listId: list.id, title: 'Ausgangslage' })
    await deviceA.engine.sync()
    await deviceB.engine.sync()

    // B ändert zuerst …
    deviceB.clock.advance(60_000)
    await deviceB.repositories.updateTask(task.id, { title: 'B war zuerst' })
    await deviceB.engine.sync()

    // … A ändert danach, kennt Bs Version aber noch nicht.
    deviceA.clock.advance(120_000)
    await deviceA.repositories.updateTask(task.id, { title: 'A war später' })
    await deviceA.engine.sync()

    // B holt sich die neuere Version von A.
    await deviceB.engine.sync()
    expect((await deviceB.repositories.getTask(task.id))?.title).toBe('A war später')

    // Last Write Wins: Nur eine der beiden Änderungen überlebt – bewusste
    // Vereinfachung für Version 0.1, siehe src/domain/merge.ts.
    expect(server.taskById(task.id)?.title).toBe('A war später')
  })

  it('überträgt Löschungen zwischen Geräten', async () => {
    const server = createFakeServer()
    const userId = 'user-loeschung'

    const deviceA = await createDevice({
      userId,
      gateway: server.gatewayFor(userId),
      clock: createFixedClock(Date.parse('2026-01-01T00:00:00.000Z')),
    })
    const deviceB = await createDevice({
      userId,
      gateway: server.gatewayFor(userId),
      clock: createFixedClock(Date.parse('2026-01-01T00:00:00.000Z')),
    })
    devices.push(deviceA, deviceB)

    const list = await deviceA.repositories.createList('Meine Liste', userId)
    const task = await deviceA.repositories.createTask({ listId: list.id, title: 'Wird gelöscht' })
    await deviceA.engine.sync()
    await deviceB.engine.sync()
    expect(await deviceB.repositories.listTasks(list.id)).toHaveLength(1)

    deviceA.clock.advance(60_000)
    await deviceA.repositories.deleteTask(task.id)
    await deviceA.engine.sync()

    deviceB.clock.advance(60_000)
    await deviceB.engine.sync()
    expect(await deviceB.repositories.listTasks(list.id)).toHaveLength(0)
  })
})
