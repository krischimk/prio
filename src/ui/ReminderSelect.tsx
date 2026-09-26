import { useEffect, useMemo, useRef, useState } from 'react'
import { useReminderPresets } from '../app/hooks'
import { useWorkspace } from '../app/useWorkspace'
import { isRecurrence } from '../domain/recurrence'
import { absoluteFromOffset, offsetFromAbsolute } from '../domain/reminder'
import {
  formatReminderLabel,
  fromDateTimeLocalValue,
  toDateTimeLocalValue,
} from './datetime'
import { BellIcon, StarIcon } from './icons'
import {
  FIXED_REMINDER_STEPS,
  formatReminderOffset,
  reminderPreview,
  type ReminderValue,
} from './reminder'
import { activeIcon, ghostButton, input, mutedText } from './styles'

/**
 * Erinnerung einer Aufgabe – in beiden Ansichten dieselbe Komponente.
 *
 * Die Form folgt der Wiederholung (siehe `alignReminder`):
 *
 *   einmalig      absoluter Zeitpunkt
 *   wiederkehrend Vorlauf in Tagen, Stunden und Minuten, auch negativ
 *
 * Wie bei der Wiederholung gilt: Beide Formulare binden diese Komponente ein,
 * damit die andere Oberfläche nicht vergessen werden kann (`AGENTS.md`,
 * Abschnitt „Oberfläche").
 */

const KEINE = ''
const ZUR_FAELLIGKEIT = 'at-due'
const EIGENE = 'custom'

