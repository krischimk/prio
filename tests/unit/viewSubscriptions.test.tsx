import { act, render } from '@testing-library/react'
import { memo, useLayoutEffect } from 'react'
import { expect, it, vi } from 'vitest'
import { createNavigation } from '../../src/app/navigation'
import { NavigationContext } from '../../src/app/navigationContext'
import type { OverviewPreferencesQuery } from '../../src/app/hooks'
import { ViewProvider } from '../../src/ui/ViewProvider'
import { useTaskView, useView } from '../../src/ui/useView'
import type { ViewValue } from '../../src/ui/viewContext'
import { localList, localUserPreference } from '../support/factories'

const state = vi.hoisted(() => ({ overview: null as unknown as OverviewPreferencesQuery, conflicts: [] }))
vi.mock('../../src/app/hooks', () => ({ useOverviewPreferences: () => state.overview, useCloudConflicts: () => state.conflicts }))
vi.mock('../../src/ui/CalendarDataProvider', () => ({ CalendarDataProvider: ({ children }: { children: React.ReactNode }) => children }))

it('hält Aufgabenleser bei Menü- und Dialogwechseln stabil und meldet weiterhin Filter und persönliche Daten', () => {
  state.overview = { status: 'ready', lists: [localList()], preferences: [], userPreference: localUserPreference(), retry: vi.fn() }
  const navigation = createNavigation({ push() {}, replace() {}, go() {}, listen: () => () => {} }, 'test')
  let controls!: ViewValue
  const renders = vi.fn()
  const Reader = memo(function Reader() { renders(useTaskView()); return null })
  function Controls() {
    const view = useView()
    useLayoutEffect(() => { controls = view }, [view])
    return null
  }
  const ui = () => <NavigationContext value={navigation}><ViewProvider userId="user-1"><Reader /><Controls /></ViewProvider></NavigationContext>
  const { rerender, unmount } = render(ui())
  expect(renders).toHaveBeenCalledTimes(1)
  act(() => controls.setDrawerMode('open'))
  act(() => controls.setTaskDetail({ taskId: 'task', listId: 'list' }))
  act(() => controls.setAccountOpen(true))
  expect(renders).toHaveBeenCalledTimes(1)
  act(() => controls.setTagFilter(['Uni']))
  expect(renders).toHaveBeenCalledTimes(2)
  expect(renders.mock.lastCall?.[0].tagFilter).toEqual(['Uni'])
  state.overview = { ...state.overview, userPreference: localUserPreference({ detailed_ratings: true }) }
  rerender(ui())
  expect(renders).toHaveBeenCalledTimes(3)
  expect(renders.mock.lastCall?.[0].overview.userPreference.detailed_ratings).toBe(true)
  unmount(); navigation.dispose()
})
