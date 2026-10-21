import { useId, type CSSProperties, type ReactNode } from 'react'
import { changeUrgencyMode, ratingValues, startRating } from '../domain/rating'
import type { TaskRating } from '../domain/rating'
import type { ChecklistItem } from '../domain/checklist'
import { useWorkspace } from '../app/useWorkspace'
import type { TaskForm } from './useTaskForm'
import { Hint } from './components/Hint'
import { Button } from './components/Button'
import { ImportanceIcon, EffortIcon, UrgencyIcon, PriorityIcon, EraserIcon } from './icons'
import { useView } from './useView'
import type { PriorityRank } from '../domain/overviewOrdering'

const rankNames = { 1: 'Gold', 2: 'Silber', 3: 'Bronze' } as const
const rankColors = { 1: 'text-priority-gold', 2: 'text-priority-silver', 3: 'text-priority-bronze' } as const

const level = (value: number) => value < 2 ? 'sehr niedrig' : value < 4 ? 'niedrig' : value < 6 ? 'mittel' : value < 8 ? 'hoch' : 'sehr hoch'
const fillStyle = (value: number): CSSProperties => ({ '--rating-fill': `${value * 10}%` } as CSSProperties)

export function RatingSlider({ label, value, onChange, disabled = false, unassigned = false, hint, max = 10, compact = false, icon, actions }: {
  label: string; value: number; onChange: (value: number) => void; disabled?: boolean; unassigned?: boolean; hint: string
  max?: number; compact?: boolean
  icon?: ReactNode; actions?: ReactNode
}) {
  const id = useId()
  return <div className="min-w-0">
    {!compact ? <div className="flex min-h-11 flex-wrap items-center gap-x-2">
      <Hint text={hint}><label htmlFor={id} className="inline-flex items-center gap-2 text-body text-ink-soft">{icon}{label}</label></Hint>
      {actions}
      <span aria-hidden="true" className="ml-auto shrink-0 text-label text-ink-faint">Gering → Hoch</span>
    </div> : null}
    <div className={compact ? undefined : 'pl-8'}><div className="relative">
    {!compact ? <span aria-hidden="true" className={`rating-ruler ${disabled ? 'opacity-40' : ''}`}>{[1, 2, 3, 4, 5, 6, 7].map(tick => <span key={tick}
      className={tick === 4 ? 'rating-tick-half' : tick % 2 === 0 ? 'rating-tick-quarter' : 'rating-tick-eighth'}
      style={{ left: `calc(0.625rem + (100% - 1.25rem) * ${tick / 8})` }} />)}</span> : null}
    <input id={id} type="range" min="0" max={max} step={max / 100} value={value} disabled={disabled}
      aria-label={compact ? label : undefined}
      title={compact ? `${Math.round(value * 100)} % des Gesamtaufwands. ${hint}` : undefined}
      aria-valuetext={unassigned ? 'Noch nicht bewertet' : compact ? `${Math.round(value * 100)} Prozent des Gesamtaufwands` : level(value)} aria-describedby={`${id}-hint`}
      className={`rating-slider w-full ${unassigned ? 'rating-unassigned' : ''}`} style={fillStyle(unassigned ? 0 : value / max * 10)}
      onChange={event => onChange(event.currentTarget.valueAsNumber)}
      onPointerUp={event => { if (unassigned) onChange(event.currentTarget.valueAsNumber) }} /></div></div>
    <span id={`${id}-hint`} className="sr-only">{hint}</span>
  </div>
}

