import type { LocalTask } from '../domain/types'
import type { ReactNode } from 'react'
import { formatDueLabel } from './datetime'
import { BellIcon, BellOffIcon, RepeatIcon, CalendarIcon } from './icons'
import { Hint } from './components/Hint'
import { describeRecurrence } from './recurrence'
import { describeReminders } from './reminder'
import { attentionText, dangerText, mutedText, numeric } from './styles'
import { isUpcomingRepeat } from '../domain/recurrence'
import { useNowMs } from '../app/useWorkspace'

export interface TaskFactsProps {
  task: LocalTask
  currentUserId: string
  afterTitle?: ReactNode
  titleTrailing?: ReactNode
}

/**
 * Was eine Aufgabe über sich sagt: Titel, Fälligkeit, Wiederholung und
 * Erinnerungen.
 *
 * Diese Zeilen standen zweimal im Code – einmal in der breiten Zeile, einmal in
 * der mobilen –, und sie waren schon auseinandergelaufen: dieselbe gedämpfte
 * Zeile war einmal `text-ink-muted` und einmal `text-ink-faint`. Hier entsteht
 * der Inhalt einmal; TaskRow setzt die gemeinsame klickbare Aufgabenfläche.
 */
export function TaskFacts({ task, currentUserId, afterTitle, titleTrailing }: TaskFactsProps) {
  const nowMs = useNowMs()
  const due = task.due_at === null ? null : formatDueLabel(task.due_at, task.completed, nowMs)
  const wiederholung = describeRecurrence(task.recurrence)
  const upcoming = isUpcomingRepeat(task)
  const erinnerungen = describeReminders(task, currentUserId)
  const allMuted = erinnerungen.length > 0 && erinnerungen.every(reminder => reminder.muted)
  const reminderHint = `Erinnerungen: ${erinnerungen.map(reminder => reminder.text).join(' · ')}`

  return (
    <>
      <span className="flex items-start gap-2"><span
        className={`min-w-0 flex-1 break-words text-title ${task.completed ? 'text-ink-faint line-through' : upcoming ? 'text-ink-faint' : 'text-ink'}`}
      >
        {task.title}
      </span>{titleTrailing}</span>
      {afterTitle}

      {due || wiederholung || erinnerungen.length ? <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
      {due ? (
        <Hint text={due.absoluteText}><span aria-label={`${due.text}. ${due.absoluteText}`} className={`inline-flex items-center gap-1 text-meta ${numeric} ${due.overdue ? dangerText : mutedText}`}>
          <CalendarIcon className="size-icon-meta shrink-0" />{due.text}
        </span></Hint>
      ) : null}

      {wiederholung ? (
        <span className={`flex items-center gap-1 text-meta ${mutedText}`}>
          <RepeatIcon className="size-icon-meta shrink-0" />
          {upcoming ? `Nächste Wiederholung · ${wiederholung}` : wiederholung}
        </span>
      ) : null}

      {erinnerungen.length ? <Hint text={reminderHint}>
        <span role="img" aria-label={reminderHint}
          className={`inline-flex items-center text-meta ${erinnerungen.some(reminder => reminder.afterDue && !reminder.muted) ? attentionText : mutedText}`}>
          {allMuted ? (
            <BellOffIcon className="size-icon-meta shrink-0" />
          ) : (
            <BellIcon className="size-icon-meta shrink-0" />
          )}
        </span>
      </Hint> : null}
      </span> : null}
    </>
  )
}
