/** Unveränderte Datenbankzeilen behalten ihre Identität, auch nach erneutem Lesen. */
export function shareQueryData<T>(previous: T, next: T): T {
  if (Object.is(previous, next)) return previous
  if (!previous || !next || typeof previous !== 'object' || typeof next !== 'object') return next
  if (Array.isArray(previous) && Array.isArray(next)) {
    const byId = new Map(previous.filter(value => value && typeof value === 'object' && typeof value.id === 'string').map(value => [value.id, value]))
    const values = next.map((value, index) => shareQueryData(value && typeof value === 'object' && typeof value.id === 'string' ? byId.get(value.id) : previous[index], value))
    return (values.length === previous.length && values.every((value, index) => value === previous[index]) ? previous : values) as T
  }
  if (Array.isArray(previous) || Array.isArray(next)) return next
  const before = previous as Record<string, unknown>, after = next as Record<string, unknown>
  const keys = Object.keys(after)
  const result = Object.fromEntries(keys.map(key => [key, shareQueryData(before[key], after[key])]))
  return (keys.length === Object.keys(before).length && keys.every(key => Object.hasOwn(before, key) && result[key] === before[key]) ? previous : result) as T
}
