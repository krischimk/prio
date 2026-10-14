import { useAuth } from '../auth/useAuth'
import { useView } from './useView'
import { ListOverviewChoice } from './ListOverviewChoice'
import { Sheet } from './components/Sheet'
import { Button } from './components/Button'
import { errorBox } from './styles'
import { Screen } from './components/Screen'
import { IconButton } from './components/IconButton'
import { CloseIcon } from './icons'
import { TaskComposer } from './TaskComposer'

function OverviewSettings({ userId }: { userId: string }) {
  const { overview, setOverviewSettingsOpen } = useView()
  return <Sheet title="Listen in der Gesamtansicht" name="overview-settings" onClose={() => setOverviewSettingsOpen(false)}>
    <div className="space-y-3 p-4">
      {overview.status === 'loading' ? <p role="status">Einstellungen werden geladen …</p> : overview.status === 'error' ? <div className="space-y-2">
        <p role="alert" className={errorBox}>Die Einstellungen konnten nicht geladen werden.</p>
        <Button variant="secondary" onClick={overview.retry}>Erneut versuchen</Button>
      </div> : <>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-body font-semibold text-ink">Listen in der Gesamtansicht</legend>
          {overview.lists.map(list => <ListOverviewChoice key={list.id} listId={list.id} currentUserId={userId} label={list.name} />)}
          {overview.lists.length === 0 ? <p className="text-body text-ink-muted">Lege zuerst eine Liste über das Menü oder die Seitenleiste an.</p> : null}
        </fieldset>
      </>}
    </div>
  </Sheet>
}

function OverviewTarget() {
  const { setOverviewCreating } = useView()
  const close = () => setOverviewCreating(false)
  return <Screen label="Neue Aufgabe" name="overview-create" onClose={close} header={<div className="safe-top border-b border-line">
    <header className="flex min-h-16 items-center gap-2 px-2 py-1"><IconButton aria-label="Schließen" onClick={close}><CloseIcon /></IconButton><h2 className="text-title font-medium text-ink">Neue Aufgabe</h2></header>
  </div>}>
    <div className="scroll-area min-h-0 flex-1 overflow-y-auto p-4"><TaskComposer autoFocus onCreated={close} /></div>
  </Screen>
}

/** Die Gesamtansicht verwendet denselben Aufgabeneditor wie jede Listenansicht. */
export function OverviewDialogs() {
  const { state } = useAuth()
  const userId = state.status === 'authenticated' ? state.user.id : ''
  const { overview, overviewSettingsOpen, overviewCreating, setOverviewCreating } = useView()
  return <>
    {overviewSettingsOpen ? <OverviewSettings userId={userId} /> : null}
    {overviewCreating && overview.status === 'ready' ? <OverviewTarget /> : null}
    {overviewCreating && overview.status !== 'ready' ? <Sheet title="Neue Aufgabe" onClose={() => setOverviewCreating(false)}>
      <div className="space-y-3 p-5"><p role="status">Die verfügbaren Listen müssen zuerst geladen werden.</p><Button variant="secondary" onClick={overview.retry}>Erneut versuchen</Button></div>
    </Sheet> : null}
  </>
}
