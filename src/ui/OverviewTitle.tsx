import { useView } from './useView'
import { useIsDesktop } from '../app/useIsDesktop'
import { ChevronIcon } from './icons'
import { focusRing } from './styles'

/** Der Ansichtsname ist zugleich der Zugang zur persönlichen Listenauswahl. */
export function OverviewTitle() {
  const { setOverviewSettingsOpen } = useView()
  const desktop = useIsDesktop()
  return <button type="button" aria-label="Listen für die Gesamtansicht auswählen" data-focus-key="settings:overview"
    onClick={() => setOverviewSettingsOpen(true)}
    className={`${focusRing} group/title inline-flex min-h-11 max-w-full items-center gap-2 rounded-control text-ink-strong hover:text-ink`}>
    <span className="truncate">Gesamtansicht</span>
    <ChevronIcon offen className={`h-4 w-4 shrink-0 text-ink-muted ${desktop ? 'opacity-0 transition-opacity group-hover/title:opacity-100 group-focus-visible/title:opacity-100' : ''}`} />
  </button>
}
