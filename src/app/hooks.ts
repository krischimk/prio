import { useEffect, useState } from 'react'
import type { LocalList, LocalListMember, LocalTask } from '../domain/types'
import { useWorkspace } from './useWorkspace'

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

export function useLists(): LocalList[] {
  const { repositories, dataVersion } = useWorkspace()
  const [lists, setLists] = useState<LocalList[]>([])
  useEffect(() => subscribe(() => repositories.listLists(), setLists), [repositories, dataVersion])
  return lists
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

/**
 * Abgehakte Aufgaben, die noch wiederhergestellt werden können – zuletzt
 * abgehakte zuerst.
 */
export function useRestorableTasks(): LocalTask[] {
  const { repositories, dataVersion } = useWorkspace()
  const [tasks, setTasks] = useState<LocalTask[]>([])
  useEffect(
    () => subscribe(() => repositories.listRestorableTasks(), setTasks),
    [repositories, dataVersion],
  )
  return tasks
}

export function useMembers(listId: string | null): LocalListMember[] {
  const { repositories, dataVersion } = useWorkspace()
  const [members, setMembers] = useState<LocalListMember[]>([])
  useEffect(
    () => subscribe(() => (listId === null ? Promise.resolve([]) : repositories.listMembers(listId)), setMembers),
    [repositories, dataVersion, listId],
  )
  return members
}

/**
 * Hält die aktuell ausgewählte Liste.
 *
 * Die Auswahl wird beim Rendern abgeleitet, nicht in einem Effekt korrigiert:
 * Existiert die gewünschte Liste nicht mehr (gelöscht oder Zugriff entzogen),
 * fällt die Anzeige automatisch auf die erste verfügbare Liste zurück.
 */
export function useSelectedListId(lists: LocalList[]): [string | null, (id: string | null) => void] {
  const [preferred, setPreferred] = useState<string | null>(null)
  const selected = lists.some((list) => list.id === preferred) ? preferred : (lists[0]?.id ?? null)
  return [selected, setPreferred]
}
