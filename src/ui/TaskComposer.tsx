import { useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { useTaskForm } from './useTaskForm'
import { TaskFields } from './TaskFields'
import { TaskMoreOptions } from './TaskMoreOptions'
import { TaskFormStatus } from './TaskFormStatus'
import { input } from './styles'
import { Button } from './components/Button'
import { BulletListIcon, PlusIcon } from './icons'
import { ListIcon } from './ListIcon'
import { Select } from './components/Select'
import { useView } from './useView'
import { TaskDraftContext } from './taskDraftContext'
import { useExpandableForm } from './useExpandableForm'
import { submitTaskShortcut } from './taskFormKeyboard'
import { TaskTagsEditor } from './TaskTagsEditor'

/** Erst schreiben; Gesamt- und Listenentwurf bleiben unabhängig. */
export function TaskComposer({ listId, autoFocus = false, onCreated }: { listId?: string; autoFocus?: boolean; onCreated?: () => void }) {
  const { overview } = useView()
  const { state } = useAuth()
  const currentUserId = state.status === 'authenticated' ? state.user.id : ''
  const drafts = useContext(TaskDraftContext)!
  const idPrefix = useId()
  const { container, focused, focus, blur } = useExpandableForm(autoFocus)
  const focusAfterSave = useRef(false)
  const [chooseRequested, setChooseRequested] = useState(false)
  const targetSelect = useRef<HTMLButtonElement>(null)
  const [targetOpen, setTargetOpen] = useState(false)
  const titleInput = useRef<HTMLInputElement>(null)
  const available = overview.lists
  const candidate = drafts.overviewTarget ?? overview.userPreference?.default_list_id ?? ''
  const targetId = listId ?? (available.some(list => list.id === candidate) ? candidate : '')
  const target = available.find(list => list.id === targetId)
  const excluded = listId === undefined && target && !overview.preferences.some(row => row.list_id === target.id && row.include_in_overview)
  const form = useTaskForm({ task: null, listId: targetId, overviewUserId: listId === undefined ? currentUserId : undefined,
    detailedRatings: overview.userPreference?.detailed_ratings === true,
    onSaved: () => {
      if (listId === undefined) drafts.selectOverviewTarget(targetId)
      setChooseRequested(false)
      focusAfterSave.current = true
      onCreated?.()
    } })
  const expanded = focused || form.geaendert || chooseRequested
  useEffect(() => { if (chooseRequested) targetSelect.current?.focus() }, [chooseRequested])
  useLayoutEffect(() => {
    if (!focusAfterSave.current || form.busy) return
    titleInput.current?.focus()
    focusAfterSave.current = false
  })
  return <form ref={container} aria-label="Neue Aufgabe anlegen" className="space-y-3 rounded-card border border-line bg-surface p-4"
    onFocusCapture={() => {
      focus()
      if (listId === undefined && drafts.overviewTarget === null) drafts.selectOverviewTarget(targetId)
    }} onBlurCapture={blur}
    onKeyDownCapture={submitTaskShortcut}
    onSubmit={event => {
      if (!targetId) { event.preventDefault(); setChooseRequested(true); setTargetOpen(true); return }
      void form.speichern(event)
    }}>
    <div className="flex gap-2">
      <label htmlFor={`${idPrefix}-title`} className="sr-only">Neue Aufgabe</label>
      <input ref={titleInput} id={`${idPrefix}-title`} data-focus-key={`new:${listId ?? 'overview'}`} disabled={form.busy} autoFocus={autoFocus}
        value={form.werte.title} onChange={event => form.setzen('title', event.target.value)}
        placeholder="Neue Aufgabe…" className={`${input} min-w-0 flex-1`} />
      <Button type="submit" variant="primary" disabled={form.busy || form.werte.title.trim().length === 0}>
        <PlusIcon />Hinzufügen
      </Button>
    </div>
    {expanded ? <div className="space-y-3">
      {listId === undefined ? <Select triggerRef={targetSelect} label="Zielliste" value={targetId} disabled={form.busy}
          open={targetOpen} onOpenChange={setTargetOpen}
          onChange={id => {
            drafts.selectOverviewTarget(id)
            if (!available.find(list => list.id === id)?.sections.some(section => section.id === form.werte.sectionId)) form.setzen('sectionId', null)
            setChooseRequested(false)
          }} options={[{ value: '', label: 'Zielliste auswählen', icon: <BulletListIcon /> }, ...available.map(list => ({ value: list.id, label: list.name,
            icon: list.icon ? <ListIcon icon={list.icon} className="size-icon shrink-0" /> : <BulletListIcon /> }))]} /> : null}
      {excluded ? <p role="status" className="text-meta text-ink-muted">Die Aufgabe wird in „{target.name}“ gespeichert. Diese Liste ist nicht in deiner Gesamtansicht enthalten.</p> : null}
      <TaskFields form={form} felder={['beschreibung', 'checkliste', 'faellig', 'wiederholung', 'erinnerungen']} sections={target?.sections ?? []}
        currentUserId={currentUserId} listIsShared={target?.is_shared ?? false} ratingsEnabled={target?.ratings_enabled} idPrefix={idPrefix} />
      <TaskTagsEditor form={form} />
      <TaskMoreOptions form={form} sections={target?.sections ?? []} idPrefix={idPrefix} />
    </div> : null}
    <TaskFormStatus form={form} />
  </form>
}
