import { useState } from 'react'
import { RECURRENCES, RECURRENCE_UNITS, makeRecurrence, recurrenceInterval, type RecurrenceUnit } from '../domain/recurrence'
import { RECURRENCE_LABELS, RECURRENCE_UNIT_LABELS } from './recurrence'
import { input } from './styles'
import { Select } from './components/Select'
import { CalendarIcon, RepeatIcon, SettingsIcon } from './icons'

/**
 * Auswahlfeld für die Wiederholung.
 *
 * Wiederholung braucht eine Fälligkeit: Ohne Datum gibt es nichts
 * fortzuschreiben. Ist keine gesetzt, bleibt das Feld abgeschaltet und sagt
 * auch, warum.
 */
export function RecurrenceSelect({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  const [custom, setCustom] = useState(value.startsWith('every:'))
  const [countDraft, setCountDraft] = useState<string | null>(null)
  const interval = recurrenceInterval(value) ?? { every: 2, unit: 'days' as const }
  return (
    <div className="space-y-2">
      <Select id={id} label="Wiederholung" icon={<RepeatIcon />}
        value={custom ? 'custom' : value}
        disabled={disabled}
        title="Wiederholung: Nach dem Abhaken wird der nächste Termin angelegt."
        onChange={next => {
          setCountDraft(null)
          setCustom(next === 'custom')
          onChange(next === 'custom' ? makeRecurrence(interval.every, interval.unit) : next)
        }}
        options={[{ value: '', label: 'Einmalig', icon: <CalendarIcon /> },
          ...RECURRENCES.map(value => ({ value, label: RECURRENCE_LABELS[value], icon: <RepeatIcon /> })),
          { value: 'custom', label: 'Eigenes Intervall …', icon: <SettingsIcon /> }]} />
      {custom ? <div className="grid min-w-0 grid-cols-[auto_minmax(0,5rem)_minmax(0,1fr)] items-center gap-2">
        <span className="text-meta text-ink-muted">Alle</span>
        <input type="number" min={1} max={999} step={1} required aria-label="Wiederholung: Anzahl" disabled={disabled}
          className={input} value={countDraft ?? interval.every} onChange={event => {
            setCountDraft(event.target.value)
            const count = Number(event.target.value)
            if (Number.isInteger(count) && count >= 1 && count <= 999) onChange(makeRecurrence(count, interval.unit))
          }} />
        <Select label="Wiederholung: Einheit" disabled={disabled} value={interval.unit} icon={<CalendarIcon />}
          onChange={value => { setCountDraft(null); onChange(makeRecurrence(interval.every, value as RecurrenceUnit)) }}
          options={RECURRENCE_UNITS.map(value => ({ value, label: RECURRENCE_UNIT_LABELS[value] }))} />
      </div> : null}
    </div>
  )
}
