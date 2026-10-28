import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useRepositories } from '../app/useWorkspace'
import { input } from './styles'

/** Kleiner Eingabeentwurf; der bestätigte Inhalt bleibt in den Konto-Einstellungen. */
export function CalendarDayNote({ userId, day, saved }: { userId: string; day: string; saved: string }) {
  const repositories = useRepositories()
  const id = useId()
  const [text, setText] = useState(saved)
  const [error, setError] = useState(false)
  const current = useRef(saved)
  const confirmed = useRef(saved)
  const alive = useRef(true)
  const editing = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const save = useCallback(async (value: string) => {
    if (timer.current) clearTimeout(timer.current)
    if (value.trim() === confirmed.current) return
    try {
      await repositories.updateUserPreferences(userId, { calendar: { note: { date: day, text: value } } })
      confirmed.current = value.trim()
      if (alive.current) setError(false)
    } catch { if (alive.current) setError(true) }
  }, [repositories, userId, day])
  useEffect(() => {
    if (!editing.current && current.current.trim() === confirmed.current) { current.current = saved; setText(saved) }
    confirmed.current = saved
  }, [saved])
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; if (timer.current) clearTimeout(timer.current); void save(current.current) }
  }, [save])
  return <div className="my-3 space-y-1">
    <label htmlFor={id} className="text-meta text-ink-muted">Tagesnotiz</label>
    <textarea id={id} rows={2} maxLength={2000} className={`${input} resize-y`} placeholder="Notiz zu diesem Tag…" value={text}
      onFocus={() => { editing.current = true }} onBlur={() => { editing.current = false; void save(current.current) }} onChange={event => {
        current.current = event.target.value; setText(event.target.value)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => void save(current.current), 600)
      }} />
    {error ? <p role="alert" className="text-meta text-danger">Die Tagesnotiz konnte nicht gespeichert werden. Deine Eingabe bleibt erhalten.</p> : null}
  </div>
}
