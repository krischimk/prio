import { useContext } from 'react'
import { UndoContext, type UndoContextValue } from './undoContext'

export function useUndo(): UndoContextValue {
  const value = useContext(UndoContext)
  if (!value) throw new Error('useUndo muss innerhalb von <UndoProvider> verwendet werden.')
  return value
}
