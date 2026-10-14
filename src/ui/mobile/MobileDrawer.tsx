import { useAuth } from '../../auth/useAuth'
import { useWorkspace } from '../../app/useWorkspace'
import { describeReminderState } from '../status/reminderStatus'
import { describeSyncState } from '../status/syncStatus'
import type { LocalList } from '../../domain/types'
import { focusRing, layer } from '../styles'
import { AppBrand } from '../AppBrand'
import { ListIcon } from '../ListIcon'
import { UpdateEntry } from '../UpdateEntry'
import { CloseIcon, UserIcon, BellIcon, RestoreIcon, SyncIcon, OverviewIcon, AlertIcon } from '../icons'
import { appBackground, numeric, statusTone } from '../styles'
import { isNativeApp } from '../../app/platform'
import { leerListen } from '../emptyTexts'
import { IconButton } from '../components/IconButton'
import { Button } from '../components/Button'
import { useDialog } from '../components/useDialog'
import { useView } from '../useView'
import { NewListComposer } from '../NewListComposer'

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
  onSelectList: (listId: string | null) => void
  currentUserId: string
  onOpenRestore: () => void
}) {
  const { state } = useAuth()
  const {
    syncStatus,
    pendingCount,
    rejectedCount,
    syncing,
    runSync,
    reminderStatus,
    enableReminders,
  } = useWorkspace()

  const { cloudConflicts, setConflictsOpen, setAccountOpen } = useView()

  // Zurück-Taste, Escape, Fokus und Rolle kommen aus `useDialog` – dasselbe
  // Verhalten wie bei Blatt und Detailansicht. `active: open`, weil das Menü
  // immer eingebunden ist, aber meistens zu.
  const { panel, onKeyDown } = useDialog<HTMLDivElement>({ active: open, onClose })

  if (!open) return null

  const email = state.status === 'authenticated' ? state.user.email : ''
  const sync = describeSyncState(syncStatus, pendingCount, syncing, rejectedCount, cloudConflicts.length)
  const reminders = describeReminderState(reminderStatus)

  return (
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label="Menü"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={`fixed inset-0 outline-none ${layer.raised}`}
    >
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
          <AppBrand />
          <IconButton
            onClick={onClose}
            aria-label="Menü schließen"
            variant="icon"
          >
            <CloseIcon />
          </IconButton>
        </div>
        <div className="px-4 pb-3"><span className="sr-only" data-testid="drawer-user">{email}</span></div>

        <section className="px-4 pb-4" aria-label="Listen">
          <button type="button" aria-current={selectedListId === null ? 'page' : undefined} onClick={() => { onSelectList(null); onClose() }}
            className={`${focusRing} mb-3 flex w-full items-center gap-2 rounded-control px-3 py-3 text-left text-body ${selectedListId === null ? 'bg-brand-tint/60 text-brand-faint' : 'text-ink-soft active:bg-surface'}`}>
            <OverviewIcon />Gesamtansicht
          </button>
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
                    className={`${focusRing} flex w-full items-center justify-between gap-2 rounded-control px-3 py-2 text-left text-body ${
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
              <li className="px-3 py-1 text-body text-ink-faint">{leerListen('mobil')}</li>
            ) : null}
          </ul>

          <div className="mt-3"><NewListComposer currentUserId={currentUserId} onCreated={id => { onSelectList(id); onClose() }} /></div>
        </section>

        <section className="border-t border-line px-4 py-4" aria-label="Synchronisation">
          <h2 className="mb-2 text-meta font-semibold uppercase tracking-wide text-ink-faint">
            Synchronisation
          </h2>
          <p className={`text-meta ${statusTone[sync.tone].text} ${numeric}`} data-testid="drawer-sync">
            <span data-testid="sync-status">{sync.text}</span>
          </p>
          {cloudConflicts.length > 0 ? (
            <Button
              variant="secondary" layout="mt-2 w-full"
              onClick={() => {
                onClose()
                setConflictsOpen(true)
              }}
            >
              <AlertIcon />Konflikte klären
            </Button>
          ) : null}
          <Button
            variant="secondary" layout="mt-2 w-full"
            onClick={() => {
              void runSync()
            }}
            disabled={syncing}
          >
            <SyncIcon />Jetzt synchronisieren
          </Button>
        </section>

        <section className="border-t border-line px-4 py-4" aria-label="Erinnerungen">
          <h2 className="mb-2 flex items-center gap-2 text-meta font-semibold uppercase tracking-wide text-ink-faint">
            <BellIcon />Erinnerungen
          </h2>
          {reminders.text ? <p className="mb-2 text-meta text-ink-muted">{reminders.text}</p> : null}
          {reminders.canEnable ? (
            <Button
              variant="secondary" layout="w-full"
              onClick={() => {
                void enableReminders()
              }}
            >
              <BellIcon />Erinnerungen aktivieren
            </Button>
          ) : null}
          {!reminders.available ? (
            <p className="text-meta text-ink-faint">Erinnerungen sind auf diesem Gerät nicht verfügbar.</p>
          ) : null}

        </section>
        <section className="border-t border-line px-4 py-3" aria-label="Wiederherstellen">
          <Button variant="ghost" layout="w-full justify-start" onClick={onOpenRestore}><RestoreIcon />Aufgaben wiederherstellen</Button>
        </section>

        {isNativeApp() ? <section className="border-t border-line px-4 py-4" aria-label="Updates">
          <h3 className="text-meta font-medium uppercase tracking-wide text-ink-faint">Updates</h3>
          <UpdateEntry />
        </section> : null}

        <div className="mt-auto border-t border-line px-4 py-4">
          <Button variant="ghost" layout="w-full justify-start" onClick={() => { onClose(); setAccountOpen(true) }}><UserIcon />Konto</Button>
        </div>
      </aside>
    </div>
  )
}
