import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { AuthError, type AuthPort, type AuthUser, type SignUpResult } from './authPort'
import { normalizeUsername, validUsername } from '../domain/username'
import { cachedNativeSession, hasNativeWidgets, nativeAuthLock, nativeAuthStorage } from '../widgets/native'

const AUTH_STORAGE_KEY = 'prio.auth'

/**
 * Supabase Auth als `AuthPort`.
 *
 * Für Capacitor vorbereitet:
 *  - `detectSessionInUrl: false`, weil Magic-Links/OAuth-Weiterleitungen in
 *    einer Capacitor-App eigene Deep-Link-Behandlung bräuchten. Passwort-Links
 *    öffnen stattdessen den eigenständigen Web-Weg `/konto/passwort`.
 *  - `persistSession: true` speichert im Browser in `localStorage`, auf Android
 *    im verschlüsselten nativen Speicher, den auch das Widget verwendet.
 *  - Es werden keine Browser-APIs benutzt, die im WebView fehlen.
 */

export interface SupabaseConfig {
  url: string
  /**
   * Öffentlicher Schlüssel für den Client.
   *
   * Aktuell ist das der **Publishable Key** (`sb_publishable_…`). Supabase
   * schafft die alten `anon`-Keys bis Ende 2026 ab; der Publishable Key ist
   * der direkte Ersatz mit identischen Rechten. Zur Sicherheit wird der alte
   * Variantenname weiterhin akzeptiert, damit bestehende Installationen nicht
   * brechen.
   */
  publishableKey: string
}

/**
 * Liest die Konfiguration aus den Vite-Umgebungsvariablen.
 * Gibt `null` zurück, wenn die App ohne Supabase-Projekt gestartet wurde.
 */
export function readSupabaseConfig(env: ImportMetaEnv = import.meta.env): SupabaseConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim()
  const publishableKey = (
    env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY
  )?.trim()
  if (!url || !publishableKey) return null
  return { url, publishableKey }
}

export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: AUTH_STORAGE_KEY,
      ...(hasNativeWidgets() ? { storage: nativeAuthStorage, lock: nativeAuthLock } : {}),
    },
  })
}

interface SupabaseUserLike {
  id: string
  email?: string | null
  user_metadata?: { username?: unknown }
}

function toAuthUser(user: SupabaseUserLike | null | undefined): AuthUser | null {
  if (!user) return null
  const name = typeof user.user_metadata?.username === 'string' ? normalizeUsername(user.user_metadata.username) : ''
  return { id: user.id, email: user.email ?? '', username: validUsername(name) ? name : null }
}

/** Nur die lokale Kontoauswahl. Cloud-Zugriffe prüft weiterhin Supabase/RLS. */
function storedUser(): AuthUser | null {
  try {
    const raw = hasNativeWidgets() ? cachedNativeSession() : globalThis.localStorage?.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const session: unknown = JSON.parse(raw)
    if (!session || typeof session !== 'object' || !('user' in session)
      || !('access_token' in session) || typeof session.access_token !== 'string' || !session.access_token
      || !('refresh_token' in session) || typeof session.refresh_token !== 'string' || !session.refresh_token) return null
    const user = session.user
    if (!user || typeof user !== 'object' || !('id' in user) || typeof user.id !== 'string' || !user.id) return null
    return toAuthUser(user as SupabaseUserLike)
  } catch { return null }
}

function classifyAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) return error

  const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : ''
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error)
  const lower = message.toLowerCase()

  if (name === 'AuthRetryableFetchError' || lower.includes('failed to fetch') || lower.includes('fetch failed')) {
    return new AuthError('offline', message, { cause: error })
  }
  if (lower.includes('invalid login credentials')) {
    return new AuthError('invalid-credentials', message, { cause: error })
  }
  if (lower.includes('email not confirmed')) {
    return new AuthError('email-not-confirmed', message, { cause: error })
  }
  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return new AuthError('email-already-registered', message, { cause: error })
  }
  if (lower.includes('password should be at least') || lower.includes('weak password')) {
    return new AuthError('weak-password', message, { cause: error })
  }
  if (lower.includes('database error') || lower.includes('benutzername')) return new AuthError('profile-error', message, { cause: error })
  return new AuthError('unknown', message, { cause: error })
}

function recoveryError(error: unknown): AuthError {
  const classified = classifyAuthError(error)
  return classified.kind === 'offline' ? classified
    : new AuthError('recovery-link-invalid', 'recovery-link-invalid', { cause: error })
}

