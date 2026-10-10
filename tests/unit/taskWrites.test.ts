import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createFakeServer } from '../support/fakeGateway'
import { createDevice, type DeviceHarness } from '../support/harness'
import { taskEditBase, TaskEditConflict } from '../../src/domain/taskEdit'

describe('Atomare lokale Aufgabenänderungen', () => {
  let device: DeviceHarness
  beforeEach(async () => {
    device = await createDevice({ userId: 'task-writes', gateway: createFakeServer().gatewayFor('task-writes') })
  })
  afterEach(async () => { await device.dispose() })

  async function setup() {
    const list = await device.repositories.createList('Quelle', 'task-writes')
    const task = await device.repositories.createTask({ listId: list.id, title: 'Alt' })
    return { list, task }
  }

  it('erhält zwei gleichzeitig bearbeitete unterschiedliche Felder', async () => {
    const { task } = await setup()
    await Promise.all([
      device.repositories.updateTask(task.id, { title: 'Neu' }),
      device.repositories.updateTask(task.id, { description: 'Notiz' }),
    ])
    expect(await device.repositories.getTask(task.id)).toMatchObject({ title: 'Neu', description: 'Notiz' })
  })

  it('verliert beim gleichzeitigen Abhaken keine Bearbeitung', async () => {
    const { task } = await setup()
    await Promise.all([
      device.repositories.updateTask(task.id, { title: 'Neu' }),
      device.repositories.setTaskCompleted(task.id, true),
    ])
    expect(await device.repositories.getTask(task.id)).toMatchObject({ title: 'Neu', completed: true })
  })

  it('erhält Bearbeitung und Ziel beim gleichzeitigen Verschieben', async () => {
    const { task } = await setup()
    const target = await device.repositories.createList('Ziel', 'task-writes')
    await Promise.all([
      device.repositories.updateTask(task.id, { description: 'Notiz' }),
      device.repositories.moveTask(task.id, target.id),
    ])
    expect(await device.repositories.getTask(task.id)).toMatchObject({ list_id: target.id, description: 'Notiz' })
  })

  it('erhält Bearbeitung und Reihenfolge beim gleichzeitigen Umsortieren', async () => {
    const { task, list } = await setup()
    await Promise.all([
      device.repositories.updateTask(task.id, { title: 'Neu' }),
      device.repositories.reorderTasks(list.id, [task.id]),
    ])
    expect(await device.repositories.getTask(task.id)).toMatchObject({ title: 'Neu', position: 1 })
  })

  it('erhält die letzte Bearbeitung auch beim gleichzeitigen Löschen', async () => {
    const { task } = await setup()
    await Promise.all([
      device.repositories.updateTask(task.id, { title: 'Neu' }),
      device.repositories.deleteTask(task.id),
    ])
    expect(await device.db.tasks.get(task.id)).toMatchObject({ title: 'Neu', deleted_at: device.clock.now(), dirty: 1 })
  })

  it('vergibt bei gleichzeitiger Erstellung unterschiedliche Positionen', async () => {
    const list = await device.repositories.createList('Liste', 'task-writes')
    const tasks = await Promise.all(['A', 'B'].map(title => device.repositories.createTask({ listId: list.id, title })))
    expect(new Set(tasks.map(task => task.position)).size).toBe(2)
  })

  it('wendet Entwürfe auf den aktuellen Stand an und erhält Konflikte unverändert', async () => {
    const { task } = await setup()
    const base = taskEditBase(task)
    await device.repositories.updateTask(task.id, { description: 'Andere Notiz' })
    const updated = await device.repositories.updateTask(task.id, { title: 'Mein Titel' }, { base })
    expect(updated).toMatchObject({ title: 'Mein Titel', description: 'Andere Notiz' })
    await expect(device.repositories.updateTask(task.id, { title: 'Veraltet' }, { base })).rejects.toBeInstanceOf(TaskEditConflict)
    expect((await device.repositories.getTask(task.id))?.title).toBe('Mein Titel')
  })

  it('markiert ein unverändertes Formular nicht erneut für den Upload', async () => {
    const { task } = await setup()
    await device.engine.sync()
    device.clock.advance(1000)
    const updated = await device.repositories.updateTask(task.id, {})
    expect(updated.dirty).toBe(0)
    expect(updated.updated_at).toBe(task.updated_at)
  })

  it('behandelt einen wiederholten Abschluss als denselben Zustand', async () => {
    const { task } = await setup()
    const first = await device.repositories.setTaskCompleted(task.id, true)
    device.clock.advance(1000)
    const second = await device.repositories.setTaskCompleted(task.id, true)
    expect(second.completed_at).toBe(first.completed_at)
    expect(second.updated_at).toBe(first.updated_at)
  })
})
