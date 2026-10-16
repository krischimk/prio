import type { OverviewMode } from '../domain/types'

export const overviewModeLabel: Record<OverviewMode, string> = {
  by_list: 'Nach Listen gruppiert',
  newest: 'Neueste zuerst',
  priority: 'Höchste Priorität zuerst',
}
