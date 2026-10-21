import { useState } from 'react'
import { RECURRENCES, RECURRENCE_UNITS, makeRecurrence, recurrenceInterval, type RecurrenceUnit } from '../domain/recurrence'
import { RECURRENCE_LABELS, RECURRENCE_UNIT_LABELS } from './recurrence'
import { input } from './styles'

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
      <label htmlFor={id} className="sr-only">
        Wiederholung
      </label>
      <select
        id={id}
        value={custom ? 'custom' : value}
        disabled={disabled}
        title="Wiederholung: Nach dem Abhaken wird der nächste Termin angelegt."
        onChange={event => {
          setCountDraft(null)
          setCustom(event.target.value === 'custom')
          onChange(event.target.value === 'custom' ? makeRecurrence(interval.every, interval.unit) : event.target.value)
        }}
        className={`${input} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <option value="">Einmalig</option>
        {RECURRENCES.map((art) => (
          <option key={art} value={art}>
            {RECURRENCE_LABELS[art]}
          </option>
        ))}
        <option value="custom">Eigenes Intervall …</option>
      </select>
      {custom ? <div className="flex min-w-0 items-center gap-2">
        <span className="text-meta text-ink-muted">Alle</span>
        <input type="number" min={1} max={999} step={1} required aria-label="Wiederholung: Anzahl" disabled={disabled}
          className={input} value={countDraft ?? interval.every} onChange={event => {
            setCountDraft(event.target.value)
            const count = Number(event.target.value)
            if (Number.isInteger(count) && count >= 1 && count <= 999) onChange(makeRecurrence(count, interval.unit))
          }} />
        <select aria-label="Wiederholung: Einheit" className={input} disabled={disabled} value={interval.unit}
          onChange={event => { setCountDraft(null); onChange(makeRecurrence(interval.every, event.target.value as RecurrenceUnit)) }}>
          {RECURRENCE_UNITS.map(unit => <option key={unit} value={unit}>{RECURRENCE_UNIT_LABELS[unit]}</option>)}
        </select>
      </div> : null}
    </div>
  )
}
