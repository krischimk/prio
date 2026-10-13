import type { LocalTask } from '../domain/types'
import { IconButton } from './components/IconButton'
import { TrashIcon } from './icons'
import { useTaskDelete } from './useTaskDelete'

export function TaskDeleteButton({ task, disabled }: { task: LocalTask; disabled: boolean }) {
  const deletion = useTaskDelete(task)
  return <div className="shrink-0">
    <div className="pointer-events-none opacity-0 transition-opacity group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100">
      <IconButton aria-label={`Aufgabe löschen: ${task.title}`} title="Aufgabe löschen. Anschließend kannst du die Löschung rückgängig machen."
        disabled={disabled || deletion.busy} onClick={() => void deletion.remove()}><TrashIcon className="h-4 w-4" /></IconButton>
    </div>
    {deletion.error ? <p role="alert" className="max-w-48 text-meta text-danger">{deletion.error}</p> : null}
  </div>
}
