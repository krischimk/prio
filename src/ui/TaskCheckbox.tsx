import { useState } from 'react'
import { useRepositories } from '../app/useWorkspace'
import type { LocalTask } from '../domain/types'
import { useUndo } from './useUndo'
import { checkboxTarget } from './styles'
import { Hint } from './components/Hint'

/** Abhaken mit großer Trefferfläche; Rückgängig erst nach erfolgreichem Schreiben. */
export function TaskCheckbox({ task }: { task: LocalTask }) {
  const repositories = useRepositories()
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
      setError(cause instanceof Error ? cause.message : next ? 'Die Aufgabe konnte nicht abgehakt werden.' : 'Die Aufgabe konnte nicht wieder geöffnet werden.')
    } finally { setBusy(false) }
  }
  return <div className="shrink-0">
    <Hint text={task.completed ? 'Aufgabe wieder öffnen. Der ursprüngliche Bereich und die Nachbarschaft werden soweit verfügbar wiederhergestellt.' : 'Aufgabe abhaken. Anschließend kannst du das Abhaken rückgängig machen.'}>
    <label className={checkboxTarget}>
      <input type="checkbox" className="h-5 w-5 cursor-pointer accent-brand" checked={task.completed} disabled={busy}
        aria-label={`${task.completed ? 'Aufgabe wieder öffnen' : 'Aufgabe erledigen'}: ${task.title}`} onChange={event => void change(event.target.checked)} />
    </label>
    </Hint>
    {error ? <p role="alert" className="max-w-48 break-words text-meta text-danger">{error}</p> : null}
  </div>
}
