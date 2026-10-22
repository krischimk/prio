import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDevice, type DeviceHarness } from '../support/harness'
import { createFakeServer } from '../support/fakeGateway'
import { createWidgetMirror } from '../../src/widgets/mirror'
import type { WidgetCommand, WidgetSnapshot } from '../../src/widgets/model'

const fake = vi.hoisted(() => ({ commands: [] as WidgetCommand[], failAck: false, publications: [] as WidgetSnapshot[] }))
vi.mock('../../src/widgets/native', () => ({ hasNativeWidgets: () => true, widgetBridge: {
  acquire: async () => ({ lease: 'lease' }), release: async () => {},
  commands: async () => ({ commands: fake.commands }),
  acknowledge: async ({ id }: { id: string }) => { if (fake.failAck) { fake.failAck = false; throw new Error('process stopped before ack') }; fake.commands = fake.commands.filter(row => row.id !== id) },
  publish: async ({ snapshot }: { snapshot: WidgetSnapshot }) => { fake.publications.push(snapshot) },
} }))
vi.mock('@capacitor/app', () => ({ App: { addListener: async () => ({ remove: async () => {} }) } }))
const devices: DeviceHarness[] = []
afterEach(async () => { for (const device of devices.splice(0)) await device.dispose(); fake.commands = []; fake.publications = []; fake.failAck = false })
async function setup() {
  const device = await createDevice({ userId: 'widget-user', gateway: createFakeServer().gatewayFor('widget-user') }); devices.push(device)
  const list = await device.repositories.createList('Alltag', 'widget-user')
  const task = await device.repositories.createTask({ listId: list.id, title: 'Täglich', description: 'Lokal geändert', dueAt: '2030-05-20T12:00:00.000Z', recurrence: 'daily' })
  fake.commands = [{ id: crypto.randomUUID(), userId: 'widget-user', taskId: task.id, at: '2030-05-19T12:00:00.000Z' }]
  return { device, list, task, mirror: createWidgetMirror(device.db, device.repositories, 'widget-user') }
}
describe('Widget → lokale Datenbank, auch ohne Internet', () => {
  it('replays checklist actions independently and keeps later deliberate changes after an interrupted acknowledgement', async () => {
    const { device, task, mirror } = await setup()
    await device.repositories.updateTask(task.id, { checklist: [{ id: 'a', text: 'Schritt', completed: false, deleted_at: null }] })
    fake.commands[0].checklist = { id: 'a', completed: true }; fake.failAck = true
    await expect(mirror.drain()).rejects.toThrow('process stopped')
    expect(await device.repositories.getTask(task.id)).toMatchObject({ completed: false, checklist: [{ completed: true }] })
    expect(await device.db.tasks.count()).toBe(1)
    await device.repositories.setChecklistItemCompleted(task.id, 'a', false)
    await mirror.drain()
    expect(await device.repositories.getTask(task.id)).toMatchObject({ completed: false, checklist: [{ completed: false }] })
    expect(fake.commands).toHaveLength(0); mirror.close()
  })
  it('applies a queued action through repositories and acknowledges only after persistence', async () => {
    const { device, task, mirror } = await setup()
    await mirror.drain(); await mirror.publish()
    expect(fake.commands).toHaveLength(0)
    expect(await device.repositories.getTask(task.id)).toMatchObject({ completed: true, description: 'Lokal geändert', dirty: 1 })
    const rows = await device.db.tasks.toArray(); expect(rows).toHaveLength(2)
    expect(fake.publications.at(-1)?.tasks).toHaveLength(1)
    expect(fake.publications.at(-1)?.tasks[0].deferred).toBe(true)
    mirror.close()
  })
  it('retries after a process interruption without changing a later deliberate reopen', async () => {
    const { device, task, mirror } = await setup(); fake.failAck = true
    await expect(mirror.drain()).rejects.toThrow('process stopped')
    expect(await device.repositories.getTask(task.id)).toMatchObject({ completed: true })
    await device.repositories.setTaskCompleted(task.id, false)
    await mirror.drain()
    expect(await device.repositories.getTask(task.id)).toMatchObject({ completed: false })
    expect(fake.commands).toHaveLength(0); mirror.close()
  })
  it('publishes the latest unsynced input and its confirmed base without duplicating app state', async () => {
    const { task, list, mirror } = await setup(); fake.commands = []
    await mirror.publish()
    const local = fake.publications.at(-1)!.local[task.id]
    expect(local).toMatchObject({ task: { description: 'Lokal geändert' }, base: null, list: { id: list.id }, listBase: null })
    mirror.close()
  })
})
