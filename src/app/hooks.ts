import { useEffect, useState } from 'react'
import type { LocalList, LocalListMember, LocalListPreference, LocalUserPreference, LocalTask, ShareContact } from '../domain/types'
import { useWorkspace } from './useWorkspace'
import type { CloudConflict } from '../domain/cloudMerge'

/**
 * Lese-Hooks auf die lokale Datenbank.
 *
 * Alle Hooks hängen an `dataVersion`. Ändert sich die lokale Datenbank (durch
 * eine Benutzeraktion oder durch einen Pull), werden die Daten neu gelesen.
 * Das ersetzt eine State-Bibliothek durch wenige Zeilen Code – und es gibt nur
 * eine Wahrheit: die lokale Datenbank.
 */

/** Lädt einen Wert und meldet ihn, solange die Komponente noch eingebunden ist. */
function subscribe<T>(load: () => Promise<T>, onValue: (value: T) => void): () => void {
  let active = true
  load()
    .then((value) => {
      if (active) onValue(value)
    })
    .catch(() => {
      // Lesefehler dürfen die Oberfläche nicht blockieren; der letzte bekannte
      // Stand bleibt stehen.
    })
  return () => {
    active = false
  }
}

/**
 * Adressen, mit denen schon einmal eine Liste geteilt wurde – zuletzt
 * verwendete zuerst.
 *
 * Eine Eingabehilfe für das Teilen-Formular: Sie liegt in `meta`, wird nicht
 * synchronisiert und füllt sich nur aus dem, was der Benutzer selbst einträgt.
 */
export function useShareContacts(): ShareContact[] {
  const { repositories, dataVersion } = useWorkspace()
  const [contacts, setContacts] = useState<ShareContact[]>([])
  useEffect(
    () => subscribe(() => repositories.listShareContacts(), setContacts),
    [repositories, dataVersion],
  )
  return contacts
}

export function useLists(): LocalList[] {
  const { repositories, dataVersion } = useWorkspace()
  const [lists, setLists] = useState<LocalList[]>([])
  useEffect(() => subscribe(() => repositories.listLists(), setLists), [repositories, dataVersion])
  return lists
}

export interface OverviewPreferencesQuery {
  status: 'loading' | 'ready' | 'error'
  lists: LocalList[]
  preferences: LocalListPreference[]
  userPreference: LocalUserPreference | null
  retry: () => void
}

/** Listen und persönliche Regeln laden zusammen; ein Fehler ist kein leerer Bestand. */
export function useOverviewPreferences(userId: string): OverviewPreferencesQuery {
  const { repositories, dataVersion } = useWorkspace()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Omit<OverviewPreferencesQuery, 'retry'> & { userId: string }>({
    userId: '', status: 'loading', lists: [], preferences: [], userPreference: null,
  })
  useEffect(() => {
    let active = true
    Promise.all([repositories.listLists(), repositories.listListPreferences(userId), repositories.getUserPreferences(userId)])
      .then(([lists, preferences, userPreference]) => {
        if (active) setResult({ userId, status: 'ready', lists, preferences, userPreference: userPreference ?? null })
      }).catch(() => {
        if (active) setResult(previous => previous.userId === userId ? { ...previous, status: 'error' } : { userId, status: 'error', lists: [], preferences: [], userPreference: null })
      })
    return () => { active = false }
  }, [repositories, dataVersion, userId, attempt])
  const retry = () => setAttempt(value => value + 1)
  if (result.userId !== userId) return { status: 'loading', lists: [], preferences: [], userPreference: null, retry }
  return { ...result, retry }
}

/** Nur Aufgaben der ausdrücklich aktivierten Listen; die Liste bleibt ihre Heimat. */
export function useOverviewTasks(listIds: string[]): { status: 'loading' | 'ready' | 'error'; tasks: LocalTask[]; retry: () => void } {
  const { repositories, dataVersion } = useWorkspace()
  const scope = JSON.stringify(listIds)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ scope: string; status: 'ready' | 'error'; tasks: LocalTask[] }>({ scope: '[]', status: 'ready', tasks: [] })
  useEffect(() => {
    let active = true
    const ids: string[] = JSON.parse(scope)
    Promise.all(ids.map(id => repositories.listTasks(id))).then(groups => {
      if (active) setResult({ scope, status: 'ready', tasks: groups.flat().filter(task => !task.completed) })
    }).catch(() => {
      if (active) setResult(previous => ({ scope, status: 'error', tasks: previous.scope === scope ? previous.tasks : [] }))
    })
    return () => { active = false }
  }, [repositories, dataVersion, scope, attempt])
  const retry = () => setAttempt(value => value + 1)
  return result.scope === scope ? { ...result, retry } : { status: 'loading', tasks: [], retry }
}

export function useCloudConflicts(): CloudConflict[] {
  const { repositories, dataVersion } = useWorkspace()
  const [conflicts, setConflicts] = useState<CloudConflict[]>([])
  useEffect(() => subscribe(() => repositories.listCloudConflicts(), setConflicts), [repositories, dataVersion])
  return conflicts
}

export function useTasks(listId: string | null): LocalTask[] {
  const { repositories, dataVersion } = useWorkspace()
  const [tasks, setTasks] = useState<LocalTask[]>([])
  useEffect(
    () => subscribe(() => (listId === null ? Promise.resolve([]) : repositories.listTasks(listId)), setTasks),
    [repositories, dataVersion, listId],
  )
  return tasks
}

