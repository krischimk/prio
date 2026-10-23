import { useMemo, useState } from 'react'
import { Temporal } from '@js-temporal/polyfill'
import { calendarEntries, dayInZone, parseCalendarPreferences, systemTimeZone, type DayCapacity, type RepeatFilter } from '../domain/calendar'
import type { LocalList, LocalTask } from '../domain/types'
import { useWorkspace } from '../app/useWorkspace'
import { useView } from './useView'
import { CalendarMonth } from './components/CalendarMonth'
import { Select } from './components/Select'
import { Button } from './components/Button'
import { PlusIcon, RepeatIcon } from './icons'
import { TaskRow } from './TaskRow'
import { errorBox, focusRing } from './styles'
import { formatCalendarDay } from './datetime'
import { PriorityRanksContext } from './priorityRanksContext'
import { priorityRanks } from '../domain/overviewOrdering'

export function OverviewCalendar({ tasks, lists, currentUserId }: { tasks: LocalTask[]; lists: LocalList[]; currentUserId: string }) {
  const { repositories, nowMs } = useWorkspace()
  const { overview, setTaskDetail } = useView()
  const preferences = parseCalendarPreferences(overview.userPreference?.calendar_preferences)
  const zone = preferences.timeZone ?? systemTimeZone()
  const today = dayInZone(nowMs, zone)
  const [selected, setSelected] = useState(today)
  const [month, setMonth] = useState(today.slice(0, 7))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const start = Temporal.PlainDate.from(`${month}-01`).subtract({ days: 7 }).toString()
  const end = Temporal.PlainDate.from(`${month}-01`).add({ months: 1, days: 7 }).toString()
  const entries = useMemo(() => calendarEntries(tasks, start, end, preferences.repeats, nowMs, zone), [tasks, start, end, preferences.repeats, nowMs, zone])
  const counts = new Map<string, number>()
  for (const entry of entries) counts.set(entry.day, (counts.get(entry.day) ?? 0) + (entry.occurrences ?? 1))
  const dayEntries = entries.filter(entry => entry.day === selected)
  const activeTasks = dayEntries.filter(entry => !entry.planned).map(entry => entry.task)
  const target = lists.find(list => list.id === overview.userPreference?.default_list_id) ?? lists[0]
  const ranks = priorityRanks(activeTasks, lists, nowMs, overview.userPreference?.detailed_ratings === true, preferences)
  const write = async (calendar: { repeats?: RepeatFilter; day?: { date: string; capacity: DayCapacity } }) => {
    if (busy) return
    setBusy(true); setError(null)
    try { await repositories.updateUserPreferences(currentUserId, { calendar: { ...calendar, timeZone: zone } }) }
    catch { setError('Die Kalendereinstellung konnte nicht gespeichert werden.') }
    finally { setBusy(false) }
  }
  return <section aria-label="Aufgabenkalender" className="space-y-3 py-2">
    <div className="flex flex-wrap items-start gap-4">
      <div className="mx-auto w-80 max-w-full shrink-0 space-y-2">
        <CalendarMonth month={month} selected={selected} today={today} counts={counts} preferences={preferences} onMonth={setMonth}
          onSelect={day => { setSelected(day); setMonth(day.slice(0, 7)) }} />
        <Select label="Wiederkehrende Aufgaben" value={preferences.repeats} icon={<RepeatIcon />} compact disabled={busy}
          options={[{ value: 'active', label: 'Nur aktive Wiederholungen' }, { value: 'all', label: 'Alle Wiederholungen' }, { value: 'none', label: 'Wiederholungen ausblenden' }]}
          onChange={value => void write({ repeats: value as RepeatFilter })} />
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-label text-ink-faint" aria-label="Kalenderlegende">
          <span className="inline-flex items-center gap-1"><span className="calendar-dot" />Fälligkeit</span>
          <span className="inline-flex items-center gap-1"><span className="calendar-capacity-sample" data-capacity="low" />Wenig Zeit</span>
          <span className="inline-flex items-center gap-1"><span className="calendar-capacity-sample" data-capacity="none" />Keine Zeit</span>
        </div>
      </div>
      <section aria-label="Aufgaben am ausgewählten Tag" className="min-w-60 flex-1">
        <h2 className="text-list-heading font-medium text-ink">{formatCalendarDay(selected)}</h2>
        <div className="my-2 flex flex-wrap items-center gap-2" role="group" aria-label="Deine Zeit an diesem Tag"><span className="mr-1 text-meta text-ink-muted">Deine Zeit</span>
          {(['normal', 'low', 'none'] as const).map((capacity, index) => <Button key={capacity} size="sm" variant={(preferences.days[selected] ?? 'normal') === capacity ? 'secondary' : 'ghost'}
            aria-pressed={(preferences.days[selected] ?? 'normal') === capacity} disabled={busy} onClick={() => void write({ day: { date: selected, capacity } })}>{['Normal', 'Wenig Zeit', 'Keine Zeit'][index]}</Button>)}
        </div>
        {error ? <p role="alert" className={errorBox}>{error}</p> : null}
        <PriorityRanksContext value={ranks}><ul>{dayEntries.map(entry => {
          const list = lists.find(list => list.id === entry.task.list_id)!
          return entry.planned ? <li key={`${entry.task.id}:${entry.task.due_at}`} className="border-b border-line-soft px-rand py-2 text-body text-ink-faint">
            <button type="button" className={`${focusRing} w-full rounded-control text-left`} onClick={() => setTaskDetail({ taskId: entry.task.id, listId: list.id, fromOverview: true })}>{entry.task.title}<span className="block text-meta">{entry.occurrences && entry.occurrences > 1 ? `${entry.occurrences} geplante Wiederholungen` : 'Geplante Wiederholung'}</span></button>
          </li> : <TaskRow key={entry.task.id} task={entry.task} currentUserId={currentUserId} ratingsEnabled={list.ratings_enabled} originList={list} overview
            onOpen={task => setTaskDetail({ taskId: task.id, listId: task.list_id, fromOverview: true })} />
        })}</ul></PriorityRanksContext>
        {dayEntries.length === 0 ? <p className="py-3 text-body text-ink-muted">Keine Fälligkeiten an diesem Tag.</p> : null}
        <Button size="sm" variant="ghost" onClick={() => setSelected(today)} layout="mt-2">Heute</Button>
        {target ? <Button size="sm" variant="ghost" layout="mt-2" onClick={() => setTaskDetail({ taskId: null, listId: target.id, fromOverview: true, initialDueAt: `${selected}T18:00` })}><PlusIcon />Aufgabe für diesen Tag</Button> : null}
      </section>
    </div>
  </section>
}
