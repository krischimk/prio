import { reminderTimeOf, type TaskReminder } from '../../domain/reminder'
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '../datetime'
import { input } from '../styles'
import { DateTimeInput, type DateTimePicker } from '../components/DateTimeInput'
import { useState } from 'react'
import { FIXED_REMINDER_STEPS, formatReminderOffset } from '../reminder'

/** Einmalige Aufgabe: ausdrücklich fester Zeitpunkt oder gebundene Vorlage. */
export function OneTimeRow({ idPrefix, reminder, dueAt, onChange, autoOpen = false }: {
  idPrefix: string; reminder: TaskReminder; dueAt: string | null; onChange: (next: TaskReminder) => void; autoOpen?: boolean
}) {
  const [picker, setPicker] = useState<DateTimePicker>(autoOpen ? 'calendar' : null)
  const at = reminderTimeOf(reminder, dueAt)
  const choices = reminder.form === 'offset' && !FIXED_REMINDER_STEPS.includes(reminder.minutes)
    ? [...FIXED_REMINDER_STEPS, reminder.minutes] : FIXED_REMINDER_STEPS
  return <div className="reminder-timing-fields">
    <DateTimeInput id={idPrefix} label="Erinnerung am" required activePicker={picker} onPickerChange={setPicker} value={toDateTimeLocalValue(at)} onChange={value => {
      const next = fromDateTimeLocalValue(value)
      if (next && next !== at) onChange({ form: 'absolute', at: next })
    }} />
    {dueAt ? <select aria-label="Erinnerung" className={input}
      value={reminder.form === 'offset' ? String(reminder.minutes) : 'custom'}
      onChange={event => {
        setPicker(null)
        if (event.target.value === 'custom') { if (at) onChange({ form: 'absolute', at }) }
        else onChange({ form: 'offset', minutes: Number(event.target.value) })
      }}>
      {choices.map(step => <option key={step} value={step}>{formatReminderOffset(step)}</option>)}
      <option value="custom">Fester Zeitpunkt</option>
    </select> : null}
  </div>
}
