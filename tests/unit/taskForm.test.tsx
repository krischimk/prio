import { act, renderHook } from '@testing-library/react'
import type { FormEvent, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repositories } from '../../src/db/repositories'
import type { LocalTask } from '../../src/domain/types'
import { TaskDraftProvider } from '../../src/ui/TaskDraftProvider'
import { useTaskForm } from '../../src/ui/useTaskForm'
import { createFakeServer } from '../support/fakeGateway'
import { createDevice, type DeviceHarness } from '../support/harness'

let repositories: Repositories
vi.mock('../../src/app/useWorkspace', () => ({ useWorkspace: () => ({ repositories }) }))
const event = { preventDefault() {} } as FormEvent
const wrapper = ({ children }: { children: ReactNode }) => <TaskDraftProvider>{children}</TaskDraftProvider>

describe('Aufgabenentwürfe und Speichern', () => {
  let device: DeviceHarness
  let listId: string
  beforeEach(async () => {
    device = await createDevice({ userId: 'form', gateway: createFakeServer().gatewayFor('form') })
    repositories = device.repositories
    listId = (await repositories.createList('Einkaufen', 'form')).id
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await device.dispose()
  })

  function open(task: LocalTask | null = null) {
    const onSaved = vi.fn()
    const hook = renderHook((props: { task: LocalTask | null; listId: string }) =>
      useTaskForm({ ...props, onSaved }), { wrapper, initialProps: { task, listId } })
    return { ...hook, onSaved }
  }

  it('behält eine neue Eingabe in ihrer Liste und speichert erst beim Hinzufügen', async () => {
    const other = await repositories.createList('Arbeit', 'form')
    const { result, rerender } = open()
    act(() => result.current.setzen('title', 'Milch'))
    expect(await repositories.listTasks(listId)).toEqual([])
    rerender({ task: null, listId: other.id })
    expect(result.current.werte.title).toBe('')
    act(() => result.current.setzen('title', 'Bericht'))
    rerender({ task: null, listId })
    expect(result.current.werte.title).toBe('Milch')
    await act(async () => { await result.current.speichern(event) })
    expect((await repositories.listTasks(listId)).map(task => task.title)).toEqual(['Milch'])
    expect(await repositories.listTasks(other.id)).toEqual([])
    expect(result.current.werte.title).toBe('')
    rerender({ task: null, listId: other.id })
    expect(result.current.werte.title).toBe('Bericht')
  })

  it('hält gleichnamige Aufgabenentwürfe getrennt und verwirft ausdrücklich', async () => {
    const a = await repositories.createTask({ listId, title: 'Gleich' })
    const b = await repositories.createTask({ listId, title: 'Gleich' })
    const { result, rerender } = open(a)
    act(() => result.current.setzen('description', 'Nur A'))
    rerender({ task: b, listId })
    expect(result.current.werte.description).toBe('')
    rerender({ task: a, listId })
    expect(result.current.werte.description).toBe('Nur A')
    act(() => result.current.zuruecksetzen())
    expect(result.current.werte.description).toBe('')
  })

  it('schickt nur geänderte Felder und erhält externe Änderungen samt Terminsekunden', async () => {
    const task = await repositories.createTask({ listId, title: 'Alt', dueAt: '2026-06-01T10:00:37.000Z' })
    const { result, rerender } = open(task)
    act(() => result.current.setzen('title', 'Mein Titel'))
    const current = await repositories.updateTask(task.id, { description: 'Andere Notiz' })
    rerender({ task: current, listId })
    const write = vi.spyOn(repositories, 'updateTask')
    await act(async () => { await result.current.speichern(event) })
    expect(write).toHaveBeenCalledWith(task.id, { title: 'Mein Titel' }, expect.objectContaining({ base: expect.objectContaining({ taskId: task.id }) }))
    expect(await repositories.getTask(task.id)).toMatchObject({ title: 'Mein Titel', description: 'Andere Notiz', due_at: task.due_at })
  })

  it('zeigt einen Feldkonflikt, erhält die Eingabe und lädt nur bewusst neu', async () => {
    const task = await repositories.createTask({ listId, title: 'Alt' })
    const { result, rerender, onSaved } = open(task)
    act(() => result.current.setzen('title', 'Mein Entwurf'))
    const current = await repositories.updateTask(task.id, { title: 'Andere Änderung' })
    rerender({ task: current, listId })
    await act(async () => { await result.current.speichern(event) })
    expect(result.current.error).toContain('inzwischen geändert')
    expect(result.current.werte.title).toBe('Mein Entwurf')
    expect(onSaved).not.toHaveBeenCalled()
    expect((await repositories.getTask(task.id))?.title).toBe('Andere Änderung')
    act(() => result.current.neuLaden?.())
    expect(result.current.werte.title).toBe('Andere Änderung')
    expect(result.current.error).toBeNull()
    act(() => result.current.setzen('title', 'Neue Bearbeitung'))
    await act(async () => { await result.current.speichern(event) })
    expect((await repositories.getTask(task.id))?.title).toBe('Neue Bearbeitung')
  })

  it('folgt aktuellen Daten bis zur ersten eigenen Eingabe', async () => {
    const task = await repositories.createTask({ listId, title: 'Alt' })
    const { result, rerender } = open(task)
    const current = await repositories.updateTask(task.id, { title: 'Neu' })
    rerender({ task: current, listId })
    expect(result.current.werte.title).toBe('Neu')
    expect(result.current.geaendert).toBe(false)
  })

  it('behält einen fehlgeschlagenen Entwurf und erlaubt einen erneuten Versuch', async () => {
    const { result, onSaved } = open()
    act(() => result.current.setzen('title', 'Milch'))
    vi.spyOn(repositories, 'createTask').mockRejectedValueOnce(new Error('Lokal nicht gespeichert'))
    await act(async () => { await result.current.speichern(event) })
    expect(result.current.werte.title).toBe('Milch')
    expect(result.current.error).toBe('Lokal nicht gespeichert')
    expect(result.current.busy).toBe(false)
    expect(result.current.neuLaden).toBeNull()
    expect(onSaved).not.toHaveBeenCalled()
    await act(async () => { await result.current.speichern(event) })
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(await repositories.listTasks(listId)).toHaveLength(1)
  })

  it('sperrt doppelte Submit-Ereignisse und lässt einen späteren Abschluss beim richtigen Entwurf', async () => {
    const other = await repositories.createList('Arbeit', 'form')
    const { result, rerender, onSaved } = open()
    act(() => result.current.setzen('title', 'Milch'))
    const original = repositories.createTask.bind(repositories)
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const write = vi.spyOn(repositories, 'createTask').mockImplementation(async input => { await gate; return original(input) })
    const form = result.current
    let first!: Promise<void>
    let duplicate!: Promise<void>
    act(() => { first = form.speichern(event); duplicate = form.speichern(event) })
    expect(write).toHaveBeenCalledTimes(1)
    act(() => result.current.setzen('title', 'Während Speichern'))
    expect(result.current.werte.title).toBe('Milch')
    rerender({ task: null, listId: other.id })
    act(() => result.current.setzen('title', 'Bericht'))
    await act(async () => { release(); await Promise.all([first, duplicate]) })
    expect(onSaved).not.toHaveBeenCalled()
    expect(result.current.werte.title).toBe('Bericht')
    expect((await repositories.listTasks(listId)).map(task => task.title)).toEqual(['Milch'])
  })
})
