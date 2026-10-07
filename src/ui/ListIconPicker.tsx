import { useWorkspace } from '../app/useWorkspace'
import type { LocalList } from '../domain/types'
import { groupListIcons } from './listIcons'
import { ListIcon } from './ListIcon'
import { cardSoft, secondaryButton } from './styles'

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
    <div className={`${cardSoft} space-y-3`}>
      <p className="text-meta text-ink-muted">
        Ein Symbol hilft, die Liste schneller wiederzufinden.
      </p>

      {/*
        Sechzehn Symbole in vier Reihen zu vier – deshalb liegt „Kein Symbol"
        außerhalb des Rasters. Als Kachel bliebe eine einzelne Zeile übrig, und
        das sähe nach Versehen aus.
      */}
      {/*
        Die Gruppen kommen als Überschriften mit: Bei 60 Symbolen findet man
        ein Motiv schneller, wenn Verwandtes untereinander steht und benannt
        ist.
      */}
      <div className="space-y-4" data-testid="icon-picker">
        {groupListIcons().map((gruppe) => (
          <div key={gruppe.name ?? 'ohne Gruppe'}>
            {gruppe.name ? (
              <h4 className="mb-2 text-meta font-medium uppercase tracking-wide text-ink-faint">
                {gruppe.name}
              </h4>
            ) : null}
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
              {gruppe.icons.map((eintrag) => (
                <button
                  key={eintrag.id}
                  type="button"
                  aria-label={eintrag.label}
                  aria-pressed={list.icon === eintrag.id}
                  onClick={() => setzen(eintrag.id)}
                  className={`flex aspect-square items-center justify-center rounded-control border ${
                    list.icon === eintrag.id
                      ? 'border-brand bg-brand-tint/60 text-brand-faint'
                      : 'border-line-strong bg-surface text-ink-soft hover:bg-raised'
                  }`}
                >
                  <ListIcon icon={eintrag.id} className="h-6 w-6" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {list.icon !== null ? (
        <button type="button" className={secondaryButton} onClick={() => setzen(null)}>
          Symbol entfernen
        </button>
      ) : null}

      <p className="text-meta text-ink-dim">
        Ein Teil der Symbole stammt aus Material Design Icons (Apache-2.0) – siehe THIRD-PARTY.md.
      </p>
    </div>
  )
}