export function ReminderSelect({
  idPrefix,
  dueAt,
  recurrence,
  remindAt,
  reminderOffsetMinutes,
  disabled,
  onChange,
}: {
  idPrefix: string
  dueAt: string | null
  recurrence: string | null
  remindAt?: string | null
  reminderOffsetMinutes?: number | null
  disabled?: boolean
  onChange: (next: ReminderValue) => void
}) {
  const relativ = isRecurrence(recurrence) && dueAt !== null

  /*
   * Wechselt die Form, wandert der Moment mit.
   *
   * Sonst stünde im Formular „Keine", während beim Speichern derselbe
   * Zeitpunkt als Vorlauf herauskäme – die Anzeige und das Ergebnis wären
   * verschiedene Dinge. Das Repository rechnet zwar ebenfalls um, aber nur,
   * wenn das Formular zum Wert nichts sagt; hier sagt es etwas, und deshalb
   * muss es auch das Richtige sagen.
   */
  const vorherRelativ = useRef(relativ)
  useEffect(() => {
    if (vorherRelativ.current === relativ) return
    vorherRelativ.current = relativ
    if (relativ) {
      onChange({
        reminderOffsetMinutes:
          remindAt == null ? null : offsetFromAbsolute(dueAt, remindAt),
      })
    } else {
      onChange({
        remindAt: absoluteFromOffset(dueAt, reminderOffsetMinutes ?? null, Date.now()),
      })
    }
    // Absichtlich nur am Formwechsel aufgehängt; die Werte sind die Quelle.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [relativ])

  return relativ ? (
    <RelativeReminder
      idPrefix={idPrefix}
      dueAt={dueAt}
      value={reminderOffsetMinutes}
      disabled={disabled ?? false}
      onChange={(minutes) => onChange({ reminderOffsetMinutes: minutes })}
    />
  ) : (
    <AbsoluteReminder
      idPrefix={idPrefix}
      dueAt={dueAt}
      value={remindAt ?? null}
      onChange={(at) => onChange({ remindAt: at })}
    />
  )
}

/** Einmalige Aufgabe: „Keine", „Zur Fälligkeit" oder ein eigener Zeitpunkt. */
function AbsoluteReminder({
  idPrefix,
  dueAt,
  value,
  onChange,
}: {
  idPrefix: string
  dueAt: string | null
  value: string | null
  onChange: (at: string | null) => void
}) {
  // Der Offen-Zustand der eigenen Eingabe wird eigens gehalten: Sonst fiele die
  // Auswahl sofort auf „Zur Fälligkeit" zurück, sobald der eigene Wert zufällig
  // genau die Fälligkeit ist – das Feld klappte beim Öffnen wieder zu.
  const [eigeneOffen, setEigeneOffen] = useState(false)
  // `eigeneOffen` steht vorn: Ohne das fiele die Auswahl auf „Keine" zurück,
  // solange noch gar keine Erinnerung gesetzt ist – und das Feld ließe sich
  // ohne Fälligkeit nicht mehr öffnen.
  const auswahl = eigeneOffen
    ? EIGENE
    : value === null
      ? KEINE
      : dueAt !== null && value === dueAt
        ? ZUR_FAELLIGKEIT
        : EIGENE

  const waehlen = (wahl: string) => {
    if (wahl === KEINE) {
      setEigeneOffen(false)
      return onChange(null)
    }
    if (wahl === ZUR_FAELLIGKEIT) {
      setEigeneOffen(false)
      return onChange(dueAt)
    }
    setEigeneOffen(true)
    // Mit der Fälligkeit vorbelegen, damit das Feld nicht leer startet.
    return onChange(value ?? dueAt)
  }

  return (
    <div>
      <label htmlFor={`${idPrefix}-reminder`} className="mb-1 block text-xs text-neutral-400">
        Erinnerung
      </label>
      <select
        id={`${idPrefix}-reminder`}
        value={auswahl}
        onChange={(event) => waehlen(event.target.value)}
        className={input}
      >
        <option value={KEINE}>Keine</option>
        <option value={ZUR_FAELLIGKEIT} disabled={dueAt === null}>
          Zur Fälligkeit
        </option>
        <option value={EIGENE}>Eigene Zeit …</option>
      </select>

      {auswahl === EIGENE ? (
        <div className="mt-2">
          <input
            id={`${idPrefix}-reminder-at`}
            type="datetime-local"
            aria-label="Erinnerung am"
            value={toDateTimeLocalValue(value)}
            onChange={(event) =>
              onChange(fromDateTimeLocalValue(event.target.value))
            }
            className={input}
          />
          {value !== null ? (
            <p className={`mt-1 text-xs ${mutedText}`}>{formatReminderLabel(value)}</p>
          ) : null}
        </div>
      ) : null}

      {dueAt === null && auswahl === KEINE ? (
        <p className={`mt-1 text-xs ${mutedText}`}>
          Unabhängig von der Fälligkeit – eine Aufgabe kann auch ohne Termin erinnern.
        </p>
      ) : null}
    </div>
  )
}

/** Wiederkehrende Aufgabe: fester Vorlauf oder ein eigener. */
function RelativeReminder({
  idPrefix,
  dueAt,
  value,
  disabled,
  onChange,
}: {
  idPrefix: string
  dueAt: string
  value: number | null | undefined
  disabled: boolean
  onChange: (minutes: number | null) => void
}) {
  const { repositories } = useWorkspace()
  const presets = useReminderPresets()

  // Feste Stufen und gemerkte Werte, ohne Doppelte und in steter Reihenfolge.
  const auswahl = useMemo(() => {
    const gesehen = new Set<number>()
    return [...FIXED_REMINDER_STEPS, ...presets].filter((minuten) => {
      if (gesehen.has(minuten)) return false
      gesehen.add(minuten)
      return true
    })
  }, [presets])

  const aktuell = value ?? null
  const bekannt = aktuell !== null && auswahl.includes(aktuell)
  // Eigener Offen-Zustand: Sonst klappte „Eigene …" sofort wieder zu, sobald
  // der eingestellte Wert zufällig eine der festen Stufen trifft (0 ist eine).
  const [eigeneOffen, setEigeneOffen] = useState(false)
  const auswahlWert = eigeneOffen
    ? EIGENE
    : aktuell === null
      ? KEINE
      : bekannt
        ? String(aktuell)
        : EIGENE

  const waehlen = (wahl: string) => {
    if (wahl === KEINE) {
      setEigeneOffen(false)
      return onChange(null)
    }
    if (wahl === EIGENE) {
      setEigeneOffen(true)
      return onChange(aktuell ?? 0)
    }
    setEigeneOffen(false)
    return onChange(Number(wahl))
  }

  const merken = async () => {
    if (aktuell === null) return
    const neu = presets.includes(aktuell)
      ? presets.filter((minuten) => minuten !== aktuell)
      : [...presets, aktuell]
    await repositories.setReminderPresets(neu)
  }

  const gemerkt = aktuell !== null && presets.includes(aktuell)
  const zeitpunkt = reminderPreview(dueAt, aktuell)

  return (
    <div>
      <label htmlFor={`${idPrefix}-reminder`} className="mb-1 block text-xs text-neutral-400">
        Erinnerung
      </label>
      <select
        id={`${idPrefix}-reminder`}
        value={auswahlWert}
        disabled={disabled}
        onChange={(event) => waehlen(event.target.value)}
        className={`${input} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <option value={KEINE}>Keine</option>
        {auswahl.map((minuten) => (
          <option key={minuten} value={String(minuten)}>
            {formatReminderOffset(minuten)}
          </option>
        ))}
        <option value={EIGENE}>Eigene …</option>
      </select>

      {auswahlWert === EIGENE ? (
        <CustomOffset
          idPrefix={idPrefix}
          value={aktuell ?? 0}
          onChange={onChange}
          onRemember={merken}
          remembered={gemerkt}
        />
      ) : null}

      {zeitpunkt !== null ? (
        <p className={`mt-1 flex items-center gap-1 text-xs ${mutedText}`}>
          <BellIcon className="h-3 w-3 shrink-0" />
          {formatReminderLabel(zeitpunkt)}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Tage, Stunden und Minuten – plus Richtung.
 *
 * Eine nackte Minutenzahl wird niemand im Kopf rechnen; „1 Std 30 Min vorher"
 * ist die Sprache, in der man das denkt.
 */
function CustomOffset({
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
  const nachher = value < 0
  const betrag = Math.abs(value)
  const tage = Math.floor(betrag / 1440)
  const stunden = Math.floor((betrag % 1440) / 60)
  const minuten = betrag % 60

  const [richtung, setRichtung] = useState<'vorher' | 'nachher'>(nachher ? 'nachher' : 'vorher')
  const [felder, setFelder] = useState({ tage, stunden, minuten })

  // Bei einer Änderung an einer Stelle werden alle drei neu gerechnet – so
  // bleibt der Wert eine einzige Zahl und die Anzeige konsistent.
  const setzen = (teil: Partial<typeof felder>) => {
    const neu = { ...felder, ...teil }
    setFelder(neu)
    const gesamt = neu.tage * 1440 + neu.stunden * 60 + neu.minuten
    onChange(richtung === 'nachher' ? -gesamt : gesamt)
  }

  const zahl = (id: string, label: string, wert: number, max: number) => (
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
      className={`${input} px-2 py-1`}
    />
  )

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-end gap-2">
        <div className="w-24 shrink-0">
          <label htmlFor={`${idPrefix}-richtung`} className="mb-1 block text-xs text-neutral-400">
            Richtung
          </label>
          <select
            id={`${idPrefix}-richtung`}
            aria-label="Richtung"
            value={richtung}
            onChange={(event) => {
              const neu = event.target.value as 'vorher' | 'nachher'
              setRichtung(neu)
              const gesamt = felder.tage * 1440 + felder.stunden * 60 + felder.minuten
              onChange(neu === 'nachher' ? -gesamt : gesamt)
            }}
            className={`${input} px-2 py-1`}
          >
            <option value="vorher">vorher</option>
            <option value="nachher">nachher</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-neutral-400">Tage</label>
          {zahl('tage', 'Tage vorher oder nachher', felder.tage, 3650)}
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-neutral-400">Std</label>
          {zahl('stunden', 'Stunden vorher oder nachher', felder.stunden, 23)}
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-neutral-400">Min</label>
          {zahl('minuten', 'Minuten vorher oder nachher', felder.minuten, 59)}
        </div>
        <button
          type="button"
          onClick={onRemember}
          aria-pressed={remembered}
          aria-label={
            remembered ? 'Aus der Schnellauswahl entfernen' : 'In die Schnellauswahl aufnehmen'
          }
          title={remembered ? 'Aus der Schnellauswahl entfernen' : 'In der Schnellauswahl behalten'}
          className={`${ghostButton} shrink-0 px-2 py-2 ${
            remembered ? activeIcon : 'text-neutral-500'
          }`}
        >
          <StarIcon filled={remembered} />
        </button>
      </div>
      <p className={`text-xs ${mutedText}`}>
        {formatReminderOffset(value)}
        {value < 0 ? ' – erinnert erst, wenn die Aufgabe noch offen ist.' : ''}
      </p>
    </div>
  )
}
