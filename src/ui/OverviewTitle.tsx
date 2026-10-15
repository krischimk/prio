import { useView } from './useView'
import { useIsDesktop } from '../app/useIsDesktop'
import { ChevronIcon, OverviewIcon, SettingsIcon } from './icons'
import { focusRing } from './styles'

/** Der Ansichtsname ist zugleich der Zugang zur persönlichen Listenauswahl. */
export function OverviewTitle() {
  const { setOverviewSettingsOpen } = useView()
  const desktop = useIsDesktop()
  return <button type="button" aria-label="Listen für die Gesamtansicht auswählen" data-focus-key="settings:overview"
    onClick={() => setOverviewSettingsOpen(true)}
    className={`${focusRing} group/title inline-flex min-h-11 max-w-full items-center gap-2 rounded-control text-ink-strong hover:text-ink ${desktop ? '' : 'w-full px-2 py-1 text-left active:bg-raised'}`}>
    {!desktop ? <OverviewIcon /> : null}
    <span className="truncate">Gesamtansicht</span>
    {desktop ? <ChevronIcon offen className="size-icon-meta shrink-0 text-ink-muted opacity-0 transition-opacity group-hover/title:opacity-100 group-focus-visible/title:opacity-100" />
      : <SettingsIcon className="ml-auto size-icon shrink-0 text-ink-muted" />}
  </button>
}
