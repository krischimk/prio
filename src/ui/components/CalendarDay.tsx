export function CalendarDayMarks({ count }: { count: number }) {
  return <span className="calendar-day-marks" aria-hidden="true">{count > 3 ? <span className="calendar-many"><span className="calendar-dot" /></span>
    : Array.from({ length: count }, (_, index) => <span key={index} className="calendar-dot" />)}</span>
}
