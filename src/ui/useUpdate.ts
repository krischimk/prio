import { useContext } from 'react'
import { UpdateContext, type UpdateContextValue } from './updateContext'

export function useUpdate(): UpdateContextValue {
  const value = useContext(UpdateContext)
  if (!value) throw new Error('useUpdate muss innerhalb von <UpdateProvider> verwendet werden.')
  return value
}
