import { useContext } from 'react'
import { ViewContext, type ViewValue } from './viewContext'

/** Der Ansichtszustand – siehe `ViewProvider`. */
export function useView(): ViewValue {
  const value = useContext(ViewContext)
  if (!value) {
    throw new Error('useView braucht einen ViewProvider über der Ansicht.')
  }
  return value
}
