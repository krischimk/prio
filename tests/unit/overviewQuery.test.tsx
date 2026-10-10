import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOverviewPreferences, useOverviewTasks } from '../../src/app/hooks'
import { localList, localTask, localUserPreference } from '../support/factories'

const workspace = vi.hoisted(() => ({ repositories: { listLists: vi.fn(), listListPreferences: vi.fn(), getUserPreferences: vi.fn(), listTasks: vi.fn() }, dataVersion: 0 }))
vi.mock('../../src/app/useWorkspace', () => ({ useWorkspace: () => workspace }))
beforeEach(() => {
  Object.values(workspace.repositories).forEach(mock => mock.mockReset())
  workspace.repositories.listLists.mockResolvedValue([localList()])
  workspace.repositories.listListPreferences.mockResolvedValue([])
  workspace.repositories.getUserPreferences.mockResolvedValue(localUserPreference({ overview_mode: 'newest' }))
})

describe('Gesamtansicht lesen', () => {
  it('setzt einen gespeicherten Modus bei einem Lesefehler nicht zurück und kann erneut laden', async () => {
    workspace.repositories.getUserPreferences.mockRejectedValueOnce(new Error('IndexedDB'))
    const { result } = renderHook(() => useOverviewPreferences('user-1'))
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('error'))
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.userPreference?.overview_mode).toBe('newest')
  })

  it('liefert nach einem Kontowechsel auch bei Fehlern keine vorherigen Einstellungen', async () => {
    const { result, rerender } = renderHook(({ id }) => useOverviewPreferences(id), { initialProps: { id: 'user-1' } })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    workspace.repositories.getUserPreferences.mockRejectedValueOnce(new Error('IndexedDB'))
    rerender({ id: 'user-2' })
    expect(result.current.userPreference).toBeNull()
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.lists).toEqual([])
    expect(result.current.userPreference).toBeNull()
  })

  it('verfolgt ausgeschlossene Listen nicht und zeigt keine verspäteten Aufgaben eines alten Scopes', async () => {
    let release!: (tasks: ReturnType<typeof localTask>[]) => void
    workspace.repositories.listTasks.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
      .mockResolvedValueOnce([localTask({ list_id: 'b', id: 'b' }), localTask({ list_id: 'b', id: 'done', completed: true })])
    const { result, rerender } = renderHook(({ ids }) => useOverviewTasks(ids), { initialProps: { ids: ['a'] } })
    rerender({ ids: ['b'] })
    expect(result.current.tasks).toEqual([])
    await waitFor(() => expect(result.current.tasks.map(task => task.id)).toEqual(['b']))
    await act(async () => release([localTask({ list_id: 'a' })]))
    expect(result.current.tasks.map(task => task.id)).toEqual(['b'])
    rerender({ ids: [] })
    expect(result.current.tasks).toEqual([])
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(workspace.repositories.listTasks).toHaveBeenCalledTimes(2)
  })
})
