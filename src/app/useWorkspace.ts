import { useContext } from 'react'
import { WorkspaceContext, type WorkspaceValue } from './workspaceContext'

export function useWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace muss innerhalb von <WorkspaceProvider> verwendet werden.')
  return value
}
