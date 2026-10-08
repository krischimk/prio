import { StarIcon } from '../icons'
import { formatReminderOffset } from '../reminder'
import { input, mutedText, numberInput } from '../styles'
import { IconButton } from '../components/IconButton'
import { useCustomOffset } from './useCustomOffset'

/**
 * Tage, Stunden und Minuten – plus Richtung.
 *
 * Eine nackte Minutenzahl wird niemand im Kopf rechnen; „1 Std 30 Min vorher"
 * ist die Sprache, in der man das denkt.
 */
export function CustomOffset({
  idPrefix,
  value,
  onChange,
  onRemember,
  remembered,
}: {
  idPrefix: string
  value: number
  onChange: (minutes: number) => void
  onRemember: () => void
  remembered: boolean
}) {
  const { richtung, richtungWechseln, felder, setzen } = useCustomOffset({ value, onChange })

  const zahl = (id: 'tage' | 'stunden' | 'minuten', label: string, wert: number, max: number) => (
    <input
      id={`${idPrefix}-${id}`}
      type="number"
      min={0}
      max={max}
      aria-label={label}
      value={wert}
      onChange={(event) => {
        const gelesen = Number(event.target.value)
        setzen({ [id]: Number.isFinite(gelesen) ? Math.min(Math.max(0, gelesen), max) : 0 })
      }}
      className={numberInput}
    />
  )

  return (
    <div className="mt-2 space-y-2">
      {/*
        Zwei Zeilen statt einer: Nebeneinander blieben für Tage, Std und Min
        je rund 39 Pixel übrig, und ab drei Ziffern schnitt das Feld ab.
      */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor={`${idPrefix}-richtung`} className="mb-1 block text-meta text-ink-muted">
            Richtung
          </label>
          <select
            id={`${idPrefix}-richtung`}
            aria-label="Richtung"
            value={richtung}
            onChange={(event) => richtungWechseln(event.target.value as 'vorher' | 'nachher')}
            className={input}
          >
            <option value="vorher">vorher</option>
            <option value="nachher">nachher</option>
          </select>
        </div>
        <IconButton
          onClick={onRemember}
          aria-pressed={remembered}
          aria-label={
            remembered ? 'Aus der Schnellauswahl entfernen' : 'In die Schnellauswahl aufnehmen'
          }
          title={remembered ? 'Aus der Schnellauswahl entfernen' : 'In der Schnellauswahl behalten'}
          variant={remembered ? 'iconActive' : 'iconMuted'} layout="shrink-0"
        >
          <StarIcon filled={remembered} />
        </IconButton>
      </div>

      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-meta text-ink-muted">Tage</label>
          {zahl('tage', 'Tage vorher oder nachher', felder.tage, 3650)}
        </div>
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-meta text-ink-muted">Std</label>
          {zahl('stunden', 'Stunden vorher oder nachher', felder.stunden, 23)}
        </div>
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-meta text-ink-muted">Min</label>
          {zahl('minuten', 'Minuten vorher oder nachher', felder.minuten, 59)}
        </div>
      </div>
      <p className={`text-meta ${mutedText}`}>
        {formatReminderOffset(value)}
        {value < 0 ? ' – erinnert erst, wenn die Aufgabe noch offen ist.' : ''}
      </p>
    </div>
  )
}
