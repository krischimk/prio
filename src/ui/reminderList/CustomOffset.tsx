import { ArrowLeftIcon, ClockIcon, StarIcon } from '../icons'
import { formatReminderOffset } from '../reminder'
import { numberInput } from '../styles'
import { Select } from '../components/Select'
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
      <Select label="Einheit des Erinnerungsabstands" value={unit} icon={<ClockIcon />} onChange={value => change({ unit: value as typeof unit })}
        options={Object.entries(OFFSET_UNITS).map(([value, { label }]) => ({ value, label }))} />
      <Select label="Richtung" value={direction} onChange={value => change({ direction: value })}
        options={[{ value: 'vorher', label: 'vorher', icon: <ArrowLeftIcon /> },
          { value: 'nachher', label: 'nachher', icon: <ArrowLeftIcon className="size-icon rotate-180" /> }]} />
      <IconButton onClick={onRemember} aria-pressed={remembered} aria-label={remembered ? 'Aus der Schnellauswahl entfernen' : 'In die Schnellauswahl aufnehmen'}
        variant={remembered ? 'iconActive' : 'iconMuted'} layout="justify-self-end"><StarIcon filled={remembered} /></IconButton>
    </div>
    <p className="text-meta text-ink-muted">{formatReminderOffset(value)}{value < 0 ? ' – erinnert erst, wenn die Aufgabe noch offen ist.' : ''}</p>
  </div>
}
