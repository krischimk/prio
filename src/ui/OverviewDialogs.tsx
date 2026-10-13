import { useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { useWorkspace } from '../app/useWorkspace'
import { useView } from './useView'
import { ListOverviewChoice } from './ListOverviewChoice'
import { Sheet } from './components/Sheet'
import { Button } from './components/Button'
import { errorBox, input } from './styles'
import { Screen } from './components/Screen'
import { IconButton } from './components/IconButton'
import { CloseIcon } from './icons'
import { TaskComposer } from './TaskComposer'

function OverviewSettings({ userId }: { userId: string }) {
  const { overview, setOverviewSettingsOpen } = useView()
  const { repositories } = useWorkspace()
  const [busy, setBusy] = useState(false)
  const writing = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const defaultId = overview.userPreference?.default_list_id ?? ''
  const unavailable = defaultId !== '' && !overview.lists.some(list => list.id === defaultId)
  const changeDefault = async (defaultListId: string | null) => {
    if (writing.current) return
    writing.current = true; setBusy(true); setError(null)
    try { await repositories.updateUserPreferences(userId, { defaultListId }) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Die Standardliste konnte nicht gespeichert werden.') }
    finally { writing.current = false; setBusy(false) }
  }
  return <Sheet title="Gesamtansicht einstellen" name="overview-settings" onClose={() => { if (!busy) setOverviewSettingsOpen(false) }}>
    <div className="space-y-5 p-4">
      <p className="text-body text-ink-muted">Diese Auswahl gilt für dich und wird zwischen deinen Geräten synchronisiert.</p>
      {overview.status === 'loading' ? <p role="status">Einstellungen werden geladen …</p> : overview.status === 'error' ? <div className="space-y-2">
        <p role="alert" className={errorBox}>Die Einstellungen konnten nicht geladen werden.</p>
        <Button variant="secondary" onClick={overview.retry}>Erneut versuchen</Button>
      </div> : <>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-body font-semibold text-ink">Listen in der Gesamtansicht</legend>
          {overview.lists.map(list => <ListOverviewChoice key={list.id} listId={list.id} currentUserId={userId} label={list.name} />)}
          {overview.lists.length === 0 ? <p className="text-body text-ink-muted">Lege zuerst eine Liste über das Menü oder die Seitenleiste an.</p> : null}
        </fieldset>
        <label className="block space-y-2 text-body text-ink">
          <span>Standardliste für neue Aufgaben</span>
          <select className={input} aria-label="Standardliste für neue Aufgaben" value={defaultId} disabled={busy}
            onChange={event => { void changeDefault(event.target.value || null) }}>
            <option value="">Jedes Mal auswählen</option>
            {unavailable ? <option value={defaultId} disabled>Nicht mehr verfügbar</option> : null}
            {overview.lists.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}
          </select>
        </label>
        <p className="text-meta text-ink-muted">Nur eine hier ausdrücklich gesetzte Standardliste wird vorausgewählt. Die letzte Zielliste wird nicht automatisch gemerkt.</p>
        {unavailable ? <p role="status" className="text-body text-ink-muted">Deine Standardliste ist nicht mehr verfügbar. Wähle eine andere Liste oder „Jedes Mal auswählen“.</p> : null}
      </>}
      {error ? <p role="alert" className={errorBox}>{error}</p> : null}
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
