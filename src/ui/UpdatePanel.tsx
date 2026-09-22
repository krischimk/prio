import { useBackLayer } from '../app/useBackLayer'
import { RELEASE_REPO } from '../updates/updateCheck'
import { CloseIcon } from './mobile/icons'
import { dangerText, ghostButton, primaryButton } from './styles'
import { useUpdate } from './useUpdate'

/** Dateigröße in MB, mit Komma – oder leer, wenn die Größe unbekannt ist. */
function formatSize(bytes: number): string {
  if (bytes <= 0) return ''
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/**
 * „Nach Updates suchen“.
 *
 * In der App lässt sich die neue Fassung direkt laden und installieren; im
 * Browser bleibt nur der Verweis auf die Veröffentlichung.
 */
export function UpdatePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, check, install, installing, installError, canInstall } = useUpdate()

  useBackLayer(open, onClose)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Nach Updates suchen"
    >
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" onClick={onClose} />

      <div className="safe-bottom relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl border-t border-neutral-800 bg-neutral-900 md:max-w-lg md:rounded-2xl md:border">
        <header className="flex items-start justify-between gap-2 border-b border-neutral-800 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-neutral-100">Nach Updates suchen</h2>
            <p className="text-xs text-neutral-500">Quelle: github.com/{RELEASE_REPO}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-md p-2 text-neutral-400 active:bg-neutral-800"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="scroll-area flex-1 overflow-y-auto px-4 py-4">
          {state.status === 'checking' ? (
            <p className="text-sm text-neutral-400" data-testid="update-status">
              Suche nach Updates …
            </p>
          ) : null}

          {state.status === 'idle' ? (
            <p className="text-sm text-neutral-400" data-testid="update-status">
              Noch nicht geprüft.
            </p>
          ) : null}

          {state.status === 'up-to-date' ? (
            <p className="text-sm text-neutral-300" data-testid="update-status">
              prio {state.latest} ist die neueste Fassung.
            </p>
          ) : null}

          {state.status === 'failed' ? (
            <p className={`break-words text-sm ${dangerText}`} data-testid="update-status">
              {state.message}
            </p>
          ) : null}

          {state.status === 'available' ? (
            <div data-testid="update-available">
              <p className="text-sm text-neutral-100">
                Version <span className="font-medium">{state.release.version}</span> ist verfügbar –
                installiert ist {state.current}.
              </p>
              {formatSize(state.release.sizeBytes) ? (
                <p className="mt-1 text-xs text-neutral-500">
                  {formatSize(state.release.sizeBytes)}
                </p>
              ) : null}

              {state.release.notes.trim() !== '' ? (
                <div className="mt-3 max-h-48 overflow-y-auto rounded-md border border-neutral-800 bg-neutral-950/60 p-3">
                  <p className="whitespace-pre-wrap break-words text-xs text-neutral-400">
                    {state.release.notes}
                  </p>
                </div>
              ) : null}

              {!canInstall ? (
                <p className="mt-3 text-xs text-neutral-500">
                  Im Browser wird die Datei nur heruntergeladen. Installieren lässt sie sich in der
                  App.
                </p>
              ) : null}
            </div>
          ) : null}

          {installError ? (
            <p className={`mt-3 break-words text-xs ${dangerText}`} data-testid="update-error">
              {installError}
            </p>
          ) : null}
        </div>

        <div className="flex gap-2 border-t border-neutral-800 px-4 py-3">
          {state.status === 'available' ? (
            <button
              type="button"
              className={`${primaryButton} min-w-0 flex-1`}
              onClick={() => {
                void install()
              }}
              disabled={installing}
            >
              {installing ? 'Wird geladen …' : canInstall ? 'Installieren' : 'Herunterladen'}
            </button>
          ) : null}
          <button
            type="button"
            className={`${ghostButton} min-w-0 flex-1`}
            onClick={() => {
              void check()
            }}
            disabled={state.status === 'checking'}
          >
            Erneut suchen
          </button>
        </div>
      </div>
    </div>
  )
}
