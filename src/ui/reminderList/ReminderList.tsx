import { isMutedFor, withMuted, MAX_REMINDERS, type TaskReminder } from '../../domain/reminder'
import { BellIcon, BellOffIcon, PlusIcon, TrashIcon } from '../icons'
import { mutedText } from '../styles'
import { Button } from '../components/Button'
import { IconButton } from '../components/IconButton'
import { AbsoluteRow } from './AbsoluteRow'
import { OffsetRow } from './OffsetRow'
import { useReminderRows } from './useReminderRows'

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
 *
 * Der Zustand liegt in `useReminderRows`, `useOffsetChoice` und
 * `useCustomOffset`; die Zeilen in `AbsoluteRow`, `OffsetRow` und
 * `CustomOffset`. Diese Datei zeichnet nur noch die Liste.
 */
export function ReminderList({
  idPrefix,
  dueAt,
  recurrence,
  reminders,
  viewerId,
  listIsShared,
  onChange,
}: {
  idPrefix: string
  dueAt: string | null
  recurrence: string | null
  reminders: TaskReminder[]
  /** Wer die App benutzt – nötig, um „für mich stumm" zu erkennen. */
  viewerId?: string
  /** Nur in geteilten Listen lässt sich eine Erinnerung stummschalten. */
  listIsShared?: boolean
  onChange: (next: TaskReminder[]) => void
}) {
  const { relativ, ersetzen, entfernen, hinzufuegen } = useReminderRows({
    dueAt,
    recurrence,
    reminders,
    onChange,
  })

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="block text-meta text-ink-muted">Erinnerungen</span>
        {reminders.length > 0 ? (
          <span className={`text-meta ${mutedText}`}>
            {reminders.length === 1 ? '1 Termin' : `${reminders.length} Termine`}
          </span>
        ) : null}
      </div>

      {reminders.length === 0 ? (
        <p className={`mb-2 text-meta ${mutedText}`}>
          Keine. Eine Fälligkeit erinnert nicht von selbst.
        </p>
      ) : (
        <ul className="mb-2 space-y-2">
          {reminders.map((reminder, index) => {
            const stumm = viewerId !== undefined && isMutedFor(reminder, viewerId)
            // Beim Ändern des Wertes darf die Stummschaltung nicht verloren gehen.
            const behalteStumm = reminder.mutedBy !== undefined ? { mutedBy: reminder.mutedBy } : {}
            return (
              <li key={index} className="rounded-control border border-line p-2">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    {/* `relativ` gilt nur mit Fälligkeit – hier nachgeprüft, damit
                        der Typ es auch weiß (die Herleitung steckt im Hook). */}
                    {relativ && dueAt !== null ? (
                      <OffsetRow
                        idPrefix={`${idPrefix}-r${index}`}
                        dueAt={dueAt}
                        minutes={reminder.form === 'offset' ? reminder.minutes : 0}
                        muted={stumm}
                        onChange={(minutes) =>
                          ersetzen(index, { form: 'offset', minutes, ...behalteStumm })
                        }
                      />
                    ) : (
                      <AbsoluteRow
                        idPrefix={`${idPrefix}-r${index}`}
                        at={reminder.form === 'absolute' ? reminder.at : null}
                        muted={stumm}
                        onChange={(at) => ersetzen(index, { form: 'absolute', at, ...behalteStumm })}
                      />
                    )}
                  </div>
                  {listIsShared && viewerId !== undefined ? (
                    <IconButton
                      onClick={() =>
                        onChange(
                          reminders.map((eintrag, i) =>
                            i === index ? withMuted(eintrag, viewerId, !stumm) : eintrag,
                          ),
                        )
                      }
                      aria-pressed={stumm}
                      aria-label={
                        stumm
                          ? `Erinnerung ${index + 1} wieder für mich einschalten`
                          : `Erinnerung ${index + 1} für mich stummschalten`
                      }
                      title={stumm ? 'Wieder für mich einschalten' : 'Nur für mich stummschalten'}
                      variant={stumm ? 'iconMuted' : 'icon'} layout="shrink-0"
                    >
                      {stumm ? <BellOffIcon className="h-4 w-4" /> : <BellIcon className="h-4 w-4" />}
                    </IconButton>
                  ) : null}
                  <IconButton
                    onClick={() => entfernen(index)}
                    aria-label={`Erinnerung ${index + 1} entfernen`}
                    title="Erinnerung entfernen"
                    variant="icon" layout="shrink-0"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </IconButton>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {reminders.length < MAX_REMINDERS ? (
        <Button onClick={hinzufuegen} variant="secondary" size="sm">
          <PlusIcon className="h-4 w-4" />
          Weitere Erinnerung
        </Button>
      ) : (
        <p className={`text-meta ${mutedText}`}>
          Mehr als {MAX_REMINDERS} Erinnerungen je Aufgabe sind nicht vorgesehen.
        </p>
      )}
    </div>
  )
}
