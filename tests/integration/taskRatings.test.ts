import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDevice, type DeviceHarness } from '../support/harness'
import { createFakeServer } from '../support/fakeGateway'
import { startRating, ratingValues } from '../../src/domain/rating'
import { taskEditBase, TaskEditConflict } from '../../src/domain/taskEdit'
import { normalisiereListe, normalisiereAufgabe } from '../../src/domain/normalize'
import { localList, localTask } from '../support/factories'

describe('Bewertungen in Speicherung, Wiederholung und Abgleich', () => {
  let device: DeviceHarness
  beforeEach(async () => { device = await createDevice({ userId: 'ratings', gateway: createFakeServer().gatewayFor('ratings') }) })
  afterEach(async () => { await device.dispose() })

  it('hält Bestandslisten aus, neue Listen an und Aufgaben auch mit Termin unbewertet', async () => {
    const oldList = localList(); delete (oldList as Partial<typeof oldList>).ratings_enabled
    const oldTask = localTask(); delete (oldTask as Partial<typeof oldTask>).rating
    expect(normalisiereListe(oldList).ratings_enabled).toBe(false)
    expect(normalisiereAufgabe(oldTask).rating).toBeNull()
    const list = await device.repositories.createList('Neu', 'ratings')
    expect(list.ratings_enabled).toBe(true)
    const task = await device.repositories.createTask({ listId: list.id, title: 'Mit Termin', dueAt: device.clock.now() })
    expect(task.rating).toBeNull()
  })

  it('schützt die gemeinsame Listenregel und erhält Bewertungen beim Ausschalten und Verschieben', async () => {
    const list = await device.repositories.createList('Arbeit', 'ratings')
    const rating = { ...startRating(7.3), effort: 0 }
    const task = await device.repositories.createTask({ listId: list.id, title: 'Bewertet', rating })
    await expect(device.repositories.setListRatingsEnabled(list.id, 'other', false)).rejects.toThrow('Besitzer')
    await device.repositories.setListRatingsEnabled(list.id, 'ratings', false)
    expect((await device.repositories.getList(list.id))?.ratings_enabled).toBe(false)
    expect((await device.repositories.getTask(task.id))?.rating).toEqual(rating)
    const target = await device.repositories.createList('Packliste', 'ratings', { ratingsEnabled: false })
    expect((await device.repositories.moveTask(task.id, target.id)).rating).toEqual(rating)
    await device.repositories.updateTask(task.id, { rating: null })
    expect((await device.repositories.getTask(task.id))?.rating).toBeNull()
    await expect(device.repositories.updateTask(task.id, { rating: { ...rating, effort: 11 } })).rejects.toThrow()
  })

  it('behandelt die drei Werte atomar, erhält unabhängige Änderungen und erkennt paralleles Entfernen', async () => {
    const list = await device.repositories.createList('Parallel', 'ratings')
    const task = await device.repositories.createTask({ listId: list.id, title: 'A', rating: startRating(5) })
    const base = taskEditBase(task)
    await device.repositories.updateTask(task.id, { description: 'Andere Änderung' })
    const changed = await device.repositories.updateTask(task.id, { rating: startRating(8) }, { base })
    expect(changed.description).toBe('Andere Änderung')
    await expect(device.repositories.updateTask(task.id, { rating: null }, { base })).rejects.toBeInstanceOf(TaskEditConflict)
  })

  it('übernimmt Einschätzungen in Wiederholungen und berechnet deren Dringlichkeit aus dem neuen Termin', async () => {
    const list = await device.repositories.createList('Routine', 'ratings')
    const task = await device.repositories.createTask({ listId: list.id, title: 'Täglich', dueAt: device.clock.now(), recurrence: 'daily', rating: startRating(7),
      checklist: [{ id: 'a', text: 'Groß', completed: true, deleted_at: null, weight: 0.75 }, { id: 'b', text: 'Klein', completed: false, deleted_at: null, weight: 0.25 }] })
    const done = await device.repositories.setTaskCompleted(task.id, true)
    const next = (await device.repositories.getTask(done.successor_id!))!
    expect(next.rating).toEqual(task.rating)
    expect(next.checklist.map(item => [item.completed, item.weight])).toEqual([[false, 0.75], [false, 0.25]])
    expect(ratingValues(next.rating!, next.due_at, device.clock.nowMs(), next.checklist).effort).toBe(5)
    expect((await device.repositories.getTask(task.id))?.checklist[0].completed).toBe(true)
    expect(ratingValues(next.rating!, next.due_at, device.clock.nowMs()).urgency).toBeLessThan(ratingValues(task.rating!, task.due_at, device.clock.nowMs()).urgency)
    await device.repositories.updateTask(next.id, { rating: startRating(9) })
    await device.repositories.setTaskCompleted(task.id, false)
    expect((await device.repositories.getTask(next.id))?.rating?.importance).toBe(9)
  })
})
