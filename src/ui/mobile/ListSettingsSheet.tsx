import { useState, type FormEvent } from 'react'
import { useBackLayer } from '../../app/useBackLayer'
import { useWorkspace } from '../../app/useWorkspace'
import type { LocalList } from '../../domain/types'
import { SharePanel } from '../SharePanel'
import { dangerButton, errorMessage, input, primaryButton, secondaryButton } from '../styles'
import { CloseIcon } from './icons'

/**
 * Verwaltung der aktuellen Liste – umbenennen, teilen, löschen oder verlassen.
 *
 * Auf dem Telefon ist die App-Leiste der einzige Ort, an dem die Liste
 * sichtbar ist; deshalb öffnet ein Tippen auf ihren Namen diese Ansicht.
 * Das entspricht dem Muster der Aufgaben: antippen öffnet die Details, in
 * denen auch gelöscht wird.
 *
 * Was jemand darf, hängt an der Rolle: Nur der Besitzer kann umbenennen,
 * teilen und löschen. Wer nur Mitglied ist, kann die Liste verlassen.
 */

type Modus = 'menue' | 'umbenennen' | 'teilen' | 'loeschen' | 'verlassen'

export function ListSettingsSheet({
  list,
  currentUserId,
  onClose,
}: {
  list: LocalList
  currentUserId: string
  onClose: () => void
}) {
  const { repositories } = useWorkspace()
  const [modus, setModus] = useState<Modus>('menue')
  const [name, setName] = useState(list.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const istBesitzer = list.owner_id === currentUserId

  // Die Zurück-Taste schließt zuerst das Unterformular, dann die Ansicht.
  useBackLayer(true, () => {
    if (modus === 'menue') onClose()
    else setModus('menue')
  })

  /** Führt eine Aktion aus und schließt danach – Fehler bleiben sichtbar. */
  const ausfuehren = async (aktion: () => Promise<unknown>) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await aktion()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Die Aktion ist fehlgeschlagen.')
      setBusy(false)
    }
  }

  const umbenennen = (event: FormEvent) => {
    event.preventDefault()
    void ausfuehren(() => repositories.renameList(list.id, name))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Liste verwalten"
    >
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" onClick={onClose} />

      <div className="safe-bottom relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl border-t border-neutral-800 bg-neutral-900 md:max-w-lg md:rounded-2xl md:border">
        <header className="flex items-start justify-between gap-2 border-b border-neutral-800 px-4 py-3">
          <div className="min-w-0">
            <h2 className="break-words text-sm font-medium text-neutral-100" data-testid="list-sheet-title">
              {list.name}
            </h2>
            <p className="text-xs text-neutral-500">
              {istBesitzer ? 'Deine Liste' : 'Von jemand anderem geteilt'}
            </p>
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
          {modus === 'menue' ? (
            <div className="space-y-2">
              {istBesitzer ? (
                <>
                  <button
                    type="button"
                    className={`${secondaryButton} w-full`}
                    onClick={() => setModus('umbenennen')}
                  >
                    Umbenennen
                  </button>
                  <button
                    type="button"
                    className={`${secondaryButton} w-full`}
                    onClick={() => setModus('teilen')}
                  >
                    Teilen
                  </button>
                  <button
                    type="button"
                    className={`${dangerButton} w-full`}
                    onClick={() => setModus('loeschen')}
                  >
                    Liste löschen
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={`${dangerButton} w-full`}
                  onClick={() => setModus('verlassen')}
                >
                  Liste verlassen
                </button>
              )}
            </div>
          ) : null}

          {modus === 'umbenennen' ? (
            <form onSubmit={umbenennen} className="space-y-3" aria-label="Liste umbenennen">
              <label htmlFor="list-rename" className="block text-xs text-neutral-400">
                Neuer Name
              </label>
              <input
                id="list-rename"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className={input}
              />
              <div className="flex gap-2">
                <button type="submit" className={`${primaryButton} flex-1`} disabled={busy}>
                  Speichern
                </button>
                <button
                  type="button"
                  className={`${secondaryButton} flex-1`}
                  onClick={() => setModus('menue')}
                >
                  Abbrechen
                </button>
              </div>
            </form>
          ) : null}

          {modus === 'teilen' ? <SharePanel list={list} currentUserId={currentUserId} /> : null}

          {modus === 'loeschen' ? (
            <div className="space-y-3">
              <p className="text-sm text-neutral-300">
                Die Liste und alle ihre Aufgaben werden gelöscht. Rückgängig machen lässt sich das
                nicht.
              </p>
              <button
                type="button"
                className={`${dangerButton} w-full`}
                disabled={busy}
                onClick={() => void ausfuehren(() => repositories.deleteList(list.id))}
              >
                Wirklich löschen
              </button>
              <button
                type="button"
                className={`${secondaryButton} w-full`}
                onClick={() => setModus('menue')}
              >
                Abbrechen
              </button>
            </div>
          ) : null}

          {modus === 'verlassen' ? (
            <div className="space-y-3">
              <p className="text-sm text-neutral-300">
                Die Liste verschwindet aus deiner Ansicht. Die Aufgaben bleiben beim Besitzer.
              </p>
              <button
                type="button"
                className={`${dangerButton} w-full`}
                disabled={busy}
                onClick={() => void ausfuehren(() => repositories.leaveList(list.id, currentUserId))}
              >
                Wirklich verlassen
              </button>
              <button
                type="button"
                className={`${secondaryButton} w-full`}
                onClick={() => setModus('menue')}
              >
                Abbrechen
              </button>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className={`mt-3 break-words ${errorMessage}`}>
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
