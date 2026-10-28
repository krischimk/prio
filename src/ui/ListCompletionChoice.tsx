import { useState } from 'react'
import { useRepositories } from '../app/useWorkspace'
import type { LocalList } from '../domain/types'

export function ListCompletionChoice({ list, currentUserId }: { list: LocalList; currentUserId: string }) {
  const repositories = useRepositories()
  const [pending, setPending] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (pending !== null && pending === list.keep_completed) setPending(null)
  const keep = pending ?? list.keep_completed
  const owner = list.owner_id === currentUserId
  async function change(next: boolean) {
    setPending(next); setBusy(true); setError(null)
    try { await repositories.setListKeepCompleted(list.id, currentUserId, next) }
    catch (cause) { setPending(null); setError(cause instanceof Error ? cause.message : 'Die Einstellung ließ sich nicht speichern.') }
    finally { setBusy(false) }
  }
  return <div className="space-y-1">
    <ListCompletionField keep={keep} disabled={busy || !owner} owner={owner} onChange={next => { void change(next) }} />
    {error ? <p role="alert" className="text-body text-danger">{error}</p> : null}
  </div>
}

export function ListCompletionField({ keep, disabled, owner = true, onChange }: {
  keep: boolean; disabled?: boolean; owner?: boolean; onChange: (value: boolean) => void
}) {
  return <div className="space-y-1">
    <label className="flex min-h-11 items-center gap-3 text-body text-ink">
      <input type="checkbox" className="h-5 w-5 shrink-0 accent-brand" checked={keep} disabled={disabled} onChange={event => onChange(event.target.checked)} />
      <span>Erledigt am Listenende</span>
    </label>
    {!owner ? <p className="text-meta text-ink-muted">Diese gemeinsame Listenregel stellt der Besitzer ein.</p> : null}
  </div>
}
