import { useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/useAuth'
import { useBackLayer } from '../../app/useBackLayer'
import { useWorkspace } from '../../app/useWorkspace'
import { describeReminderState } from '../../reminders/reminderStatus'
import { describeSyncState } from '../../sync/syncStatus'
import type { LocalList } from '../../domain/types'
import { errorMessage, input } from '../styles'
import { BackendLabel } from '../BackendLabel'
import { ListIcon } from '../ListIcon'
import { UpdateEntry } from '../UpdateEntry'
import { CloseIcon } from '../icons'
import { appBackground } from '../styles'
import { IconButton } from '../components/IconButton'
import { Button } from '../components/Button'

/**
 * Ausklappbares Menü der mobilen Ansicht.
 *
 * Enthält alles, was nicht auf den Hauptbildschirm gehört: Listen, Konto,
 * Sync-Zustand und die Erinnerungen. Auf dem Telefon ist das der Ersatz für
 * die Seitenleiste der Desktop-Ansicht.
 */
export function MobileDrawer({
  open,
  onClose,
  lists,
  selectedListId,
  onSelectList,
  currentUserId,
  onOpenRestore,
}: {
  open: boolean
  onClose: () => void
  lists: LocalList[]
  selectedListId: string | null
  onSelectList: (listId: string) => void
  currentUserId: string
  onOpenRestore: () => void
}) {
  const { state, signOut } = useAuth()
  const { repositories, syncStatus, pendingCount, syncing, runSync, reminderStatus, enableReminders } =
    useWorkspace()

  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Die Zurück-Taste und Escape schließen das Menü – beides kommt aus dem
  // Zurück-Stapel (siehe `BackLayerProvider`), nicht aus dieser Komponente.
  useBackLayer(open, onClose)

  if (!open) return null

  const email = state.status === 'authenticated' ? state.user.email : ''
  const sync = describeSyncState(syncStatus, pendingCount, syncing)
  const reminders = describeReminderState(reminderStatus)

  const createList = async (event: FormEvent) => {
    event.preventDefault()
    if (creating || name.trim().length === 0) return
    setCreating(true)
    setError(null)
    try {
      const list = await repositories.createList(name, currentUserId)
      setName('')
      onSelectList(list.id)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Liste konnte nicht erstellt werden.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Menü">
      {/*
        Der Hintergrund schließt das Menü, ist aber kein Bedienelement:
        Er ist dekorativ (aria-hidden) und nicht per Tastatur erreichbar.
        Schließen geht über das X, die Zurück-Taste oder Escape – so gibt es
        nicht zwei Bedienelemente mit demselben Namen.
      */}
      <div
        className="absolute inset-0 cursor-default bg-page/60"
        aria-hidden="true"
        onClick={onClose}
      />

      <aside className={`safe-top safe-bottom absolute inset-y-0 left-0 flex w-80 max-w-[85%] flex-col overflow-y-auto border-r border-line ${appBackground}`}>
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="text-heading font-semibold tracking-tight text-ink-strong">Prio</span>
          <IconButton
           
            onClick={onClose}
            aria-label="Menü schließen"
            variant="icon"
          >
            <CloseIcon />
          </IconButton>
        </div>
        <div className="px-4 pb-4">
          <p className="truncate text-meta text-ink-faint" data-testid="drawer-user">
            {email}
          </p>
          <BackendLabel />
        </div>

        <section className="px-4 pb-4" aria-label="Listen">
          <h2 className="mb-2 text-meta font-semibold uppercase tracking-wide text-ink-faint">Listen</h2>
          <ul className="space-y-1">
            {lists.map((list) => {
              const selected = list.id === selectedListId
              return (
                <li key={list.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectList(list.id)
                      onClose()
                    }}
                    aria-current={selected ? 'true' : undefined}
                    className={`flex w-full items-center justify-between gap-2 rounded-control px-3 py-2 text-left text-body ${
                      selected ? 'bg-brand-tint/60 text-brand-faint' : 'text-ink-soft active:bg-surface'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <ListIcon icon={list.icon} className="h-4 w-4 shrink-0" />
                      <span className="truncate">{list.name}</span>
                    </span>
                    {list.is_shared ? <span className="shrink-0 text-meta text-brand-soft">geteilt</span> : null}
                  </button>
                </li>
              )
            })}
            {lists.length === 0 ? (
              <li className="px-3 py-1 text-body text-ink-faint">Noch keine Liste vorhanden.</li>
            ) : null}
          </ul>

          <form onSubmit={createList} className="mt-3 space-y-2" aria-label="Neue Liste">
            <label htmlFor="mobile-new-list" className="sr-only">
              Name der neuen Liste
            </label>
            <input
              id="mobile-new-list"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Neue Liste"
              className={input}
            />
            <Button
              type="submit"
              variant="primary" layout="w-full"
              disabled={creating || name.trim().length === 0}
            >
              Liste anlegen
            </Button>
            {error ? (
              <p role="alert" className={errorMessage}>
                {error}
              </p>
            ) : null}
          </form>
        </section>

        <section className="border-t border-line px-4 py-4" aria-label="Synchronisation">
          <h2 className="mb-2 text-meta font-semibold uppercase tracking-wide text-ink-faint">
            Synchronisation
          </h2>
          <p className="text-meta text-ink-muted" data-testid="drawer-sync">
            {sync.text}
          </p>
          <Button
           
            variant="secondary" layout="mt-2 w-full"
            onClick={() => {
              void runSync()
            }}
            disabled={syncing}
          >
            Jetzt synchronisieren
          </Button>
        </section>

        <section className="border-t border-line px-4 py-4" aria-label="Einstellungen">
          <h2 className="mb-2 text-meta font-semibold uppercase tracking-wide text-ink-faint">
            Einstellungen
          </h2>
          {reminders.text ? <p className="mb-2 text-meta text-ink-muted">{reminders.text}</p> : null}
          {reminders.canEnable ? (
            <Button
             
              variant="secondary" layout="w-full"
              onClick={() => {
                void enableReminders()
              }}
            >
              Erinnerungen aktivieren
            </Button>
          ) : null}
          {!reminders.available ? (
            <p className="text-meta text-ink-faint">Erinnerungen sind auf diesem Gerät nicht verfügbar.</p>
          ) : null}

          <Button
           
            variant="secondary" layout="mt-3 w-full"
            onClick={onOpenRestore}
          >
            Aufgaben wiederherstellen
          </Button>
        </section>

        <section className="border-t border-line px-4 py-4" aria-label="Updates">
          <h3 className="text-meta font-medium uppercase tracking-wide text-ink-faint">Updates</h3>
          <UpdateEntry />
        </section>

        <div className="mt-auto border-t border-line px-4 py-4">
          <Button
           
            variant="secondary" layout="w-full"
            onClick={() => {
              void signOut()
            }}
          >
            Abmelden
          </Button>
        </div>
      </aside>
    </div>
  )
}
