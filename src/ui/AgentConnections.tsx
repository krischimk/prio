import { useContext, useEffect, useState } from 'react'
import { OAuthContext } from '../auth/oauthContext'
import type { AgentConnection } from '../auth/oauthPort'
import { Button } from './components/Button'
import { errorBox } from './styles'
import { CloseIcon, LinkIcon } from './icons'

export function AgentConnections() {
  const port = useContext(OAuthContext)
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<AgentConnection[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open || !port) return
    let active = true
    void port.connections().then(data => { if (active) setRows(data) }).catch(() => { if (active) setError('Die Verbindungen sind gerade nicht erreichbar. Deine Freigaben konnten nicht geladen werden.') })
    return () => { active = false }
  }, [open, port])
  if (!port) return null
  async function change(row: AgentConnection, next: { can_write: boolean; can_share: boolean } | null) {
    if (!port || busy) return
    setBusy(true); setError(null)
    if (next) setRows(current => current?.map(item => item.client_id === row.client_id ? { ...item, ...next } : item) ?? null)
    try {
      if (next) await port.permissions(row.client_id, next)
      else await port.revoke(row.client_id)
      setRows(await port.connections())
    } catch {
      if (next) setRows(current => current?.map(item => item.client_id === row.client_id ? row : item) ?? null)
      setError('Die Änderung konnte nicht bestätigt werden. Lade die Verbindungen erneut, bevor du vom neuen Stand ausgehst.')
    }
    finally { setBusy(false) }
  }
  return <section className="border-t border-line pt-3">
    <Button variant="ghost" aria-expanded={open} onClick={() => setOpen(value => !value)}><LinkIcon />KI-Verbindungen</Button>
    {open ? <div className="space-y-3 pt-3">
      <p className="text-meta text-ink-muted">MCP-Adresse für dein KI-Programm:</p><p className="break-all text-meta text-ink">https://prio-krischi.pages.dev/mcp</p>
      {rows === null && !error ? <p role="status" className="text-meta text-ink-muted">Verbindungen werden geladen …</p> : null}
      {rows?.filter(row => row.revoked_at === null).map(row => <div key={row.client_id} className="space-y-2 rounded-control border border-line p-3">
        <p className="text-body font-semibold text-ink">{row.name}</p>
        <label className="flex min-h-11 items-center gap-3 text-body text-ink"><input type="checkbox" className="size-5 accent-brand" disabled={busy} checked={row.can_write} onChange={event => void change(row, { can_write: event.target.checked, can_share: event.target.checked && row.can_share })} />Bearbeiten erlauben</label>
        <label className="flex min-h-11 items-center gap-3 text-body text-ink"><input type="checkbox" className="size-5 accent-brand" disabled={busy || !row.can_write} checked={row.can_share} onChange={event => void change(row, { can_write: row.can_write, can_share: event.target.checked })} />Teilen erlauben</label>
        <Button variant="ghost" disabled={busy} onClick={() => void change(row, null)}><CloseIcon />Zugriff widerrufen</Button>
      </div>)}
      {rows && !rows.some(row => row.revoked_at === null) ? <p className="text-meta text-ink-muted">Noch keine aktiven Verbindungen.</p> : null}
      {error ? <p role="alert" className={errorBox}>{error}</p> : null}
    </div> : null}
  </section>
}
