import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTaskQuery } from '../../src/app/hooks'
import { localTask } from '../support/factories'

const workspace = vi.hoisted(() => ({ repositories: { getTask: vi.fn() }, dataVersion: 0 }))
const getTask = workspace.repositories.getTask
vi.mock('../../src/app/useWorkspace', () => ({ useWorkspace: () => workspace }))

describe('Einzelne Aufgabe für einen Editor lesen', () => {
  beforeEach(() => { getTask.mockReset() })
  it('unterscheidet erstes Laden und eine nicht mehr vorhandene Aufgabe', async () => {
    getTask.mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useTaskQuery('fehlend'))
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.task).toBeNull()
  })

  it('zeigt einen Lesefehler und erlaubt einen erneuten Versuch', async () => {
    getTask.mockRejectedValueOnce(new Error('IndexedDB')).mockResolvedValueOnce(localTask())
    const { result } = renderHook(() => useTaskQuery('task-1'))
    await waitFor(() => expect(result.current.status).toBe('error'))
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.task?.id).toBe('task-1')
  })

  it('liefert beim ID-Wechsel weder die vorherige Aufgabe noch eine verspätete Antwort', async () => {
    let release!: (task: ReturnType<typeof localTask>) => void
    getTask.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
      .mockResolvedValueOnce(localTask({ id: 'b', title: 'B' }))
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useTaskQuery(id), { initialProps: { id: 'a' as string | null } })
    rerender({ id: 'b' })
    expect(result.current.task).toBeNull()
    await waitFor(() => expect(result.current.task?.id).toBe('b'))
    await act(async () => { release(localTask({ id: 'a' })) })
    expect(result.current.task?.id).toBe('b')
    rerender({ id: null })
    expect(result.current.task).toBeNull()
  })
})
