import { createContext } from 'react'
import type { AuthUser } from './authPort'

/**
 * Anmeldezustand der App.
 *
 * Die Oberfläche entscheidet anhand von `status`, was sie zeigt:
 *  - `loading`      → kurzer Ladezustand beim Start
 *  - `anonymous`    → Anmeldeformular
 *  - `authenticated`→ eigentliche App (auch vollständig offline nutzbar)
 */
export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: AuthUser }

export interface AuthContextValue {
  state: AuthState
  /** `null`, wenn kein Fehler vorliegt. */
  error: string | null
  /** Meldung nach erfolgreicher Registrierung (E-Mail-Bestätigung nötig). */
  notice: string | null
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  clearMessages(): void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