export function TaskRatingEditor({ form }: { form: TaskForm }) {
  const { nowMs } = useWorkspace()
  const { overview } = useView()
  const detailed = overview.userPreference?.detailed_ratings === true
  const rating = form.werte.rating
  const linked = rating?.effortFromChecklist && form.werte.checklist.some(item => item.deleted_at === null)
  const values = rating && ratingValues(rating, form.dueIso, nowMs, form.werte.checklist, detailed)
  return <section aria-label="Bewertung" data-no-drawer-swipe data-no-drag className="space-y-2 border-t border-line px-2 pt-3">
    <RatingSlider label={rating ? 'Wichtigkeit' : 'Wichtigkeit einschätzen'} icon={<ImportanceIcon />} value={rating?.importance ?? 5} unassigned={!rating}
        hint={rating ? 'Wie wichtig ist dir das Ergebnis? Links geringer, rechts höher.' : 'Der erste Klick startet die Bewertung. Aufwand und manuelle Dringlichkeit beginnen sichtbar in der Mitte.'}
        onChange={importance => form.setzen('rating', rating ? { ...rating, importance } : startRating(importance))} />
    {rating && values ? <>
      {detailed || values.automatic || linked ? <RatingSlider label={linked ? 'Gesamtaufwand' : 'Aufwand'} icon={<EffortIcon />} value={rating.effort} hint={linked ? 'Geschätzter Aufwand für die gesamte Checkliste. Der offene Anteil bestimmt den verbleibenden Aufwand.' : 'Wie viel Arbeit liegt ungefähr noch vor dir? Größerer Aufwand macht die Aufgabe automatisch früher dringlich.'}
        onChange={effort => form.setzen('rating', { ...rating, effort })} /> : null}
      {linked && detailed ? <RatingMeter label="Restaufwand" icon={<EffortIcon className="size-icon-meta" />} value={values.effort} hint="Aus Gesamtaufwand und offenen Checklistenpunkten berechnet." inset /> : null}
      {detailed || !form.dueIso ? <TaskUrgencyEditor form={form} /> : null}
      {detailed ? <RatingMeter label="Priorität" icon={<PriorityIcon className="size-icon-meta" />} value={values.priority} hint="Gleichgewichtet aus Wichtigkeit und Dringlichkeit berechnet." prominent inset /> : null}
      <Button variant="ghost" size="sm" onClick={() => form.setzen('rating', null)}><EraserIcon />Bewertung entfernen</Button>
    </> : null}
  </section>
}

export function TaskUrgencyEditor({ form }: { form: TaskForm }) {
  const { nowMs } = useWorkspace()
  const { overview } = useView()
  const rating = form.werte.rating
  if (!rating) return null
  const values = ratingValues(rating, form.dueIso, nowMs, form.werte.checklist, overview.userPreference?.detailed_ratings === true)
  return <RatingSlider label="Dringlichkeit" icon={<UrgencyIcon />} value={values.urgency} disabled={values.automatic}
      actions={form.dueIso ? <div role="group" aria-label="Dringlichkeitsmodus" className="flex gap-1">
        <Button size="sm" variant={rating.urgencyMode === 'auto' ? 'secondary' : 'ghost'} aria-pressed={rating.urgencyMode === 'auto'}
          onClick={() => form.setzen('rating', changeUrgencyMode(rating, 'auto', form.dueIso, nowMs, form.werte.checklist))}>Automatisch</Button>
        <Button size="sm" variant={rating.urgencyMode === 'manual' ? 'secondary' : 'ghost'} aria-pressed={rating.urgencyMode === 'manual'}
          onClick={() => form.setzen('rating', changeUrgencyMode(rating, 'manual', form.dueIso, nowMs, form.werte.checklist))}>Manuell</Button>
      </div> : undefined}
        hint={values.automatic ? 'Automatisch aus verbleibender Zeit und Aufwand. Hoher Aufwand zieht den Anstieg und das Maximum vor. Wähle Manuell für einen eigenen Wert.' : 'Wie bald musst du dich darum kümmern? Links kann es warten, rechts ist es dringlicher.'}
        onChange={urgency => form.setzen('rating', { ...rating, urgency, urgencyMode: 'manual' })} />
}

