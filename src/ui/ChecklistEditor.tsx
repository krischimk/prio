import { useId, useRef, useState } from 'react'
import { DragDropProvider } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import { KeyboardSensor, PointerSensor, PointerActivationConstraints } from '@dnd-kit/dom'
import { RestrictToWindow } from '@dnd-kit/dom/modifiers'
import { appendChecklistItem, checklistProgress, checklistWeights, createChecklistItem, deleteChecklistItem, setChecklistWeight, withChecklistWeights, withoutChecklistWeights, type ChecklistItem } from '../domain/checklist'
import type { TaskForm } from './useTaskForm'
import { ChecklistIcon, ChevronIcon, GripIcon, PlusIcon, TrashIcon } from './icons'
import { checklistInput, focusRing, numeric } from './styles'
import { IconButton } from './components/IconButton'
import { useIsDesktop } from '../app/useIsDesktop'
import { Hint } from './components/Hint'
import { RatingSlider } from './TaskRating'

// Eigener Kontext: Checklistenpunkte werden nie zu Aufgaben-/Listen-Ziehzielen.
// Nur der Griff unterdrückt Scrollen; Eingabefelder bleiben normal bedienbar.
const pointer = PointerSensor.configure({ activationConstraints: [new PointerActivationConstraints.Distance({ value: 4 })] })
const keyboard = KeyboardSensor.configure({ keyboardCodes: { ...KeyboardSensor.defaults.keyboardCodes, start: ['Space'] } })

export function ChecklistEditor({ form, ratingsEnabled = false }: { form: TaskForm; ratingsEnabled?: boolean }) {
  const group = useId()
  const [open, setOpen] = useState(true)
  const addInput = useRef<HTMLInputElement>(null)
  const items = form.werte.checklist.filter(item => item.deleted_at === null)
  const progress = checklistProgress(items)
  const linked = ratingsEnabled && form.werte.rating?.effortFromChecklist === true
  const weighted = items.some(item => item.weight !== undefined)
  const weights = checklistWeights(items)
  const change = (id: string, patch: Partial<ChecklistItem>) => form.setzen('checklist', form.werte.checklist.map(item => item.id === id ? { ...item, ...patch } : item))
  const add = () => {
    if (!form.werte.checklistText.trim()) return
    form.setzen('checklist', appendChecklistItem(form.werte.checklist, createChecklistItem(form.werte.checklistText), weighted))
    form.setzen('checklistText', '')
    setOpen(true)
    addInput.current?.focus()
  }
  return <div data-no-drawer-swipe className="min-w-0">
    <button type="button" aria-label={items.length ? 'Checkliste bearbeiten' : 'Checkliste hinzufügen'} aria-expanded={open} aria-controls={`${group}-items`} onClick={() => setOpen(value => !value)}
      className={`${focusRing} flex min-h-11 w-full items-center gap-3 rounded-control px-2 text-left text-body text-ink-muted hover:bg-raised hover:text-ink`}>
      <ChecklistIcon /><span className="flex-1">{items.length ? 'Checkliste' : 'Checkliste hinzufügen'}</span>
      {items.length ? <span className={`text-meta ${numeric}`}>{progress.completed}/{progress.total}</span> : null}
      <ChevronIcon offen={open} className="size-icon-meta shrink-0" />
    </button>
    {open ? <div id={`${group}-items`} className="ml-2 min-w-0 border-l border-line pl-2">
      <DragDropProvider sensors={defaults => [...defaults.filter(sensor => sensor !== PointerSensor && sensor !== KeyboardSensor), pointer, keyboard]}
        modifiers={[RestrictToWindow]}
        onDragEnd={event => {
          const source = event.operation.source
          if (event.canceled || !event.operation.target || !isSortable(source) || source.initialIndex === source.index) return
          const ordered = [...items]
          const [moved] = ordered.splice(source.initialIndex, 1)
          ordered.splice(source.index, 0, moved)
          form.setzen('checklist', [...ordered, ...form.werte.checklist.filter(item => item.deleted_at !== null)])
        }}>
        <ul aria-label="Checklistenpunkte bearbeiten">{items.map((item, index) => <ChecklistEditRow key={item.id} item={item} index={index} group={group} busy={form.busy}
          weight={linked && weighted ? weights.get(item.id) : undefined}
          onWeight={value => form.setzen('checklist', setChecklistWeight(form.werte.checklist, item.id, value))}
          onChange={patch => change(item.id, patch)} onDelete={() => form.setzen('checklist', deleteChecklistItem(form.werte.checklist, item.id, new Date().toISOString()))} />)}</ul>
      </DragDropProvider>
      <div className="ml-2 flex items-center gap-1 pl-2">
        <IconButton aria-label="Checklistenpunkt hinzufügen" variant="iconMuted" disabled={!form.werte.checklistText.trim() || form.busy} onClick={add}><PlusIcon /></IconButton>
        <input ref={addInput} aria-label="Neuer Checklistenpunkt" placeholder="Neuer Checklistenpunkt…" className={checklistInput}
          value={form.werte.checklistText} onChange={event => form.setzen('checklistText', event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); add() } }} />
      </div>
      {ratingsEnabled && form.werte.rating && items.length > 0 ? <label className="flex min-h-11 items-center gap-3 pl-2 text-meta text-ink-muted">
        <input type="checkbox" className="size-5 shrink-0 accent-brand" checked={linked}
          onChange={event => form.setzen('rating', { ...form.werte.rating!, effortFromChecklist: event.target.checked })} />
        <span>Checkliste reduziert den Restaufwand</span>
      </label> : null}
      {linked && items.length > 0 ? <label className="flex min-h-11 items-center gap-3 pl-2 text-meta text-ink-muted">
        <input type="checkbox" className="size-5 shrink-0 accent-brand" checked={weighted}
          onChange={event => form.setzen('checklist', event.target.checked ? withChecklistWeights(form.werte.checklist) : withoutChecklistWeights(form.werte.checklist))} />
        <span>Checklistenpunkte unterschiedlich gewichten</span>
      </label> : null}
    </div> : null}
  </div>
}

