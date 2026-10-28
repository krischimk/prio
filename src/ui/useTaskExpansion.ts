import { useCallback, useState } from 'react'
import { useRepositories } from '../app/useWorkspace'
import { useTaskView } from './useView'

export function useTaskExpansion(userId: string, taskId: string, part: 'note' | 'checklist') {
  const repositories = useRepositories()
  const { overview } = useTaskView()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Nur die unbestätigte Klickabsicht; der bestätigte Zustand kommt aus der DB.
  const [pending, setPending] = useState<boolean | null>(null)
  const confirmed = Boolean((overview.userPreference?.task_expansions[taskId] ?? 0) & (part === 'note' ? 1 : 2))
  const open = pending ?? confirmed
  if (!busy && pending !== null && (confirmed === pending || overview.status === 'error')) {
    setPending(null)
    if (overview.status === 'error') setError('Die gespeicherte Ansicht konnte nicht gelesen werden.')
  }
  const toggle = useCallback(async () => {
    if (busy || pending !== null) return
    setPending(!open); setBusy(true); setError(null)
    try { await repositories.setTaskExpanded(userId, taskId, part, !open) }
    catch (cause) { setPending(null); setError(cause instanceof Error ? cause.message : 'Die Ansicht konnte nicht gespeichert werden.') }
    finally { setBusy(false) }
  }, [busy, pending, repositories, userId, taskId, part, open])
  return { open, toggle, busy: busy || pending !== null, error }
}
