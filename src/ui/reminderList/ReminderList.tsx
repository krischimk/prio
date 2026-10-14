import { isMutedFor, withMuted, MAX_REMINDERS, type TaskReminder } from '../../domain/reminder'
import { BellIcon, BellOffIcon, PlusIcon, TrashIcon } from '../icons'
import { mutedText } from '../styles'
import { Button } from '../components/Button'
import { IconButton } from '../components/IconButton'
import { OneTimeRow } from './OneTimeRow'
import { OffsetRow } from './OffsetRow'
import { useReminderRows } from './useReminderRows'

/**
 * Erinnerungen einer Aufgabe – in beiden Ansichten dieselbe Komponente.
 *
 * Einmalig: feste Zeitpunkte oder gebundene Vorlagen. Serien: Vorläufe in
 * Tagen, Stunden und Minuten, auch negativ (siehe `alignReminders`).
 *
 * **Eine Aufgabe kann mehrere tragen.** Jede wird ein eigener Termin beim
 * Betriebssystem; eine leere Liste heißt „keine Erinnerung".
 *
 * Der Zustand liegt in `useReminderRows`, `useOffsetChoice` und
 * `useCustomOffset`; die Zeilen in `OneTimeRow`, `OffsetRow` und
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
      {reminders.length > 0 ? (
        <ul className="mb-2 space-y-2">
          {reminders.map((reminder, index) => {
            const stumm = viewerId !== undefined && isMutedFor(reminder, viewerId)
            // Beim Ändern des Wertes darf die Stummschaltung nicht verloren gehen.
            const behalteStumm = reminder.mutedBy !== undefined ? { mutedBy: reminder.mutedBy } : {}
            return (
              <li key={index} className="rounded-control px-2 py-2">
                <div className="flex items-start gap-2">
                  {stumm ? <BellOffIcon className="mt-3 h-5 w-5 shrink-0 text-ink-muted" /> : <BellIcon className="mt-3 h-5 w-5 shrink-0 text-ink-muted" />}
                  <div className="reminder-controls min-w-0 flex-1">
                    {/* `relativ` gilt nur mit Fälligkeit – hier nachgeprüft, damit
                        der Typ es auch weiß (die Herleitung steckt im Hook). */}
                    {relativ && dueAt !== null ? (
                      <OffsetRow
                        idPrefix={`${idPrefix}-r${index}`}
                        dueAt={dueAt}
                        minutes={reminder.form === 'offset' ? reminder.minutes : 0}
                        onChange={(minutes) =>
                          ersetzen(index, { form: 'offset', minutes, ...behalteStumm })
                        }
                      />
                    ) : (
                      <OneTimeRow
                        idPrefix={`${idPrefix}-r${index}`}
                        reminder={reminder}
                        dueAt={dueAt}
                        onChange={(next) => ersetzen(index, { ...next, ...behalteStumm })}
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
      ) : null}

      {reminders.length < MAX_REMINDERS ? (
        <Button onClick={hinzufuegen} variant="ghost" size="field" title="Erinnerung hinzufügen. Ein Fälligkeitsdatum allein löst keine Erinnerung aus." layout="w-full justify-start">
          {reminders.length === 0 ? <BellIcon className="h-5 w-5" /> : <PlusIcon className="h-5 w-5" />}
          {reminders.length === 0 ? 'Erinnerung hinzufügen' : 'Weitere Erinnerung'}
        </Button>
      ) : (
        <p className={`text-meta ${mutedText}`}>
          Mehr als {MAX_REMINDERS} Erinnerungen je Aufgabe sind nicht vorgesehen.
        </p>
      )}
    </div>
  )
}
