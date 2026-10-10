import type { IsoDateTime } from './types'

/** Liefert die aktuelle Zeit als ISO-String in UTC. */
export interface Clock {
  now(): IsoDateTime
  /** Aktuelle Zeit in Millisekunden seit Epoche – Basis für Vergleiche. */
  nowMs(): number
}

export const systemClock: Clock = {
  now: () => new Date().toISOString(),
  nowMs: () => Date.now(),
}

/** Feste Uhr für deterministische Tests. */
export function createFixedClock(startMs = Date.parse('2026-01-01T00:00:00.000Z')): Clock & {
  advance(ms: number): void
  set(ms: number): void
} {
  let current = startMs
  return {
    now: () => new Date(current).toISOString(),
    nowMs: () => current,
    advance: (ms: number) => {
      current += ms
    },
    set: (ms: number) => {
      current = ms
    },
  }
}

/**
 * Bringt jeden Zeitstempel auf die kanonische Form `...Z` in Millisekunden.
 *
 * Wichtig: Supabase liefert `timestamptz` als `2026-01-31T12:00:00.123456+00:00`,
 * lokal speichern wir `2026-01-31T12:00:00.123Z`. Für lokale Vergleiche und
 * Anzeige gilt dieselbe Form; `cloudState` bewahrt zusätzlich die genaue
 * Serverbasis für den atomaren Schreibvergleich.
 */
export function normalizeIso(value: string): IsoDateTime
export function normalizeIso(value: string | null | undefined): IsoDateTime | null
export function normalizeIso(value: string | null | undefined): IsoDateTime | null {
  if (value === null || value === undefined || value === '') return null
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) {
    throw new Error(`Ungültiger Zeitstempel: ${value}`)
  }
  return new Date(ms).toISOString()
}

/** Zeitstempel als Millisekunden, etwa für das Wiederherstellungsfenster. */
export function timeOf(value: IsoDateTime): number {
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) {
    throw new Error(`Ungültiger Zeitstempel: ${value}`)
  }
  return ms
}
