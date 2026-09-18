import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createReminderService, type ReminderService } from '../../src/reminders/reminderService'
import { createFakeServer } from '../support/fakeGateway'
import { FakeNotificationsPort } from '../support/fakeNotifications'
import { createDevice, createTestUserId, type DeviceHarness } from '../support/harness'

/**
 * Erinnerungen als Ganzes (Integration): echte Dexie-Datenbank, echter Dienst,
 * nur die Benachrichtigungen des Betriebssystems sind ersetzt.
 *
 * Geprüft wird das Verhalten, das im Alltag zählt: Es wird geplant, verschoben,
 * aufgeräumt – und nichts doppelt.
 */
describe('Erinnerungsdienst', () => {
  let device: DeviceHarness
  let port: FakeNotificationsPort
  let service: ReminderService
  const userId = createTestUserId('reminder')

  /** Fälligkeit weit in der Zukunft, damit sie nicht von selbst verstreicht. */
  const DUE_SOON = '2026-06-01T09:00:00.000Z'
  const DUE_LATER = '2026-06-02T09:00:00.000Z'

  beforeEach(async () => {
    device = await createDevice({ userId, gateway: createFakeServer().gatewayFor(userId) })
    port = new FakeNotificationsPort()
    service = createReminderService({ db: device.db, port, clock: device.clock })
  })

  afterEach(async () => {
    await device.dispose()
  })

  async function createTaskWithDue(title: string, dueAt: string): Promise<string> {
    const list = await device.repositories.createList('Arbeit', userId)
    const task = await device.repositories.createTask({ listId: list.id, title, dueAt })
    return task.id
  }

  it('meldet im Browser "nicht unterstützt" und fasst nichts an', async () => {
    port.permission = 'unsupported'
    await createTaskWithDue('Bericht', DUE_SOON)

    const status = await service.sync()

    expect(status.kind).toBe('unsupported')
    expect(port.scheduleCalls).toBe(0)
    expect(await device.db.reminders.count()).toBe(0)
  })

  it('plant nichts, solange die Berechtigung fehlt', async () => {
    port.permission = 'prompt'
    await createTaskWithDue('Bericht', DUE_SOON)

    const status = await service.sync()

    expect(status.kind).toBe('permission-required')
    expect(port.scheduleCalls).toBe(0)
    expect(port.pending.size).toBe(0)
  })

  it('plant fällige Aufgaben und merkt sie sich lokal', async () => {
    await createTaskWithDue('Bericht schreiben', DUE_SOON)

    const status = await service.sync()

    expect(status.kind).toBe('ok')
    expect(status.scheduled).toBe(1)
    expect(port.titles()).toEqual(['Bericht schreiben'])
    expect(await device.db.reminders.count()).toBe(1)
  })

  it('ist idempotent – ein zweiter Lauf plant nichts neu', async () => {
    await createTaskWithDue('Bericht', DUE_SOON)
    await service.sync()
    const nachErstemLauf = port.scheduleCalls

    const status = await service.sync()

    expect(status.scheduled).toBe(1)
    expect(port.scheduleCalls).toBe(nachErstemLauf)
    expect(port.pending.size).toBe(1)
  })

  it('fragt beim Aktivieren die Berechtigung an und plant anschließend', async () => {
    await createTaskWithDue('Bericht', DUE_SOON)
    port.permission = 'prompt'

    // Erster Versuch ohne Berechtigung
    expect((await service.status()).kind).toBe('permission-required')

    // Nutzer erlaubt
    port.permission = 'granted'
    const status = await service.enable()

    expect(port.requestCalls).toBe(1)
    expect(status.kind).toBe('ok')
    expect(status.scheduled).toBe(1)
  })

  it('meldet eine abgelehnte Berechtigung verständlich', async () => {
    port.permission = 'denied'
    const status = await service.enable()

    expect(status.kind).toBe('permission-denied')
    expect(status.scheduled).toBe(0)
  })

  it('bricht die Erinnerung ab, wenn die Aufgabe erledigt wird', async () => {
    const taskId = await createTaskWithDue('Bericht', DUE_SOON)
    await service.sync()
    expect(port.pending.size).toBe(1)

    device.clock.advance(1000)
    await device.repositories.setTaskCompleted(taskId, true)
    const status = await service.sync()

    expect(status.scheduled).toBe(0)
    expect(port.pending.size).toBe(0)
    expect(await device.db.reminders.count()).toBe(0)
  })

  it('bricht die Erinnerung ab, wenn die Aufgabe gelöscht wird', async () => {
    const taskId = await createTaskWithDue('Bericht', DUE_SOON)
    await service.sync()

    device.clock.advance(1000)
    await device.repositories.deleteTask(taskId)
    await service.sync()

    expect(port.pending.size).toBe(0)
    expect(await device.db.reminders.count()).toBe(0)
  })

  it('verschiebt eine Erinnerung, wenn sich die Fälligkeit ändert', async () => {
    const taskId = await createTaskWithDue('Bericht', DUE_SOON)
    await service.sync()
    const alteNummer = [...port.pending.keys()][0]

    device.clock.advance(1000)
    await device.repositories.updateTask(taskId, { dueAt: DUE_LATER })
    await service.sync()

    expect(port.pending.size).toBe(1)
    expect([...port.pending.keys()][0]).toBe(alteNummer)
    expect([...port.pending.values()][0]?.at).toBe(DUE_LATER)
  })

  it('entfernt die Erinnerung, wenn das Fälligkeitsdatum gelöscht wird', async () => {
    const taskId = await createTaskWithDue('Bericht', DUE_SOON)
    await service.sync()

    device.clock.advance(1000)
    await device.repositories.updateTask(taskId, { dueAt: null })
    await service.sync()

    expect(port.pending.size).toBe(0)
  })

  it('plannt eine Aufgabe, die nach dem Öffnen wieder geöffnet wird, erneut', async () => {
    const taskId = await createTaskWithDue('Bericht', DUE_SOON)
    await device.repositories.setTaskCompleted(taskId, true)
    await service.sync()
    expect(port.pending.size).toBe(0)

    device.clock.advance(1000)
    await device.repositories.setTaskCompleted(taskId, false)
    const status = await service.sync()

    expect(status.scheduled).toBe(1)
    expect(port.titles()).toEqual(['Bericht'])
  })

  it('vergibt fortlaufende Nummern ohne Kollision', async () => {
    const list = await device.repositories.createList('Arbeit', userId)
    await device.repositories.createTask({ listId: list.id, title: 'A', dueAt: DUE_SOON })
    await device.repositories.createTask({ listId: list.id, title: 'B', dueAt: DUE_LATER })

    await service.sync()

    const nummern = [...port.pending.keys()].sort((a, b) => a - b)
    expect(nummern).toEqual([1, 2])
    expect(new Set(nummern).size).toBe(2)
  })

  it('meldet einen Fehler des Betriebssystems, ohne die App abzustürzen', async () => {
    await createTaskWithDue('Bericht', DUE_SOON)
    port.failScheduleWith = new Error('AlarmManager nicht verfügbar')

    const status = await service.sync()

    expect(status.kind).toBe('error')
    expect(status.message).toBe('AlarmManager nicht verfügbar')
    // Kein Eintrag, der einen Termin behauptet, den es nicht gibt.
    expect(await device.db.reminders.count()).toBe(0)
  })

  it('erholt sich nach einem Fehler beim nächsten Lauf', async () => {
    await createTaskWithDue('Bericht', DUE_SOON)
    port.failScheduleWith = new Error('kurzzeitig nicht verfügbar')
    expect((await service.sync()).kind).toBe('error')

    port.failScheduleWith = null
    const status = await service.sync()

    expect(status.kind).toBe('ok')
    expect(port.pending.size).toBe(1)
  })

  it('liefert den Status, ohne etwas zu verändern', async () => {
    await createTaskWithDue('Bericht', DUE_SOON)
    await service.sync()
    const vorher = port.scheduleCalls

    const status = await service.status()

    expect(status.kind).toBe('ok')
    expect(status.scheduled).toBe(1)
    expect(port.scheduleCalls).toBe(vorher)
  })
})
