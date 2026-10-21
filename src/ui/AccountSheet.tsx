import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { Sheet } from './components/Sheet'
import { Button } from './components/Button'
import { BackendLabel } from './BackendLabel'
import { UsernameField } from './UsernameField'
import { errorBox, focusRing } from './styles'
import { LogoutIcon, SaveIcon } from './icons'
import { ThemeSelect } from './ThemeSelect'
import { useView } from './useView'
import { useWorkspace } from '../app/useWorkspace'
import { AgentConnections } from './AgentConnections'

export function AccountSheet({ onClose }: { onClose: () => void }) {
  const { state, setUsername, signOut, error } = useAuth()
  const user = state.status === 'authenticated' ? state.user : null
  const [name, setName] = useState(user?.username ?? '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const { overview } = useView()
  const { repositories } = useWorkspace()
  const [ratingBusy, setRatingBusy] = useState(false)
  const [ratingError, setRatingError] = useState<string | null>(null)
  const [ratingPending, setRatingPending] = useState<boolean | null>(null)
  const detailed = overview.userPreference?.detailed_ratings === true
  if (ratingPending === detailed) setRatingPending(null)
  const changeDetail = async (next: boolean) => {
    if (!user || ratingBusy) return
    setRatingPending(next); setRatingBusy(true); setRatingError(null)
    try { await repositories.updateUserPreferences(user.id, { detailedRatings: next }) }
    catch (cause) { setRatingPending(null); setRatingError(cause instanceof Error ? cause.message : 'Die Darstellung konnte nicht gespeichert werden.') }
    finally { setRatingBusy(false) }
  }
  return <Sheet title="Konto" name="account" onClose={() => { if (!busy) onClose() }}>
    <div className="space-y-5 p-5">
      <section aria-label="Darstellung" className="space-y-2">
        <h2 className="text-body text-ink">Darstellung</h2>
        <ThemeSelect />
        <label className="flex min-h-11 items-center gap-3 text-body text-ink">
          <input type="checkbox" className="size-5 shrink-0 accent-brand" checked={ratingPending ?? detailed} disabled={ratingBusy}
            onChange={event => void changeDetail(event.target.checked)} />
          <span>Detaillierte Bewertungen anzeigen</span>
        </label>
        <p className="text-meta text-ink-muted">Für alle Listen auf deinen Geräten. Zeigt alle Bewertungen und erlaubt manuelle Dringlichkeit trotz Fälligkeit. In der einfachen Ansicht bestimmt eine Fälligkeit die Dringlichkeit immer automatisch.</p>
        {ratingError ? <p role="alert" className={errorBox}>{ratingError}</p> : null}
      </section>
      <p className="break-words text-body text-ink-muted">{user?.email}</p>
      <form aria-label="Benutzername ändern" className="space-y-3" onSubmit={event => {
        event.preventDefault()
        if (busy) return
        setBusy(true); setSaved(false)
        void setUsername(name).then(() => setSaved(true)).catch(() => {}).finally(() => setBusy(false))
      }}>
        <UsernameField value={name} onChange={value => { setName(value); setSaved(false) }} disabled={busy} />
        <Button type="submit" variant="secondary" disabled={busy || name === user?.username}><SaveIcon />Speichern</Button>
        {saved ? <p role="status" className="text-meta text-ok-ink">Benutzername gespeichert.</p> : null}
        {error ? <p role="alert" className={errorBox}>{error}</p> : null}
      </form>
      <AgentConnections />
      <details className="border-t border-line pt-3">
        <summary className={`${focusRing} cursor-pointer rounded-control py-2 text-meta text-ink-muted`}>Technische Informationen</summary>
        <div className="space-y-2 py-2"><BackendLabel /><p className="text-meta text-ink-muted">Dieser Server speichert den synchronisierten Bestand. Das Konto darüber legt fest, auf welche Listen du zugreifen kannst.</p></div>
      </details>
      <Button variant="ghost" disabled={busy} onClick={() => void signOut()}><LogoutIcon />Abmelden</Button>
    </div>
  </Sheet>
}
