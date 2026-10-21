import { StarIcon } from '../icons'
import { formatReminderOffset } from '../reminder'
import { input, numberInput } from '../styles'
import { IconButton } from '../components/IconButton'
import { OFFSET_UNITS, useCustomOffset } from './useCustomOffset'

/** Eigener Vorlauf: eine Zahl, eine Einheit und die Richtung. */
export function CustomOffset({ idPrefix, value, onChange, onRemember, remembered }: {
  idPrefix: string; value: number; onChange: (minutes: number) => void; onRemember: () => void; remembered: boolean
}) {
  const { amount, unit, direction, change, max } = useCustomOffset({ value, onChange })
  return <div className="mt-2 space-y-2">
    <div className="grid grid-cols-2 items-end gap-2">
      <label className="space-y-1 text-meta text-ink-muted" htmlFor={`${idPrefix}-amount`}>Abstand
        <input id={`${idPrefix}-amount`} type="number" aria-label="Erinnerungsabstand" min={0} max={max} step="any" required value={amount}
          onChange={event => change({ amount: event.target.value })} className={numberInput} />
      </label>
      <select aria-label="Einheit des Erinnerungsabstands" value={unit} onChange={event => change({ unit: event.target.value as typeof unit })} className={input}>
        {Object.entries(OFFSET_UNITS).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <select aria-label="Richtung" value={direction} onChange={event => change({ direction: event.target.value })} className={input}>
        <option value="vorher">vorher</option><option value="nachher">nachher</option>
      </select>
      <IconButton onClick={onRemember} aria-pressed={remembered} aria-label={remembered ? 'Aus der Schnellauswahl entfernen' : 'In die Schnellauswahl aufnehmen'}
        variant={remembered ? 'iconActive' : 'iconMuted'} layout="justify-self-end"><StarIcon filled={remembered} /></IconButton>
    </div>
    <p className="text-meta text-ink-muted">{formatReminderOffset(value)}{value < 0 ? ' – erinnert erst, wenn die Aufgabe noch offen ist.' : ''}</p>
  </div>
}
