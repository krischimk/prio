/** Bit 1: Notiz, Bit 2: Checkliste. Nur aufgeklappte Aufgaben werden gespeichert. */
export function parseTaskExpansions(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([id, bits]) => id.length > 0 && id.length <= 128 && [1, 2, 3].includes(bits)))
}

/** Unabhängige Aufgaben und die beiden Schalter einer Aufgabe bleiben unabhängig. */
export function mergeTaskExpansions(base: unknown, local: unknown, remote: unknown): Record<string, number> {
  const b = parseTaskExpansions(base), l = parseTaskExpansions(local), r = parseTaskExpansions(remote)
  const result: Record<string, number> = {}
  for (const id of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])) {
    let bits = 0
    for (const bit of [1, 2]) bits |= ((l[id] ?? 0) & bit) !== ((b[id] ?? 0) & bit) ? (l[id] ?? 0) & bit : (r[id] ?? 0) & bit
    if (bits) result[id] = bits
  }
  return result
}
