import { useContext, useId, useState, type FormEvent } from 'react'
import { useRepositories } from '../app/useWorkspace'
import { TaskDraftContext } from './taskDraftContext'
import { useExpandableForm } from './useExpandableForm'
import { ListIcon } from './ListIcon'
import { ListIconChoice } from './ListIconPicker'
import { ListOverviewField } from './ListOverviewChoice'
import { ListCompletionField } from './ListCompletionChoice'
import { ListRatingField } from './ListRatingChoice'
import { ListDuplicateField } from './ListDuplicateChoice'
import { Button } from './components/Button'
import { IconButton } from './components/IconButton'
import { Sheet } from './components/Sheet'
import { IconChoiceIcon, PlusIcon } from './icons'
import { errorMessage, input } from './styles'

/** Ein Listenentwurf für Menü und Seitenleiste; Speichern ist eine Transaktion. */
export function NewListComposer({ currentUserId, onCreated }: { currentUserId: string; onCreated: (id: string) => void }) {
  const repositories = useRepositories()
  const drafts = useContext(TaskDraftContext)!
  const draft = drafts.newList
  const id = useId()
  const { container, focused, focus, blur } = useExpandableForm()
  const [pickingIcon, setPickingIcon] = useState(false)
  const expanded = focused || pickingIcon || draft.name.length > 0 || draft.icon !== null || draft.includeInOverview || draft.keepCompleted
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.name.trim() || !drafts.beginListSave()) return
    try {
      const list = await repositories.createList(draft.name, currentUserId, {
        icon: draft.icon, includeInOverview: draft.includeInOverview, keepCompleted: draft.keepCompleted, ratingsEnabled: draft.ratingsEnabled, allowDuplicateTitles: draft.allowDuplicateTitles,
      })
      drafts.listSaved()
      onCreated(list.id)
    } catch (cause) { drafts.listFailed(cause instanceof Error ? cause.message : 'Liste konnte nicht erstellt werden.') }
  }
  return <>
    <form ref={container} onSubmit={event => { void submit(event) }} onFocusCapture={focus} onBlurCapture={blur} className="space-y-2" aria-label="Neue Liste">
      <div className="flex items-center gap-1">
        <label htmlFor={id} className="sr-only">Name der neuen Liste</label>
        <input id={id} value={draft.name} disabled={draft.busy} onChange={event => drafts.changeNewList({ name: event.target.value })}
          placeholder="Neue Liste" className={`${input} min-w-0 flex-1`} />
        {expanded ? <IconButton aria-label="Symbol der neuen Liste auswählen" title="Symbol für die neue Liste auswählen" disabled={draft.busy} onClick={() => setPickingIcon(true)} layout="shrink-0">
          {draft.icon ? <ListIcon icon={draft.icon} className="h-5 w-5" /> : <IconChoiceIcon />}
        </IconButton> : null}
      </div>
      {expanded ? <div className="space-y-2 pb-2" role="group" aria-label="Einstellungen der neuen Liste">
        <ListOverviewField included={draft.includeInOverview} disabled={draft.busy} onChange={includeInOverview => drafts.changeNewList({ includeInOverview })} />
        <ListCompletionField keep={draft.keepCompleted} disabled={draft.busy} onChange={keepCompleted => drafts.changeNewList({ keepCompleted })} />
        <ListRatingField enabled={draft.ratingsEnabled} disabled={draft.busy} onChange={ratingsEnabled => drafts.changeNewList({ ratingsEnabled })} />
        <ListDuplicateField allowed={draft.allowDuplicateTitles} disabled={draft.busy} onChange={allowDuplicateTitles => drafts.changeNewList({ allowDuplicateTitles })} />
      </div> : null}
      <Button type="submit" variant="primary" layout="w-full" disabled={draft.busy || !draft.name.trim()}><PlusIcon />Liste anlegen</Button>
      {draft.error ? <p role="alert" className={errorMessage}>{draft.error}</p> : null}
    </form>
    {pickingIcon ? <Sheet title="Symbol auswählen" name="neue-liste-symbol" onClose={() => setPickingIcon(false)}>
      <ListIconChoice icon={draft.icon} onPick={icon => { drafts.changeNewList({ icon }); setPickingIcon(false) }} />
    </Sheet> : null}
  </>
}
