import type { UpdateCheckResult } from './updateCheck'

/**
 * Der Zustand der Update-Prüfung, wie ihn die Oberfläche kennt.
 *
 * Steht hier und nicht in den React-Dateien, damit die Formulierungen – wie bei
 * der Synchronisation – ohne Komponenten geprüft werden können.
 */
export type UpdateState = { status: 'idle' } | { status: 'checking' } | UpdateCheckResult

export type UpdateTone = 'muted' | 'ok' | 'attention' | 'error'

export interface UpdateDescription {
  text: string
  tone: UpdateTone
}

export function describeUpdateState(state: UpdateState): UpdateDescription {
  switch (state.status) {
    case 'idle':
      return { text: 'Noch nicht geprüft.', tone: 'muted' }
    case 'checking':
      return { text: 'Suche nach Updates …', tone: 'muted' }
    case 'up-to-date':
      return { text: `prio ${state.latest} ist die neueste Fassung.`, tone: 'ok' }
    case 'available':
      return {
        text: `Version ${state.release.version} ist verfügbar – installiert ist ${state.current}.`,
        tone: 'attention',
      }
    case 'failed':
      return { text: state.message, tone: 'error' }
  }
}
