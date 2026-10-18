import { useEffect, useState } from 'react'
import type { OAuthPort, OAuthRequest } from '../auth/oauthPort'
import { Button } from './components/Button'
import { appBackground, errorBox } from './styles'
import { LinkIcon } from './icons'

export function OAuthConsentScreen({ port }: { port: OAuthPort }) {
  const id = new URLSearchParams(window.location.search).get('authorization_id') ?? ''
  const [request, setRequest] = useState<OAuthRequest | null>(null)
  const [error, setError] = useState<string | null>(id ? null : 'Die Verbindungsanfrage fehlt. Starte die Verbindung aus deinem KI-Programm erneut.')
  const [write, setWrite] = useState(true); const [share, setShare] = useState(false); const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    if (!id) return
    void port.details(id).then(data => {
      if (!active) return
      if ('redirect_url' in data) window.location.assign(data.redirect_url)
      else setRequest(data)
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Die Anfrage konnte nicht geladen werden.') })
    return () => { active = false }
  }, [id, port])
  async function finish(approve: boolean) {
    setBusy(true); setError(null)
    try {
      const redirect = approve ? await port.approve(id, { can_write: write, can_share: write && share, time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone }) : await port.deny(id)
      // Der Server liefert den registrierten OAuth-Callback; keine URL aus
      // Anfragetexten oder selbst eingegebenen Parametern verwenden.
      window.location.assign(redirect)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Die Verbindung konnte nicht abgeschlossen werden.'); setBusy(false) }
  }
  return <main className={`flex min-h-dvh items-center justify-center p-5 ${appBackground}`}>
    <section aria-label="KI-Verbindung freigeben" className="w-full max-w-lg space-y-5 rounded-card border border-line p-5">
      <h1 className="flex items-center gap-2 text-heading font-semibold text-ink-strong"><LinkIcon />Prio verbinden</h1>
      {request ? <>
        <p className="text-body text-ink"><strong>{request.client.name}</strong> möchte auf dein Prio-Konto zugreifen.</p>
        <p className="text-meta text-ink-muted">Der Name stammt vom anfragenden Programm. Erlaube den Zugriff nur, wenn du diese Verbindung selbst gestartet hast.</p>
        <div className="space-y-2 text-body text-ink">
          <p>Lesen: alle Listen, auf die dein Konto Zugriff hat, einschließlich Notizen, Checklisten und erledigten Aufgaben.</p>
          <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="size-5 shrink-0 accent-brand" checked={write} disabled={busy} onChange={event => setWrite(event.target.checked)} />Aufgaben und Listen bearbeiten, löschen und wiederherstellen</label>
          <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="size-5 shrink-0 accent-brand" checked={write && share} disabled={busy || !write} onChange={event => setShare(event.target.checked)} />Zusätzlich Listen teilen und Mitglieder entfernen</label>
        </div>
        <p className="text-meta text-ink-muted">Der Zugriff funktioniert auch bei geschlossener App. Unter Konto → KI-Verbindungen kannst du ihn jederzeit widerrufen. Noch nicht synchronisierte Änderungen sind für das Programm nicht sichtbar.</p>
        <details className="text-meta text-ink-muted"><summary>Verbindungsadresse</summary><p className="break-all py-2">{request.redirect_uri}</p></details>
        <div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={() => void finish(true)}><LinkIcon />Verbindung erlauben</Button><Button variant="secondary" disabled={busy} onClick={() => void finish(false)}>Ablehnen</Button></div>
      </> : !error ? <p role="status" className="text-body text-ink-muted">Verbindungsanfrage wird geprüft …</p> : null}
      {error ? <p role="alert" className={errorBox}>{error}</p> : null}
    </section>
  </main>
}
