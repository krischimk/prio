import { useState } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import { useView } from './useView'

export function useTaskExpansion(userId: string, taskId: string, part: 'note' | 'checklist') {
  const { repositories } = useWorkspace()
  const { overview } = useView()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const open = Boolean((overview.userPreference?.task_expansions[taskId] ?? 0) & (part === 'note' ? 1 : 2))
  const toggle = async () => {
    if (busy) return
    setBusy(true); setError(null)
    try { await repositories.setTaskExpanded(userId, taskId, part, !open) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Die Ansicht konnte nicht gespeichert werden.') }
    finally { setBusy(false) }
  }
  return { open, toggle, busy, error }
}
