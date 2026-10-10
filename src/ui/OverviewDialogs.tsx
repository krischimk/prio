import { useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { useWorkspace } from '../app/useWorkspace'
import { useView } from './useView'
import { ListOverviewChoice } from './ListOverviewChoice'
import { Sheet } from './components/Sheet'
import { Button } from './components/Button'
import { errorBox, input } from './styles'

const exclusionHint = (name: string) => `„${name}“ ist nicht in der Gesamtansicht. Deine neue Aufgabe wird dort gespeichert und erscheint in dieser Listenansicht.`

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
  const { overview, setOverviewCreating, setTaskDetail } = useView()
  const defaultId = overview.userPreference?.default_list_id ?? null
  const [listId, setListId] = useState(overview.lists.some(list => list.id === defaultId) ? defaultId! : '')
  const list = overview.lists.find(entry => entry.id === listId)
  const included = overview.preferences.some(row => row.list_id === listId && row.include_in_overview)
  return <Sheet title="Zielliste wählen" name="overview-target" onClose={() => setOverviewCreating(false)}>
    <form className="space-y-4 p-4" onSubmit={event => {
      event.preventDefault()
      if (!list) return
      setTaskDetail({ taskId: null, listId: list.id, fromOverview: true }); setOverviewCreating(false)
    }}>
      <label className="block space-y-2 text-body text-ink">
        <span>Zielliste</span>
        <select className={input} aria-label="Zielliste" value={list?.id ?? ''} onChange={event => setListId(event.target.value)}>
          <option value="">Bitte auswählen</option>
          {overview.lists.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
      </label>
      {defaultId && !overview.lists.some(entry => entry.id === defaultId) ? <p role="status" className="text-body text-ink-muted">Deine Standardliste ist nicht mehr verfügbar. Bitte wähle die Zielliste ausdrücklich.</p> : null}
      {list && !included ? <p role="status" className="text-body text-ink-muted">{exclusionHint(list.name)}</p> : null}
      <Button type="submit" variant="primary" disabled={!list}>Weiter</Button>
    </form>
  </Sheet>
}

/** Die Gesamtansicht verwendet denselben Aufgabeneditor wie jede Listenansicht. */
export function OverviewDialogs() {
  const { state } = useAuth()
  const userId = state.status === 'authenticated' ? state.user.id : ''
  const { overview, overviewSettingsOpen, overviewCreating, setOverviewCreating } = useView()
  return <>
    {overviewSettingsOpen ? <OverviewSettings userId={userId} /> : null}
    {overviewCreating && overview.status === 'ready' ? <OverviewTarget /> : null}
    {overviewCreating && overview.status !== 'ready' ? <Sheet title="Zielliste wählen" onClose={() => setOverviewCreating(false)}>
      <div className="space-y-3 p-5"><p role="status">Die verfügbaren Listen müssen zuerst geladen werden.</p><Button variant="secondary" onClick={overview.retry}>Erneut versuchen</Button></div>
    </Sheet> : null}
  </>
}
