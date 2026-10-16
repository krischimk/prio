import { AuthError, type AuthPort, type AuthUser, type SignUpResult } from '../../src/auth/authPort'
import type { NetworkMonitor } from '../../src/sync/network'

/**
 * In-Memory-Ersatz für Supabase Auth.
 *
 * Bildet Registrierung, Anmeldung, Abmeldung und Sitzungswiederherstellung ab.
 * Optional kann eine E-Mail-Bestätigung erzwungen werden (`requireEmailConfirmation`),
 * um beide Supabase-Konfigurationen testen zu können.
 */
export class FakeAuthPort implements AuthPort {
  private readonly accounts = new Map<string, { id: string; password: string; username: string | null }>()
  private listeners = new Set<(user: AuthUser | null) => void>()
  private counter = 0
  /**
   * Zufälliges Präfix, damit zwei Tests nicht dieselbe lokale Datenbank
   * (`prio-user-<id>`) verwenden.
   */
  private readonly prefix: string

  currentUser: AuthUser | null = null
  requireEmailConfirmation = false
  /** Wenn gesetzt, schlägt die nächste Anmeldung mit diesem Fehler fehl. */
  failNextSignInWith: AuthError | null = null

  constructor(prefix?: string) {
    this.prefix = prefix ?? `u${Math.random().toString(36).slice(2, 8)}`
  }

  seed(email: string, password: string, username: string | null = `user_${this.counter + 1}`): AuthUser {
    this.counter += 1
    const user: AuthUser = { id: `${this.prefix}-${this.counter}`, email, username }
    this.accounts.set(email.trim().toLowerCase(), { id: user.id, password, username })
    return user
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    return this.currentUser
  }

  async signUp(email: string, password: string, username?: string): Promise<SignUpResult> {
    const key = email.trim().toLowerCase()
    if (this.accounts.has(key)) {
      throw new AuthError('email-already-registered', 'User already registered')
    }
    const user = this.seed(key, password, username)
    if (this.requireEmailConfirmation) {
      return { user: null, requiresEmailConfirmation: true }
    }
    this.setCurrent(user)
    return { user, requiresEmailConfirmation: false }
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    if (this.failNextSignInWith) {
      const error = this.failNextSignInWith
      this.failNextSignInWith = null
      throw error
    }
    const account = this.accounts.get(email.trim().toLowerCase())
    if (!account || account.password !== password) {
      throw new AuthError('invalid-credentials', 'Invalid login credentials')
    }
    const user: AuthUser = { id: account.id, email: email.trim().toLowerCase(), username: account.username }
    this.setCurrent(user)
    return user
  }

  async signOut(): Promise<void> {
    this.setCurrent(null)
  }
  async requestPasswordReset(_email: string): Promise<void> {}
  async completePasswordRecovery(_url: string): Promise<AuthUser> {
    if (!this.currentUser) throw new AuthError('recovery-link-invalid', 'recovery-link-invalid')
    return this.currentUser
  }
  async setPassword(password: string): Promise<void> {
    if (!this.currentUser) throw new AuthError('recovery-link-invalid', 'recovery-link-invalid')
    this.accounts.get(this.currentUser.email)!.password = password
  }
  async setUsername(username: string): Promise<AuthUser> {
    if (!this.currentUser) throw new AuthError('unknown', 'Bitte anmelden.')
    const user = { ...this.currentUser, username }
    this.accounts.get(user.email)!.username = username
    this.setCurrent(user)
    return user
  }

  onAuthStateChange(listener: (user: AuthUser | null) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private setCurrent(user: AuthUser | null): void {
    this.currentUser = user
    for (const listener of this.listeners) listener(user)
  }
}

/** Steuerbarer Netzwerkzustand für Tests. */
export class FakeNetworkMonitor implements NetworkMonitor {
  private listeners = new Set<(online: boolean) => void>()
  private online: boolean

  constructor(online = true) {
    this.online = online
  }

  isOnline(): boolean {
    return this.online
  }

  subscribe(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  setOnline(online: boolean): void {
    this.online = online
    for (const listener of this.listeners) listener(online)
  }
}
