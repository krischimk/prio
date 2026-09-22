import { useState, type FormEvent } from 'react'
import { useWorkspace } from '../app/useWorkspace'
import type { LocalList } from '../domain/types'
import { errorMessage, input, primaryButton } from './styles'

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
      className="shrink-0 border-b border-neutral-800 bg-neutral-950 p-4 md:h-screen md:w-72 md:overflow-y-auto md:border-b-0 md:border-r"
      aria-label="Listen"
    >
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Listen</h2>

      <ul className="mb-4 space-y-1" data-testid="list-of-lists">
        {lists.map((list) => {
          const selected = list.id === selectedListId
          return (
            <li key={list.id}>
              <button
                type="button"
                onClick={() => onSelect(list.id)}
                aria-current={selected ? 'true' : undefined}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm ${
                  selected
                    ? 'bg-indigo-950/60 text-indigo-100'
                    : 'text-neutral-300 hover:bg-neutral-900 hover:text-neutral-100'
                }`}
              >
                <span className="truncate">{list.name}</span>
                {list.is_shared ? (
                  <span className="shrink-0 text-xs text-indigo-400" title="Gemeinsame Liste">
                    geteilt
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
        {lists.length === 0 ? (
          <li className="px-2 py-1 text-sm text-neutral-500">Noch keine Liste vorhanden.</li>
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
        <button type="submit" className={`${primaryButton} w-full`} disabled={creating || name.trim().length === 0}>
          Liste anlegen
        </button>
        {error ? (
          <p role="alert" className={errorMessage}>
            {error}
          </p>
        ) : null}
      </form>

      <p className="mt-4 text-xs text-neutral-600">
        Änderungen werden lokal gespeichert und später synchronisiert.
      </p>
    </aside>
  )
}
