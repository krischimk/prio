import type { ListSection } from '../domain/types'
import { Field } from './components/Field'
import { RecurrenceSelect } from './RecurrenceSelect'
import { ReminderList } from './ReminderList'
import { SectionSelect } from './SectionSelect'
import { input } from './styles'
import type { TaskForm } from './useTaskForm'

/** Welche Felder ein Formular zeigt. */
export type TaskFieldName =
  | 'titel'
  | 'beschreibung'
  | 'faellig'
  | 'bereich'
  | 'wiederholung'
  | 'erinnerungen'

const ALLE: TaskFieldName[] = [
  'titel',
  'beschreibung',
  'faellig',
  'bereich',
  'wiederholung',
  'erinnerungen',
]

export interface TaskFieldsProps {
  form: TaskForm
  /** Die Bereiche der Liste – leer heißt: kein Bereichsfeld. */
  sections: ListSection[]
  /** Nur für die Erinnerungen nötig: Wer sieht sie, und ist die Liste geteilt? */
  currentUserId?: string
  listIsShared?: boolean
  /**
   * Vorsatz für die Feld-IDs (`task-<id>`, `detail`, `new-task`). Die
   * Beschriftung hängt per `htmlFor` daran – Vorleseprogramme und
   * `getByLabel` in den Tests brauchen das.
   */
  idPrefix: string
  /** Für die Eingabezeile: nur Beschreibung und Fälligkeit. */
  felder?: TaskFieldName[]
  /** Zeilen der Beschreibung – die Detailansicht hat mehr Platz. */
  beschreibungZeilen?: number
  /** Beim Anlegen auf dem Telefon steht der Schreibzeiger schon im Titelfeld. */
  titelAutofokus?: boolean
}

/**
 * Die Felder eines Aufgabenformulars – einmal.
 *
 * Vorher standen dieselben fünf Blöcke mit denselben Beschriftungen und
 * Umwandlungen in drei Dateien. Ein neues Feld (oder eine geänderte
 * Beschriftung) hätte an drei Stellen nachgezogen werden müssen; genau daran
 * waren die Fassungen schon auseinandergelaufen.
 *
 * Der **Rahmen** bleibt beim Aufrufer: die Karte der Zeile, das Blatt der
 * Detailansicht, die Eingabezeile. Knöpfe gehören ebenfalls dorthin – sie
 * unterscheiden sich je Rahmen.
 */
export function TaskFields({
  form,
  sections,
  currentUserId = '',
  listIsShared = false,
  idPrefix,
  felder = ALLE,
  beschreibungZeilen = 2,
  titelAutofokus = false,
}: TaskFieldsProps) {
  const zeigt = (feld: TaskFieldName) => felder.includes(feld)

  return (
    <>
      {zeigt('titel') ? (
        <Field id={`${idPrefix}-title`} label="Titel">
          <input
            id={`${idPrefix}-title`}
            value={form.werte.title}
            onChange={(event) => form.setzen('title', event.target.value)}
            autoFocus={titelAutofokus}
            required
            className={input}
          />
        </Field>
      ) : null}

      {zeigt('beschreibung') ? (
        <Field id={`${idPrefix}-description`} label="Beschreibung (optional)">
          <textarea
            id={`${idPrefix}-description`}
            value={form.werte.description}
            onChange={(event) => form.setzen('description', event.target.value)}
            rows={beschreibungZeilen}
            className={input}
          />
        </Field>
      ) : null}

      {zeigt('faellig') ? (
        <Field id={`${idPrefix}-due`} label="Fällig am (optional)">
          <input
            id={`${idPrefix}-due`}
            type="datetime-local"
            value={form.werte.dueAt}
            onChange={(event) => {
              const neu = event.target.value
              form.setzen('dueAt', neu)
              // Ohne Fälligkeit gibt es nichts fortzuschreiben.
              if (neu === '') form.setzen('recurrence', '')
            }}
            className={input}
          />
        </Field>
      ) : null}

      {zeigt('bereich') && sections.length > 0 ? (
        <Field id={`${idPrefix}-section`} label="Bereich">
          <SectionSelect
            id={`${idPrefix}-section`}
            sections={sections}
            value={form.werte.sectionId}
            onChange={(wert) => form.setzen('sectionId', wert)}
          />
        </Field>
      ) : null}

      {zeigt('wiederholung') ? (
        <RecurrenceSelect
          id={`${idPrefix}-recurrence`}
          value={form.werte.recurrence}
          disabled={form.werte.dueAt === ''}
          onChange={(wert) => form.setzen('recurrence', wert)}
        />
      ) : null}

      {zeigt('erinnerungen') ? (
        <ReminderList
          idPrefix={idPrefix}
          dueAt={form.dueIso}
          recurrence={form.werte.recurrence === '' ? null : form.werte.recurrence}
          reminders={form.werte.reminders}
          viewerId={currentUserId}
          listIsShared={listIsShared}
          onChange={(neu) => form.setzen('reminders', neu)}
        />
      ) : null}
    </>
  )
}
