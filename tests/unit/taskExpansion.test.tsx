import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useTaskExpansion } from '../../src/ui/useTaskExpansion'

const state = vi.hoisted(() => ({
  repositories: { setTaskExpanded: vi.fn() },
  overview: { status: 'ready', userPreference: { task_expansions: {} as Record<string, number> } },
}))
vi.mock('../../src/app/useWorkspace', () => ({ useRepositories: () => state.repositories }))
vi.mock('../../src/ui/useView', () => ({ useTaskView: () => ({ overview: state.overview }) }))
beforeEach(() => { state.repositories.setTaskExpanded.mockReset(); state.overview.status = 'ready'; state.overview.userPreference.task_expansions = {} })

it('reagiert sofort, bestätigt über den DB-Leser und übernimmt danach Änderungen anderer Geräte', async () => {
  let finish!: () => void
  state.repositories.setTaskExpanded.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
  const { result, rerender } = renderHook(() => useTaskExpansion('user', 'task', 'note'))
  let writing!: Promise<void>
  act(() => { writing = result.current.toggle() })
  expect(result.current.open).toBe(true)
  expect(result.current.busy).toBe(true)
  expect(state.repositories.setTaskExpanded).toHaveBeenCalledWith('user', 'task', 'note', true)
  await act(async () => { finish(); await writing })
  expect(result.current.open).toBe(true)
  expect(result.current.busy).toBe(true)
  state.overview.userPreference.task_expansions = { task: 3 }
  rerender()
  await waitFor(() => expect(result.current.busy).toBe(false))
  state.overview.userPreference.task_expansions = { task: 2 }
  rerender()
  expect(result.current.open).toBe(false)
})

it('nimmt einen fehlgeschlagenen Klick zurück und lässt einen neuen Versuch zu', async () => {
  state.repositories.setTaskExpanded.mockRejectedValueOnce(new Error('Speicher voll')).mockResolvedValueOnce(undefined)
  const { result } = renderHook(() => useTaskExpansion('user', 'task', 'checklist'))
  await act(async () => { await result.current.toggle() })
  expect(result.current.open).toBe(false)
  expect(result.current.busy).toBe(false)
  expect(result.current.error).toBe('Speicher voll')
  await act(async () => { await result.current.toggle() })
  expect(result.current.open).toBe(true)
  expect(result.current.error).toBeNull()
})

it('bleibt bei einem fehlgeschlagenen Bestätigungslesen bedienbar', async () => {
  state.repositories.setTaskExpanded.mockResolvedValue(undefined)
  const { result, rerender } = renderHook(() => useTaskExpansion('user', 'task', 'note'))
  await act(async () => { await result.current.toggle() })
  state.overview.status = 'error'
  rerender()
  await waitFor(() => expect(result.current.busy).toBe(false))
  expect(result.current.error).toMatch(/nicht gelesen/)
})
