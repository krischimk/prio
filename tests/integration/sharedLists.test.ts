import { afterEach, describe, expect, it } from 'vitest'
import { createShareListAction } from '../../src/sync/shareList'
import { createFakeServer } from '../support/fakeGateway'
import { createDevice, type DeviceHarness } from '../support/harness'
import { createFixedClock } from '../../src/domain/clock'

/**
 * Gemeinsame Listen (Integration): der komplette Ablauf aus der Aufgabenstellung.
 *
 *   A erstellt eine gemeinsame Liste → A fügt B per E-Mail hinzu →
 *   B sieht die Liste nach dem Sync → B erstellt eine Aufgabe →
 *   A sieht sie nach seinem nächsten Sync.
 */
describe('Gemeinsame Listen', () => {
  const devices: DeviceHarness[] = []

  afterEach(async () => {
    await Promise.all(devices.splice(0).map((device) => device.dispose()))
  })

  async function createPair() {
    const server = createFakeServer()
    const userA = 'user-a'
    const userB = 'user-b'
    server.registerAccount('a@example.com', userA)
    server.registerAccount('b@example.com', userB)

    const deviceA = await createDevice({
      userId: userA,
      gateway: server.gatewayFor(userA),
      clock: createFixedClock(Date.parse('2026-01-01T00:00:00.000Z')),
    })
    const deviceB = await createDevice({
      userId: userB,
      gateway: server.gatewayFor(userB),
      clock: createFixedClock(Date.parse('2026-01-01T00:00:00.000Z')),
    })
    devices.push(deviceA, deviceB)

    const shareFromA = createShareListAction({
      gateway: server.gatewayFor(userA),
      repositories: deviceA.repositories,
      sync: () => deviceA.engine.sync(),
    })

    return { server, userA, userB, deviceA, deviceB, shareFromA }
  }

  it('teilt eine Liste und überträgt Aufgaben in beide Richtungen', async () => {
    const { server, userA, deviceA, deviceB, shareFromA } = await createPair()

    // 1. A erstellt eine Liste und lädt sie hoch.
    const list = await deviceA.repositories.createList('Projekt', userA)
    await deviceA.engine.sync()
    expect(server.listById(list.id)?.name).toBe('Projekt')

    // 2. A teilt die Liste per E-Mail-Adresse.
    await shareFromA(list.id, 'b@example.com')
    await deviceA.engine.sync()

    expect(server.listById(list.id)?.is_shared).toBe(true)
    expect(await deviceA.repositories.listMembers(list.id)).toHaveLength(1)

    // 3. B sieht die Liste nach der Synchronisation.
    await deviceB.engine.sync()
    const listsOnB = await deviceB.repositories.listLists()
    expect(listsOnB.map((row) => row.name)).toEqual(['Projekt'])
    expect(listsOnB[0]?.is_shared).toBe(true)

    // 4. B erstellt eine Aufgabe.
    const taskFromB = await deviceB.repositories.createTask({
      listId: list.id,
      title: 'Aufgabe von B',
    })
    deviceB.clock.advance(1000)
    await deviceB.engine.sync()

    // 5. A sieht die Änderung nach dem nächsten Sync.
    const resultOnA = await deviceA.engine.sync()
    expect(resultOnA.pulled).toBeGreaterThan(0)
    const tasksOnA = await deviceA.repositories.listTasks(list.id)
    expect(tasksOnA.map((row) => row.title)).toEqual(['Aufgabe von B'])

    // B darf die Aufgabe auch wieder erledigen – beide sind gleichberechtigt.
    deviceB.clock.advance(1000)
    await deviceB.repositories.setTaskCompleted(taskFromB.id, true)
    await deviceB.engine.sync()
    await deviceA.engine.sync()
    expect((await deviceA.repositories.getTask(taskFromB.id))?.completed).toBe(true)
  })

  it('entfernt ein Mitglied, das die Liste danach nicht mehr sieht', async () => {
    const { userA, userB, deviceA, deviceB, shareFromA } = await createPair()

    const list = await deviceA.repositories.createList('Projekt', userA)
    await deviceA.engine.sync()
    await shareFromA(list.id, 'b@example.com')
    await deviceA.engine.sync()
    await deviceB.engine.sync()
    expect(await deviceB.repositories.listLists()).toHaveLength(1)

    // A entfernt B.
    deviceA.clock.advance(60_000)
    await deviceA.repositories.removeMember(list.id, userB)
    await deviceA.engine.sync()

    // B erfährt davon über seine eigene (soft-gelöschte) Mitgliedschaftszeile.
    deviceB.clock.advance(60_000)
    await deviceB.engine.sync()

    expect(await deviceB.repositories.listLists()).toHaveLength(0)
    expect(await deviceB.repositories.listTasks(list.id)).toHaveLength(0)
    // Die fremde Liste wird vollständig entfernt – sie gehört B nicht.
    expect(await deviceB.db.lists.get(list.id)).toBeUndefined()

    // A behält alles.
    expect(await deviceA.repositories.listLists()).toHaveLength(1)
  })

  it('weist eine unberechtigte Änderung an einer fremden Liste zurück, ohne A zu beschädigen', async () => {
    const { userA, deviceA, deviceB, shareFromA } = await createPair()

    const list = await deviceA.repositories.createList('Projekt', userA)
    await deviceA.engine.sync()
    await shareFromA(list.id, 'b@example.com')
    await deviceA.engine.sync()
    await deviceB.engine.sync()

    // B versucht, die Liste umzubenennen. Der Besitzer bleibt A.
    deviceB.clock.advance(60_000)
    await deviceB.repositories.renameList(list.id, 'Umbenannt von B')
    const resultOnB = await deviceB.engine.sync()

    expect(resultOnB.kind).toBe('partial')
    expect(resultOnB.pushed).toBe(0)

    // A ist unbeeinflusst und erhält keine Änderung.
    await deviceA.engine.sync()
    expect((await deviceA.repositories.getList(list.id))?.name).toBe('Projekt')
  })

  it('lehnt das Teilen an eine unbekannte E-Mail-Adresse verständlich ab', async () => {
    const { userA, deviceA, shareFromA } = await createPair()
    const list = await deviceA.repositories.createList('Projekt', userA)
    await deviceA.engine.sync()

    await expect(shareFromA(list.id, 'niemand@example.com')).rejects.toThrow(/keinen registrierten Nutzer/)
    expect(await deviceA.repositories.listMembers(list.id)).toHaveLength(0)
  })

  it('teilt eine Liste nicht erneut an den Besitzer selbst', async () => {
    const { userA, deviceA, shareFromA } = await createPair()
    const list = await deviceA.repositories.createList('Projekt', userA)
    await deviceA.engine.sync()

    await expect(shareFromA(list.id, 'a@example.com')).rejects.toThrow(/bereits Besitzer/)
  })
})
