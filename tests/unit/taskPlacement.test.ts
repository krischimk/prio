import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { taskLocation } from '../../src/domain/taskPlacement'
import { createFakeServer } from '../support/fakeGateway'
import { createDevice, type DeviceHarness } from '../support/harness'

describe('Aufgabe atomar an einer Nachbarschaft platzieren', () => {
  let device: DeviceHarness
  beforeEach(async () => {
    device = await createDevice({ userId: 'placement', gateway: createFakeServer().gatewayFor('placement') })
  })
  afterEach(async () => device.dispose())
  async function setup() {
    const source = await device.repositories.createList('Quelle', 'placement')
    const target = await device.repositories.createList('Ziel', 'placement')
    const sectionId = (await device.repositories.addListSection(target.id, 'Bereich'))!
    const task = await device.repositories.createTask({ listId: source.id, title: 'Bewegen', description: 'Notiz' })
    const last = await device.repositories.createTask({ listId: target.id, title: 'C', sectionId })
    const first = await device.repositories.createTask({ listId: target.id, title: 'A', sectionId })
    return { source, target, sectionId, task, first, last }
  }

  it('wechselt Liste und Bereich und fügt vor dem gewählten Nachbarn ein', async () => {
    const { source, target, sectionId, task, first, last } = await setup()
    await device.engine.sync()
    device.clock.advance(1000)
    const moved = await device.repositories.placeTask(task.id, { listId: target.id, sectionId, beforeTaskId: last.id, expected: taskLocation(task) })
    expect(moved).toMatchObject({ list_id: target.id, section_id: sectionId, description: 'Notiz', created_at: task.created_at, dirty: 1, updated_at: device.clock.now() })
    expect((await device.repositories.listTasks(target.id)).map(row => row.id)).toEqual([first.id, task.id, last.id])
    expect(await device.repositories.listTasks(source.id)).toEqual([])
    expect(await device.db.tasks.get(first.id)).toMatchObject({ position: first.position, dirty: 0 })
    expect(await device.db.tasks.get(last.id)).toMatchObject({ position: last.position, dirty: 0 })
  })

  it('legt eine Aufgabe im leeren ungruppierten Teil einer anderen Liste ab', async () => {
    const { target, task } = await setup()
    const moved = await device.repositories.placeTask(task.id, { listId: target.id, sectionId: null, beforeTaskId: null })
    expect(moved).toMatchObject({ list_id: target.id, section_id: null, position: 0 })
  })

  it('sortiert innerhalb desselben Bereichs, ohne andere Bereiche umzuschreiben', async () => {
    const { target, sectionId, first, last } = await setup()
    const other = await device.repositories.createTask({ listId: target.id, title: 'Anderer Bereich' })
    await device.repositories.placeTask(first.id, { listId: target.id, sectionId, beforeTaskId: null })
    expect((await device.repositories.listTasks(target.id)).filter(row => row.section_id === sectionId).map(row => row.id)).toEqual([last.id, first.id])
    expect(await device.db.tasks.get(other.id)).toEqual(other)
  })

  it('erhält zwischenzeitliche Bearbeitungen der bewegten Aufgabe', async () => {
    const { target, task } = await setup()
    await device.repositories.updateTask(task.id, { title: 'Neuer Titel', description: 'Neue Notiz' })
    const moved = await device.repositories.placeTask(task.id, { listId: target.id, sectionId: null, beforeTaskId: null, expected: taskLocation(task) })
    expect(moved).toMatchObject({ title: 'Neuer Titel', description: 'Neue Notiz', list_id: target.id })
  })

  it('folgt der aktuellen Position des Nachbarn nach einer anderen Umsortierung', async () => {
    const { target, sectionId, task, first, last } = await setup()
    await device.repositories.placeTask(last.id, { listId: target.id, sectionId, beforeTaskId: first.id })
    await device.repositories.placeTask(task.id, { listId: target.id, sectionId, beforeTaskId: first.id })
    expect((await device.repositories.listTasks(target.id)).map(row => row.id)).toEqual([last.id, task.id, first.id])
  })

  it('behandelt verwaiste Bereichsverweise wie die Oberfläche als ungruppiert', async () => {
    const { task, target, first, last } = await setup()
    await device.db.tasks.update(first.id, { section_id: 'entfernter-bereich' })
    await device.db.tasks.update(last.id, { section_id: 'entfernter-bereich' })
    await device.repositories.placeTask(task.id, { listId: target.id, sectionId: null, beforeTaskId: last.id })
    expect((await device.repositories.listTasks(target.id)).map(row => row.id)).toEqual([first.id, task.id, last.id])
  })

  it('weist eine inzwischen anders platzierte Aufgabe zurück', async () => {
    const { task, target, sectionId } = await setup()
    const moved = await device.repositories.placeTask(task.id, { listId: target.id, sectionId, beforeTaskId: null })
    await expect(device.repositories.placeTask(task.id, { listId: target.id, sectionId: null, beforeTaskId: null, expected: taskLocation(task) })).rejects.toThrow('inzwischen verschoben')
    expect(await device.db.tasks.get(task.id)).toEqual(moved)
  })

  it('weist eine inzwischen abgehakte Aufgabe zurück', async () => {
    const { task, target } = await setup()
    await device.repositories.setTaskCompleted(task.id, true)
    await expect(device.repositories.placeTask(task.id, { listId: target.id, sectionId: null, beforeTaskId: null })).rejects.toThrow('abgehakt')
    expect(await device.db.tasks.get(task.id)).toMatchObject({ list_id: task.list_id, completed: true })
  })

  it('bricht ohne Teilschreibung ab, wenn der Zielbereich entfernt wurde', async () => {
    const { task, target, sectionId } = await setup()
    await device.repositories.deleteListSection(target.id, sectionId)
    await expect(device.repositories.placeTask(task.id, { listId: target.id, sectionId, beforeTaskId: null })).rejects.toThrow('Zielbereich')
    expect(await device.db.tasks.get(task.id)).toEqual(task)
  })

  it('bricht ohne Teilschreibung ab, wenn der Nachbar nicht mehr in der Zielgruppe ist', async () => {
    const { task, target, sectionId, first } = await setup()
    await device.repositories.moveTask(first.id, target.id, null)
    await expect(device.repositories.placeTask(task.id, { listId: target.id, sectionId, beforeTaskId: first.id })).rejects.toThrow('Nachbaraufgabe')
    expect(await device.db.tasks.get(task.id)).toEqual(task)
  })

  it('bricht ohne Teilschreibung ab, wenn die Zielliste gelöscht wurde', async () => {
    const { task, target } = await setup()
    await device.repositories.deleteList(target.id)
    await expect(device.repositories.placeTask(task.id, { listId: target.id, sectionId: null, beforeTaskId: null })).rejects.toThrow()
    expect(await device.db.tasks.get(task.id)).toEqual(task)
  })

  it('nummeriert bei fehlender Zahlengenauigkeit nur die betroffene Zielgruppe neu', async () => {
    const { task, target, sectionId, first, last } = await setup()
    const other = await device.repositories.createTask({ listId: target.id, title: 'Unberührt' })
    await device.db.tasks.update(first.id, { position: 1 })
    await device.db.tasks.update(last.id, { position: 1 + Number.EPSILON })
    await device.repositories.placeTask(task.id, { listId: target.id, sectionId, beforeTaskId: last.id })
    expect((await device.repositories.listTasks(target.id)).filter(row => row.section_id === sectionId).map(row => [row.id, row.position])).toEqual([[first.id, 1], [task.id, 2], [last.id, 3]])
    expect(await device.db.tasks.get(other.id)).toEqual(other)
  })
})

it('synchronisiert das Platzieren zwischen Listen mitsamt Nachbarschaft auf ein zweites Gerät', async () => {
  const server = createFakeServer()
  const a = await createDevice({ userId: 'placement-sync', gateway: server.gatewayFor('placement-sync') })
  const b = await createDevice({ userId: 'placement-sync', gateway: server.gatewayFor('placement-sync') })
  try {
    const source = await a.repositories.createList('Quelle', 'placement-sync')
    const target = await a.repositories.createList('Ziel', 'placement-sync')
    const task = await a.repositories.createTask({ listId: source.id, title: 'Bewegen' })
    const neighbor = await a.repositories.createTask({ listId: target.id, title: 'Danach' })
    await a.engine.sync(); await b.engine.sync()
    await a.repositories.placeTask(task.id, { listId: target.id, sectionId: null, beforeTaskId: neighbor.id, expected: taskLocation(task) })
    await a.engine.sync(); await b.engine.sync()
    expect(await b.repositories.listTasks(source.id)).toEqual([])
    expect((await b.repositories.listTasks(target.id)).map(row => row.id)).toEqual([task.id, neighbor.id])
  } finally { await a.dispose(); await b.dispose() }
})
