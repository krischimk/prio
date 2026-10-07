import type { LocalTask } from '../domain/types'
import { formatDueLabel } from './datetime'
import { BellIcon, BellOffIcon, RepeatIcon } from './icons'
import { describeRecurrence } from './recurrence'
import { describeReminders } from './reminder'
import { attentionText, dangerText, mutedText, numeric } from './styles'

export interface TaskFactsProps {
  task: LocalTask
  currentUserId: string
  /**
   * `mobil` ist die flache Zeile: größerer Titel, engere Abstände. Die
   * **Farben** sind in beiden Ansichten dieselben – Dichte darf abweichen, das
   * Aussehen nicht (`AGENTS.md`).
   */
  dichte?: 'breit' | 'mobil'
}

/**
 * Was eine Aufgabe über sich sagt: Titel, Fälligkeit, Wiederholung und
 * Erinnerungen.
 *
 * Diese Zeilen standen zweimal im Code – einmal in der breiten Zeile, einmal in
 * der mobilen –, und sie waren schon auseinandergelaufen: dieselbe gedämpfte
 * Zeile war einmal `text-ink-muted` und einmal `text-ink-faint`. Hier entsteht
 * der Inhalt einmal; den **Rahmen** setzt der Aufrufer (Karte bzw. flache
 * Zeile), und auf dem Telefon liegt er in einem Knopf, weil die ganze Zeile
 * antippbar ist.
 */
export function TaskFacts({ task, currentUserId, dichte = 'breit' }: TaskFactsProps) {
  const due = task.due_at === null ? null : formatDueLabel(task.due_at, task.completed)
  const wiederholung = describeRecurrence(task.recurrence)
  const erinnerungen = describeReminders(task, currentUserId)
  const abstand = dichte === 'mobil' ? 'mt-0.5' : 'mt-1'

  return (
    <>
      <span
        className={`block break-words ${
          dichte === 'mobil' ? 'text-title leading-snug' : 'text-body'
        } ${task.completed ? `text-ink-faint line-through` : 'text-ink'}`}
      >
        {task.title}
      </span>

      {due ? (
        <span className={`${abstand} block text-meta ${numeric} ${due.overdue ? dangerText : mutedText}`}>
          {due.text}
        </span>
      ) : null}

      {wiederholung ? (
        <span className={`${abstand} flex items-center gap-1 text-meta ${mutedText}`}>
          <RepeatIcon className="h-3 w-3 shrink-0" />
          {wiederholung}
        </span>
      ) : null}

      {erinnerungen.map((erinnerung, index) => (
        <span
          key={index}
          className={`${abstand} flex items-center gap-1 text-meta ${numeric} ${
            erinnerung.afterDue && !erinnerung.muted ? attentionText : mutedText
          }`}
        >
          {erinnerung.muted ? (
            <BellOffIcon className="h-3 w-3 shrink-0" />
          ) : (
            <BellIcon className="h-3 w-3 shrink-0" />
          )}
          {erinnerung.text}
        </span>
      ))}
    </>
  )
}
