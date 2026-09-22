import { createContext } from 'react'
import type { UpdateCheckResult } from '../updates/updateCheck'

/** Ergebnis der letzten Prüfung auf eine neue Fassung. */
export type UpdateState = { status: 'idle' } | { status: 'checking' } | UpdateCheckResult

export interface UpdateContextValue {
  state: UpdateState
  /** Sucht erneut nach einer neuen Fassung. */
  check(): Promise<void>
  /** Lädt die gefundene Fassung und öffnet den Installationsdialog. */
  install(): Promise<void>
  /** Läuft gerade ein Download? */
  installing: boolean
  /** Meldung, falls das Installieren nicht angestoßen werden konnte. */
  installError: string | null
  /** Ob direkt installiert werden kann (nur in der App). */
  canInstall: boolean
}

export const UpdateContext = createContext<UpdateContextValue | null>(null)
