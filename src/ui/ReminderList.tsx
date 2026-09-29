import { useEffect, useMemo, useRef, useState } from 'react'
import { useReminderPresets } from '../app/hooks'
import { useWorkspace } from '../app/useWorkspace'
import { isRecurrence } from '../domain/recurrence'
import {
  MAX_REMINDERS,
  absoluteFromOffset,
  offsetFromAbsolute,
  reminderTimeOf,
  type TaskReminder,
} from '../domain/reminder'
import {
  formatReminderLabel,
  fromDateTimeLocalValue,
  toDateTimeLocalValue,
} from './datetime'
import { BellIcon, PlusIcon, StarIcon, TrashIcon } from './icons'
import {
  FIXED_REMINDER_STEPS,
  formatOffsetChoice,
  formatReminderOffset,
  reminderSuggestion,
} from './reminder'
import { activeIcon, ghostButton, input, mutedText, numberInput, secondaryButton } from './styles'

/**
 * Erinnerungen einer Aufgabe – in beiden Ansichten dieselbe Komponente.
 *
 * Die Form folgt der Wiederholung (siehe `alignReminders`):
 *
 *   einmalig      absolute Zeitpunkte
 *   wiederkehrend Vorläufe in Tagen, Stunden und Minuten, auch negativ
 *
 * **Eine Aufgabe kann mehrere tragen.** Jede wird ein eigener Termin beim
 * Betriebssystem; eine leere Liste heißt „keine Erinnerung".
 */

const EIGENE = 'custom'

