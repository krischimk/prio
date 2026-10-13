import { useContext, useEffect, useId, useRef, useState } from 'react'
import { useTaskForm } from './useTaskForm'
import { TaskFields } from './TaskFields'
import { TaskFormStatus } from './TaskFormStatus'
import { input } from './styles'
import { Button } from './components/Button'
import { PlusIcon, SettingsIcon } from './icons'
import { useView } from './useView'
import { newDraftKey, TaskDraftContext } from './taskDraftContext'

/** Erst schreiben, dann bei Bedarf Details und Zielliste wählen. */
export function TaskComposer({ listId, autoFocus = false, onCreated }: { listId?: string; autoFocus?: boolean; onCreated?: () => void }) {
  const { overview, setTaskDetail, setOverviewCreating } = useView()
  const drafts = useContext(TaskDraftContext)!
  const idPrefix = useId()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingTarget, setPendingTarget] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const focusAfterSave = useRef(false)
  const [chooseRequested, setChooseRequested] = useState(false)
  const targetSelect = useRef<HTMLSelectElement>(null)
  const titleInput = useRef<HTMLInputElement>(null)
  const returnToTitle = useRef(false)
  const available = overview.lists
  const candidate = selectedId ?? overview.userPreference?.default_list_id ?? ''
  const targetId = listId ?? (available.some(list => list.id === candidate) ? candidate : '')
  const target = available.find(list => list.id === targetId)
  const excluded = listId === undefined && target && !overview.preferences.some(row => row.list_id === target.id && row.include_in_overview)
  const form = useTaskForm({ task: null, listId: targetId, onSaved: () => {
    setSelectedId(null); setChooseRequested(false)
    if (returnToTitle.current) focusAfterSave.current = true
    onCreated?.()
  } })
  const expanded = focused || form.geaendert || chooseRequested || pendingTarget !== null
  const listDrafts = Object.entries(drafts.drafts).filter(([, draft]) => draft.taskId === null && draft.listId === targetId)
  const selectTarget = (id: string) => {
    if (!targetId && form.geaendert && id) {
      const existing = Object.values(drafts.drafts).some(draft => draft.taskId === null && draft.listId === id)
      if (existing) { setPendingTarget(id); setChooseRequested(false); return }
      drafts.assignUnassignedDraft(id)
    }
    setSelectedId(id); setChooseRequested(false)
  }
  useEffect(() => { if (chooseRequested) targetSelect.current?.focus() }, [chooseRequested])
  useEffect(() => {
    if (!focusAfterSave.current || form.busy) return
    // Erst der fertige Render gibt das während des Schreibens gesperrte Feld
    // wieder frei. Ein einzelner Animation Frame konnte davor eintreffen.
    titleInput.current?.focus()
    focusAfterSave.current = false
  })
  return <form aria-label="Neue Aufgabe anlegen" className="space-y-3 rounded-card border border-line bg-surface p-4"
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}
    onSubmit={event => {
      if (!targetId || pendingTarget) { event.preventDefault(); setChooseRequested(true); return }
      returnToTitle.current = document.activeElement === titleInput.current
      void form.speichern(event)
    }}>
    <div className="flex gap-2">
      <label htmlFor={`${idPrefix}-title`} className="sr-only">Neue Aufgabe</label>
      <input ref={titleInput} id={`${idPrefix}-title`} data-focus-key={`new:${targetId}`} disabled={form.busy} autoFocus={autoFocus}
        value={form.werte.title} onChange={event => form.setzen('title', event.target.value)}
        placeholder="Neue Aufgabe…" className={`${input} min-w-0 flex-1`} />
      <Button type="submit" variant="primary" disabled={form.busy || form.werte.title.trim().length === 0}>
        <PlusIcon className="h-4 w-4" />Hinzufügen
      </Button>
    </div>
    {expanded ? <div className="space-y-3">
      {listId === undefined ? <label className="block text-meta text-ink-muted">
        <span className="sr-only">Zielliste</span>
        <select ref={targetSelect} aria-label="Zielliste" value={pendingTarget ?? targetId} disabled={form.busy}
          size={chooseRequested ? Math.min(available.length + 1, 5) : undefined} className={input} onChange={event => selectTarget(event.target.value)}>
          <option value="">Zielliste auswählen</option>
          {available.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}
        </select>
      </label> : null}
      {pendingTarget ? <div className="space-y-2 rounded-control border border-line-strong p-3" role="group" aria-label="Entwurf auswählen">
        <p className="text-body text-ink-muted">In „{available.find(list => list.id === pendingTarget)?.name}“ liegt bereits ein Entwurf. Beide Eingaben bleiben erhalten.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" aria-label="Neue Eingabe weiterbearbeiten" onClick={() => { drafts.assignUnassignedDraft(pendingTarget); setSelectedId(pendingTarget); setPendingTarget(null) }}>Neue Eingabe: „{form.werte.title || 'Ohne Titel'}“</Button>
          <Button variant="secondary" size="sm" aria-label="Listenentwurf weiterbearbeiten" onClick={() => { setSelectedId(pendingTarget); setPendingTarget(null) }}>Listenentwurf: „{drafts.drafts[newDraftKey(drafts, pendingTarget)]?.werte.title || 'Ohne Titel'}“</Button>
        </div>
      </div> : null}
      {listDrafts.length > 1 ? <select className={input} aria-label="Ungespeicherte Entwürfe" value={newDraftKey(drafts, targetId)}
        disabled={form.busy} onChange={event => drafts.activateNewDraft(targetId, event.target.value)}>
        {listDrafts.map(([key, draft]) => <option value={key} key={key}>{draft.werte.title || 'Unbenannter Entwurf'}</option>)}
      </select> : null}
      {excluded ? <p role="status" className="text-meta text-ink-muted">Die Aufgabe wird in „{target.name}“ gespeichert. Diese Liste ist nicht in deiner Gesamtansicht enthalten.</p> : null}
      <TaskFields form={form} felder={['beschreibung', 'faellig']} sections={[]} idPrefix={idPrefix} />
      <Button variant="ghost" size="sm" onClick={() => {
        if (!targetId) { setChooseRequested(true); return }
        setOverviewCreating(false)
        setTaskDetail({ taskId: null, listId: targetId, fromOverview: listId === undefined, onCreated: () => {
          setSelectedId(null); setChooseRequested(false)
          focusAfterSave.current = true
        } })
      }} disabled={form.busy || pendingTarget !== null}>
        <SettingsIcon className="h-4 w-4" />Weitere Einstellungen
      </Button>
    </div> : null}
    <TaskFormStatus form={form} />
  </form>
}
