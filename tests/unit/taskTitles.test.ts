import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { taskSeriesId, taskTitleKey } from '../../src/domain/taskTitles'
import { normalisiereAufgabe, normalisiereListe } from '../../src/domain/normalize'
import { createDevice, type DeviceHarness } from '../support/harness'
import { createFakeServer } from '../support/fakeGateway'
import { localList, localTask } from '../support/factories'

const owner = 'owner'
const duplicate = /bereits eine offene oder erledigte Aufgabe/
let device: DeviceHarness
beforeEach(async () => { device = await createDevice({ userId: owner, gateway: createFakeServer().gatewayFor(owner) }) })
afterEach(async () => { await device.dispose() })

describe('Aufgabennamen pro Liste', () => {
  it('vereinheitlicht Großschreibung und alle JS-Leerzeichen, behält Satzzeichen und Umlaute', () => {
    expect(taskTitleKey(' \tZELT\u00a0 \n aufbauen\u2009')).toBe('zelt aufbauen')
    expect(taskTitleKey('Ärger!')).toBe('ärger!')
    expect(taskTitleKey('Zelt!')).not.toBe(taskTitleKey('Zelt'))
  })
  it('normalisiert alte Zeilen ohne die neuen Felder', () => {
    const list = localList(), task = localTask()
    Reflect.deleteProperty(list, 'allow_duplicate_titles'); Reflect.deleteProperty(task, 'recurrence_series_id')
    expect(normalisiereListe(list).allow_duplicate_titles).toBe(true)
    expect(normalisiereAufgabe(task).recurrence_series_id).toBeNull()
  })
  it('erlaubt Duplikate zunächst, erhält sie beim Abschalten und lässt Notizen und Zustände bearbeiten', async () => {
    const list = await device.repositories.createList('Packen', owner)
    expect(list.allow_duplicate_titles).toBe(true)
    const a = await device.repositories.createTask({ listId: list.id, title: 'Zelt' })
    await device.repositories.createTask({ listId: list.id, title: 'zelt' })
    await device.repositories.setListAllowDuplicateTitles(list.id, owner, false)
    expect(await device.repositories.listTasks(list.id)).toHaveLength(2)
    await device.repositories.updateTask(a.id, { title: ' ZELT ', description: 'Neue Notiz' })
    await device.repositories.setTaskCompleted(a.id, true)
    await device.repositories.setTaskCompleted(a.id, false)
    await expect(device.repositories.createTask({ listId: list.id, title: 'Zelt' })).rejects.toThrow(duplicate)
    await expect(device.repositories.setListAllowDuplicateTitles(list.id, 'member', true)).rejects.toThrow(/Besitzer/)
    await device.repositories.setListAllowDuplicateTitles(list.id, owner, true)
    await expect(device.repositories.createTask({ listId: list.id, title: 'Zelt' })).resolves.toBeDefined()
  })
  it('prüft erledigte Aufgaben, ignoriert endgültig abgelaufene und gelöschte Aufgaben', async () => {
    const list = await device.repositories.createList('Packen', owner, { allowDuplicateTitles: false, keepCompleted: true })
    const a = await device.repositories.createTask({ listId: list.id, title: 'Zelt aufbauen' })
    await device.repositories.setTaskCompleted(a.id, true)
    await expect(device.repositories.createTask({ listId: list.id, title: ' ZELT\u00a0 aufbauen ' })).rejects.toThrow(duplicate)
    await device.repositories.deleteTask(a.id)
    const b = await device.repositories.createTask({ listId: list.id, title: 'Zelt aufbauen' })
    await expect(device.repositories.restoreTask(a.id)).rejects.toThrow(duplicate)
    await device.repositories.setListKeepCompleted(list.id, owner, false)
    await device.repositories.setTaskCompleted(b.id, true)
    device.clock.advance(8 * 86400000)
    await expect(device.repositories.createTask({ listId: list.id, title: 'Zelt aufbauen' })).resolves.toBeDefined()
  })
  it('lehnt Kollisionen beim Umbenennen, Verschieben und Ziehen ohne Teiländerungen ab', async () => {
    const source = await device.repositories.createList('Quelle', owner)
    const target = await device.repositories.createList('Ziel', owner, { allowDuplicateTitles: false })
    const a = await device.repositories.createTask({ listId: source.id, title: 'Zelt' })
    const b = await device.repositories.createTask({ listId: target.id, title: 'Zelt' })
    const c = await device.repositories.createTask({ listId: target.id, title: 'Schlafsack' })
    const before = await device.db.tasks.toArray()
    await expect(device.repositories.updateTask(c.id, { title: 'ZELT' })).rejects.toThrow(duplicate)
    await expect(device.repositories.moveTask(a.id, target.id)).rejects.toThrow(duplicate)
    await expect(device.repositories.placeTask(a.id, { listId: target.id, sectionId: null, beforeTaskId: b.id })).rejects.toThrow(duplicate)
    expect(await device.db.tasks.toArray()).toEqual(before)
  })
  it('serialisiert gleichzeitiges lokales Anlegen', async () => {
    const list = await device.repositories.createList('Packen', owner, { allowDuplicateTitles: false })
    const result = await Promise.allSettled(['Zelt', 'zelt'].map(title => device.repositories.createTask({ listId: list.id, title })))
    expect(result.map(row => row.status).sort()).toEqual(['fulfilled', 'rejected'])
    expect(await device.repositories.listTasks(list.id)).toHaveLength(1)
  })
  it('erlaubt automatische Wiederholungen derselben Serie, aber keine manuell angelegte zweite Serie', async () => {
    const list = await device.repositories.createList('Routine', owner, { allowDuplicateTitles: false, keepCompleted: true })
    const task = await device.repositories.createTask({ listId: list.id, title: 'Lesen', dueAt: '2026-01-01T20:00:00Z', recurrence: 'daily' })
    const done = await device.repositories.setTaskCompleted(task.id, true)
    const next = (await device.repositories.getTask(done.successor_id!))!
    expect(next.recurrence_series_id).toBe(task.id)
    const nextDone = await device.repositories.setTaskCompleted(next.id, true)
    expect((await device.repositories.getTask(nextDone.successor_id!))?.recurrence_series_id).toBe(task.id)
    await expect(device.repositories.createTask({ listId: list.id, title: 'Lesen' })).rejects.toThrow(duplicate)
    await expect(device.repositories.createTask({ listId: list.id, title: 'Lesen', dueAt: '2026-01-01T20:00:00Z', recurrence: 'daily' })).rejects.toThrow(duplicate)
    await device.repositories.setTaskCompleted(next.id, false)
    await device.repositories.setTaskCompleted(next.id, true)
  })
  it('findet dieselbe Serienkennung in alten Vorgänger-/Nachfolgerketten', () => {
    const a = localTask({ id: 'a', successor_id: 'b' }), b = localTask({ id: 'b', successor_id: 'c' }), c = localTask({ id: 'c' })
    for (const row of [a, b, c]) expect(taskSeriesId(row, [a, b, c])).toBe('a')
    expect(taskSeriesId(c, [{ ...a, recurrence_series_id: 'known' }, b, c])).toBe('known')
  })
})
