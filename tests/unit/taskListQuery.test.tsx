import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useTasksQuery, useCompletedTasks } from '../../src/app/hooks'
import { localTask } from '../support/factories'

const workspace = vi.hoisted(() => ({ repositories: { listTasks: vi.fn(), listCompletedTasks: vi.fn() }, dataVersion: 0, contentVersion: undefined as number | undefined, nowMs: Date.parse('2026-01-01T10:00:00Z') }))
vi.mock('../../src/app/useWorkspace', () => ({ useWorkspace: () => workspace, useWorkspaceData: () => workspace }))
beforeEach(() => { vi.resetAllMocks(); workspace.dataVersion = 0; workspace.contentVersion = undefined })

it('zeigt beim Listenwechsel auch bei einem Lesefehler keine Aufgaben der vorherigen Liste', async () => {
  workspace.repositories.listTasks.mockResolvedValueOnce([localTask({ list_id: 'a' })]).mockRejectedValueOnce(new Error('IndexedDB'))
  const { result, rerender } = renderHook(({ id }) => useTasksQuery([id]), { initialProps: { id: 'a' } })
  await waitFor(() => expect(result.current.status).toBe('ready'))
  expect(result.current.tasks).toHaveLength(1)
  rerender({ id: 'b' })
  expect(result.current).toMatchObject({ status: 'loading', tasks: [] })
  await waitFor(() => expect(result.current.status).toBe('error'))
  expect(result.current.tasks).toEqual([])
  workspace.repositories.listTasks.mockResolvedValueOnce([localTask({ list_id: 'b', id: 'b' })])
  act(() => result.current.retry())
  await waitFor(() => expect(result.current.tasks.map(row => row.id)).toEqual(['b']))
})

it('lässt eine verspätete alte Erledigt-Abfrage nicht in einer anderen Liste erscheinen', async () => {
  let release!: (tasks: ReturnType<typeof localTask>[]) => void
  workspace.repositories.listCompletedTasks.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    .mockResolvedValueOnce([localTask({ list_id: 'b', id: 'b', completed: true })])
  const { result, rerender } = renderHook(({ id }) => useCompletedTasks(id), { initialProps: { id: 'a' } })
  rerender({ id: 'b' })
  await waitFor(() => expect(result.current.tasks.map(row => row.id)).toEqual(['b']))
  await act(async () => release([localTask({ list_id: 'a', completed: true })]))
  expect(result.current.tasks.map(row => row.id)).toEqual(['b'])
})

it('ersetzt nach einer Ansichtseinstellung keine unveränderten Aufgaben', async () => {
  const task = localTask()
  workspace.repositories.listTasks.mockImplementation(() => Promise.resolve([structuredClone(task)]))
  const { result, rerender } = renderHook(() => useTasksQuery(['a']))
  await waitFor(() => expect(result.current.tasks).toHaveLength(1))
  const first = result.current.tasks
  workspace.dataVersion++
  rerender()
  await waitFor(() => expect(workspace.repositories.listTasks).toHaveBeenCalledTimes(2))
  expect(result.current.tasks).toBe(first)
  expect(result.current.tasks[0]).toBe(first[0])
})

it('liest nach einer persönlichen Ansichtseinstellung keine Aufgaben neu, nach Inhaltsänderungen schon', async () => {
  workspace.contentVersion = 0
  workspace.repositories.listTasks.mockResolvedValue([localTask()])
  const { result, rerender } = renderHook(() => useTasksQuery(['a']))
  await waitFor(() => expect(result.current.tasks).toHaveLength(1))
  workspace.dataVersion++
  rerender()
  expect(workspace.repositories.listTasks).toHaveBeenCalledTimes(1)
  workspace.contentVersion++
  workspace.repositories.listTasks.mockResolvedValue([localTask({ title: 'Bearbeitet' })])
  rerender()
  await waitFor(() => expect(result.current.tasks[0].title).toBe('Bearbeitet'))
})
