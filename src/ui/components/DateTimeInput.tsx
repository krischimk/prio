import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { DatePicker, parseDate } from '@ark-ui/react/date-picker'
import { useBackLayer } from '../../app/useBackLayer'
import { formatCalendarDay, formatGermanDate, localTimeZone, parseGermanDate } from '../datetime'
import { CalendarIcon, ChevronIcon } from '../icons'
import { focusRing, input, layer, numeric } from '../styles'
import { Button } from './Button'
import { IconButton } from './IconButton'
import { TimeInput } from './TimeInput'
import { Select } from './Select'

/** Kalender und 24-Stunden-Uhr; außen bleibt der vorhandene lokale ISO-Wert. */
export type DateTimePicker = 'calendar' | 'time' | null

export function DateTimeInput({ id, label, value, onChange, disabled = false, required = false, autoOpen = false, activePicker, onPickerChange }: {
  id: string; label: string; value: string; onChange: (value: string) => void; disabled?: boolean; required?: boolean; autoOpen?: boolean
  activePicker?: DateTimePicker; onPickerChange?: Dispatch<SetStateAction<DateTimePicker>>
}) {
  const [localPicker, setLocalPicker] = useState<DateTimePicker>(autoOpen ? 'calendar' : null)
  const picker = activePicker === undefined ? localPicker : activePicker
  const setPicker = onPickerChange ?? setLocalPicker
  const open = picker === 'calendar', timeOpen = picker === 'time'
  const setOpen = (next: boolean) => setPicker(current => next ? 'calendar' : current === 'calendar' ? null : current)
  const setTimeOpen = (next: boolean) => setPicker(current => next ? 'time' : current === 'time' ? null : current)
  const dateInput = useRef<HTMLInputElement>(null)
  const day = value.slice(0, 10)
  const time = value.slice(11, 16) || '00:00'
  useBackLayer(open, () => setOpen(false), `${id}:kalender`)
  const selectDay = (date: string) => {
    dateInput.current?.setCustomValidity(!date && required ? 'Bitte ein Datum eingeben.' : '')
    onChange(date ? `${date}T${time}` : '')
  }
  return <div className="flex min-w-0 flex-wrap items-start gap-2">
    <DatePicker.Root locale="de-DE" timeZone={localTimeZone()} startOfWeek={1} fixedWeeks outsideDaySelectable disabled={disabled} required={required}
      ids={{ input: () => id }} value={day ? [parseDate(day)] : []}
      format={date => formatGermanDate(date.toString())}
      parse={text => { const date = parseGermanDate(text); return date ? parseDate(date) : undefined }}
      onValueChange={details => {
        const date = details.value[0]?.toString() ?? ''
        selectDay(date)
        if (date && open) { setOpen(false); setTimeOpen(true) }
      }}
      open={open} onOpenChange={details => setOpen(details.open)}
      positioning={{ strategy: 'fixed', placement: 'bottom-start', gutter: 8 }} lazyMount unmountOnExit
      translations={{ content: 'Kalender', trigger: () => `${label}: Kalender öffnen`, nextTrigger: () => 'Nächster Monat', prevTrigger: () => 'Voriger Monat', monthSelect: 'Monat', yearSelect: 'Jahr', clearTrigger: 'Datum entfernen', dayCell: state => formatCalendarDay(state.value.toString()) }}
      className="min-w-40 flex-1">
      <DatePicker.Control className="flex min-w-0 items-center gap-1">
        <DatePicker.Input ref={dateInput} aria-label={label} placeholder="TT.MM.JJJJ" className={`${input} ${numeric}`}
          onClick={() => setOpen(true)}
          fixOnBlur={false}
          onChange={event => event.target.setCustomValidity((!event.target.value && !required) || parseGermanDate(event.target.value) ? '' : 'Bitte ein gültiges Datum eingeben, zum Beispiel 31.12.2026.')}
          onBlur={event => {
            const date = parseGermanDate(event.target.value)
            if (date || !event.target.value) selectDay(date ?? '')
          }} />
        <DatePicker.Trigger asChild><IconButton aria-label={`${label}: Kalender öffnen`} variant="iconMuted" layout="shrink-0"><CalendarIcon /></IconButton></DatePicker.Trigger>
      </DatePicker.Control>
      <DatePicker.Positioner className={layer.top}>
        <DatePicker.Content className="w-80 max-h-[var(--available-height)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-card border border-line-strong bg-raised p-3 shadow-xl shadow-page/50">
          <DatePicker.View view="day">
            <DatePicker.Context>{calendar => <>
              <DatePicker.ViewControl className="mb-3 grid grid-cols-[2.75rem_minmax(0,1fr)_5rem_2.75rem] items-center gap-1">
                <DatePicker.PrevTrigger asChild><IconButton aria-label="Voriger Monat" variant="iconMuted"><ChevronIcon offen={false} className="size-icon rotate-180" /></IconButton></DatePicker.PrevTrigger>
                <Select label="Monat" value={String(calendar.visibleRange.start.month)} compact
                  options={calendar.getMonths().map(month => ({ value: String(month.value), label: month.label }))}
                  onChange={value => calendar.focusMonth(Number(value))} />
                <Select label="Jahr" value={String(calendar.visibleRange.start.year)} compact
                  options={calendar.getYears().map(year => ({ value: String(year.value), label: year.label }))}
                  onChange={value => calendar.focusYear(Number(value))} />
                <DatePicker.NextTrigger asChild><IconButton aria-label="Nächster Monat" variant="iconMuted"><ChevronIcon offen={false} /></IconButton></DatePicker.NextTrigger>
              </DatePicker.ViewControl>
              <DatePicker.Table className="w-full table-fixed border-separate">
                <DatePicker.TableHead><DatePicker.TableRow>
                  {calendar.weekDays.map((weekday, index) => <DatePicker.TableHeader key={index} className="pb-2 text-center text-meta text-ink-muted">{weekday.short}</DatePicker.TableHeader>)}
                </DatePicker.TableRow></DatePicker.TableHead>
                <DatePicker.TableBody>{calendar.weeks.map((week, index) => <DatePicker.TableRow key={index}>
                  {week.map(date => <DatePicker.TableCell key={date.toString()} value={date}>
                    <DatePicker.TableCellTrigger onClick={() => {
                      if (calendar.getDayTableCellState({ value: date }).selectable) { setOpen(false); setTimeOpen(true) }
                    }} className={`${focusRing} calendar-day flex min-h-11 w-full items-center justify-center rounded-control text-body text-ink hover:bg-surface data-[outside-range]:text-ink-faint data-[selected]:bg-brand data-[selected]:text-on-brand`}>{date.day}</DatePicker.TableCellTrigger>
                  </DatePicker.TableCell>)}
                </DatePicker.TableRow>)}</DatePicker.TableBody>
              </DatePicker.Table>
              <Button variant="ghost" size="sm" layout="mt-2 w-full" onClick={() => { calendar.selectToday(); setOpen(false); setTimeOpen(true) }}>Heute</Button>
            </>}</DatePicker.Context>
          </DatePicker.View>
        </DatePicker.Content>
      </DatePicker.Positioner>
    </DatePicker.Root>
    <TimeInput id={`${id}-time`} label={`${label}: Uhrzeit`} value={day ? time : ''} scopeValue={value}
      open={timeOpen} onOpenChange={setTimeOpen}
      onFocus={() => setOpen(false)}
      disabled={disabled || !day} onChange={next => onChange(`${day}T${next}`)} />
  </div>
}
