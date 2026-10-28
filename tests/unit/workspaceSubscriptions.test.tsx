import { act, render, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { WorkspaceProvider } from '../../src/app/WorkspaceProvider'
import { useNowMs, useRepositories, useWorkspace, useWorkspaceData } from '../../src/app/useWorkspace'
import type { Repositories } from '../../src/db/repositories'
import type { WorkspaceRuntime, WorkspaceZustand } from '../../src/app/workspaceRuntime'
import type { RemoteGateway } from '../../src/sync/remoteGateway'
import type { NetworkMonitor } from '../../src/sync/network'

const runtime = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('../../src/app/workspaceRuntime', () => ({ createWorkspaceRuntime: async () => runtime.current }))

it('zeichnet Daten und Aktionen nicht bei Synchronisationsmeldungen neu; Daten und Uhr bleiben aktuell', async () => {
  let state: WorkspaceZustand = { datenVersion: 0, inhaltVersion: 0, jetztMs: 1000, syncStatus: null, syncing: false, pendingCount: 0, rejectedCount: 0, reminderStatus: null }
  const listeners = new Set<() => void>()
  const repositories = {} as Repositories
  runtime.current = { repositories, zustand: () => state, abonnieren: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    synchronisieren: vi.fn(), erinnerungenErlauben: vi.fn(), erinnerungenAuffrischen: vi.fn(), schliessen: vi.fn(), shareList: vi.fn() } satisfies WorkspaceRuntime
  const data = vi.fn(), action = vi.fn(), clock = vi.fn(), status = vi.fn()
  function Data() { data(useWorkspaceData()); return null }
  function Action() { action(useRepositories()); return null }
  function Clock() { clock(useNowMs()); return null }
  function Status() { status(useWorkspace().syncing); return null }
  render(<WorkspaceProvider userId="test" gateway={{} as RemoteGateway} network={{} as NetworkMonitor}><Data /><Action /><Clock /><Status /></WorkspaceProvider>)
  await waitFor(() => expect(data).toHaveBeenCalledTimes(1))
  act(() => { state = { ...state, syncing: true }; listeners.forEach(listener => listener()) })
  expect(status).toHaveBeenLastCalledWith(true)
  expect(data).toHaveBeenCalledTimes(1)
  expect(action).toHaveBeenCalledTimes(1)
  expect(clock).toHaveBeenCalledTimes(1)
  act(() => { state = { ...state, datenVersion: 1 }; listeners.forEach(listener => listener()) })
  expect(data).toHaveBeenCalledTimes(2)
  expect(action).toHaveBeenCalledTimes(1)
  act(() => { state = { ...state, jetztMs: 2000 }; listeners.forEach(listener => listener()) })
  expect(clock).toHaveBeenLastCalledWith(2000)
  expect(data).toHaveBeenLastCalledWith({ repositories, dataVersion: 1, contentVersion: 0, nowMs: 2000 })
})
