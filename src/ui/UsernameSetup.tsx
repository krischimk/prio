import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { UsernameField } from './UsernameField'
import { AppBrand } from './AppBrand'
import { Button } from './components/Button'
import { appBackground, errorBox } from './styles'

/** Bestehende Konten wählen einmalig einen Namen; die Daten bleiben erhalten. */
export function UsernameSetup() {
  const { setUsername, signOut, error } = useAuth()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  return <main className={`flex min-h-screen items-center justify-center px-4 py-8 ${appBackground}`}>
    <div className="w-full max-w-sm space-y-5">
      <AppBrand />
      <h1 className="text-heading font-semibold text-ink-strong">Wähle deinen Benutzernamen</h1>
      <p className="text-body text-ink-muted">Damit können andere Listen mit dir teilen und dich in der Mitgliederliste erkennen.</p>
      <form aria-label="Benutzername wählen" className="space-y-4" onSubmit={event => {
        event.preventDefault()
        if (busy) return
        setBusy(true)
        void setUsername(name).catch(() => {}).finally(() => setBusy(false))
      }}>
        <UsernameField value={name} onChange={setName} disabled={busy} />
        {error ? <p role="alert" className={errorBox}>{error}</p> : null}
        <Button type="submit" variant="primary" layout="w-full" disabled={busy}>Benutzernamen speichern</Button>
      </form>
      <Button variant="ghost" disabled={busy} onClick={() => void signOut()}>Abmelden</Button>
    </div>
  </main>
}
