import { useState, type FormEvent } from 'react'
import { useBackLayer } from '../../app/useBackLayer'
import { useWorkspace } from '../../app/useWorkspace'
import type { LocalList } from '../../domain/types'
import { ListIcon } from '../ListIcon'
import { ListIconPicker } from '../ListIconPicker'
import { SharePanel } from '../SharePanel'
import { SectionsPanel } from '../SectionsPanel'
import { errorMessage, input } from '../styles'
import { CloseIcon } from '../icons'
import { IconButton } from '../components/IconButton'
import { Button } from '../components/Button'

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

type Modus = 'menue' | 'umbenennen' | 'symbol' | 'bereiche' | 'teilen' | 'loeschen' | 'verlassen'

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
      <div className="absolute inset-0 bg-page/60" aria-hidden="true" onClick={onClose} />

      <div className="safe-bottom relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-sheet border-t border-line bg-surface md:max-w-lg md:rounded-sheet md:border">
        <header className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <ListIcon icon={list.icon} className="h-5 w-5 shrink-0 text-ink-soft" />
            <div className="min-w-0">
              <h2 className="break-words text-body font-medium text-ink" data-testid="list-sheet-title">
                {list.name}
              </h2>
              <p className="text-meta text-ink-faint">
                {istBesitzer ? 'Deine Liste' : 'Von jemand anderem geteilt'}
              </p>
            </div>
          </div>
          <IconButton
           
            onClick={onClose}
            aria-label="Schließen"
            variant="icon"
          >
            <CloseIcon />
          </IconButton>
        </header>

        <div className="scroll-area flex-1 overflow-y-auto px-4 py-4">
          {modus === 'menue' ? (
            <div className="space-y-2">
              {istBesitzer ? (
                <>
                  <Button
                   
                    variant="secondary" layout="w-full"
                    onClick={() => setModus('umbenennen')}
                  >
                    Umbenennen
                  </Button>
                  <Button
                   
                    variant="secondary" layout="w-full"
                    onClick={() => setModus('symbol')}
                  >
                    Symbol ändern
                  </Button>
                  <Button
                   
                    variant="secondary" layout="w-full"
                    onClick={() => setModus('bereiche')}
                  >
                    Bereiche
                  </Button>
                  <Button
                   
                    variant="secondary" layout="w-full"
                    onClick={() => setModus('teilen')}
                  >
                    Teilen
                  </Button>
                  <Button
                   
                    variant="danger" layout="w-full"
                    onClick={() => setModus('loeschen')}
                  >
                    Liste löschen
                  </Button>
                </>
              ) : (
                <Button
                 
                  variant="danger" layout="w-full"
                  onClick={() => setModus('verlassen')}
                >
                  Liste verlassen
                </Button>
              )}
            </div>
          ) : null}

          {modus === 'umbenennen' ? (
            <form onSubmit={umbenennen} className="space-y-3" aria-label="Liste umbenennen">
              <label htmlFor="list-rename" className="block text-meta text-ink-muted">
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
                <Button type="submit" variant="primary" layout="flex-1" disabled={busy}>
                  Speichern
                </Button>
                <Button
                 
                  variant="secondary" layout="flex-1"
                  onClick={() => setModus('menue')}
                >
                  Abbrechen
                </Button>
              </div>
            </form>
          ) : null}

          {modus === 'symbol' ? <ListIconPicker list={list} onPicked={onClose} /> : null}

          {modus === 'teilen' ? <SharePanel list={list} currentUserId={currentUserId} /> : null}

          {modus === 'loeschen' ? (
            <div className="space-y-3">
              <p className="text-body text-ink-soft">
                Die Liste und alle ihre Aufgaben werden gelöscht. Rückgängig machen lässt sich das
                nicht.
              </p>
              <Button
               
                variant="danger" layout="w-full"
                disabled={busy}
                onClick={() => void ausfuehren(() => repositories.deleteList(list.id))}
              >
                Wirklich löschen
              </Button>
              <Button
               
                variant="secondary" layout="w-full"
                onClick={() => setModus('menue')}
              >
                Abbrechen
              </Button>
            </div>
          ) : null}

          {modus === 'bereiche' ? (
            <div className="space-y-3">
              <SectionsPanel list={list} />
              <Button
               
                variant="secondary" layout="w-full"
                onClick={() => setModus('menue')}
              >
                Zurück
              </Button>
            </div>
          ) : null}

          {modus === 'verlassen' ? (
            <div className="space-y-3">
              <p className="text-body text-ink-soft">
                Die Liste verschwindet aus deiner Ansicht. Die Aufgaben bleiben beim Besitzer.
              </p>
              <Button
               
                variant="danger" layout="w-full"
                disabled={busy}
                onClick={() => void ausfuehren(() => repositories.leaveList(list.id, currentUserId))}
              >
                Wirklich verlassen
              </Button>
              <Button
               
                variant="secondary" layout="w-full"
                onClick={() => setModus('menue')}
              >
                Abbrechen
              </Button>
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
