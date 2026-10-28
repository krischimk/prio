import { useState } from 'react'
import type { LocalList } from '../domain/types'
import { useRepositories } from '../app/useWorkspace'

export function ListDuplicateField({ allowed, disabled, onChange }: { allowed: boolean; disabled?: boolean; onChange: (allowed: boolean) => void }) {
  return <label className="flex min-h-11 items-center gap-3 text-body text-ink">
    <input type="checkbox" className="size-5 shrink-0 accent-brand" checked={allowed} disabled={disabled} onChange={event => onChange(event.target.checked)} />
    <span>Gleiche Aufgabennamen erlauben</span>
  </label>
}

export function ListDuplicateChoice({ list, currentUserId }: { list: LocalList; currentUserId: string }) {
  const repositories = useRepositories()
  const [pending, setPending] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (pending === list.allow_duplicate_titles) setPending(null)
  const change = async (allowed: boolean) => {
    setPending(allowed); setBusy(true); setError(null)
    try { await repositories.setListAllowDuplicateTitles(list.id, currentUserId, allowed) }
    catch (cause) { setPending(null); setError(cause instanceof Error ? cause.message : 'Die Einstellung konnte nicht gespeichert werden.') }
    finally { setBusy(false) }
  }
  return <div>
    <ListDuplicateField allowed={pending ?? list.allow_duplicate_titles} disabled={busy || list.owner_id !== currentUserId} onChange={allowed => void change(allowed)} />
    {error ? <p role="alert" className="text-body text-danger">{error}</p> : null}
  </div>
}
