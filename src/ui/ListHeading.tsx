import { useEffect, useRef, useState } from 'react'
import type { LocalList } from '../domain/types'
import { useIsDesktop } from '../app/useIsDesktop'
import { useWorkspace } from '../app/useWorkspace'
import { useListNameDraft } from './useListNameDraft'
import { ListIcon } from './ListIcon'
import { IconChoiceIcon, PlusIcon } from './icons'
import { ListSettingsSheet } from './ListSettingsSheet'
import { focusRing, errorMessage } from './styles'
import { Hint } from './components/Hint'

/** Direkte Bearbeitung im Kopf; die Seitenleiste bleibt reine Navigation. */
export function ListHeading({ list, currentUserId, main = false }: {
  list: LocalList; currentUserId: string; main?: boolean
}) {
  const desktop = useIsDesktop()
  const { repositories } = useWorkspace()
  const { name, setName, discard } = useListNameDraft(list)
  const editable = desktop && list.owner_id === currentUserId
  const [editing, setEditing] = useState<'symbol' | 'umbenennen' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const writing = useRef(false)
  const cancelled = useRef(false)
  const renameInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editing === 'umbenennen') { renameInput.current?.focus(); renameInput.current?.select() }
  }, [editing])
  const beginRename = () => {
    cancelled.current = false; setError(null); setEditing('umbenennen')
  }
  const saveName = async () => {
    if (writing.current || cancelled.current) return
    writing.current = true; setBusy(true); setError(null)
    try {
      if (name !== list.name) await repositories.renameList(list.id, name)
      discard(); setEditing(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Der Listenname konnte nicht gespeichert werden.')
      renameInput.current?.focus()
    } finally { writing.current = false; setBusy(false) }
  }
  const iconClass = `${main ? 'size-7' : 'size-icon'} shrink-0 text-brand-soft`
  const editableIcon = editable
  const icon = list.icon ? <ListIcon icon={list.icon} className={iconClass} /> : editableIcon ? <span className="relative inline-flex text-ink-faint">
    <IconChoiceIcon className={main ? 'size-7' : 'size-icon'} /><PlusIcon className="absolute -bottom-1 -right-1 size-icon-meta rounded-full bg-page" />
  </span> : null
  const title = <span data-testid={main ? 'list-title' : undefined} className="break-words">{list.name}</span>
  const Title = main ? 'h1' : 'h2'
  return <>
    <div className="flex min-w-0 items-center gap-2">
      {editableIcon ? <Hint text={`Symbol von „${list.name}“ ändern`}><button type="button" aria-label={`Symbol von ${list.name} ändern`}
        onClick={() => setEditing('symbol')} className={`${focusRing} inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-control hover:bg-surface active:bg-raised`}>{icon}</button></Hint> : icon}
      <Title className={`min-w-0 font-semibold text-ink-strong ${main ? 'text-heading tracking-tight' : 'text-list-heading'}`}>
        {editing === 'umbenennen' ? <input ref={renameInput} aria-label="Neuer Listenname" aria-invalid={Boolean(error)}
          title="Enter oder Klick daneben speichert. Escape verwirft die Änderung."
          value={name} size={Math.max(4, name.length + 1)} disabled={busy}
          className={`${focusRing} min-h-11 min-w-0 max-w-full rounded-control border border-line-strong bg-surface px-2`}
          onChange={event => setName(event.target.value)} onBlur={() => void saveName()}
          onKeyDown={event => {
            if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); void saveName() }
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelled.current = true; discard(); setEditing(null); setError(null) }
          }} /> : editable ? <button type="button" aria-label={`Liste ${list.name} umbenennen`}
          title={editable ? 'Doppelklick zum Umbenennen' : undefined}
          className={`${focusRing} min-h-11 rounded-control text-left hover:text-brand-soft`}
          onClick={event => { if (event.detail === 0) beginRename() }} onDoubleClick={beginRename}>{title}</button> : title}
      </Title>
    </div>
    {error ? <p role="alert" className={errorMessage}>{error}</p> : null}
    {editing === 'symbol' ? <ListSettingsSheet list={list} currentUserId={currentUserId} initialMode="symbol" onClose={() => setEditing(null)} /> : null}
  </>
}
