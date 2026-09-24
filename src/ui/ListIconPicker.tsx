import { useWorkspace } from '../app/useWorkspace'
import type { LocalList } from '../domain/types'
import { LIST_ICONS } from './listIcons'
import { ListIcon } from './ListIcon'
import { secondaryButton } from './styles'

/**
 * Auswahl des Listensymbols.
 *
 * Bewusst ein gemeinsamer Baustein für beide Ansichten: Das Aussehen und die
 * Bedeutung der Symbole sind identisch, nur der Rahmen unterscheidet sich (die
 * breite Ansicht zeigt die Auswahl aufgeklappt, die mobile in einer eigenen
 * Ansicht). Eine Funktion, die es auf einem Bildschirm gibt, muss es auf dem
 * anderen auch geben – siehe `AGENTS.md`.
 */
export function ListIconPicker({
  list,
  onPicked,
}: {
  list: LocalList
  /**
   * Wird nach dem Setzen aufgerufen.
   *
   * Die mobile Ansicht ist ein eigenes Blatt und schließt sich damit; in der
   * breiten Ansicht steht die Auswahl aufgeklappt im Kopfbereich und bleibt
   * offen. Der Unterschied liegt im Rahmen, nicht im Verhalten des Bausteins.
   */
  onPicked?: () => void
}) {
  const { repositories } = useWorkspace()

  const setzen = (icon: string | null) => {
    void repositories.setListIcon(list.id, icon).then(() => onPicked?.())
  }

  return (
    <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <p className="text-xs text-neutral-400">
        Ein Symbol hilft, die Liste schneller wiederzufinden.
      </p>

      {/*
        Sechzehn Symbole in vier Reihen zu vier – deshalb liegt „Kein Symbol"
        außerhalb des Rasters. Als Kachel bliebe eine einzelne Zeile übrig, und
        das sähe nach Versehen aus.
      */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8" data-testid="icon-picker">
        {LIST_ICONS.map((eintrag) => (
          <button
            key={eintrag.id}
            type="button"
            aria-label={eintrag.label}
            aria-pressed={list.icon === eintrag.id}
            onClick={() => setzen(eintrag.id)}
            className={`flex aspect-square items-center justify-center rounded-md border ${
              list.icon === eintrag.id
                ? 'border-indigo-500 bg-indigo-950/60 text-indigo-100'
                : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            <ListIcon icon={eintrag.id} className="h-6 w-6" />
          </button>
        ))}
      </div>

      {list.icon !== null ? (
        <button type="button" className={secondaryButton} onClick={() => setzen(null)}>
          Symbol entfernen
        </button>
      ) : null}
    </div>
  )
}