function ChecklistEditRow({ item, index, group, busy, onChange, onDelete, weight, onWeight }: {
  item: ChecklistItem; index: number; group: string; busy: boolean
  onChange: (patch: Partial<ChecklistItem>) => void; onDelete: () => void
  weight?: number; onWeight: (value: number) => void
}) {
  const desktop = useIsDesktop()
  const { ref, handleRef, isDragging } = useSortable({ id: item.id, index, group, type: group, accept: group, disabled: busy })
  return <li ref={ref} data-checklist-item={item.id} className={`group/check flex min-w-0 items-center gap-1 rounded-control border-b border-line-soft ${isDragging ? 'bg-raised shadow-lg shadow-page/30' : 'hover:bg-surface'}`}>
    <Hint text="Checklistenpunkt ziehen. Mit Leertaste aufnehmen, Pfeiltasten verschieben und Leertaste ablegen.">
      <button ref={handleRef} type="button" aria-label={`Checklistenpunkt verschieben: ${item.text}`} disabled={busy}
        className={`${focusRing} checklist-drag-handle flex min-h-11 shrink-0 cursor-grab items-center rounded-control px-1 text-ink-faint active:cursor-grabbing ${desktop ? 'opacity-0 group-hover/check:opacity-100 group-focus-within/check:opacity-100' : ''}`}><GripIcon className="size-icon-meta" /></button>
    </Hint>
    <label className="flex min-h-11 shrink-0 items-center px-1"><input type="checkbox" className="size-5 accent-brand" aria-label={`Checklistenpunkt erledigt: ${item.text}`}
      checked={item.completed} onChange={event => onChange({ completed: event.target.checked })} /></label>
    <div className="min-w-0 flex-1">
    <input aria-label={`Checklistenpunkt ${index + 1}`} className={`${checklistInput} ${item.completed ? 'line-through' : ''}`} value={item.text}
      onChange={event => onChange({ text: event.target.value })} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault() }} />
    {weight !== undefined ? <div className="px-2"><RatingSlider label={`Gewichtung: ${item.text}`} value={weight} max={1} compact onChange={onWeight}
      hint="Anteil dieses Punkts am Gesamtaufwand. Die übrigen Anteile passen sich proportional an." /></div> : null}
    </div>
    <IconButton aria-label={`Checklistenpunkt löschen: ${item.text}`} variant="iconMuted" onClick={onDelete}
      layout={desktop ? 'opacity-0 group-hover/check:opacity-100 group-focus-within/check:opacity-100' : ''}><TrashIcon /></IconButton>
  </li>
}
