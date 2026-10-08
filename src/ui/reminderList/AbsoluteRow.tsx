import { BellIcon, BellOffIcon } from '../icons'
import { formatReminderLabel, fromDateTimeLocalValue, toDateTimeLocalValue } from '../datetime'
import { input, mutedText } from '../styles'

/** Einmalige Aufgabe: ein absoluter Zeitpunkt. */
export function AbsoluteRow({
  idPrefix,
  at,
  muted,
  onChange,
}: {
  idPrefix: string
  at: string | null
  muted: boolean
  onChange: (at: string) => void
}) {
  return (
    <div>
      <label htmlFor={idPrefix} className="sr-only">
        Erinnerung am
      </label>
      <input
        id={idPrefix}
        type="datetime-local"
        aria-label="Erinnerung am"
        value={toDateTimeLocalValue(at)}
        onChange={(event) => {
          const neu = fromDateTimeLocalValue(event.target.value)
          if (neu !== null) onChange(neu)
        }}
        className={input}
      />
      {at !== null ? (
        <p className={`mt-1 flex items-center gap-1 text-meta ${mutedText}`}>
          {muted ? <BellOffIcon className="h-3 w-3 shrink-0" /> : <BellIcon className="h-3 w-3 shrink-0" />}
          {formatReminderLabel(at)}
          {muted ? ' · für mich stumm' : ''}
        </p>
      ) : null}
    </div>
  )
}