export function useCompletedTasks(listId: string): { status: 'loading' | 'ready' | 'error'; tasks: LocalTask[]; retry: () => void } {
  const { repositories, dataVersion } = useWorkspace()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ listId: string; status: 'ready' | 'error'; tasks: LocalTask[] }>({ listId: '', status: 'ready', tasks: [] })
  useEffect(() => {
    let active = true
    repositories.listCompletedTasks(listId).then(tasks => {
      if (active) setResult({ listId, status: 'ready', tasks })
    }).catch(() => {
      if (active) setResult(previous => ({ listId, status: 'error', tasks: previous.listId === listId ? previous.tasks : [] }))
    })
    return () => { active = false }
  }, [repositories, dataVersion, listId, attempt])
  const retry = () => setAttempt(value => value + 1)
  return result.listId === listId ? { ...result, retry } : { status: 'loading', tasks: [], retry }
}

/**
 * Gelöschte Aufgaben der letzten Tage – zuletzt gelöschte zuerst.
 *
 * `aktiv` wie bei `useRestorableTasks`: Das Fenster ist meistens zu, und ein
 * Lesevorgang für ein unsichtbares Fenster ist verschwendet.
 */
export function useDeletedTasks(aktiv = true): LocalTask[] {
  const { repositories, dataVersion } = useWorkspace()
  const [tasks, setTasks] = useState<LocalTask[]>([])
  useEffect(() => {
    if (!aktiv) return
    return subscribe(() => repositories.listDeletedTasks(), setTasks)
  }, [repositories, dataVersion, aktiv])
  return tasks
}

/** Gelöschte Listen der letzten Tage – zuletzt gelöschte zuerst. */
export function useDeletedLists(aktiv = true): LocalList[] {
  const { repositories, dataVersion } = useWorkspace()
  const [lists, setLists] = useState<LocalList[]>([])
  useEffect(() => {
    if (!aktiv) return
    return subscribe(() => repositories.listDeletedLists(), setLists)
  }, [repositories, dataVersion, aktiv])
  return lists
}

/**
 * Eine einzelne Aufgabe.
 *
 * Für die Rückgängig-Leiste: Sie merkt sich nur die Kennung und liest den Titel
 * hier nach. Kopierte Daten (`{ taskId, title }`) zeigten nach einer Umbenennung
 * innerhalb der fünf Sekunden den alten Titel.
 */
export function useTask(taskId: string | null): LocalTask | null {
  return useTaskQuery(taskId).task
}

/** Für einen Editor müssen fehlende Daten, Laden und Lesefehler unterscheidbar sein. */
export function useTaskQuery(taskId: string | null): {
  status: 'loading' | 'ready' | 'error'
  task: LocalTask | null
  retry: () => void
} {
  const { repositories, dataVersion } = useWorkspace()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ id: string | null; status: 'ready' | 'error'; task: LocalTask | null }>({ id: null, status: 'ready', task: null })
  useEffect(() => {
    let active = true
    if (taskId !== null) {
      repositories.getTask(taskId).then(task => {
        if (active) setResult({ id: taskId, status: 'ready', task: task ?? null })
      }).catch(() => {
        if (active) setResult(previous => ({ id: taskId, status: 'error', task: previous.id === taskId ? previous.task : null }))
      })
    }
    return () => { active = false }
  }, [repositories, dataVersion, taskId, attempt])
  const retry = () => setAttempt(previous => previous + 1)
  if (taskId === null) return { status: 'ready', task: null, retry }
  // Ein schneller ID-Wechsel darf niemals kurz die vorherige Aufgabe liefern.
  if (result.id !== taskId) return { status: 'loading', task: null, retry }
  return { status: result.status, task: result.task, retry }
}

/**
 * Abgehakte Aufgaben, die noch wiederhergestellt werden können – zuletzt
 * abgehakte zuerst.
 *
 * `aktiv` ist wichtig: Das Panel ist in beiden Ansichten **immer** eingebunden
 * und meistens zu. Ohne diesen Schalter las die App bei jeder Änderung die
 * abgehakten Aufgaben für ein unsichtbares Fenster.
 */
export function useRestorableTasks(aktiv = true): LocalTask[] {
  const { repositories, dataVersion } = useWorkspace()
  const [tasks, setTasks] = useState<LocalTask[]>([])
  useEffect(() => {
    if (!aktiv) return
    return subscribe(() => repositories.listRestorableTasks(), setTasks)
  }, [repositories, dataVersion, aktiv])
  return tasks
}

/**
 * Die selbst gemerkten Vorlaufzeiten für die Erinnerungs-Schnellauswahl.
 *
 * Eine Eingabehilfe, keine Angabe über eine Aufgabe – sie liegt deshalb in
 * `meta` und wird nicht synchronisiert.
 */
export function useReminderPresets(): number[] {
  const { repositories, dataVersion } = useWorkspace()
  const [presets, setPresets] = useState<number[]>([])
  useEffect(
    () => subscribe(() => repositories.listReminderPresets(), setPresets),
    [repositories, dataVersion],
  )
  return presets
}

export function useMembers(listId: string | null): LocalListMember[] {  const { repositories, dataVersion } = useWorkspace()
  const [members, setMembers] = useState<LocalListMember[]>([])
  useEffect(
    () => subscribe(() => (listId === null ? Promise.resolve([]) : repositories.listMembers(listId)), setMembers),
    [repositories, dataVersion, listId],
  )
  return members
}
