import { useState } from 'react'
import type { LocalList } from '../domain/types'
import { useRepositories } from '../app/useWorkspace'

export function ListRatingField({ enabled, disabled, onChange }: { enabled: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex min-h-11 items-center gap-3 text-body text-ink">
    <input type="checkbox" className="size-5 shrink-0 accent-brand" checked={enabled} disabled={disabled} onChange={event => onChange(event.target.checked)} />
    <span>Bewertungen verwenden</span>
  </label>
}

export function ListRatingChoice({ list, currentUserId }: { list: LocalList; currentUserId: string }) {
  const repositories = useRepositories()
  const [pending, setPending] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (pending === list.ratings_enabled) setPending(null)
  async function change(next: boolean) {
    setPending(next); setBusy(true); setError(null)
    try { await repositories.setListRatingsEnabled(list.id, currentUserId, next) }
    catch (cause) { setPending(null); setError(cause instanceof Error ? cause.message : 'Die Einstellung ließ sich nicht speichern.') }
    finally { setBusy(false) }
  }
  return <div>
    <ListRatingField enabled={pending ?? list.ratings_enabled} disabled={busy || list.owner_id !== currentUserId} onChange={next => { void change(next) }} />
    {error ? <p role="alert" className="text-body text-danger">{error}</p> : null}
  </div>
}
