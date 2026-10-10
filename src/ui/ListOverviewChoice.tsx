import { useRef, useState } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import { useView } from './useView'
import { Button } from './components/Button'
import { errorMessage } from './styles'

/** Persönliche Auswahl: gleicher Weg für Besitzer und Mitglieder. */
export function ListOverviewChoice({ listId, currentUserId, label = 'In Gesamtansicht aufnehmen' }: { listId: string; currentUserId: string; label?: string }) {
  const { overview } = useView()
  const { repositories } = useWorkspace()
  const included = overview.preferences.some(row => row.list_id === listId && row.include_in_overview)
  const [busy, setBusy] = useState(false)
  const writing = useRef(false)
  const [error, setError] = useState<string | null>(null)
  // Die laufende Aktion zeigt ihre Absicht sofort. Nach dem Neulesen übernimmt
  // wieder der gespeicherte Stand; ein Fehler nimmt die Absicht zurück.
  const [pending, setPending] = useState<boolean | null>(null)
  if (pending !== null && pending === included) setPending(null)
  const change = async (value: boolean) => {
    if (writing.current) return
    writing.current = true; setBusy(true); setError(null); setPending(value)
    try { await repositories.setListInOverview(listId, currentUserId, value) }
    catch (cause) { setPending(null); setError(cause instanceof Error ? cause.message : 'Die Auswahl konnte nicht gespeichert werden.') }
    finally { writing.current = false; setBusy(false) }
  }
  return <div className="space-y-1">
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-body text-ink-soft">
      <input type="checkbox" checked={pending ?? included} disabled={busy || pending !== null || overview.status !== 'ready'} className="h-5 w-5 shrink-0 accent-brand"
        onChange={event => { void change(event.target.checked) }} />
      <span className="min-w-0 break-words">{label}</span>
    </label>
    {overview.status === 'error' ? <div>
      <p role="alert" className={errorMessage}>Die persönliche Auswahl konnte nicht geladen werden.</p>
      <Button variant="secondary" onClick={overview.retry}>Erneut versuchen</Button>
    </div> : null}
    {error ? <p role="alert" className={errorMessage}>{error}</p> : null}
  </div>
}