function RatingMeter({ label, value, hint, prominent = false, icon, inset = false, barOnly = false }: { label: string; value: number; hint: string; prominent?: boolean; icon?: ReactNode; inset?: boolean; barOnly?: boolean }) {
  return <Hint text={`${label}: ${level(value)}. ${hint}`}><span role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={10} aria-valuenow={value} aria-valuetext={level(value)}
    className={prominent && !inset ? 'flex min-w-0 items-center gap-2' : 'block min-w-0 space-y-1'}>
    {barOnly ? icon : <span className={`flex shrink-0 items-center gap-1 text-meta ${prominent ? 'font-medium text-ink-soft' : 'text-ink-muted'}`}>{icon}{label}</span>}
    <span aria-hidden="true" className={`block min-w-0 ${inset ? 'ml-8' : prominent ? 'flex-1' : ''} ${prominent ? 'priority-track' : 'h-1.5 overflow-hidden rounded-full bg-line'}`}><span style={prominent ? { width: '100%', clipPath: `inset(0 ${100 - value * 10}% 0 0 round 999px)` } : { width: `${value * 10}%` }}
      className={prominent ? 'priority-fill' : 'block h-full rounded-full bg-ink-faint'} /></span>
  </span></Hint>
}

export function TaskPriorityBar({ rating, dueAt, checklist, rank }: { rating: TaskRating; dueAt: string | null; checklist: ChecklistItem[]; rank?: PriorityRank }) {
  const { nowMs } = useWorkspace()
  const { overview } = useView()
  return <span className="mt-2 mb-2 block w-80 max-w-full" aria-label={rank ? `Prioritätsplatz ${rank}: ${rankNames[rank]}` : undefined}>
    <RatingMeter label="Priorität" value={ratingValues(rating, dueAt, nowMs, checklist, overview.userPreference?.detailed_ratings === true).priority}
      hint={`${rank ? `${rank}. Platz in dieser Ansicht (${rankNames[rank]}). ` : ''}Gleichgewichtet aus Wichtigkeit und Dringlichkeit.`}
      icon={<span className={`inline-flex shrink-0 items-center gap-1 ${rank ? rankColors[rank] : 'text-ink-muted'}`}>
        <PriorityIcon className="size-icon-meta" />{rank ? <span aria-hidden="true" className="text-label font-semibold">{rank}</span> : null}
      </span>} prominent barOnly /></span>
}

export function TaskRatingSummary({ rating, dueAt, checklist, detailed: forceDetailed, includePriority = true }: { rating: TaskRating; dueAt: string | null; checklist: ChecklistItem[]; detailed?: boolean; includePriority?: boolean }) {
  const { nowMs } = useWorkspace()
  const { overview } = useView()
  const detailedRatings = overview.userPreference?.detailed_ratings === true
  const detailed = forceDetailed ?? detailedRatings
  const values = ratingValues(rating, dueAt, nowMs, checklist, detailedRatings)
  const linked = rating.effortFromChecklist && checklist.some(item => item.deleted_at === null)
  if (!detailed && !includePriority) return null
  return <span aria-label="Aufgabenbewertung" className={detailed ? 'mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4' : 'mt-1 block w-80 max-w-full'}>
    {detailed ? <>
    <RatingMeter label="Wichtigkeit" icon={<ImportanceIcon className="size-icon-meta" />} value={values.importance} hint="Deine Einschätzung der Bedeutung." />
    <RatingMeter label="Dringlichkeit" icon={<UrgencyIcon className="size-icon-meta" />} value={values.urgency} hint={values.automatic ? 'Automatisch aus Fälligkeit und Aufwand.' : 'Manuell eingeschätzt.'} />
    <RatingMeter label={linked ? 'Restaufwand' : 'Aufwand'} icon={<EffortIcon className="size-icon-meta" />} value={values.effort} hint={linked ? 'Aus Gesamtaufwand und offenen Checklistenpunkten.' : 'Grob eingeschätzte verbleibende Arbeit.'} />
    </> : null}
    {includePriority ? <RatingMeter label="Priorität" value={values.priority} hint="Gleichgewichtet aus Wichtigkeit und Dringlichkeit." prominent /> : null}
  </span>
}
