import { useEffect, useRef, useState } from 'react'
import type { LocalTask } from '../domain/types'
import { checklistProgress } from '../domain/checklist'
import { useWorkspace } from '../app/useWorkspace'
import { ChecklistIcon, ChevronIcon } from './icons'
import { errorBox, focusRing, numeric } from './styles'
import { Hint } from './components/Hint'

export function TaskChecklist({ task }: { task: LocalTask }) {
  const { repositories } = useWorkspace()
  const [open, setOpen] = useState(false)
  // Nur die unbestätigte Klickabsicht: sie endet, sobald der DB-Hook sie zeigt.
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const writing = useRef(new Set<string>())
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setPending(previous => {
      const remaining = Object.entries(previous).filter(([id, value]) => writing.current.has(id)
        || task.checklist.some(item => item.id === id && item.deleted_at === null && item.completed !== value))
      return remaining.length === Object.keys(previous).length ? previous : Object.fromEntries(remaining)
    })
  }, [task.checklist, pending])
  const progress = checklistProgress(task.checklist)
  if (!progress.total) return null
  const change = async (id: string, completed: boolean) => {
    if (writing.current.has(id)) return
    writing.current.add(id); setPending(previous => ({ ...previous, [id]: completed })); setError(null)
    try { await repositories.setChecklistItemCompleted(task.id, id, completed) }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Der Checklistenpunkt konnte nicht geändert werden.')
      setPending(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => key !== id)))
    } finally { writing.current.delete(id); setPending(previous => ({ ...previous })) }
  }
  return <div data-no-drag data-no-drawer-swipe className="min-w-0">
    <Hint text={`Checkliste ${open ? 'einklappen' : 'aufklappen'}: ${progress.completed} von ${progress.total} Punkten erledigt. Die Hauptaufgabe bleibt unabhängig.`}>
      <button type="button" aria-label={`Checkliste: ${task.title}`} aria-expanded={open} onClick={() => setOpen(value => !value)}
        className={`${focusRing} inline-flex min-h-8 items-center gap-1 rounded-control px-1 text-meta text-ink-muted hover:bg-raised hover:text-ink`}>
        <ChecklistIcon className="size-icon-meta" /><span className={numeric}>{progress.completed}/{progress.total}</span><ChevronIcon offen={open} className="size-icon-meta" />
      </button>
    </Hint>
    {open ? <ul aria-label={`Checkliste: ${task.title}`} className="mt-1">{task.checklist.filter(item => item.deleted_at === null).map(item => <li key={item.id}>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-1 text-body hover:bg-raised active:bg-raised">
        <input type="checkbox" className="size-5 shrink-0 accent-brand" checked={pending[item.id] ?? item.completed} disabled={Object.hasOwn(pending, item.id)}
          aria-label={`Checklistenpunkt: ${item.text}`} onChange={event => void change(item.id, event.target.checked)} />
        <span className={`break-words ${item.completed ? 'text-ink-faint line-through' : 'text-ink-soft'}`}>{item.text}</span>
      </label>
    </li>)}</ul> : null}
    {error ? <p role="alert" className={errorBox}>{error}</p> : null}
  </div>
}
