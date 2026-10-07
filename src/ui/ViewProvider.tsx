import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useLists } from '../app/hooks'
import { ViewContext, type ViewValue } from './viewContext'

/**
 * Der Ansichtszustand, über der Verzweigung zwischen breiter und mobiler
 * Ansicht.
 *
 * Die gewählte Liste wird beim Rendern abgeleitet, nicht in einem Effekt
 * korrigiert: Existiert die gewünschte Liste nicht mehr (gelöscht oder Zugriff
 * entzogen), fällt die Anzeige automatisch auf die erste verfügbare zurück.
 */
export function ViewProvider({ children }: { children: ReactNode }) {
  const lists = useLists()
  const [preferred, setPreferred] = useState<string | null>(null)
  const [restoreOpen, setRestoreOpen] = useState(false)

  const selectList = useCallback((id: string | null) => setPreferred(id), [])

  const value = useMemo<ViewValue>(() => {
    const selectedListId = lists.some((list) => list.id === preferred)
      ? preferred
      : (lists[0]?.id ?? null)
    return {
      lists,
      selected: lists.find((list) => list.id === selectedListId) ?? null,
      selectedListId,
      selectList,
      restoreOpen,
      setRestoreOpen,
    }
  }, [lists, preferred, selectList, restoreOpen])

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>
}
