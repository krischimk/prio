import type { LocalList } from '../domain/types'
import { useIsDesktop } from '../app/useIsDesktop'
import { ListIcon } from './ListIcon'
import { focusRing, numeric } from './styles'

/** Die Gesamtansicht navigiert; bearbeitet wird ausschließlich im Listenkopf. */
export function OverviewListHeading({ list, count, onOpen }: { list: LocalList; count: number; onOpen: () => void }) {
  const desktop = useIsDesktop()
  return <h2 className="mb-2 border-b border-line">
    <button type="button" aria-label={`Liste ${list.name} öffnen`} onClick={onOpen}
      className={`${focusRing} flex min-h-11 w-full items-center gap-2 text-left hover:text-brand-soft ${desktop ? 'py-2' : 'px-rand'}`}>
      {list.icon ? <ListIcon icon={list.icon} className="size-icon shrink-0 text-brand-soft" /> : null}
      <span className="min-w-0 flex-1 break-words text-list-heading font-semibold text-ink-strong">{list.name}</span>
      <span className={`shrink-0 text-meta font-normal text-ink-muted ${numeric}`}>{count}</span>
    </button>
  </h2>
}
