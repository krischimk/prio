import { afterEach, beforeEach, expect, it } from 'vitest'
import { createDevice, createTestUserId, type DeviceHarness } from '../support/harness'
import { createFakeServer } from '../support/fakeGateway'
import { isUpcomingRepeat } from '../../src/domain/recurrence'

let device: DeviceHarness
const user = createTestUserId('navigation-repositories')
beforeEach(async () => { device = await createDevice({ userId: user, gateway: createFakeServer().gatewayFor(user) }) })
afterEach(async () => device.dispose())

it('sichert Reihenfolge und Verstecken atomar, ohne die Gesamtansicht zu verändern', async () => {
  const a = await device.repositories.createList('A', user, { includeInOverview: true })
  const b = await device.repositories.createList('B', user)
  await device.repositories.placeList(a.id, user, { hidden: true, beforeListId: null })
  const preferences = await device.repositories.listListPreferences(user)
  expect(preferences.find(row => row.list_id === a.id)).toMatchObject({ hidden: true, include_in_overview: true, dirty: 1 })
  await device.repositories.setListInOverview(a.id, user, false)
  expect((await device.repositories.listListPreferences(user)).find(row => row.list_id === a.id)?.hidden).toBe(true)
  await expect(device.repositories.placeList(b.id, user, { hidden: false, beforeListId: 'fehlt' })).rejects.toThrow()
  expect(await device.repositories.listListPreferences(user)).toEqual(expect.arrayContaining(preferences.map(row => row.list_id === a.id ? { ...row, include_in_overview: false } : row)))
})

it('merkt die bisherige Fälligkeit am früh erzeugten Nachfolger und hebt sie bei Terminänderung auf', async () => {
  const list = await device.repositories.createList('A', user)
  const due = new Date(device.clock.nowMs() + 4 * 60 * 60_000).toISOString()
  const task = await device.repositories.createTask({ listId: list.id, title: 'Täglich', recurrence: 'daily', dueAt: due })
  const completed = await device.repositories.setTaskCompleted(task.id, true)
  const successor = (await device.repositories.getTask(completed.successor_id!))!
  expect(successor.available_from).toBe(due)
  expect(isUpcomingRepeat(successor, device.clock.nowMs())).toBe(true)
  expect(isUpcomingRepeat(successor, Date.parse(due))).toBe(false)
  expect(isUpcomingRepeat({ ...successor, completed: true }, device.clock.nowMs())).toBe(false)
  await device.repositories.updateTask(successor.id, { description: 'Notiz' })
  expect((await device.repositories.getTask(successor.id))?.available_from).toBe(due)
  await device.repositories.updateTask(successor.id, { dueAt: device.clock.now() })
  expect((await device.repositories.getTask(successor.id))?.available_from).toBeNull()
})

it('erzeugt bei bereits verstrichener Fälligkeit einen sofort normalen Nachfolger', async () => {
  const list = await device.repositories.createList('A', user)
  const task = await device.repositories.createTask({ listId: list.id, title: 'Täglich', recurrence: 'daily', dueAt: device.clock.now() })
  const completed = await device.repositories.setTaskCompleted(task.id, true)
  expect((await device.repositories.getTask(completed.successor_id!))?.available_from).toBeNull()
})
