/**
 * Versionsvergleich für die Update-Prüfung.
 *
 * Bewusst ohne Bibliothek: Es geht nur um Zahlen, die durch Punkte getrennt
 * sind, mit einem optionalen führenden `v` (so heißen die Git-Tags).
 */

export interface ParsedVersion {
  major: number
  minor: number
  patch: number
}

/** Liest `v1.2.3`, `1.2.3` oder `1.2` – `null`, wenn nichts Sinnvolles übrig bleibt. */
export function parseVersion(input: string): ParsedVersion | null {
  const bereinigt = input.trim().replace(/^v/i, '')
  const treffer = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(bereinigt)
  if (!treffer) return null

  return {
    major: Number(treffer[1]),
    minor: Number(treffer[2] ?? 0),
    patch: Number(treffer[3] ?? 0),
  }
}

/**
 * Ist `candidate` neuer als `current`?
 *
 * Unlesbare Versionen gelten als „nicht neuer“ – im Zweifel wird nicht zum
 * Aktualisieren aufgefordert.
 */
export function isNewerVersion(candidate: string, current: string): boolean {
  const neu = parseVersion(candidate)
  const alt = parseVersion(current)
  if (!neu || !alt) return false

  if (neu.major !== alt.major) return neu.major > alt.major
  if (neu.minor !== alt.minor) return neu.minor > alt.minor
  return neu.patch > alt.patch
}
