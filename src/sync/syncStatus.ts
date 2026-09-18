import { OFFLINE_MESSAGE, type SyncResult } from './syncEngine'

/**
 * Übersetzt den Sync-Zustand in einen Text für die Oberfläche.
 *
 * Bewusst getrennt von der React-Komponente, damit die Formulierungen – gerade
 * die Offline-Meldung – automatisiert geprüft werden können.
 */

export type SyncTone = 'ok' | 'pending' | 'error'

export interface SyncDescription {
  text: string
  tone: SyncTone
}

export function describeSyncState(
  status: SyncResult | null,
  pendingCount: number,
  syncing: boolean,
): SyncDescription {
  if (syncing) {
    return { text: 'Synchronisiere…', tone: 'pending' }
  }
  if (!status) {
    return { text: 'Noch nicht synchronisiert.', tone: 'pending' }
  }

  switch (status.kind) {
    case 'offline':
      return { text: OFFLINE_MESSAGE, tone: 'pending' }
    case 'auth':
      return { text: 'Anmeldung abgelaufen – bitte neu anmelden.', tone: 'error' }
    case 'error':
      return { text: status.message ?? 'Synchronisation fehlgeschlagen.', tone: 'error' }
    case 'partial':
      return {
        text: `${status.message ?? 'Teilweise synchronisiert.'} (erneuter Versuch folgt)`,
        tone: 'pending',
      }
    case 'ok':
      return pendingCount > 0
        ? {
            text: `${pendingCount} ${pendingCount === 1 ? 'Änderung wartet' : 'Änderungen warten'} auf Übertragung.`,
            tone: 'pending',
          }
        : { text: 'Alles synchronisiert.', tone: 'ok' }
  }
}
