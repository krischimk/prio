import { useState, type FormEvent } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import type { LocalList } from '../domain/types'
import { ListIcon } from './ListIcon'
import { errorMessage, input } from './styles'
import { appBackground } from './styles'
import { Button } from './components/Button'

/**
 * Seitenleiste mit allen sichtbaren Listen.
 *
 * Sichtbar sind genau die Listen, die lokal in der Datenbank des Benutzers
 * liegen – also die, die die Server-Policies freigegeben haben (eigene Listen
 * und gemeinsame Listen mit Mitgliedschaft).
 */
export function Sidebar({
  lists,
  selectedListId,
  onSelect,
  currentUserId,
}: {
  lists: LocalList[]
  selectedListId: string | null
  onSelect: (listId: string) => void
  currentUserId: string
}) {
  const { repositories } = useWorkspace()
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (creating || name.trim().length === 0) return
    setCreating(true)
    setError(null)
    try {
      const list = await repositories.createList(name, currentUserId)
      setName('')
      onSelect(list.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Liste konnte nicht erstellt werden.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <aside
      className={`h-screen w-72 shrink-0 overflow-y-auto border-r border-line ${appBackground} p-4`}
      aria-label="Listen"
    >
      <h2 className="mb-3 text-meta font-semibold uppercase tracking-wide text-ink-faint">Listen</h2>

      <ul className="mb-4 space-y-1" data-testid="list-of-lists">
        {lists.map((list) => {
          const selected = list.id === selectedListId
          return (
            <li key={list.id}>
              <button
                type="button"
                onClick={() => onSelect(list.id)}
                aria-current={selected ? 'true' : undefined}
                className={`flex w-full items-center justify-between gap-2 rounded-control px-2 py-2 text-left text-body ${
                  selected
                    ? 'bg-brand-tint/60 text-brand-faint'
                    : 'text-ink-soft hover:bg-surface hover:text-ink'
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                <ListIcon icon={list.icon} className="h-4 w-4 shrink-0" />
                <span className="truncate">{list.name}</span>
              </span>
                {list.is_shared ? (
                  <span className="shrink-0 text-meta text-brand-soft" title="Gemeinsame Liste">
                    geteilt
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
        {lists.length === 0 ? (
          <li className="px-2 py-1 text-body text-ink-faint">Noch keine Liste vorhanden.</li>
        ) : null}
      </ul>

      <form onSubmit={submit} className="space-y-2" aria-label="Neue Liste">
        <label htmlFor="new-list-name" className="sr-only">
          Name der neuen Liste
        </label>
        <input
          id="new-list-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Neue Liste"
          className={input}
        />
        <Button type="submit" variant="primary" layout="w-full" disabled={creating || name.trim().length === 0}>
          Liste anlegen
        </Button>
        {error ? (
          <p role="alert" className={errorMessage}>
            {error}
          </p>
        ) : null}
      </form>

      <p className="mt-4 text-meta text-ink-dim">
        Änderungen werden lokal gespeichert und später synchronisiert.
      </p>
    </aside>
  )
}
