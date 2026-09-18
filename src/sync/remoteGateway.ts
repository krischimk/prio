import type { PushPayload, RemoteSnapshot } from '../domain/types'

/**
 * Abstraktion der Cloud-Schnittstelle.
 *
 * Die Sync-Engine kennt nur dieses Interface, nie Supabase direkt. Dadurch
 * laufen alle Sync-Tests ohne Cloud-Zugriff, und ein späterer Wechsel des
 * Backends betrifft nur die Implementierung.
 */

export type RemoteFailureKind =
  /** Netzwerk nicht erreichbar oder Supabase pausiert. */
  | 'offline'
  /** Sitzung abgelaufen oder ungültig – erneutes Anmelden nötig. */
  | 'auth'
  /** Server hat die Anfrage abgelehnt (z. B. RLS-Verstoß, 5xx). */
  | 'server'

export class RemoteError extends Error {
  readonly kind: RemoteFailureKind

  constructor(kind: RemoteFailureKind, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'RemoteError'
    this.kind = kind
  }
}

export interface RemoteGateway {
  /** Lädt den kompletten sichtbaren Serverbestand. */
  pull(): Promise<RemoteSnapshot>
  /** Lädt lokale Änderungen hoch (idempotent über Upsert). */
  push(payload: PushPayload): Promise<void>
  /**
   * Teilt eine Liste über die E-Mail-Adresse eines registrierten Nutzers.
   *
   * Das erfordert zwingend eine Serververbindung, weil nur der Server die
   * Zuordnung E-Mail → Benutzer-ID kennt.
   */
  shareListByEmail(listId: string, email: string): Promise<{ userId: string }>
}

/**
 * Ordnet einen Fehler einer der drei Kategorien zu.
 *
 * Wichtig für das Verhalten bei Serverausfall: Ein Netzwerkfehler darf nicht
 * als Datenfehler behandelt werden – die lokalen Änderungen bleiben dann in
 * der Queue und werden später erneut versucht.
 */
export function classifyRemoteError(error: unknown): RemoteError {
  if (error instanceof RemoteError) return error

  const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : ''
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error)
  const lower = message.toLowerCase()
  const status = statusOf(error)
  const code = codeOf(error)

  if (status === 401 || code === 'PGRST301' || name === 'AuthSessionMissingError' || lower.includes('invalid jwt')) {
    return new RemoteError('auth', message, { cause: error })
  }
  if (status === 403) {
    return new RemoteError('server', message, { cause: error })
  }
  if (name === 'AuthRetryableFetchError' || isNetworkFailure(lower)) {
    return new RemoteError('offline', message, { cause: error })
  }
  return new RemoteError('server', message, { cause: error })
}

function isNetworkFailure(lowerMessage: string): boolean {
  return (
    lowerMessage.includes('failed to fetch') ||
    lowerMessage.includes('fetch failed') ||
    lowerMessage.includes('networkerror') ||
    lowerMessage.includes('network request failed') ||
    lowerMessage.includes('load failed') ||
    lowerMessage.includes('err_network') ||
    // Typische Socket-Fehler aus Node/undici und älteren WebViews
    lowerMessage.includes('etimedout') ||
    lowerMessage.includes('econnrefused') ||
    lowerMessage.includes('enotfound') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('timed out')
  )
}

function statusOf(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status
    if (typeof status === 'number') return status
  }
  return undefined
}

function codeOf(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string') return code
  }
  return undefined
}
