import type { ListSortMode } from '../domain/types'

export const listSortModeLabel: Record<ListSortMode, string> = {
  manual: 'Manuelle Reihenfolge',
  priority: 'Nach Priorität – mit Bereichen',
  priority_flat: 'Nach Priorität – alle Aufgaben',
}
