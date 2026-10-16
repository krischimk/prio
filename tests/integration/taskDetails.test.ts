import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createFakeServer } from '../support/fakeGateway'
import { createDevice, type DeviceHarness } from '../support/harness'
import { createChecklistItem, checklistProgress } from '../../src/domain/checklist'
import { taskEditBase, TaskEditConflict } from '../../src/domain/taskEdit'

describe('Aufgabeneigene Checklisten und Tags', () => {
  let device: DeviceHarness
  let listId: string
  beforeEach(async () => {
    device = await createDevice({ userId: 'details', gateway: createFakeServer().gatewayFor('details') })
    listId = (await device.repositories.createList('Schritte', 'details', { keepCompleted: true })).id
  })
  afterEach(async () => { await device.dispose() })

  it('hält Checkliste und Hauptaufgabe in beide Richtungen unabhängig', async () => {
    const a = createChecklistItem('A'), b = createChecklistItem('B')
    const task = await device.repositories.createTask({ listId, title: 'Mit Punkten', checklist: [a, b] })
    await device.repositories.setChecklistItemCompleted(task.id, a.id, true)
    const completed = await device.repositories.setTaskCompleted(task.id, true)
    expect(completed.checklist).toEqual([{ ...a, completed: true }, b])
    const reopened = await device.repositories.setTaskCompleted(task.id, false)
    expect(reopened.checklist).toEqual(completed.checklist)
    await device.repositories.setChecklistItemCompleted(task.id, b.id, true)
    const allChecked = (await device.repositories.getTask(task.id))!
    expect(checklistProgress(allChecked.checklist)).toEqual({ completed: 2, total: 2 })
    expect(allChecked.completed).toBe(false)
    expect(allChecked.dirty).toBe(1)
  })

  it('schreibt zeitgleiche Punktänderungen auf den aktuellen Bestand und erkennt veraltete Textentwürfe', async () => {
    const a = createChecklistItem('A'), b = createChecklistItem('B')
    const task = await device.repositories.createTask({ listId, title: 'Parallel', checklist: [a, b] })
    const base = taskEditBase(task)
    await Promise.all([device.repositories.setChecklistItemCompleted(task.id, a.id, true), device.repositories.setChecklistItemCompleted(task.id, b.id, true)])
    const changed = await device.repositories.updateTask(task.id, { checklist: [{ ...a, text: 'Neues A' }, b] }, { base })
    expect(changed.checklist).toEqual([{ ...a, text: 'Neues A', completed: true }, { ...b, completed: true }])
    await expect(device.repositories.updateTask(task.id, { checklist: [{ ...a, text: 'Anderes A' }, b] }, { base })).rejects.toBeInstanceOf(TaskEditConflict)
  })

  it('erhält Reihenfolge, Löschvermerke und Tags auch beim Listenwechsel', async () => {
    const a = createChecklistItem('A'), b = createChecklistItem('B')
    const task = await device.repositories.createTask({ listId, title: 'Details', checklist: [a, b], tags: [' Uni ', 'uni', 'Privat'] })
    const deleted = { ...a, deleted_at: device.clock.now() }
    await device.repositories.updateTask(task.id, { checklist: [b, deleted] })
    const target = await device.repositories.createList('Ziel', 'details')
    const moved = await device.repositories.moveTask(task.id, target.id)
    expect(moved.checklist).toEqual([b, deleted])
    expect(moved.tags).toEqual(['Uni', 'Privat'])
    await expect(device.repositories.setChecklistItemCompleted(task.id, a.id, true)).rejects.toThrow('nicht mehr verfügbar')
    expect(await device.repositories.listTaskTags()).toEqual(['Privat', 'Uni'])
    await device.repositories.deleteTask(task.id)
    expect(await device.repositories.listTaskTags()).toEqual([])
  })

  it('setzt nur neue Wiederholungen zurück und schützt inzwischen bearbeitete Nachfolger', async () => {
    const a = { ...createChecklistItem('A'), completed: true }, b = createChecklistItem('B')
    const task = await device.repositories.createTask({ listId, title: 'Täglich', checklist: [a, b], tags: ['Routine'], dueAt: device.clock.now(), recurrence: 'daily' })
    const done = await device.repositories.setTaskCompleted(task.id, true)
    const next = (await device.repositories.getTask(done.successor_id!))!
    expect(done.checklist).toEqual([a, b])
    expect(next.checklist).toEqual([{ ...a, completed: false }, b])
    expect(next.tags).toEqual(['Routine'])
    await device.repositories.setChecklistItemCompleted(next.id, b.id, true)
    const reopened = await device.repositories.setTaskCompleted(task.id, false)
    expect(reopened.checklist).toEqual([a, b])
    expect(await device.repositories.getTask(next.id)).toMatchObject({ completed: false, checklist: [{ ...a, completed: false }, { ...b, completed: true }] })
  })
})
