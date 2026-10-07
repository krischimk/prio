import { useEffect, useState } from 'react'
import type { LocalList, LocalListMember, LocalTask, ShareContact } from '../domain/types'
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
