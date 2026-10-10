import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useCloudConflicts, useOverviewPreferences } from '../app/hooks'
import { ViewContext, type ViewValue } from './viewContext'

/**
 * Der Ansichtszustand, über der Verzweigung zwischen breiter und mobiler
 * Ansicht.
 *
 * Die gewählte Liste wird beim Rendern abgeleitet, nicht in einem Effekt
 * korrigiert: Existiert die gewünschte Liste nicht mehr (gelöscht oder Zugriff
 * entzogen), fällt die Anzeige auf die Gesamtansicht zurück. Sie ist auch der
 * Einstieg. Der bevorzugte Gesamtansicht-Modus kommt aus den persönlichen Daten.
 */
export function ViewProvider({ children, userId }: { children: ReactNode; userId: string }) {
  const overview = useOverviewPreferences(userId)
  const lists = overview.lists
  const cloudConflicts = useCloudConflicts()
  const [preferred, setPreferred] = useState<string | null>(null)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [conflictsOpen, setConflictsOpen] = useState(false)
  const [overviewSettingsOpen, setOverviewSettingsOpen] = useState(false)
  const [overviewCreating, setOverviewCreating] = useState(false)
  const [taskDetail, setTaskDetail] = useState<ViewValue['taskDetail']>(null)
  const [listSettingsId, setListSettingsId] = useState<string | null>(null)

  const selectList = useCallback((id: string | null) => setPreferred(id), [])

  const value = useMemo<ViewValue>(() => {
    const selectedListId = lists.some((list) => list.id === preferred)
      ? preferred
      : null
    return {
      lists,
      selected: lists.find((list) => list.id === selectedListId) ?? null,
      selectedListId,
      selectList,
      restoreOpen,
      setRestoreOpen,
      cloudConflicts, conflictsOpen, setConflictsOpen,
      overview, overviewSettingsOpen, setOverviewSettingsOpen,
      overviewCreating, setOverviewCreating, taskDetail, setTaskDetail,
      listSettingsId, setListSettingsId,
    }
  }, [lists, preferred, selectList, restoreOpen, cloudConflicts, conflictsOpen, overview, overviewSettingsOpen, overviewCreating, taskDetail, listSettingsId])

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>
}
