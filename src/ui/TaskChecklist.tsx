import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { LocalTask } from '../domain/types'
import { checklistProgress, visibleChecklistItems } from '../domain/checklist'
import { useRepositories } from '../app/useWorkspace'
import { ChecklistIcon, ChevronIcon } from './icons'
import { checkboxTarget, errorBox, focusRing, numeric } from './styles'
import { Hint } from './components/Hint'
import { useTaskExpansion } from './useTaskExpansion'

export function TaskChecklist({ task, currentUserId, trailing }: { task: LocalTask; currentUserId: string; trailing?: ReactNode }) {
  const repositories = useRepositories()
  const expansion = useTaskExpansion(currentUserId, task.id, 'checklist')
  const { open, busy: expansionBusy, toggle: toggleExpansion, error: expansionError } = expansion
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
  const { completed, total } = checklistProgress(task.checklist)
  const items = useMemo(() => visibleChecklistItems(task.checklist, task.checklist_hide_completed), [task.checklist, task.checklist_hide_completed])
  const change = useCallback(async (id: string, completed: boolean) => {
    if (writing.current.has(id)) return
    writing.current.add(id); setPending(previous => ({ ...previous, [id]: completed })); setError(null)
    try { await repositories.setChecklistItemCompleted(task.id, id, completed) }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Der Checklistenpunkt konnte nicht geändert werden.')
      setPending(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => key !== id)))
    } finally { writing.current.delete(id); setPending(previous => ({ ...previous })) }
  }, [repositories, task.id])
  return useMemo(() => items.length ? <div className="min-w-0">
    <div className="flex min-w-0 items-center justify-between gap-3">
    <Hint text={`Checkliste ${open ? 'einklappen' : 'aufklappen'}: ${completed} von ${total} Punkten erledigt. Die Hauptaufgabe bleibt unabhängig.`}>
      <button type="button" data-checklist-toggle aria-label={`Checkliste: ${task.title}`} aria-expanded={open} disabled={expansionBusy} onClick={() => void toggleExpansion()}
        className={`${focusRing} inline-flex min-h-8 items-center gap-1 rounded-control px-1 text-meta text-ink-muted hover:bg-raised hover:text-ink`}>
        <ChecklistIcon className="size-icon-meta" /><span className={numeric}>{completed}/{total}</span><ChevronIcon offen={open} className="size-icon-meta" />
      </button>
    </Hint>
    {trailing}</div>
    {open ? <ul aria-label={`Checkliste: ${task.title}`}>{items.map(item => <li key={item.id}>
      <div className="flex min-h-11 items-center gap-3 rounded-control px-1 text-body">
        <label className={`${checkboxTarget} -mx-3`}>
          <input type="checkbox" className="size-5 cursor-pointer accent-brand" checked={pending[item.id] ?? item.completed} disabled={Object.hasOwn(pending, item.id)}
            aria-label={`Checklistenpunkt: ${item.text}`} onChange={event => void change(item.id, event.target.checked)} />
        </label>
        <span className={`break-words ${item.completed ? 'text-ink-faint line-through' : 'text-ink-soft'}`}>{item.text}</span>
      </div>
    </li>)}</ul> : null}
    {expansionError ? <p role="alert" className={errorBox}>{expansionError}</p> : null}
    {error ? <p role="alert" className={errorBox}>{error}</p> : null}
  </div> : null, [items, open, completed, total, task.title, expansionBusy, toggleExpansion, expansionError, trailing, pending, error, change])
}
