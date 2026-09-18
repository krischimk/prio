import { ValidationError } from '../db/validation'
import type { Repositories } from '../db/repositories'
import type { RemoteGateway } from './remoteGateway'

/**
 * Freigabe einer Liste per E-Mail-Adresse.
 *
 * Bewusst außerhalb von React: Der Ablauf ist Geschäftslogik und soll ohne
 * Komponenten testbar sein.
 *
 * Ablauf:
 *   1. Erst synchronisieren: Die Liste muss auf dem Server existieren, bevor
 *      sie geteilt werden kann – sonst schlägt der Aufruf fehl, wenn zwischen
 *      Erstellen und Teilen noch kein Sync gelaufen ist.
 *   2. Server fragen (nur er kennt E-Mail → Benutzer-ID). Das geht nur online.
 *   3. Liste lokal als "geteilt" markieren und als Änderung vormerken.
 *      Das verhindert, dass ein gleichzeitiger Push den Server-Zustand wieder
 *      auf "privat" zurückdreht.
 *   4. Sync anstoßen, damit die neue Mitgliedschaft lokal ankommt.
 */
export function createShareListAction(deps: {
  gateway: RemoteGateway
  repositories: Repositories
  sync: () => Promise<unknown>
}): (listId: string, email: string) => Promise<{ userId: string }> {
  return async (listId, email) => {
    const trimmed = email.trim()
    if (trimmed.length === 0) {
      throw new ValidationError('Bitte eine E-Mail-Adresse angeben.')
    }

    await deps.sync()

    const result = await deps.gateway.shareListByEmail(listId, trimmed)
    await deps.repositories.markListShared(listId)
    await deps.sync()
    return result
  }
}
