import { useRef, useState } from 'react'
import { useRepositories } from '../app/useWorkspace'
import type { LocalTask } from '../domain/types'
import { useUndo } from './useUndo'

/** Löschen in Zeile und Editor mit demselben Weg zurück. */
export function useTaskDelete(task: LocalTask | null, onDeleted?: () => void) {
  const repositories = useRepositories()
  const { offer } = useUndo()
  const writing = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const remove = async () => {
    if (!task || writing.current) return
    writing.current = true; setBusy(true); setError(null)
    try {
      await repositories.deleteTask(task.id)
      offer({ taskId: task.id, text: `„${task.title}“`, art: 'geloescht', rueckgaengig: () => repositories.restoreTask(task.id) })
      onDeleted?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Die Aufgabe konnte nicht gelöscht werden.')
    } finally { writing.current = false; setBusy(false) }
  }
  return { remove, busy, error }
}