export function ReminderList({
  idPrefix,
  dueAt,
  recurrence,
  reminders,
  onChange,
}: {
  idPrefix: string
  dueAt: string | null
  recurrence: string | null
  reminders: TaskReminder[]
  onChange: (next: TaskReminder[]) => void
}) {
  const relativ = isRecurrence(recurrence) && dueAt !== null

  /*
   * Wechselt die Form, wandert jede Erinnerung mit.
   *
   * Sonst stünde im Formular etwas anderes, als beim Speichern herauskäme. Das
   * Repository rechnet zwar ebenfalls um, aber nur wenn das Formular zur Liste
   * nichts sagt; hier sagt es etwas, und deshalb muss es das Richtige sagen.
   */
  const vorherRelativ = useRef(relativ)
  useEffect(() => {
    if (vorherRelativ.current === relativ) return
    vorherRelativ.current = relativ
    onChange(umformen(reminders, dueAt, relativ, Date.now()))
    // Absichtlich nur am Formwechsel aufgehängt; die Liste ist die Quelle.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [relativ])

  const ersetzen = (index: number, neu: TaskReminder) => {
    onChange(reminders.map((eintrag, i) => (i === index ? neu : eintrag)))
  }

  const entfernen = (index: number) => {
    onChange(reminders.filter((_, i) => i !== index))
  }

  const hinzufuegen = () => {
    if (reminders.length >= MAX_REMINDERS) return
    onChange([...reminders, reminderSuggestion(recurrence, dueAt, Date.now())])
  }

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="block text-xs text-neutral-400">Erinnerungen</span>
        {reminders.length > 0 ? (
          <span className={`text-xs ${mutedText}`}>
            {reminders.length === 1 ? '1 Termin' : `${reminders.length} Termine`}
          </span>
        ) : null}
      </div>

      {reminders.length === 0 ? (
        <p className={`mb-2 text-xs ${mutedText}`}>
          Keine. Eine Fälligkeit erinnert nicht von selbst.
        </p>
      ) : (
        <ul className="mb-2 space-y-2">
          {reminders.map((reminder, index) => (
            <li key={index} className="rounded-md border border-neutral-800 p-2">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  {relativ ? (
                    <OffsetRow
                      idPrefix={`${idPrefix}-r${index}`}
                      dueAt={dueAt}
                      minutes={reminder.form === 'offset' ? reminder.minutes : 0}
                      onChange={(minutes) => ersetzen(index, { form: 'offset', minutes })}
                    />
                  ) : (
                    <AbsoluteRow
                      idPrefix={`${idPrefix}-r${index}`}
                      at={reminder.form === 'absolute' ? reminder.at : null}
                      onChange={(at) => ersetzen(index, { form: 'absolute', at })}
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => entfernen(index)}
                  aria-label={`Erinnerung ${index + 1} entfernen`}
                  title="Erinnerung entfernen"
                  className={`${ghostButton} shrink-0 px-2 py-2`}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {reminders.length < MAX_REMINDERS ? (
        <button type="button" onClick={hinzufuegen} className={`${secondaryButton} px-2 py-1 text-xs`}>
          <PlusIcon className="h-4 w-4" />
          Weitere Erinnerung
        </button>
      ) : (
        <p className={`text-xs ${mutedText}`}>
          Mehr als {MAX_REMINDERS} Erinnerungen je Aufgabe sind nicht vorgesehen.
        </p>
      )}
    </div>
  )
}

/** Einmalige Aufgabe: ein absoluter Zeitpunkt. */
function AbsoluteRow({
  idPrefix,
  at,
  onChange,
}: {
  idPrefix: string
  at: string | null
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
        <p className={`mt-1 flex items-center gap-1 text-xs ${mutedText}`}>
          <BellIcon className="h-3 w-3 shrink-0" />
          {formatReminderLabel(at)}
        </p>
      ) : null}
    </div>
  )
}

/** Wiederkehrende Aufgabe: fester Vorlauf oder ein eigener. */
function OffsetRow({
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
  const { repositories } = useWorkspace()
  const presets = useReminderPresets()

  // Feste Stufen und gemerkte Werte, ohne Doppelte und in steter Reihenfolge.
  const auswahl = useMemo(() => {
    const gesehen = new Set<number>()
    return [...FIXED_REMINDER_STEPS, ...presets].filter((wert) => {
      if (gesehen.has(wert)) return false
      gesehen.add(wert)
      return true
    })
  }, [presets])

  // Eigener Offen-Zustand: Sonst klappte „Eigene …" sofort wieder zu, sobald
  // der eingestellte Wert zufällig eine der festen Stufen trifft (0 ist eine).
  const [eigeneOffen, setEigeneOffen] = useState(!FIXED_REMINDER_STEPS.includes(minutes))
  const wert = eigeneOffen ? EIGENE : String(minutes)

  const merken = async () => {
    const neu = presets.includes(minutes)
      ? presets.filter((wert2) => wert2 !== minutes)
      : [...presets, minutes]
    await repositories.setReminderPresets(neu)
  }

  const gemerkt = presets.includes(minutes)
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
        onChange={(event) => {
          if (event.target.value === EIGENE) {
            setEigeneOffen(true)
            return
          }
          setEigeneOffen(false)
          onChange(Number(event.target.value))
        }}
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
  const setzen = (teil: Partial<typeof felder>, neueRichtung = richtung) => {
    const neu = { ...felder, ...teil }
    setFelder(neu)
    const gesamt = neu.tage * 1440 + neu.stunden * 60 + neu.minuten
    onChange(neueRichtung === 'nachher' ? -gesamt : gesamt)
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
              setzen({}, neu)
            }}
            className={input}
          >
            <option value="vorher">vorher</option>
            <option value="nachher">nachher</option>
          </select>
        </div>
        <button
          type="button"
          onClick={onRemember}
          aria-pressed={remembered}
          aria-label={
            remembered ? 'Aus der Schnellauswahl entfernen' : 'In die Schnellauswahl aufnehmen'
          }
          title={remembered ? 'Aus der Schnellauswahl entfernen' : 'In der Schnellauswahl behalten'}
          className={`${ghostButton} shrink-0 px-3 py-2 ${
            remembered ? activeIcon : 'text-neutral-500'
          }`}
        >
          <StarIcon filled={remembered} />
        </button>
      </div>

      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs text-neutral-400">Tage</label>
          {zahl('tage', 'Tage vorher oder nachher', felder.tage, 3650)}
        </div>
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs text-neutral-400">Std</label>
          {zahl('stunden', 'Stunden vorher oder nachher', felder.stunden, 23)}
        </div>
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs text-neutral-400">Min</label>
          {zahl('minuten', 'Minuten vorher oder nachher', felder.minuten, 59)}
        </div>
      </div>
      <p className={`text-xs ${mutedText}`}>
        {formatReminderOffset(value)}
        {value < 0 ? ' – erinnert erst, wenn die Aufgabe noch offen ist.' : ''}
      </p>
    </div>
  )
}

/**
 * Bringt eine Liste in die Form, die zur Wiederholung passt.
 *
 * Dieselbe Umrechnung wie in `alignReminders`, nur für die Anzeige: Beim
 * Wechsel der Wiederholung soll im Formular sofort stehen, was gespeichert
 * würde.
 */
function umformen(
  reminders: TaskReminder[],
  dueAt: string | null,
  relativ: boolean,
  nowMs: number,
): TaskReminder[] {
  const ergebnis: TaskReminder[] = []
  for (const reminder of reminders) {
    if (relativ) {
      const minutes =
        reminder.form === 'offset' ? reminder.minutes : offsetFromAbsolute(dueAt, reminder.at)
      if (minutes !== null) ergebnis.push({ form: 'offset', minutes })
    } else {
      const at =
        reminder.form === 'absolute'
          ? reminder.at
          : absoluteFromOffset(dueAt, reminder.minutes, nowMs)
      if (at !== null) ergebnis.push({ form: 'absolute', at })
    }
  }
  return ergebnis
}
