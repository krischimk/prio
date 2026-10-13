import { reminderTimeOf } from '../../domain/reminder'
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '../datetime'
import { formatReminderOffset } from '../reminder'
import { input } from '../styles'
import { DateTimeInput } from '../components/DateTimeInput'
import { CustomOffset } from './CustomOffset'
import { EIGENE, useOffsetChoice } from './useOffsetChoice'

/** Wiederkehrende Aufgabe: fester Vorlauf oder ein eigener. */
export function OffsetRow({
  idPrefix,
  dueAt,
  minutes,
  onChange,
}: {
  idPrefix: string
  dueAt: string
  minutes: number
  onChange: (minutes: number) => void
}) {
  const { auswahl, wert, waehlen, eigeneOffen, gemerkt, merken } = useOffsetChoice({
    minutes,
    onChange,
  })
  const zeitpunkt = reminderTimeOf({ form: 'offset', minutes }, dueAt)

  return (
    <div>
      <div className="reminder-timing-fields">
        <DateTimeInput id={idPrefix} label="Erinnerung am" required value={toDateTimeLocalValue(zeitpunkt)} onChange={value => {
          const next = fromDateTimeLocalValue(value)
          if (next) onChange(Math.round((Date.parse(dueAt) - Date.parse(next)) / 60000))
        }} />
        <div>
          <label htmlFor={`${idPrefix}-wahl`} className="sr-only">
            Erinnerung
          </label>
          <select
            id={`${idPrefix}-wahl`}
            aria-label="Erinnerung"
            value={wert}
            onChange={(event) => waehlen(event.target.value)}
            className={input}
          >
            {auswahl.map((wahl) => (
              <option key={wahl} value={String(wahl)}>
                {formatReminderOffset(wahl)}
              </option>
            ))}
            <option value={EIGENE}>Eigene …</option>
          </select>
        </div>
      </div>

      {eigeneOffen ? (
        <CustomOffset
          idPrefix={idPrefix}
          value={minutes}
          onChange={onChange}
          onRemember={merken}
          remembered={gemerkt}
        />
      ) : null}
    </div>
  )
}
