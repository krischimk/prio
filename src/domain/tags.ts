/** Namen bleiben lesbar; für Vergleich und Filter zählen Groß-/Kleinschreibung nicht. */
export const tagKey = (tag: string) => tag.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de')

export function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.flatMap(tag => {
    if (typeof tag !== 'string') return []
    const text = tag.normalize('NFKC').trim().replace(/\s+/g, ' ')
    const key = tagKey(text)
    if (!key || seen.has(key)) return []
    seen.add(key)
    return [text]
  })
}

export function matchesTags(tags: string[], selected: string[]): boolean {
  const present = new Set(tags.map(tagKey))
  return selected.every(tag => present.has(tagKey(tag)))
}

/** Mitgliedschaft je Tag zusammenführen; verschiedene Ergänzungen bleiben erhalten. */
export function mergeTags(base: string[], local: string[], remote: string[]): string[] {
  const b = new Set(base.map(tagKey)), l = new Set(local.map(tagKey)), r = new Set(remote.map(tagKey))
  return parseTags([...remote, ...local]).filter(tag => {
    const key = tagKey(tag)
    return l.has(key) === b.has(key) ? r.has(key) : l.has(key)
  })
}
