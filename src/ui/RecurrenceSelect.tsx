import { RECURRENCES } from '../domain/recurrence'
import { RECURRENCE_LABELS } from './recurrence'
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
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-neutral-400">
        Wiederholung
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`${input} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <option value="">Keine</option>
        {RECURRENCES.map((art) => (
          <option key={art} value={art}>
            {RECURRENCE_LABELS[art]}
          </option>
        ))}
      </select>
      {disabled ? (
        <p className="mt-1 text-xs text-neutral-500">
          Nur mit Fälligkeitsdatum möglich – sonst gibt es nichts fortzuschreiben.
        </p>
      ) : null}
    </div>
  )
}
