import { systemTimeZone } from '../domain/calendar'
import type { RecurrenceRule } from '../domain/routine'
import { Select } from './components/Select'
import { TimeInput } from './components/TimeInput'
import { input, focusRing } from './styles'
import type { TaskForm } from './useTaskForm'
import { useState } from 'react'

export function RoutineFields({ form, idPrefix }: { form: TaskForm; idPrefix: string }) {
  const rule = form.werte.recurrenceRule
  const change = (patch: Partial<RecurrenceRule>) => form.setzen('recurrenceRule', { visibility: { mode: 'clock', time: '05:00' }, resetMissed: false, timeZone: systemTimeZone(), ...rule, ...patch })
  const minutes = rule?.visibility.mode === 'lead' ? rule.visibility.minutes : 720
  const [unit, setUnit] = useState(minutes && minutes % 1440 === 0 ? 1440 : minutes % 60 === 0 ? 60 : 1)
  return <div className="space-y-2">
    <Select label="Sichtbarkeit der Wiederholungen" value={rule?.visibility.mode ?? 'always'} disabled={form.busy}
      options={[{ value: 'always', label: 'Nächste Wiederholung sofort anzeigen' }, { value: 'clock', label: 'Erst ab einer Uhrzeit anzeigen' }, { value: 'lead', label: 'Erst vor der Fälligkeit anzeigen' }]}
      onChange={value => value === 'always' ? form.setzen('recurrenceRule', null) : change({ visibility: value === 'clock' ? { mode: 'clock', time: '05:00' } : { mode: 'lead', minutes: 720 } })} />
    {rule?.visibility.mode === 'clock' ? <TimeInput id={`${idPrefix}-visible`} label="Sichtbar ab" value={rule.visibility.time} scopeValue={rule.visibility.time} disabled={form.busy}
      onChange={time => change({ visibility: { mode: 'clock', time } })} /> : null}
    {rule?.visibility.mode === 'lead' ? <div className="grid grid-cols-[minmax(0,5rem)_minmax(0,1fr)] items-center gap-2">
      <input className={input} type="number" aria-label="Sichtbarkeit: Vorlauf" min={0} max={Math.floor(5_256_000 / unit)} step={1} value={minutes / unit} disabled={form.busy}
        onChange={event => { const value = event.target.valueAsNumber; if (Number.isInteger(value) && value >= 0 && value * unit <= 5_256_000) change({ visibility: { mode: 'lead', minutes: value * unit } }) }} />
      <Select label="Sichtbarkeit: Einheit" value={String(unit)} disabled={form.busy}
        options={[{ value: '1', label: 'Minuten vorher' }, { value: '60', label: 'Stunden vorher' }, { value: '1440', label: 'Tage vorher' }]}
        onChange={value => { setUnit(Number(value)); change({ visibility: { mode: 'lead', minutes: Math.min(5_256_000, Math.round(minutes / unit) * Number(value)) } }) }} />
    </div> : null}
    {rule ? <label className={`${focusRing} flex min-h-11 cursor-pointer items-center gap-3 text-body text-ink-soft`}>
      <input type="checkbox" className="size-5 accent-brand" checked={rule.resetMissed} disabled={form.busy} onChange={event => change({ resetMissed: event.target.checked })} />
      Beim nächsten Durchlauf neu beginnen
    </label> : null}
    {rule ? <p className="text-meta text-ink-faint">{rule.resetMissed ? 'Verpasste Durchläufe werden beim nächsten Start ersetzt. Erledigte Durchläufe kannst du bis dahin wiederherstellen.' : 'Verpasste Aufgaben bleiben überfällig, bis du sie erledigst.'}</p> : null}
  </div>
}
