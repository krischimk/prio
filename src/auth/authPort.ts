/**
 * Abstraktion der Anmeldung.
 *
 * Die Oberfläche kennt nur dieses Interface. Dadurch laufen Integrations- und
 * UI-Tests mit einer Fake-Implementierung, ganz ohne Supabase.
 */

export interface AuthUser {
  id: string
  email: string
  username?: string | null
}

export type AuthFailureKind =
  /** Netzwerk nicht erreichbar – Anmeldung offline nicht möglich. */
  | 'offline'
  | 'invalid-credentials'
  | 'email-not-confirmed'
  | 'email-already-registered'
  | 'weak-password'
  | 'username-invalid'
  | 'username-taken'
  | 'profile-error'
  | 'recovery-link-invalid'
  | 'unknown'

export class AuthError extends Error {
  readonly kind: AuthFailureKind

  constructor(kind: AuthFailureKind, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'AuthError'
    this.kind = kind
  }
}

export interface SignUpResult {
  /** `null`, wenn Supabase erst eine E-Mail-Bestätigung verlangt. */
  user: AuthUser | null
  requiresEmailConfirmation: boolean
}

export interface AuthPort {
  /** Liest die gespeicherte Sitzung – auch ohne Netzwerk. */
  getCurrentUser(): Promise<AuthUser | null>
  signUp(email: string, password: string, username?: string): Promise<SignUpResult>
  setUsername(username: string): Promise<AuthUser>
  signIn(email: string, password: string): Promise<AuthUser>
  signOut(): Promise<void>
  requestPasswordReset(email: string): Promise<void>
  completePasswordRecovery(url: string): Promise<AuthUser>
  setPassword(password: string): Promise<void>
  onAuthStateChange(listener: (user: AuthUser | null) => void): () => void
}

/** Übersetzt technische Fehler in verständliche deutsche Meldungen. */
export function authErrorMessage(error: unknown): string {
  if (!(error instanceof AuthError)) {
    return 'Unbekannter Fehler bei der Anmeldung.'
  }
  switch (error.kind) {
    case 'offline':
      return 'Keine Verbindung – diese Aktion ist nur online möglich. Deine lokalen Daten bleiben erhalten.'
    case 'invalid-credentials':
      return 'E-Mail-Adresse oder Passwort ist falsch.'
    case 'email-not-confirmed':
      return 'Bitte zuerst die E-Mail-Adresse bestätigen.'
    case 'email-already-registered':
      return 'Für diese E-Mail-Adresse existiert bereits ein Konto.'
    case 'weak-password':
      return 'Das Passwort ist zu kurz (mindestens 6 Zeichen).'
    case 'username-invalid':
      return 'Verwende 3 bis 30 Zeichen: Buchstaben a–z, Ziffern und Unterstrich.'
    case 'username-taken':
      return 'Dieser Benutzername ist bereits vergeben. Wähle einen anderen.'
    case 'profile-error':
      return 'Der Benutzername konnte nicht gespeichert werden. Er ist möglicherweise inzwischen vergeben. Bitte versuche einen anderen Namen.'
    case 'recovery-link-invalid':
      return 'Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.'
    default:
      return error.message || 'Unbekannter Fehler bei der Anmeldung.'
  }
}
