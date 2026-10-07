import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  PushPayload,
  RemoteList,
  RemoteListMember,
  RemoteSnapshot,
  RemoteTask,
} from '../domain/types'
import {
  classifyRemoteError,
  leeresPushErgebnis,
  RemoteError,
  type CoMemberContact,
  type PushErgebnis,
  type PushTabelle,
  type RemoteGateway,
} from './remoteGateway'

/**
 * Supabase-Implementierung des `RemoteGateway`.
 *
 * Bewusste Entscheidungen für Version 0.1:
 *
 *  - **Vollständiger Pull statt Delta.** `pull()` lädt alle sichtbaren Zeilen.
 *    Ein inkrementeller Sync über `updated_at > cursor` wäre schneller, hat
 *    aber eine heikle Lücke: Wird ein Benutzer zu einer bereits existierenden
 *    Liste hinzugefügt, deren `updated_at` älter ist als der Cursor, würde die
 *    Liste nie nachgeladen. Bei den kleinen Datenmengen eines Prototyps ist
 *    der vollständige Pull die robustere und deutlich einfachere Variante.
 *
 *  - **Upsert ohne Hard Delete.** Löschungen werden als `deleted_at`
 *    übertragen, genau wie lokal.
 *
 *  - **Keine Supabase-Typgenerierung.** Die Zeilen werden auf die Typen in
 *    `domain/types.ts` abgebildet und dort normalisiert. Ein generiertes
 *    `database.types.ts` wäre der nächste sinnvolle Schritt.
 */
export function createSupabaseGateway(client: SupabaseClient): RemoteGateway {
  return {
    async pull(): Promise<RemoteSnapshot> {
      const [lists, members, tasks] = await Promise.all([
        client.from('lists').select('*'),
        client.from('list_members').select('*'),
        client.from('tasks').select('*'),
      ])

      throwIfError(lists.error, 'Listen konnten nicht geladen werden.')
      throwIfError(members.error, 'Mitgliedschaften konnten nicht geladen werden.')
      throwIfError(tasks.error, 'Aufgaben konnten nicht geladen werden.')

      return {
        lists: (lists.data ?? []) as RemoteList[],
        members: (members.data ?? []) as RemoteListMember[],
        tasks: (tasks.data ?? []) as RemoteTask[],
      }
    },

    async push(payload: PushPayload): Promise<PushErgebnis> {
      const ergebnis = leeresPushErgebnis()

      const hochladen = async (
        tabelle: PushTabelle,
        anfrage: () => PromiseLike<{ error: unknown }>,
      ) => {
        if (payload[tabelle].length === 0) return
        const { error } = await anfrage()
        if (error) {
          ergebnis.fehler.push({ tabelle, error: classifyRemoteError(error) })
          return
        }
        // Die Zeilen sind angekommen – markiert werden sie in der Sync-Engine.
        ergebnis.hochgeladen[tabelle] = payload[tabelle] as never
      }

      // Reihenfolge ist durch Fremdschlüssel vorgegeben: Listen → Mitglieder → Aufgaben.
      await hochladen('lists', () =>
        client.from('lists').upsert(payload.lists, { onConflict: 'id' }),
      )
      if (ergebnis.fehler.some((eintrag) => eintrag.tabelle === 'lists')) {
        // Ohne Liste scheitern Mitglieder und Aufgaben ohnehin; sie bleiben dirty.
        return ergebnis
      }
      await hochladen('members', () =>
        client.from('list_members').upsert(payload.members, { onConflict: 'list_id,user_id' }),
      )
      await hochladen('tasks', () => client.from('tasks').upsert(payload.tasks, { onConflict: 'id' }))

      return ergebnis
    },

    async shareListByEmail(listId: string, email: string): Promise<{ userId: string }> {
      const { data, error } = await client.rpc('share_list_by_email', {
        p_list_id: listId,
        p_email: email,
      })
      throwIfError(error, 'Die Liste konnte nicht geteilt werden.')
      return { userId: String(data) }
    },

    async coMemberContacts(): Promise<CoMemberContact[]> {
      const { data, error } = await client.rpc('co_member_contacts')
      throwIfError(error, 'Die Kontakte konnten nicht geladen werden.')
      if (!Array.isArray(data)) return []

      // Defensiv wie überall: Nur brauchbare Zeilen weitergeben.
      return data
        .map((zeile) => ({
          userId: String((zeile as { user_id?: unknown })?.user_id ?? ''),
          email: String((zeile as { email?: unknown })?.email ?? '')
            .trim()
            .toLowerCase(),
        }))
        .filter((kontakt) => kontakt.userId.length > 0 && kontakt.email.length > 0)
    },
  }
}

function throwIfError(error: unknown, fallbackMessage: string): void {
  if (!error) return
  const classified = classifyRemoteError(error)
  // Bei Netzwerkfehlern ist die Supabase-Meldung ("Failed to fetch") wenig
  // hilfreich – die eigene Formulierung erklärt das Verhalten besser.
  const message = classified.kind === 'offline' ? fallbackMessage : classified.message || fallbackMessage
  throw new RemoteError(classified.kind, message, { cause: error })
}
