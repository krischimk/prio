import { useState } from 'react'
import { CalendarIcon } from './icons'
import { formatScheduleLabel } from './datetime'
import { describeRecurrence } from './recurrence'
import { focusRing } from './styles'
import { Hint } from './components/Hint'
import { DateTimeInput } from './components/DateTimeInput'
import { IconButton } from './components/IconButton'
import { CloseIcon } from './icons'
import { RecurrenceSelect } from './RecurrenceSelect'
import type { TaskForm } from './useTaskForm'

/** Im Ruhezustand eine Terminzeile; die Eingabefelder öffnen sich bei Bedarf. */
export function TaskScheduleFields({ form, idPrefix, recurrence }: { form: TaskForm; idPrefix: string; recurrence: boolean }) {
  const [open, setOpen] = useState(false)
  const change = (value: string) => {
    form.setzen('dueAt', value)
    if (!value) form.setzen('recurrence', '')
  }
  return <div className="min-w-0">
    <Hint text="Fälligkeit und Wiederholung bearbeiten. Erinnerungen werden separat eingestellt.">
      <button type="button" className={`${focusRing} flex min-h-11 w-full items-center gap-3 rounded-control px-2 py-2 text-left hover:bg-raised`}
        aria-label="Fälligkeit und Wiederholung bearbeiten" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <CalendarIcon className="h-5 w-5 shrink-0 text-ink-muted" />
        <span className="min-w-0 flex-1">
          {form.dueIso ? <>
            <span className="block text-body text-ink">{formatScheduleLabel(form.dueIso)}</span>
            {recurrence ? <span className="block text-meta text-ink-muted">{describeRecurrence(form.werte.recurrence) || 'Einmalig'}</span> : null}
          </> : <span className="text-body text-ink-faint">Fälligkeit hinzufügen</span>}
        </span>
      </button>
    </Hint>
    {open ? <div className="ml-2 mt-2 space-y-3 border-l border-line pl-3">
      <div className="flex min-w-0 items-start gap-1">
        <div className="min-w-0 flex-1"><DateTimeInput id={`${idPrefix}-due`} label="Fällig am" value={form.werte.dueAt} onChange={change} disabled={form.busy} /></div>
        {form.werte.dueAt ? <IconButton aria-label="Fälligkeit entfernen" onClick={() => change('')}><CloseIcon /></IconButton> : null}
      </div>
      {recurrence && form.werte.dueAt ? <RecurrenceSelect id={`${idPrefix}-recurrence`} value={form.werte.recurrence} disabled={form.busy} onChange={value => form.setzen('recurrence', value)} /> : null}
    </div> : null}
  </div>
}