export function createSupabaseAuthPort(client: SupabaseClient, resetRedirectUrl?: string): AuthPort {
  // React kann die Initialisierung im Entwicklungslauf zweimal anfordern.
  // Ein Einmalcode wird dabei genau einmal beim Auth-Server eingelöst.
  let recoveryAttempt: Promise<AuthUser> | null = null
  async function currentSessionUser(): Promise<AuthUser | null> {
    const { data, error } = await client.auth.getSession()
    if (error) throw classifyAuthError(error)
    const user = toAuthUser(data.session?.user)
    if (user && !user.username && data.session && (typeof navigator === 'undefined' || navigator.onLine)) {
      // Profiländerungen eines anderen Geräts übernehmen, ohne den lokalen
      // Start an diesen Netzaufruf zu binden. setSession sendet das Auth-Event.
      const refreshed = await client.auth.setSession({
        access_token: data.session.access_token, refresh_token: data.session.refresh_token,
      })
      if (!refreshed.error) return toAuthUser(refreshed.data.user)
    }
    return user
  }
  async function checkUsername(value: string) {
    const username = normalizeUsername(value)
    if (!validUsername(username)) throw new AuthError('username-invalid', 'username-invalid')
    const { data, error } = await client.rpc('username_available', { p_username: username })
    if (error) throw classifyAuthError(error)
    if (data !== true) throw new AuthError('username-taken', 'username-taken')
    return username
  }
  return {
    async requestPasswordReset(email) {
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: resetRedirectUrl })
      if (error) throw classifyAuthError(error)
    },

    completePasswordRecovery(url) {
      recoveryAttempt ??= (async () => {
        const address = new URL(url)
        const hash = new URLSearchParams(address.hash.slice(1))
        if (hash.has('error') || address.searchParams.has('error')) throw new AuthError('recovery-link-invalid', 'recovery-link-invalid')
        const code = address.searchParams.get('code')
        const access = hash.get('access_token'), refresh = hash.get('refresh_token')
        if (code || (hash.get('type') === 'recovery' && access && refresh)) {
          const result = code ? await client.auth.exchangeCodeForSession(code)
            : await client.auth.setSession({ access_token: access!, refresh_token: refresh! })
          if (result.error) throw recoveryError(result.error)
        } else if (hash.size || address.searchParams.size) throw new AuthError('recovery-link-invalid', 'recovery-link-invalid')
        // Nach Neuladen der bereits bereinigten Seite ist die bestätigte
        // Sitzung weiter gültig. Der Server prüft sie erneut.
        const { data, error } = await client.auth.getUser()
        const user = toAuthUser(data.user)
        if (error || !user) throw recoveryError(error)
        return user
      })()
      return recoveryAttempt
    },

    async setPassword(password) {
      const { error } = await client.auth.updateUser({ password })
      if (error) throw classifyAuthError(error)
    },
    async getCurrentUser() {
      // getSession wartet auf die SDK-Initialisierung und damit bei abgelaufenem
      // Token auf das Netz. Den vorhandenen Supabase-Speicher direkt lesen;
      // kein zweiter Cache und kein Timeout, der später eine Anmeldung zeigt.
      const cached = storedUser()
      if (cached) {
        if (!cached.username) void currentSessionUser().catch(() => {})
        return cached
      }
      return currentSessionUser()
    },

    async signUp(email: string, password: string, requested?: string): Promise<SignUpResult> {
      const username = requested === undefined ? undefined : await checkUsername(requested)
      const { data, error } = await client.auth.signUp({ email, password, ...(username ? { options: { data: { username } } } : {}) })
      if (error) throw classifyAuthError(error)
      const user = toAuthUser(data.user)
      // Ohne Sitzung verlangt das Projekt eine E-Mail-Bestätigung.
      return { user: data.session ? user : null, requiresEmailConfirmation: data.session === null }
    },

    async setUsername(requested: string): Promise<AuthUser> {
      const session = await client.auth.getSession()
      const current = toAuthUser(session.data.session?.user)
      if (!current) throw new AuthError('unknown', 'Bitte erneut anmelden.')
      if (normalizeUsername(requested) === current.username) return current
      const username = await checkUsername(requested)
      const { data, error } = await client.auth.updateUser({ data: { username } })
      if (error) throw classifyAuthError(error)
      const user = toAuthUser(data.user)
      if (!user?.username) throw new AuthError('profile-error', 'username-not-confirmed')
      return user
    },

    async signIn(email: string, password: string): Promise<AuthUser> {
      const { data, error } = await client.auth.signInWithPassword({ email, password })
      if (error) throw classifyAuthError(error)
      const user = toAuthUser(data.user)
      if (!user) throw new AuthError('unknown', 'Anmeldung fehlgeschlagen.')
      return user
    },

    async signOut() {
      const { error } = await client.auth.signOut()
      // Ein fehlgeschlagener Server-Logout darf die lokale Abmeldung nicht
      // verhindern – die Sitzung ist lokal bereits entfernt.
      if (error && classifyAuthError(error).kind !== 'offline') {
        throw classifyAuthError(error)
      }
    },

    onAuthStateChange(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        listener(toAuthUser(session?.user))
      })
      return () => data.subscription.unsubscribe()
    },
  }
}
