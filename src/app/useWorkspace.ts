import { useContext, useState } from 'react'
import { WorkspaceContext, WorkspaceDataContext, RepositoriesContext, WorkspaceClockContext, type WorkspaceValue } from './workspaceContext'

export function useWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace muss innerhalb von <WorkspaceProvider> verwendet werden.')
  return value
}

export function useWorkspaceData() {
  const value = useContext(WorkspaceDataContext)
  if (!value) throw new Error('useWorkspaceData braucht einen WorkspaceProvider.')
  return value
}

export function useRepositories() {
  const value = useContext(RepositoriesContext)
  if (!value) throw new Error('useRepositories braucht einen WorkspaceProvider.')
  return value
}

export function useNowMs() {
  const [initialNow] = useState(Date.now)
  return useContext(WorkspaceClockContext) ?? initialNow
}
