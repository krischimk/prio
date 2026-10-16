import { useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useCloudConflicts, useOverviewPreferences } from '../app/hooks'
import { ViewContext, type ViewValue } from './viewContext'
import { NavigationContext } from '../app/navigationContext'

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
  const navigation = useContext(NavigationContext)!
  const preferred = useSyncExternalStore(navigation.subscribe, navigation.selectedListId)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [conflictsOpen, setConflictsOpen] = useState(false)
  const [overviewSettingsOpen, setOverviewSettingsOpen] = useState(false)
  const [overviewCreating, setOverviewCreating] = useState(false)
  const [taskDetail, setTaskDetail] = useState<ViewValue['taskDetail']>(null)
  const [listSettingsId, setListSettingsId] = useState<string | null>(null)
  const [tagFilters, setTagFilters] = useState<Record<string, string[]>>({})

  const selectList = navigation.selectList
  const [drawerMode, setDrawerMode] = useState<ViewValue['drawerMode']>('closed')

  const value = useMemo<ViewValue>(() => {
    const selectedListId = lists.some((list) => list.id === preferred)
      ? preferred
      : null
    return {
      lists,
      drawerMode, setDrawerMode,
      selected: lists.find((list) => list.id === selectedListId) ?? null,
      selectedListId,
      selectList,
      tagFilter: tagFilters[selectedListId ?? 'overview'] ?? [],
      setTagFilter: tags => setTagFilters(previous => ({ ...previous, [selectedListId ?? 'overview']: tags })),
      restoreOpen,
      accountOpen, setAccountOpen,
      setRestoreOpen,
      cloudConflicts, conflictsOpen, setConflictsOpen,
      overview, overviewSettingsOpen, setOverviewSettingsOpen,
      overviewCreating, setOverviewCreating, taskDetail, setTaskDetail,
      listSettingsId, setListSettingsId,
    }
  }, [lists, preferred, selectList, restoreOpen, accountOpen, cloudConflicts, conflictsOpen, overview, overviewSettingsOpen, overviewCreating, taskDetail, listSettingsId, drawerMode, tagFilters])

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>
}
