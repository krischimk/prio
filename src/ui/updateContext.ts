import { createContext } from 'react'
import type { UpdateState } from '../updates/updateStatus'

export type { UpdateState }

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
