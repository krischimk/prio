import { useState } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import type { LocalTask } from '../domain/types'
import { useUndo } from './useUndo'
import { focusRing } from './styles'

/** Abhaken mit großer Trefferfläche; Rückgängig erst nach erfolgreichem Schreiben. */
export function TaskCheckbox({ task }: { task: LocalTask }) {
  const { repositories } = useWorkspace()
  const { offerUndo } = useUndo()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function change(next: boolean) {
    if (busy) return
    setBusy(true); setError(null)
    try {
      await repositories.setTaskCompleted(task.id, next)
      if (next) offerUndo(task)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Die Aufgabe konnte nicht abgehakt werden.')
    } finally { setBusy(false) }
  }
  return <div className="shrink-0">
    <label className={`${focusRing} flex h-11 w-11 cursor-pointer items-center justify-center rounded-control hover:bg-raised active:bg-raised`}>
      <input type="checkbox" className="h-5 w-5 cursor-pointer accent-brand" checked={task.completed} disabled={busy}
        aria-label={`Aufgabe erledigen: ${task.title}`} onChange={event => void change(event.target.checked)} />
    </label>
    {error ? <p role="alert" className="max-w-48 break-words text-meta text-danger">{error}</p> : null}
  </div>
}
