import { afterEach, expect, it, vi } from 'vitest'
import { createWorkspaceRuntime, type WorkspaceRuntime } from '../../src/app/workspaceRuntime'
import { deleteLocalDatabase } from '../../src/db/localDb'
import { FakeNetworkMonitor } from '../support/fakeAuth'
import { createFakeServer } from '../support/fakeGateway'

const effects = vi.hoisted(() => ({ publish: vi.fn(async () => {}), reminders: vi.fn(async () => null) }))
vi.mock('../../src/widgets/mirror', () => ({ createWidgetMirror: () => ({ publish: effects.publish, drain: async () => {}, close: () => {} }) }))
vi.mock('../../src/reminders/reminderService', () => ({ createReminderService: () => ({ sync: effects.reminders, enable: async () => null }) }))
const user = 'view-effects-user'
let runtime: WorkspaceRuntime | null = null
afterEach(async () => { runtime?.schliessen(); runtime = null; await deleteLocalDatabase(user); vi.clearAllMocks() })
const settle = () => new Promise(resolve => setTimeout(resolve, 650))
async function setup() {
  const gateway = createFakeServer().gatewayFor(user)
  const network = new FakeNetworkMonitor(true)
  runtime = await createWorkspaceRuntime({ userId: user, gateway, network })
  const list = await runtime.repositories.createList('Ansicht', user)
  const task = await runtime.repositories.createTask({ listId: list.id, title: 'Aufgabe' })
  await settle()
  effects.publish.mockClear(); effects.reminders.mockClear()
  return { workspace: runtime, task, gateway, network }
}

it.each(['note', 'checklist'] as const)('ein Klappzustand für %s synchronisiert ohne Widgetbau oder Erinnerungsprüfung', async part => {
  const { workspace, task } = await setup()
  await workspace.repositories.setTaskExpanded(user, task.id, part, true)
  await settle()
  console.info('Ansicht-Nebenarbeiten', part, { widgets: effects.publish.mock.calls.length, reminders: effects.reminders.mock.calls.length })
  expect(workspace.zustand().pendingCount).toBe(0)
  expect(effects.publish).not.toHaveBeenCalled()
  expect(effects.reminders).not.toHaveBeenCalled()
})

it('eine folgende Klappänderung verwirft keine notwendige Arbeit nach einer Aufgabenänderung', async () => {
  const { workspace, task } = await setup()
  await workspace.repositories.updateTask(task.id, { title: 'Geändert' })
  await workspace.repositories.setTaskExpanded(user, task.id, 'note', true)
  await settle()
  expect(effects.publish).toHaveBeenCalled()
  expect(effects.reminders).toHaveBeenCalled()
  expect(workspace.zustand().pendingCount).toBe(0)
})

it('erneuert die Widget-Basis erst nach einem späteren erfolgreichen Offline-Upload', async () => {
  const { workspace, task, network } = await setup()
  network.setOnline(false)
  await workspace.repositories.updateTask(task.id, { title: 'Offline geändert' })
  await settle()
  expect(effects.publish).toHaveBeenCalledTimes(1)
  effects.publish.mockClear()
  network.setOnline(true)
  await workspace.synchronisieren()
  expect(workspace.zustand().pendingCount).toBe(0)
  expect(effects.publish).toHaveBeenCalledTimes(1)
  effects.publish.mockClear()
  await workspace.synchronisieren()
  expect(effects.publish).not.toHaveBeenCalled()
})

it('behält eine während des Uploads entstandene Widget-Änderung für dessen nächsten Abschluss', async () => {
  const { workspace, task, gateway } = await setup()
  let release!: () => void, started!: () => void
  const holding = new Promise<void>(resolve => { release = resolve })
  const uploading = new Promise<void>(resolve => { started = resolve })
  const original = gateway.push.bind(gateway)
  vi.spyOn(gateway, 'push').mockImplementationOnce(async (...args) => {
    started(); await holding; return original(...args)
  })
  await workspace.repositories.updateTask(task.id, { title: 'Erste Änderung' })
  const syncing = workspace.synchronisieren()
  await uploading
  await workspace.repositories.updateTask(task.id, { title: 'Während Upload geändert' })
  release(); await syncing
  effects.publish.mockClear()
  await workspace.synchronisieren()
  expect(workspace.zustand().pendingCount).toBe(0)
  expect(effects.publish).toHaveBeenCalledTimes(1)
  effects.publish.mockClear()
  await workspace.synchronisieren()
  expect(effects.publish).not.toHaveBeenCalled()
})
