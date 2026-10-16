import { CLOUD_TABLES, canonicalCloudRow, cloudRowId, type CloudRow, type CloudTable } from '../domain/cloudMerge'
import { sameData } from '../domain/equality'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PushPayload, RemoteSnapshot, RemoteCheckpoint } from '../domain/types'
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
 * `sync_pull` liefert seit der bestätigten PostgreSQL-Sicht geänderte Zeilen.
 * Freigaben älterer Listen lösen einen vollständigen Neuabgleich aus. Die erste
 * Seite liefert den Checkpoint: Änderungen während weiterer Seiten werden beim
 * nächsten Pull erneut geliefert. Geräteuhren entscheiden über keine Lücke.
 * Schreiben bleibt ausschließlich der atomare `sync_push` mit Basisprüfung.
 */
export function createSupabaseGateway(client: SupabaseClient): RemoteGateway {
  return {
    async pull(checkpoint?: RemoteCheckpoint | null): Promise<RemoteSnapshot> {
      const snapshot: RemoteSnapshot = { lists: [], members: [], tasks: [], preferences: [], userPreferences: [] }
      const rows = Object.fromEntries(CLOUD_TABLES.map(table => [table, new Map<string, CloudRow>()])) as Record<CloudTable, Map<string, CloudRow>>
      const removed = new Set<string>()
      let after: string | null = null
      for (;;) {
        const { data, error, status }: { data: unknown; error: unknown; status?: number } = await client.rpc('sync_pull', {
          p_since: checkpoint?.snapshot ?? null, p_lists: checkpoint?.listIds ?? [], p_after: after, p_limit: 500,
        })
        if (error) throw classifyRemoteError(error, status)
        if (!isPullPage(data)) throw new RemoteError('server', 'sync-protocol', { retryable: true })
        snapshot.checkpoint ??= data.checkpoint
        for (const change of data.changes) {
          const id = cloudRowId(change.table, change.row)
          if (typeof id !== 'string' || !id || !checkedRow(change.table, id, change.row)) throw new RemoteError('server', 'sync-protocol', { retryable: true })
          rows[change.table].set(id, change.row)
        }
        for (const id of data.removedListIds) removed.add(id)
        if (!data.hasMore) break
        if (!data.changes.length || !data.nextAfter || (after !== null && data.nextAfter <= after)) throw new RemoteError('server', 'sync-protocol', { retryable: true })
        after = data.nextAfter
      }
      for (const table of CLOUD_TABLES) for (const row of rows[table].values()) snapshot[table]!.push(row as never)
      snapshot.removedListIds = [...removed]
      return snapshot
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

    async shareListByUsername(listId: string, username: string, expectedUserId?: string): Promise<{ userId: string }> {
      const { data, error } = await client.rpc('share_list_by_username', { p_list_id: listId, p_username: username, p_expected_user_id: expectedUserId ?? null })
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
          username: typeof zeile.username === 'string' ? zeile.username : null,
        }))
        .filter((kontakt) => kontakt.userId.length > 0 && (kontakt.email.length > 0 || !!kontakt.username))
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

interface PullPage {
  changes: Array<{ table: CloudTable; row: CloudRow }>
  checkpoint: RemoteCheckpoint
  removedListIds: string[]
  hasMore: boolean
  nextAfter: string | null
}
function isPullPage(value: unknown): value is PullPage {
  if (!value || typeof value !== 'object') return false
  const page = value as PullPage
  return Array.isArray(page.changes) && page.changes.every(change => change && CLOUD_TABLES.includes(change.table) && change.row && typeof change.row === 'object')
    && typeof page.hasMore === 'boolean' && (page.nextAfter === null || typeof page.nextAfter === 'string')
    && Array.isArray(page.removedListIds) && page.removedListIds.every(id => typeof id === 'string')
    && !!page.checkpoint && typeof page.checkpoint.snapshot === 'string' && !!page.checkpoint.snapshot
    && Array.isArray(page.checkpoint.listIds) && page.checkpoint.listIds.every(id => typeof id === 'string')
}
