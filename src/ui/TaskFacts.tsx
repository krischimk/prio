import type { LocalTask } from '../domain/types'
import { formatDueLabel } from './datetime'
import { BellIcon, BellOffIcon, RepeatIcon } from './icons'
import { describeRecurrence } from './recurrence'
import { describeReminders } from './reminder'
import { attentionText, dangerText, mutedText, numeric } from './styles'

export interface TaskFactsProps {
  task: LocalTask
  currentUserId: string
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
export function TaskFacts({ task, currentUserId }: TaskFactsProps) {
  const due = task.due_at === null ? null : formatDueLabel(task.due_at, task.completed)
  const wiederholung = describeRecurrence(task.recurrence)
  const erinnerungen = describeReminders(task, currentUserId)

  return (
    <>
      <span
        className={`block break-words text-title leading-snug ${task.completed ? 'text-ink-faint line-through' : 'text-ink'}`}
      >
        {task.title}
      </span>

      {due || wiederholung || erinnerungen.length ? <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
      {due ? (
        <span className={`text-meta ${numeric} ${due.overdue ? dangerText : mutedText}`}>
          {due.text}
        </span>
      ) : null}

      {wiederholung ? (
        <span className={`flex items-center gap-1 text-meta ${mutedText}`}>
          <RepeatIcon className="h-3 w-3 shrink-0" />
          {wiederholung}
        </span>
      ) : null}

      {erinnerungen.map((erinnerung, index) => (
        <span
          key={index}
          className={`flex items-center gap-1 text-meta ${numeric} ${
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
      </span> : null}
    </>
  )
}
