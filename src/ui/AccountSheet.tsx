import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { Sheet } from './components/Sheet'
import { Button } from './components/Button'
import { BackendLabel } from './BackendLabel'
import { UsernameField } from './UsernameField'
import { errorBox, focusRing } from './styles'
import { LogoutIcon, SaveIcon } from './icons'
import { ThemeToggle } from './ThemeToggle'

export function AccountSheet({ onClose }: { onClose: () => void }) {
  const { state, setUsername, signOut, error } = useAuth()
  const user = state.status === 'authenticated' ? state.user : null
  const [name, setName] = useState(user?.username ?? '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  return <Sheet title="Konto" name="account" onClose={() => { if (!busy) onClose() }}>
    <div className="space-y-5 p-5">
      <div className="flex items-center justify-between"><span className="text-body text-ink">Darstellung</span><ThemeToggle /></div>
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
      <details className="border-t border-line pt-3">
        <summary className={`${focusRing} cursor-pointer rounded-control py-2 text-meta text-ink-muted`}>Technische Informationen</summary>
        <div className="space-y-2 py-2"><BackendLabel /><p className="text-meta text-ink-muted">Dieser Server speichert den synchronisierten Bestand. Das Konto darüber legt fest, auf welche Listen du zugreifen kannst.</p></div>
      </details>
      <Button variant="ghost" disabled={busy} onClick={() => void signOut()}><LogoutIcon />Abmelden</Button>
    </div>
  </Sheet>
}
