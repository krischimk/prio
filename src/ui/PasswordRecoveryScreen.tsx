import { useEffect, useState } from 'react'
import { authErrorMessage, type AuthPort, type AuthUser } from '../auth/authPort'
import { AppBrand } from './AppBrand'
import { Button } from './components/Button'
import { appBackground, errorBox, input, link, successBox } from './styles'
import { DelayedLoading } from './components/DelayedLoading'

/** Eigenständiger Web-Weg: funktioniert auch ohne geöffnete Prio-App. */
export function PasswordRecoveryScreen({ port }: { port: AuthPort }) {
  const [source] = useState(() => window.location.href)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  useEffect(() => {
    let active = true
    // Einmalcodes und Sitzungstokens verlassen die Adresszeile sofort.
    window.history.replaceState(null, '', window.location.pathname)
    void port.completePasswordRecovery(source).then(user => {
      if (active) { setUser(user); setReady(true) }
    }).catch(cause => { if (active) setError(authErrorMessage(cause)) })
    return () => { active = false }
  }, [port, source])
  return <main className={`flex min-h-screen items-center justify-center px-4 py-8 ${appBackground}`}>
    <div className="w-full max-w-sm space-y-5">
      <AppBrand />
      <h1 className="text-heading text-ink">Neues Passwort</h1>
      {!ready && !error ? <DelayedLoading>Link wird geprüft …</DelayedLoading> : null}
      {ready && !saved ? <form aria-label="Neues Passwort festlegen" className="space-y-3" onSubmit={event => {
        event.preventDefault()
        if (busy) return
        if (password !== repeat) { setError('Die beiden Passwörter stimmen nicht überein.'); return }
        setBusy(true); setError(null)
        void port.setPassword(password).then(() => { setSaved(true); setPassword(''); setRepeat('') })
          .catch(cause => setError(authErrorMessage(cause))).finally(() => setBusy(false))
      }}>
        <p className="break-words text-body text-ink-muted">Für {user?.email}</p>
        <label className="block text-body text-ink-soft">Neues Passwort
          <input className={`${input} mt-1`} type="password" autoComplete="new-password" required minLength={6}
            disabled={busy} value={password} onChange={event => setPassword(event.target.value)} />
        </label>
        <label className="block text-body text-ink-soft">Passwort wiederholen
          <input className={`${input} mt-1`} type="password" autoComplete="new-password" required minLength={6}
            disabled={busy} value={repeat} onChange={event => setRepeat(event.target.value)} />
        </label>
        <Button type="submit" variant="primary" layout="w-full" disabled={busy}>Passwort speichern</Button>
      </form> : null}
      {error ? <p role="alert" className={errorBox}>{error}</p> : null}
      {saved ? <p role="status" className={successBox}>Dein Passwort wurde geändert.</p> : null}
      {saved || error ? <a className={`${link} inline-block text-body`} href="/">Zurück zu Prio</a> : null}
    </div>
  </main>
}
