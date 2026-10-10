import { CLOUD_TABLES, canonicalCloudRow, cloudRowId, type CloudRow, type CloudTable } from '../domain/cloudMerge'
import { sameData } from '../domain/equality'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  PushPayload,
  RemoteList,
  RemoteListMember,
  RemoteListPreference,
  RemoteUserPreference,
  RemoteSnapshot,
  RemoteTask,
} from '../domain/types'
import {
  classifyRemoteError,
  leeresPushErgebnis,
  RemoteError,
  type CoMemberContact,
  type PushErgebnis,
  type RemoteGateway,
  type PushBases,
} from './remoteGateway'

/**
 * Supabase-Implementierung des `RemoteGateway`.
 *
 * Vollständiges paginiertes Lesen und geschütztes Schreiben:
 *
 *  - **Vollständiger Pull statt Delta.** `pull()` lädt alle sichtbaren Zeilen.
 *    Ein inkrementeller Sync über `updated_at > cursor` wäre schneller, hat
 *    aber eine heikle Lücke: Wird ein Benutzer zu einer bereits existierenden
 *    Liste hinzugefügt, deren `updated_at` älter ist als der Cursor, würde die
 *    Liste nie nachgeladen. Bei den kleinen Datenmengen eines Prototyps ist
 *    der vollständige Pull die robustere und deutlich einfachere Variante.
 *
 *  - **Geschützter RPC ohne Hard Delete.** `sync_push` prüft Berechtigung und
 *    den erwarteten Stand atomar. Löschungen bleiben `deleted_at`. Es gibt
 *    keinen Rückfall auf direkte Tabellen-Schreiboperationen.
 *
 *  - **Keine Supabase-Typgenerierung.** Die Zeilen werden auf die Typen in
 *    `domain/types.ts` abgebildet und dort normalisiert. Ein generiertes
 *    `database.types.ts` ist für diesen Schreibvertrag nicht erforderlich.
 */
export function createSupabaseGateway(client: SupabaseClient): RemoteGateway {
  return {
    async pull(): Promise<RemoteSnapshot> {
      const read = async (table: 'lists' | 'list_members' | 'tasks' | 'list_preferences' | 'user_preferences'): Promise<unknown[]> => {
        const rows: unknown[] = []
        for (;;) {
          let query = client.from(table).select('*', { count: 'exact' })
          query = table === 'list_members' || table === 'list_preferences' ? query.order('list_id').order('user_id') : query.order('id')
          const { data, count, error } = await query.range(rows.length, rows.length + 499)
          throwIfError(error, 'Daten konnten nicht geladen werden.')
          if (!data?.length) break
          rows.push(...data)
          if (count !== null ? rows.length >= count : data.length < 500) break
        }
        return rows
      }
      const [lists, members, tasks, preferences, userPreferences] = await Promise.all([
        read('lists'), read('list_members'), read('tasks'), read('list_preferences'), read('user_preferences'),
      ])

      return {
        lists: lists as RemoteList[],
        members: members as RemoteListMember[],
        tasks: tasks as RemoteTask[],
        ...(preferences.length ? { preferences: preferences as RemoteListPreference[] } : {}),
        ...(userPreferences.length ? { userPreferences: userPreferences as RemoteUserPreference[] } : {}),
      }
    },

    async push(payload: PushPayload, bases: PushBases = { lists: {}, members: {}, tasks: {} }): Promise<PushErgebnis> {
      const result = leeresPushErgebnis()
      result.konflikte = []
      const changes = CLOUD_TABLES.flatMap(table => [...(payload[table] ?? [])]
        .sort((a, b) => cloudRowId(table, a).localeCompare(cloudRowId(table, b)))
        .map(row => {
          const expected = bases[table]?.[cloudRowId(table, row)] ?? null
          // JavaScript liest Zeitpunkte nur auf Millisekunden genau. Der
          // unveränderliche Erstellzeitpunkt bleibt exakt wie im Serverbestand.
          return { table, row: expected ? { ...row, created_at: expected.created_at } : row, expected }
        }))
      // Begrenzte Anfragen; jedes Ergebnis gehört zu genau einer Zeile.
      for (let start = 0; start < changes.length; start += 100) {
        const chunk = changes.slice(start, start + 100)
        const { data, error, status } = await client.rpc('sync_push', { p_changes: chunk })
        if (error) {
          for (const table of CLOUD_TABLES) {
            const ids = chunk.filter(change => change.table === table).map(change => cloudRowId(table, change.row))
            if (ids.length) result.fehler.push({ tabelle: table, ids, error: classifyRemoteError(error, status) })
          }
          break
        }
        if (!Array.isArray(data) || data.length !== chunk.length) throw new RemoteError('server', 'sync-protocol', { retryable: true })
        for (let index = 0; index < chunk.length; index += 1) {
          const change = chunk[index]
          const answer = data[index] as { table?: string; id?: string; kind?: string; current?: CloudRow | null; message?: string; code?: string }
          const id = cloudRowId(change.table, change.row)
          if (!answer || answer.table !== change.table || answer.id !== id) throw new RemoteError('server', 'sync-protocol', { retryable: true })
          if (answer.kind === 'written' && answer.current && checkedRow(change.table, id, answer.current) && sameData(canonicalCloudRow(change.table, answer.current), canonicalCloudRow(change.table, change.row))) {
            ;(result.hochgeladen[change.table] ??= []).push(answer.current as never)
          } else if (answer.kind === 'conflict' && Object.hasOwn(answer, 'current')) {
            if (answer.current !== null && !checkedRow(change.table, id, answer.current)) throw new RemoteError('server', 'sync-protocol', { retryable: true })
            result.konflikte.push({ table: change.table, id, base: change.expected, local: change.row, remote: answer.current ?? null, fields: [] })
          } else if (answer.kind === 'rejected') {
            result.fehler.push({ tabelle: change.table, ids: [id], error: classifyRemoteError(answer) })
          } else throw new RemoteError('server', 'sync-protocol', { retryable: true })
        }
      }
      return result
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

function checkedRow(table: CloudTable, id: string, value: unknown): value is CloudRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  try {
    const row = value as CloudRow
    return cloudRowId(table, row) === id && Boolean(canonicalCloudRow(table, row))
  } catch { return false }
}

function throwIfError(error: unknown, fallbackMessage: string): void {
  if (!error) return
  const classified = classifyRemoteError(error)
  // Bei Netzwerkfehlern ist die Supabase-Meldung ("Failed to fetch") wenig
  // hilfreich – die eigene Formulierung erklärt das Verhalten besser.
  const message = classified.kind === 'offline' ? fallbackMessage : classified.message || fallbackMessage
  throw new RemoteError(classified.kind, message, { cause: error })
}
