import { reminderTimeOf } from '../../domain/reminder'
import { BellIcon, BellOffIcon } from '../icons'
import { formatReminderLabel } from '../datetime'
import { formatOffsetChoice } from '../reminder'
import { input, mutedText } from '../styles'
import { CustomOffset } from './CustomOffset'
import { EIGENE, useOffsetChoice } from './useOffsetChoice'

/** Wiederkehrende Aufgabe: fester Vorlauf oder ein eigener. */
export function OffsetRow({
  idPrefix,
  dueAt,
  minutes,
  muted,
  onChange,
}: {
  idPrefix: string
  dueAt: string
  minutes: number
  muted: boolean
  onChange: (minutes: number) => void
}) {
  const { auswahl, wert, waehlen, eigeneOffen, gemerkt, merken } = useOffsetChoice({
    minutes,
    onChange,
  })
  const zeitpunkt = reminderTimeOf({ form: 'offset', minutes }, dueAt)

  return (
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
            {formatOffsetChoice(wahl)}
          </option>
        ))}
        <option value={EIGENE}>Eigene …</option>
      </select>

      {eigeneOffen ? (
        <CustomOffset
          idPrefix={idPrefix}
          value={minutes}
          onChange={onChange}
          onRemember={merken}
          remembered={gemerkt}
        />
      ) : null}

      {zeitpunkt !== null ? (
        <p className={`mt-1 flex items-center gap-1 text-meta ${mutedText}`}>
          {muted ? <BellOffIcon className="h-3 w-3 shrink-0" /> : <BellIcon className="h-3 w-3 shrink-0" />}
          {formatReminderLabel(zeitpunkt)}
          {muted ? ' · für mich stumm' : ''}
        </p>
      ) : null}
    </div>
  )
}
