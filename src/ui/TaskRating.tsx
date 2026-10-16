import { useId, type CSSProperties } from 'react'
import { changeUrgencyMode, ratingValues, startRating } from '../domain/rating'
import type { TaskRating } from '../domain/rating'
import type { ChecklistItem } from '../domain/checklist'
import { useWorkspace } from '../app/useWorkspace'
import type { TaskForm } from './useTaskForm'
import { Hint } from './components/Hint'
import { Button } from './components/Button'
import { IconButton } from './components/IconButton'
import { CloseIcon } from './icons'

const level = (value: number) => value < 2 ? 'sehr niedrig' : value < 4 ? 'niedrig' : value < 6 ? 'mittel' : value < 8 ? 'hoch' : 'sehr hoch'
const fillStyle = (value: number): CSSProperties => ({ '--rating-fill': `${value * 10}%` } as CSSProperties)

export function RatingSlider({ label, value, onChange, disabled = false, unassigned = false, hint, max = 10, compact = false }: {
  label: string; value: number; onChange: (value: number) => void; disabled?: boolean; unassigned?: boolean; hint: string
  max?: number; compact?: boolean
}) {
  const id = useId()
  return <div className="min-w-0">
    {!compact ? <div className="flex items-baseline justify-between gap-3">
      <Hint text={hint}><label htmlFor={id} className="inline-block text-body text-ink-soft">{label}</label></Hint>
      <span aria-hidden="true" className="shrink-0 text-label text-ink-faint">Gering → Hoch</span>
    </div> : null}
    <input id={id} type="range" min="0" max={max} step={max / 100} value={value} disabled={disabled}
      aria-label={compact ? label : undefined}
      title={compact ? `${Math.round(value * 100)} % des Gesamtaufwands. ${hint}` : undefined}
      aria-valuetext={unassigned ? 'Noch nicht bewertet' : compact ? `${Math.round(value * 100)} Prozent des Gesamtaufwands` : level(value)} aria-describedby={`${id}-hint`}
      className={`rating-slider w-full ${unassigned ? 'rating-unassigned' : ''}`} style={fillStyle(unassigned ? 0 : value / max * 10)}
      onChange={event => onChange(event.currentTarget.valueAsNumber)}
      onPointerUp={event => { if (unassigned) onChange(event.currentTarget.valueAsNumber) }} />
    <span id={`${id}-hint`} className="sr-only">{hint}</span>
  </div>
}

export function TaskRatingEditor({ form }: { form: TaskForm }) {
  const { nowMs } = useWorkspace()
  const rating = form.werte.rating
  const linked = rating?.effortFromChecklist && form.werte.checklist.some(item => item.deleted_at === null)
  const values = rating && ratingValues(rating, form.dueIso, nowMs, form.werte.checklist)
  return <section aria-label="Bewertung" data-no-drawer-swipe data-no-drag className="space-y-2 border-t border-line pt-3">
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1"><RatingSlider label={rating ? 'Wichtigkeit' : 'Wichtigkeit einschätzen'} value={rating?.importance ?? 5} unassigned={!rating}
        hint={rating ? 'Wie wichtig ist dir das Ergebnis? Links geringer, rechts höher.' : 'Der erste Klick startet die Bewertung. Aufwand und manuelle Dringlichkeit beginnen sichtbar in der Mitte.'}
        onChange={importance => form.setzen('rating', rating ? { ...rating, importance } : startRating(importance))} /></div>
      {rating ? <IconButton aria-label="Bewertung entfernen" variant="iconMuted" onClick={() => form.setzen('rating', null)}><CloseIcon /></IconButton> : null}
    </div>
    {rating && values ? <>
      <RatingSlider label={linked ? 'Gesamtaufwand' : 'Aufwand'} value={rating.effort} hint={linked ? 'Geschätzter Aufwand für die gesamte Checkliste. Der offene gewichtete Anteil bestimmt den verbleibenden Aufwand.' : 'Wie viel Arbeit liegt ungefähr noch vor dir? Größerer Aufwand macht die Aufgabe automatisch früher dringlich.'}
        onChange={effort => form.setzen('rating', { ...rating, effort })} />
      {linked ? <RatingMeter label="Restaufwand" value={values.effort} hint="Aus Gesamtaufwand und offenen gewichteten Checklistenpunkten berechnet." /> : null}
      {form.dueIso ? <div role="group" aria-label="Dringlichkeitsmodus" className="flex flex-wrap gap-1">
        <Button size="sm" variant={rating.urgencyMode === 'auto' ? 'secondary' : 'ghost'} aria-pressed={rating.urgencyMode === 'auto'}
          onClick={() => form.setzen('rating', changeUrgencyMode(rating, 'auto', form.dueIso, nowMs, form.werte.checklist))}>Automatisch</Button>
        <Button size="sm" variant={rating.urgencyMode === 'manual' ? 'secondary' : 'ghost'} aria-pressed={rating.urgencyMode === 'manual'}
          onClick={() => form.setzen('rating', changeUrgencyMode(rating, 'manual', form.dueIso, nowMs, form.werte.checklist))}>Manuell</Button>
      </div> : null}
      <RatingSlider label="Dringlichkeit" value={values.urgency} disabled={values.automatic}
        hint={values.automatic ? 'Automatisch aus verbleibender Zeit und Aufwand. Hoher Aufwand zieht den Anstieg und das Maximum vor. Wähle Manuell für einen eigenen Wert.' : 'Wie bald musst du dich darum kümmern? Links kann es warten, rechts ist es dringlicher.'}
        onChange={urgency => form.setzen('rating', { ...rating, urgency, urgencyMode: 'manual' })} />
      <RatingMeter label="Priorität" value={values.priority} hint="Gleichgewichtet aus Wichtigkeit und Dringlichkeit berechnet." prominent />
    </> : null}
  </section>
}

function RatingMeter({ label, value, hint, prominent = false }: { label: string; value: number; hint: string; prominent?: boolean }) {
  return <Hint text={`${label}: ${level(value)}. ${hint}`}><span role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={10} aria-valuenow={value} aria-valuetext={level(value)}
    className="block min-w-0 space-y-1">
    <span className={`block text-meta ${prominent ? 'font-medium text-ink-soft' : 'text-ink-muted'}`}>{label}</span>
    <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-line"><span style={{ width: `${value * 10}%` }}
      className={`block h-full rounded-full ${prominent ? 'bg-brand-soft' : 'bg-ink-faint'}`} /></span>
  </span></Hint>
}

export function TaskRatingSummary({ rating, dueAt, checklist }: { rating: TaskRating; dueAt: string | null; checklist: ChecklistItem[] }) {
  const { nowMs } = useWorkspace()
  const values = ratingValues(rating, dueAt, nowMs, checklist)
  const linked = rating.effortFromChecklist && checklist.some(item => item.deleted_at === null)
  return <span aria-label="Aufgabenbewertung" className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
    <RatingMeter label="Wichtigkeit" value={values.importance} hint="Deine Einschätzung der Bedeutung." />
    <RatingMeter label="Dringlichkeit" value={values.urgency} hint={values.automatic ? 'Automatisch aus Fälligkeit und Aufwand.' : 'Manuell eingeschätzt.'} />
    <RatingMeter label={linked ? 'Restaufwand' : 'Aufwand'} value={values.effort} hint={linked ? 'Aus Gesamtaufwand und offenen gewichteten Checklistenpunkten.' : 'Grob eingeschätzte verbleibende Arbeit.'} />
    <RatingMeter label="Priorität" value={values.priority} hint="Gleichgewichtet aus Wichtigkeit und Dringlichkeit." prominent />
  </span>
}
