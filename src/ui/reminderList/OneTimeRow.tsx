import { reminderTimeOf, type TaskReminder } from '../../domain/reminder'
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '../datetime'
import { input } from '../styles'
import { DateTimeInput, type DateTimePicker } from '../components/DateTimeInput'
import { useState } from 'react'
import { formatReminderOffset } from '../reminder'
import { CustomOffset } from './CustomOffset'
import { EIGENE, useOffsetChoice } from './useOffsetChoice'

/** Einmalige Aufgabe: ausdrücklich fester Zeitpunkt oder gebundene Vorlage. */
export function OneTimeRow({ idPrefix, reminder, dueAt, onChange, autoOpen = false }: {
  idPrefix: string; reminder: TaskReminder; dueAt: string | null; onChange: (next: TaskReminder) => void; autoOpen?: boolean
}) {
  const [picker, setPicker] = useState<DateTimePicker>(autoOpen ? 'calendar' : null)
  const at = reminderTimeOf(reminder, dueAt)
  const minutes = reminder.form === 'offset' ? reminder.minutes : 0
  const changeOffset = (minutes: number) => { setPicker(null); onChange({ form: 'offset', minutes }) }
  const { auswahl, wert, waehlen, eigeneOffen, gemerkt, merken } = useOffsetChoice({ minutes, onChange: changeOffset })
  return <div><div className="reminder-timing-fields">
    <DateTimeInput id={idPrefix} label="Erinnerung am" required activePicker={picker} onPickerChange={setPicker} value={toDateTimeLocalValue(at)} onChange={value => {
      const next = fromDateTimeLocalValue(value)
      if (next && next !== at) onChange({ form: 'absolute', at: next })
    }} />
    {dueAt ? <select aria-label="Erinnerung" className={input}
      value={reminder.form === 'offset' ? wert : 'absolute'}
      onChange={event => {
        setPicker(null)
        if (event.target.value === 'absolute') { if (at) onChange({ form: 'absolute', at }) }
        else {
          if (event.target.value === EIGENE && reminder.form === 'absolute') onChange({ form: 'offset', minutes: 0 })
          waehlen(event.target.value)
        }
      }}>
      {auswahl.map(step => <option key={step} value={step}>{formatReminderOffset(step)}</option>)}
      <option value={EIGENE}>Eigene …</option>
      <option value="absolute">Fester Zeitpunkt</option>
    </select> : null}
  </div>{dueAt && reminder.form === 'offset' && eigeneOffen ? <CustomOffset idPrefix={idPrefix} value={minutes} onChange={changeOffset} onRemember={merken} remembered={gemerkt} /> : null}</div>
}
