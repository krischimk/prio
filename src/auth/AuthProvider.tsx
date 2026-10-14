import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { authErrorMessage, AuthError, type AuthPort, type AuthUser } from './authPort'
import { AuthContext, type AuthContextValue, type AuthState } from './authContext'

/**
 * Stellt den Anmeldezustand bereit.
 *
 * Hinweis zur Umsetzung: Die Zustandsänderungen passieren in Effekten bzw. in
 * asynchronen Callbacks, weil hier ein externes System (Supabase Auth)
 * abgebildet wird. Die Lint-Regel `react/set-state-in-effect` ist deshalb in
 * `.oxlintrc.json` abgeschaltet – siehe „Bewusste Entscheidungen“ in der README.
 */
export function AuthProvider({ port, children }: { port: AuthPort; children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  /**
   * Der Auth-Listener von Supabase feuert beim Abonnieren sofort ein
   * INITIAL_SESSION-Event. Ein frühes `null` würde die App fälschlich als
   * abgemeldet darstellen, während `getCurrentUser()` noch lädt. Deshalb
   * übernimmt erst die vollständige Initialisierung den Startzustand – samt
   * einem gegebenenfalls auf einem anderen Gerät gewählten Benutzernamen.
   */
  const initialResolved = useRef(false)

  useEffect(() => {
    let active = true
    initialResolved.current = false
    const apply = (user: AuthUser | null) => {
      if (!active) return
      setState(user ? { status: 'authenticated', user } : { status: 'anonymous' })
    }

    const unsubscribe = port.onAuthStateChange((user) => {
      if (initialResolved.current) apply(user)
    })

    port
      .getCurrentUser()
      .then((user) => {
        if (!active) return
        initialResolved.current = true
        apply(user)
      })
      .catch(() => {
        if (!active) return
        initialResolved.current = true
        apply(null)
      })

    return () => {
      active = false
      unsubscribe()
    }
  }, [port])

  const signIn = useCallback(
    async (email: string, password: string) => {
      setError(null)
      setNotice(null)
      try {
        const user = await port.signIn(email, password)
        initialResolved.current = true
        setState({ status: 'authenticated', user })
      } catch (cause) {
        setError(authErrorMessage(cause))
        throw cause
      }
    },
    [port],
  )

  const signUp = useCallback(
    async (email: string, password: string, username?: string) => {
      setError(null)
      setNotice(null)
      try {
        const result = await port.signUp(email, password, username)
        initialResolved.current = true
        if (result.user) {
          setState({ status: 'authenticated', user: result.user })
        } else {
          setState({ status: 'anonymous' })
          setNotice('Konto erstellt. Bitte die E-Mail-Adresse bestätigen und dann anmelden.')
        }
      } catch (cause) {
        setError(authErrorMessage(cause))
        throw cause
      }
    },
    [port],
  )

  const signOut = useCallback(async () => {
    setError(null)
    setNotice(null)
    try {
      await port.signOut()
    } catch (cause) {
      // Nur echte Fehler anzeigen; offline wird lokal trotzdem abgemeldet.
      if (!(cause instanceof AuthError) || cause.kind !== 'offline') {
        setError(authErrorMessage(cause))
      }
    } finally {
      initialResolved.current = true
      setState({ status: 'anonymous' })
    }
  }, [port])

  const clearMessages = useCallback(() => {
    setError(null)
    setNotice(null)
  }, [])

  const setUsername = useCallback(async (username: string) => {
    setError(null)
    try {
      const user = await port.setUsername(username)
      setState({ status: 'authenticated', user })
    } catch (cause) { setError(authErrorMessage(cause)); throw cause }
  }, [port])

  const value = useMemo<AuthContextValue>(
    () => ({ state, error, notice, signIn, signUp, setUsername, signOut, clearMessages }),
    [state, error, notice, signIn, signUp, setUsername, signOut, clearMessages],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
