import { useUpdate } from './useUpdate'
import { Markdown } from './Markdown'
import { describeUpdateState, type UpdateTone } from './status/updateStatus'
import { attentionText, dangerText, mutedText, statusTone } from './styles'
import { Button } from './components/Button'

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
      <p className={`mt-2 break-words text-meta ${toneClass[tone]}`} data-testid="update-status">
        {text}
      </p>

      {verfuegbar ? (
        <>
          {formatSize(state.release.sizeBytes) ? (
            <p className="mt-1 text-meta text-ink-faint">{formatSize(state.release.sizeBytes)}</p>
          ) : null}

          {state.release.notes.trim() !== '' ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-meta text-ink-muted">
                Was ist neu?
              </summary>
              <div className="scroll-flaeche mt-2 max-h-40 overflow-y-auto rounded-control border border-line bg-page/60 p-2">
                <Markdown text={state.release.notes} className="break-words text-ink-muted" />
              </div>
            </details>
          ) : null}

          <Button
            variant="primary" layout="mt-3 w-full"
            onClick={() => {
              void install()
            }}
            disabled={installing}
          >
            {installing ? 'Wird geladen …' : canInstall ? 'Installieren' : 'Herunterladen'}
          </Button>

          {!canInstall ? (
            <p className="mt-2 text-meta text-ink-faint">
              Im Browser wird die Datei nur geladen. Installieren lässt sie sich in der App.
            </p>
          ) : null}
        </>
      ) : (
        <Button
          variant="secondary" layout="mt-3 w-full"
          onClick={() => {
            void check()
          }}
          disabled={state.status === 'checking'}
        >
          Nach Updates suchen
        </Button>
      )}

      {installError ? (
        <p className={`mt-2 break-words text-meta ${dangerText}`} data-testid="update-error">
          {installError}
        </p>
      ) : null}

      {/* Unsichtbar für die Oberfläche, aber im Fehlerfall hilfreich. */}
      {state.status === 'failed' ? (
        <Button
          variant="ghost" size="sm" layout="mt-2 w-full"
          onClick={() => {
            void check()
          }}
        >
          Erneut versuchen
        </Button>
      ) : null}
    </div>
  )
}
