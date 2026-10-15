import type { LocalList } from '../domain/types'
import { focusRing, appBackground } from './styles'
import { OverviewIcon } from './icons'
import { AppBrand } from './AppBrand'
import { NewListComposer } from './NewListComposer'
import { ListNavigation } from './ListNavigation'

export function Sidebar({ lists, selectedListId, onSelect, currentUserId }: {
  lists: LocalList[]; selectedListId: string | null; onSelect: (listId: string | null) => void; currentUserId: string
}) {
  return <aside className={`h-screen w-64 shrink-0 overflow-y-auto border-r border-line ${appBackground} p-5`} aria-label="Listen">
    <div className="mb-8 flex items-center gap-3 px-2"><AppBrand /></div>
    <button type="button" onClick={() => onSelect(null)} aria-current={selectedListId === null ? 'page' : undefined}
      className={`${focusRing} mb-6 flex min-h-11 w-full items-center gap-3 rounded-control px-3 py-3 text-left text-body ${selectedListId === null ? 'bg-brand-tint text-brand-faint' : 'text-ink-soft hover:bg-surface'}`}>
      <OverviewIcon />Gesamtansicht
    </button>
    <h2 className="mb-3 text-meta font-semibold uppercase tracking-wide text-ink-faint">Listen</h2>
    <ListNavigation lists={lists} selectedListId={selectedListId} onSelect={onSelect} currentUserId={currentUserId} />
    <div className="mt-4"><NewListComposer currentUserId={currentUserId} onCreated={onSelect} /></div>
  </aside>
}
