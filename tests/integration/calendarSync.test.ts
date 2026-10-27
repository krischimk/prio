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
  it('erhält bestätigte Kalendertage, wenn ein älterer lokaler Datensatz das Feld nicht kennt', async () => {
    const server = createFakeServer()
    const device = await createDevice({ userId: 'owner', gateway: server.gatewayFor('owner') }); devices.push(device)
    await device.repositories.updateUserPreferences('owner', { calendar: { day: { date: '2026-10-29', capacity: 'low' }, timeZone: 'Europe/Berlin' } })
    await device.engine.sync()
    const previous = (await device.db.user_preferences.get('owner'))!
    delete previous.calendar_preferences
    await device.db.user_preferences.put({ ...previous, overview_mode: 'priority', dirty: 1 })
    expect((await device.repositories.getUserPreferences('owner'))?.calendar_preferences?.days).toEqual({ '2026-10-29': 'low' })
    await device.engine.sync()
    expect(server.userPreferences.get('owner')?.calendar_preferences?.days).toEqual({ '2026-10-29': 'low' })
    expect((await device.db.user_preferences.get('owner'))?.dirty).toBe(0)
    expect(server.userPreferences.get('owner')?.overview_mode).toBe('priority')
  })
  it('bewahrt Tagesnotizen beim Aufklappen, Zielwechsel und Änderungen eines anderen Geräts', async () => {
    const server = createFakeServer()
    const a = await createDevice({ userId: 'owner', gateway: server.gatewayFor('owner') })
    const b = await createDevice({ userId: 'owner', gateway: server.gatewayFor('owner') }); devices.push(a, b)
    const list = await a.repositories.createList('Planung', 'owner')
    const task = await a.repositories.createTask({ listId: list.id, title: 'Termin' })
    await a.repositories.updateUserPreferences('owner', { calendar: { note: { date: '2026-10-29', text: 'Unterwegs' }, day: { date: '2026-10-29', capacity: 'low' } } })
    await a.engine.sync(); await b.engine.sync()
    const previous = (await a.db.user_preferences.get('owner'))!
    delete previous.calendar_preferences!.notes
    await a.db.user_preferences.put(previous)
    await a.repositories.setTaskExpanded('owner', task.id, 'note', true)
    await a.repositories.createTask({ listId: list.id, title: 'Nächster Termin', rememberOverviewTargetFor: 'owner' })
    await b.repositories.updateUserPreferences('owner', { calendar: { note: { date: '2026-10-30', text: 'Besuch' } } })
    await a.engine.sync(); await b.engine.sync(); await a.engine.sync()
    expect(server.userPreferences.get('owner')?.calendar_preferences).toMatchObject({ days: { '2026-10-29': 'low' }, notes: { '2026-10-29': 'Unterwegs', '2026-10-30': 'Besuch' } })
    await a.repositories.updateUserPreferences('owner', { calendar: { day: { date: '2026-10-29', capacity: 'normal' }, note: { date: '2026-10-29', text: '' } } })
    await a.engine.sync(); await b.engine.sync()
    expect((await b.repositories.getUserPreferences('owner'))?.calendar_preferences).toMatchObject({ days: {}, notes: { '2026-10-30': 'Besuch' } })
  })
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
