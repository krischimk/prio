import { useAuth } from '../../auth/useAuth'
import { useWorkspace } from '../../app/useWorkspace'
import { describeReminderState } from '../status/reminderStatus'
import { describeSyncState } from '../status/syncStatus'
import type { LocalList } from '../../domain/types'
import { focusRing, layer } from '../styles'
import { AppBrand } from '../AppBrand'
import { UpdateEntry } from '../UpdateEntry'
import { CloseIcon, UserIcon, BellIcon, RestoreIcon, SyncIcon, OverviewIcon, AlertIcon } from '../icons'
import { appBackground, numeric, statusTone } from '../styles'
import { isNativeApp } from '../../app/platform'
import { IconButton } from '../components/IconButton'
import { Button } from '../components/Button'
import type { DialogVerhalten } from '../components/useDialog'
import { useView } from '../useView'
import { NewListComposer } from '../NewListComposer'
import { ThemeToggle } from '../ThemeToggle'
import { ListNavigation } from '../ListNavigation'
import type { RefObject } from 'react'

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
  draggingTask = false,
  visible,
  panelRef,
  sheetRef,
  onKeyDown,
}: {
  open: boolean
  onClose: () => void
  lists: LocalList[]
  selectedListId: string | null
  onSelectList: (listId: string | null) => void
  currentUserId: string
  onOpenRestore: () => void
  draggingTask?: boolean
  visible: boolean
  panelRef: RefObject<HTMLDivElement | null>
  sheetRef: RefObject<HTMLElement | null>
  onKeyDown: DialogVerhalten<HTMLDivElement>['onKeyDown']
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

  const email = state.status === 'authenticated' ? state.user.email : ''
  const sync = describeSyncState(syncStatus, pendingCount, syncing, rejectedCount, cloudConflicts.length)
  const reminders = describeReminderState(reminderStatus)

  return (
    // Geschlossen ist das Menü sofort inaktiv; sichtbar bleibt nur die Animation.
    <div
      ref={panelRef}
      role="dialog"
      aria-hidden={!open}
      inert={!open}
      aria-modal={draggingTask ? undefined : true}
      aria-label="Menü"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      data-drawer-visible={visible || open}
      className={`mobile-drawer fixed inset-0 outline-none ${layer.raised}`}
    >
      {/*
        Der Hintergrund schließt das Menü, ist aber kein Bedienelement:
        Er ist dekorativ (aria-hidden) und nicht per Tastatur erreichbar.
        Schließen geht über das X, die Zurück-Taste oder Escape – so gibt es
        nicht zwei Bedienelemente mit demselben Namen.
      */}
      <div
        className="drawer-scrim absolute inset-0 cursor-default bg-scrim/60"
        aria-hidden="true"
        onClick={onClose}
      />

      <aside ref={sheetRef} data-testid="drawer-sheet" className={`drawer-sheet safe-top safe-bottom absolute inset-y-0 left-0 flex w-80 max-w-[85%] flex-col overflow-y-auto border-r border-line ${appBackground}`}>
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
          <ListNavigation lists={lists} selectedListId={selectedListId} currentUserId={currentUserId}
            onSelect={id => { onSelectList(id); onClose() }} />

          {/* Der Entwurf liegt im Provider; modale Unteransichten enden mit dem Menü. */}
          <div className="mt-3"><NewListComposer key={open ? 'open' : 'closed'} currentUserId={currentUserId} onCreated={id => { onSelectList(id); onClose() }} /></div>
        </section>

        <section className="border-t border-line px-4 py-2" aria-label="Synchronisation">
          <div className="flex min-h-11 items-center justify-between gap-2">
          <p className={`text-meta ${statusTone[sync.tone].text} ${numeric}`} data-testid="drawer-sync">
            <span data-testid="sync-status">{sync.text}</span>
          </p>
          <IconButton aria-label="Jetzt synchronisieren" disabled={syncing} onClick={() => void runSync()}><SyncIcon /></IconButton>
          </div>
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
        </section>

        {reminders.canEnable || reminders.tone === 'error' || !reminders.available ? <section className="border-t border-line px-4 py-3" aria-label="Erinnerungen">
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

        </section> : null}
        <section className="border-t border-line px-4 py-3" aria-label="Wiederherstellen">
          <Button variant="ghost" layout="w-full justify-start" onClick={onOpenRestore}><RestoreIcon />Aufgaben wiederherstellen</Button>
        </section>

        {isNativeApp() ? <section className="border-t border-line px-4 py-4" aria-label="Updates">
          <h3 className="text-meta font-medium uppercase tracking-wide text-ink-faint">Updates</h3>
          <UpdateEntry />
        </section> : null}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line px-4 py-2">
          <Button variant="ghost" layout="flex-1 justify-start" onClick={() => { onClose(); setAccountOpen(true) }}><UserIcon />Konto</Button>
          <ThemeToggle />
        </div>
      </aside>
    </div>
  )
}
