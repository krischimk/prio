import { Temporal } from '@js-temporal/polyfill'
import { formatCalendarDay } from '../datetime'
import { ChevronIcon } from '../icons'
import { focusRing, numeric } from '../styles'
import { IconButton } from './IconButton'
import { Select } from './Select'
import { CalendarDayMarks } from './CalendarDay'
import { calendarCapacityText } from '../calendarLabels'
import type { CalendarPreferences } from '../../domain/calendar'

export function CalendarMonth({ month, selected, today, counts, preferences, onMonth, onSelect }: {
  month: string; selected: string; today: string; counts: ReadonlyMap<string, number>; preferences: CalendarPreferences
  onMonth: (month: string) => void; onSelect: (day: string) => void
}) {
  const first = Temporal.PlainDate.from(`${month}-01`)
  const start = first.subtract({ days: first.dayOfWeek - 1 })
  const total = Math.ceil((first.dayOfWeek - 1 + first.daysInMonth) / 7) * 7
  const years = Array.from({ length: 101 }, (_, index) => first.year - 50 + index)
  return <div className="calendar-month w-80 max-w-full rounded-card border border-line bg-raised p-2">
    <div className="mb-1 grid grid-cols-[2rem_minmax(0,1fr)_4.5rem_2rem] items-center gap-1">
      <IconButton size="iconSm" variant="iconMuted" aria-label="Voriger Monat" onClick={() => onMonth(first.subtract({ months: 1 }).toString().slice(0, 7))}><ChevronIcon offen={false} className="size-icon rotate-180" /></IconButton>
      <Select label="Kalendermonat" compact value={String(first.month)} options={Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: new Intl.DateTimeFormat('de-DE', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, index, 1))) }))}
        onChange={value => onMonth(first.with({ month: Number(value) }).toString().slice(0, 7))} />
      <Select label="Kalenderjahr" compact value={String(first.year)} options={years.map(year => ({ value: String(year), label: String(year) }))}
        onChange={value => onMonth(first.with({ year: Number(value) }).toString().slice(0, 7))} />
      <IconButton size="iconSm" variant="iconMuted" aria-label="Nächster Monat" onClick={() => onMonth(first.add({ months: 1 }).toString().slice(0, 7))}><ChevronIcon offen={false} /></IconButton>
    </div>
    <div className="grid grid-cols-7 gap-0.5 text-center text-meta text-ink-muted">{['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => <span key={day} className="py-1">{day}</span>)}</div>
    <div className="grid grid-cols-7 gap-0.5" aria-label="Kalendertage">{Array.from({ length: total }, (_, index) => {
      const date = start.add({ days: index }), day = date.toString(), count = counts.get(day) ?? 0
      const capacity = preferences.days[day]
      return <button key={day} type="button" className={`${focusRing} calendar-day calendar-overview-day ${numeric} rounded-control text-body text-ink hover:bg-surface`}
        aria-label={formatCalendarDay(day)} aria-description={`${count} Fälligkeiten. ${calendarCapacityText(capacity)}`} aria-pressed={selected === day}
        data-selected={selected === day || undefined} data-today={today === day || undefined} data-outside-range={date.month !== first.month || undefined}
        data-capacity={capacity} onClick={() => onSelect(day)}><span>{date.day}</span><CalendarDayMarks count={count} /></button>
    })}</div>
  </div>
}
