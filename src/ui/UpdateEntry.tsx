import { useUpdate } from './useUpdate'
import { describeUpdateState, type UpdateTone } from '../updates/updateStatus'
import { attentionText, dangerText, ghostButton, mutedText, primaryButton, secondaryButton, statusTone } from './styles'

/**
 * Update-Status mit passender Aktion – ohne eigenes Fenster.
 *
 * Die Prüfung läuft direkt hier und das Ergebnis erscheint an derselben Stelle.
 * Ein Dialog für eine Abfrage, die eine Sekunde dauert, wäre ein unnötiger
 * Umweg.
 *
 * Wird im Menü (Telefon) benutzt; die breite Ansicht hat dafür eine kompakte
 * Schaltfläche im Kopfbereich.
 */

const toneClass: Record<UpdateTone, string> = {
  muted: mutedText,
  ok: statusTone.ok.text,
  attention: attentionText,
  error: dangerText,
}

/** Dateigröße in MB, mit Komma – oder leer, wenn die Größe unbekannt ist. */
function formatSize(bytes: number): string {
  return bytes > 0 ? `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB` : ''
}

export function UpdateEntry() {
  const { state, check, install, installing, installError, canInstall } = useUpdate()
  const { text, tone } = describeUpdateState(state)
  const verfuegbar = state.status === 'available'

  return (
    <div>
      <p className={`mt-2 break-words text-xs ${toneClass[tone]}`} data-testid="update-status">
        {text}
      </p>

      {verfuegbar ? (
        <>
          {formatSize(state.release.sizeBytes) ? (
            <p className="mt-1 text-xs text-neutral-500">{formatSize(state.release.sizeBytes)}</p>
          ) : null}

          {state.release.notes.trim() !== '' ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-neutral-400">
                Was ist neu?
              </summary>
              <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-neutral-800 bg-neutral-950/60 p-2 text-xs text-neutral-400">
                {state.release.notes}
              </p>
            </details>
          ) : null}

          <button
            type="button"
            className={`${primaryButton} mt-3 w-full`}
            onClick={() => {
              void install()
            }}
            disabled={installing}
          >
            {installing ? 'Wird geladen …' : canInstall ? 'Installieren' : 'Herunterladen'}
          </button>

          {!canInstall ? (
            <p className="mt-2 text-xs text-neutral-500">
              Im Browser wird die Datei nur geladen. Installieren lässt sie sich in der App.
            </p>
          ) : null}
        </>
      ) : (
        <button
          type="button"
          className={`${secondaryButton} mt-3 w-full`}
          onClick={() => {
            void check()
          }}
          disabled={state.status === 'checking'}
        >
          Nach Updates suchen
        </button>
      )}

      {installError ? (
        <p className={`mt-2 break-words text-xs ${dangerText}`} data-testid="update-error">
          {installError}
        </p>
      ) : null}

      {/* Unsichtbar für die Oberfläche, aber im Fehlerfall hilfreich. */}
      {state.status === 'failed' ? (
        <button
          type="button"
          className={`${ghostButton} mt-2 w-full px-2 py-1 text-xs`}
          onClick={() => {
            void check()
          }}
        >
          Erneut versuchen
        </button>
      ) : null}
    </div>
  )
}
