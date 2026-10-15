import { compareListsByName } from './ordering'
import type { LocalList, LocalListPreference } from './types'

/** Ohne persönliche Reihenfolge bleibt der bisherige alphabetische Einstieg. */
export function orderedLists(lists: LocalList[], preferences: LocalListPreference[]): LocalList[] {
  const byId = new Map(preferences.map(row => [row.list_id, row]))
  return [...lists].sort((a, b) => {
    const left = byId.get(a.id)?.position ?? Infinity
    const right = byId.get(b.id)?.position ?? Infinity
    return left - right || compareListsByName(a, b)
  })
}

/** Ein Nachbar statt einer alten Gesamtliste: zwischenzeitliche Neuzugänge bleiben. */
export function placeNavigationList(lists: LocalList[], preferences: LocalListPreference[], listId: string,
  destination: { hidden: boolean; beforeListId: string | null }): Array<{ listId: string; hidden: boolean; position: number }> {
  const hidden = new Set(preferences.filter(row => row.hidden).map(row => row.list_id))
  const ordered = orderedLists(lists, preferences).filter(row => row.id !== listId)
  const peers = ordered.filter(row => hidden.has(row.id) === destination.hidden)
  const before = destination.beforeListId === null ? peers.length : peers.findIndex(row => row.id === destination.beforeListId)
  if (before < 0) throw new Error('Die Zielliste ist nicht mehr an dieser Stelle. Bitte erneut verschieben.')
  peers.splice(before, 0, lists.find(row => row.id === listId)!)
  const other = ordered.filter(row => hidden.has(row.id) !== destination.hidden)
  return [
    ...peers.map((row, index) => ({ listId: row.id, hidden: destination.hidden, position: index + 1 })),
    ...other.map((row, index) => ({ listId: row.id, hidden: !destination.hidden, position: index + 1 })),
  ]
}
