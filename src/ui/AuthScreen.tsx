import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { input, link, primaryButton } from './styles'

/**
 * Anmeldung und Registrierung.
 *
 * Bewusst ein einziges Formular mit Umschalter statt zweier Seiten – für 0.1
 * ist der Unterschied nur ein zusätzlicher Knopf.
 */
export function AuthScreen() {
  const { signIn, signUp, error, notice, clearMessages } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      if (mode === 'signin') await signIn(email, password)
      else await signUp(email, password)
    } catch {
      // Die Fehlermeldung steht bereits im Auth-Kontext.
    } finally {
      setBusy(false)
    }
  }

  const toggleMode = () => {
    clearMessages()
    setMode((current) => (current === 'signin' ? 'signup' : 'signin'))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-neutral-50">prio</h1>
        <p className="mb-6 text-sm text-neutral-400">
          Aufgaben offline erfassen – synchronisiert wird, sobald das Netz da ist.
        </p>

        <form onSubmit={submit} className="space-y-3" aria-label="Anmeldung">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-neutral-300">
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={input}
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-neutral-300">
              Passwort
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={input}
            />
          </div>

          {error ? (
            <p role="alert" className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p role="status" className="rounded-md border border-emerald-900/60 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
              {notice}
            </p>
          ) : null}

          <button type="submit" className={`${primaryButton} w-full`} disabled={busy}>
            {mode === 'signin' ? 'Anmelden' : 'Konto erstellen'}
          </button>
        </form>

        <p className="mt-4 text-sm text-neutral-400">
          {mode === 'signin' ? 'Noch kein Konto?' : 'Schon registriert?'}{' '}
          <button type="button" onClick={toggleMode} className={link}>
            {mode === 'signin' ? 'Registrieren' : 'Anmelden'}
          </button>
        </p>
      </div>
    </div>
  )
}
