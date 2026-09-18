import { createContext } from 'react'
import type { Repositories } from '../db/repositories'
import type { SyncResult } from '../sync/syncEngine'

/**
 * Kontext des Arbeitsbereichs (ein angemeldeter Benutzer).
 *
 * Der Kontext liegt bewusst in einer eigenen Datei, damit `WorkspaceProvider`
 * nur die Komponente exportiert – das hält Fast Refresh im Dev-Server intakt.
 */
export interface WorkspaceValue {
  repositories: Repositories
  /**
   * Zähler, der sich nach jeder lokalen Änderung (und nach jedem Pull mit
   * neuen Daten) erhöht. Hooks lesen daraufhin neu aus IndexedDB.
   */
  dataVersion: number
  /** Status des letzten Sync-Durchlaufs. */
  syncStatus: SyncResult | null
  /** Anzahl noch nicht hochgeladener lokaler Änderungen. */
  pendingCount: number
  /** `true`, solange ein Sync läuft. */
  syncing: boolean
  /** Zeitpunkt des letzten erfolgreichen Syncs (aus der lokalen Meta-Tabelle). */
  lastSyncedAt: string | null
  runSync(): Promise<void>
  /** Teilt eine Liste per E-Mail-Adresse (benötigt Serververbindung). */
  shareListByEmail(listId: string, email: string): Promise<{ userId: string }>
}

export const WorkspaceContext = createContext<WorkspaceValue | null>(null)
