import type { UpdateCheckResult } from './updateCheck'

/**
 * Merkt sich die letzte Update-Prüfung.
 *
 * Warum überhaupt: GitHub erlaubt **60 Abfragen pro Stunde und IP** ohne
 * Anmeldung – geteilt von Adresse, Emulator, Web-Fassung und jedem Skript am
 * selben Anschluss. Eine Prüfung bei jedem App-Start ist damit ein Verbraucher,
 * der die Grenze allein erreichbar macht; und wer die App ein paar Mal öffnet,
 * sieht statt einer Antwort eine Grenzmeldung.
 *
 * Deshalb: höchstens eine Prüfung je Zeitfenster. Der Knopf in der Oberfläche
 * prüft trotzdem sofort – wer ausdrücklich fragt, bekommt eine Antwort.
 */

/** Wie lange ein Ergebnis gilt. */
export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

const SPEICHER_SCHLUESSEL = 'prio.updateCheck'

export interface CachedCheck {
  /** Zeitpunkt der Prüfung in Millisekunden (wie `Date.now()`). */
  at: number
  /** Die installierte Version, gegen die geprüft wurde. */
  current: string
  result: UpdateCheckResult
}

export function parseCachedCheck(raw: string | null): CachedCheck | null {
  if (raw === null) return null
  try {
    const wert: unknown = JSON.parse(raw)
    if (typeof wert !== 'object' || wert === null) return null
    const eintrag = wert as Partial<CachedCheck>
    if (typeof eintrag.at !== 'number' || !Number.isFinite(eintrag.at)) return null
    if (typeof eintrag.current !== 'string') return null
    if (typeof eintrag.result !== 'object' || eintrag.result === null) return null
    return { at: eintrag.at, current: eintrag.current, result: eintrag.result as UpdateCheckResult }
  } catch {
    return null
  }
}

/**
 * Ist das gemerkte Ergebnis noch brauchbar?
 *
 * Nicht mehr, wenn es zu alt ist – oder wenn inzwischen eine andere Fassung
 * läuft: Dann verglich es die falsche Version (typisch direkt nach einem
 * Update: „Version 0.15.1 verfügbar, installiert ist 0.15.0", obwohl 0.15.1
 * bereits läuft).
 */
export function isCachedCheckUsable(
  cached: CachedCheck | null,
  currentVersion: string,
  now: number,
): boolean {
  if (cached === null) return false
  // Ein Fehlschlag wird nicht wiederverwendet: Er ist ein Grund zum
  // Wiederholen, nicht zum Merken. Sonst stünde nach einem Start ohne Netz
  // für Stunden eine Fehlermeldung da, obwohl die Verbindung längst steht.
  if (cached.result.status === 'failed') return false
  if (cached.current !== currentVersion) return false
  return now - cached.at < UPDATE_CHECK_INTERVAL_MS
}

/** Nur brauchbare Ergebnisse werden gemerkt – siehe `isCachedCheckUsable`. */
export function shouldCacheResult(result: UpdateCheckResult): boolean {
  return result.status !== 'failed'
}

/** Der gemerkte Eintrag als Text für den Speicher. */
export function serializeCachedCheck(eintrag: CachedCheck): string {
  return JSON.stringify(eintrag)
}

/** Liest den gemerkten Eintrag; ohne Speicher (Tests, alte Browser) `null`. */
export function readCachedCheck(): CachedCheck | null {
  try {
    return parseCachedCheck(globalThis.localStorage?.getItem(SPEICHER_SCHLUESSEL) ?? null)
  } catch {
    return null
  }
}

export function writeCachedCheck(eintrag: CachedCheck): void {
  try {
    globalThis.localStorage?.setItem(SPEICHER_SCHLUESSEL, serializeCachedCheck(eintrag))
  } catch {
    // Ohne Speicher wird eben jedes Mal gefragt – kein Grund, den Aufruf zu stören.
  }
}
