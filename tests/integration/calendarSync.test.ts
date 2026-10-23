import { afterEach, describe, expect, it } from 'vitest'
import { createFakeServer } from '../support/fakeGateway'
import { createDevice, type DeviceHarness } from '../support/harness'
import { createFixedClock } from '../../src/domain/clock'
import { planTaskCompletion } from '../../src/domain/taskCompletion'
import { projectWidget } from '../../src/widgets/model'
import { toRemoteList, toRemoteTask } from '../../src/domain/mapping'

const devices: DeviceHarness[] = []
afterEach(async () => { await Promise.all(devices.splice(0).map(device => device.dispose())) })
describe('Kalender und Routinen auf mehreren Geräten', () => {
  it('behält verschiedene Tage und Ansichtsoptionen bei konkurrierenden Änderungen', async () => {
    const server = createFakeServer()
    const a = await createDevice({ userId: 'owner', gateway: server.gatewayFor('owner') })
    const b = await createDevice({ userId: 'owner', gateway: server.gatewayFor('owner') }); devices.push(a, b)
    await a.repositories.updateUserPreferences('owner', { calendar: { day: { date: '2026-10-29', capacity: 'low' }, timeZone: 'Europe/Berlin' } })
    await a.engine.sync(); await b.engine.sync()
    await a.repositories.updateUserPreferences('owner', { calendar: { day: { date: '2026-10-30', capacity: 'none' } } })
    await b.repositories.updateUserPreferences('owner', { calendar: { repeats: 'all', day: { date: '2026-10-29', capacity: 'normal' } } })
    await b.engine.sync(); await a.engine.sync(); await b.engine.sync()
    for (const device of [a, b]) {
      expect((await device.repositories.getUserPreferences('owner'))?.calendar_preferences).toMatchObject({ days: { '2026-10-30': 'none' }, repeats: 'all', timeZone: 'Europe/Berlin' })
      expect(await device.repositories.listCloudConflicts()).toEqual([])
    }
  })
  it('versteckt den Nachfolger bis 5 Uhr, erlaubt Rückgängig und beginnt ohne Abhaken frisch', async () => {
    const server = createFakeServer(), clock = createFixedClock(Date.parse('2026-10-24T08:00:00.000Z'))
    const device = await createDevice({ userId: 'owner', gateway: server.gatewayFor('owner'), clock }); devices.push(device)
    const list = await device.repositories.createList('Routinen', 'owner')
    const task = await device.repositories.createTask({ listId: list.id, title: 'Lesen', recurrence: 'daily', dueAt: '2026-10-24T20:30:00.000Z',
      recurrenceRule: { visibility: { mode: 'clock', time: '05:00' }, resetMissed: true, timeZone: 'Europe/Berlin' },
      checklist: [{ id: 'point', text: '10 Minuten', completed: false, deleted_at: null }] })
    await device.repositories.setChecklistItemCompleted(task.id, 'point', true)
    const finished = await device.repositories.setTaskCompleted(task.id, true)
    const successor = await device.repositories.getTask(finished.successor_id!)
    expect(successor?.available_from).toBe('2026-10-25T04:00:00.000Z')
    expect((await device.repositories.listRestorableTasks()).map(task => task.id)).toContain(task.id)
    const widget = projectWidget({ lists: [toRemoteList(list)], tasks: [toRemoteTask(successor!)], preferences: [], userPreferences: [] }, 'owner', clock.nowMs(), 'Europe/Berlin')
    expect(widget.tasks).toHaveLength(0)
    await device.repositories.setTaskCompleted(task.id, false)
    expect((await device.repositories.getTask(task.id))?.checklist[0].completed).toBe(true)
    clock.advance(20 * 3_600_000)
    expect(await device.repositories.advanceRoutines()).toBe(true)
    const next = await device.repositories.getTask(task.id)
    expect(next?.due_at).toBe('2026-10-25T21:30:00.000Z')
    expect(next?.checklist[0].completed).toBe(false)
    expect(await device.repositories.advanceRoutines()).toBe(false)
    await device.engine.sync()
    expect(server.tasks.get(task.id)?.recurrence_rule).toEqual(task.recurrence_rule)
    const plan = await planTaskCompletion(next!, list, await device.repositories.listTasks(list.id), true, clock.now())
    expect(plan.changes.find(row => !row.completed)?.available_from).toBe('2026-10-26T04:00:00.000Z')
  })
})
