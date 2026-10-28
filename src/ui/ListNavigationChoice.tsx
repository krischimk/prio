import { useRef, useState } from 'react'
import { useRepositories } from '../app/useWorkspace'
import { useView } from './useView'
import { ChevronIcon, EyeIcon, EyeOffIcon } from './icons'
import { IconButton } from './components/IconButton'
import { errorMessage } from './styles'

/** Dieselben persönlichen Änderungen sind auch ohne Ziehen bedienbar. */
export function ListNavigationChoice({ listId, currentUserId }: { listId: string; currentUserId: string }) {
  const { lists, overview } = useView()
  const repositories = useRepositories()
  const hidden = overview.preferences.some(row => row.list_id === listId && row.hidden)
  const hiddenIds = new Set(overview.preferences.filter(row => row.hidden).map(row => row.list_id))
  const peers = lists.filter(row => hiddenIds.has(row.id) === hidden)
  const index = peers.findIndex(row => row.id === listId)
  const writing = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const place = async (nextHidden: boolean, beforeListId: string | null) => {
    if (writing.current) return
    writing.current = true; setBusy(true); setError(null)
    try { await repositories.placeList(listId, currentUserId, { hidden: nextHidden, beforeListId }) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Die Listenposition konnte nicht gespeichert werden.') }
    finally { writing.current = false; setBusy(false) }
  }
  const disabled = busy || overview.status !== 'ready' || index < 0
  return <div>
    <div className="flex min-h-11 items-center gap-1" role="group" aria-label="Persönliche Listenposition">
      <span className="min-w-0 flex-1 text-body text-ink-soft">Listenposition</span>
      <IconButton aria-label="Liste nach oben" disabled={disabled || index === 0} onClick={() => void place(hidden, peers[index - 1].id)}>
        <ChevronIcon offen={false} className="size-icon -rotate-90" />
      </IconButton>
      <IconButton aria-label="Liste nach unten" disabled={disabled || index === peers.length - 1} onClick={() => void place(hidden, peers[index + 2]?.id ?? null)}>
        <ChevronIcon offen={false} className="size-icon rotate-90" />
      </IconButton>
      <IconButton aria-label={hidden ? 'Liste anzeigen' : 'Liste verstecken'} disabled={disabled} onClick={() => void place(!hidden, null)}>
        {hidden ? <EyeIcon /> : <EyeOffIcon />}
      </IconButton>
    </div>
    {error ? <p role="alert" className={errorMessage}>{error}</p> : null}
  </div>
}
