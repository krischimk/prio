import type { SyncResult } from '../../sync/syncEngine'

/**
 * Übersetzt den Sync-Zustand in einen Text für die Oberfläche.
 *
 * Bewusst getrennt von der React-Komponente, damit die Formulierungen – gerade
 * die Offline-Meldung – automatisiert geprüft werden können. Sie liegt in der
 * Oberfläche (`src/ui/status/`), nicht in der Sync-Engine: Die kennt den
 * **Zustand** (`kind: 'offline'`), die Formulierung gehört hierher. Vorher stand
 * `OFFLINE_MESSAGE` in `src/sync/syncEngine.ts` – die Fachschicht trug die
 * Worte der Oberfläche mit.
 */

/** Der Text für den Offline-Zustand. */
export const OFFLINE_TEXT = 'Offline – Änderungen werden später synchronisiert.'

export type SyncTone = 'ok' | 'pending' | 'error'

export interface SyncDescription {
  text: string
  tone: SyncTone
}

export function describeSyncState(
  status: SyncResult | null,
  pendingCount: number,
  syncing: boolean,
  /** Änderungen, die der Server dauerhaft ablehnt (Ablagefach). */
  rejectedCount = 0,
  /** Offene Konflikte bleiben auch nach Neustart oder einem Offline-Lauf sichtbar. */
  conflictCount = 0,
): SyncDescription {
  if (syncing) {
    return { text: 'Synchronisiere…', tone: 'pending' }
  }
  if (conflictCount > 0) {
    return {
      text: `${conflictCount} ${conflictCount === 1 ? 'Änderungskonflikt' : 'Änderungskonflikte'} – deine Eingaben bleiben erhalten.`,
      tone: 'error',
    }
  }
  if (!status) {
    return { text: 'Noch nicht synchronisiert.', tone: 'pending' }
  }

  switch (status.kind) {
    case 'offline':
      return { text: OFFLINE_TEXT, tone: 'pending' }
    case 'auth':
      return { text: 'Anmeldung abgelaufen – bitte neu anmelden.', tone: 'error' }
    case 'error':
      return { text: status.message ?? 'Synchronisation fehlgeschlagen.', tone: 'error' }
    case 'partial':
      return {
        text: `${status.message === 'sync-protocol' ? 'Die Cloud-Antwort konnte nicht geprüft werden. Deine Änderungen bleiben gespeichert.' : status.message ?? 'Teilweise synchronisiert.'} (erneuter Versuch folgt)`,
        tone: 'pending',
      }
    case 'conflict':
      return { text: 'Änderungskonflikt – deine Eingaben bleiben erhalten.', tone: 'error' }
    case 'ok':
      // Abgelehnte Änderungen sind kein „warten“: Sie gehen nicht von selbst
      // durch. Deshalb stehen sie hier und nicht im Zähler daneben.
      if (rejectedCount > 0) {
        return {
          text: `${rejectedCount} ${rejectedCount === 1 ? 'Änderung wurde' : 'Änderungen wurden'} vom Server abgelehnt.`,
          tone: 'error',
        }
      }
      return pendingCount > 0
        ? {
            text: `${pendingCount} ${pendingCount === 1 ? 'Änderung wartet' : 'Änderungen warten'} auf Übertragung.`,
            tone: 'pending',
          }
        : { text: 'Alles synchronisiert.', tone: 'ok' }
  }
}
