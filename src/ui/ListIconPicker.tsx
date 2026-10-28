import { useRepositories } from '../app/useWorkspace'
import type { LocalList } from '../domain/types'
import { groupListIcons } from './listIcons'
import { ListIcon } from './ListIcon'
import { cardSoft, focusRing } from './styles'
import { Button } from './components/Button'

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
  const repositories = useRepositories()

  const setzen = (icon: string | null) => {
    void repositories.setListIcon(list.id, icon).then(() => onPicked?.())
  }

  return <ListIconChoice icon={list.icon} onPick={setzen} />
}

export function ListIconChoice({ icon, onPick }: { icon: string | null; onPick: (value: string | null) => void }) {
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
                  aria-pressed={icon === eintrag.id}
                  onClick={() => onPick(eintrag.id)}
                  className={`${focusRing} flex aspect-square items-center justify-center rounded-control border ${
                    icon === eintrag.id
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

      {icon !== null ? (
        <Button variant="secondary" onClick={() => onPick(null)}>
          Symbol entfernen
        </Button>
      ) : null}

      <p className="text-meta text-ink-faint">
        Ein Teil der Symbole stammt aus Material Design Icons (Apache-2.0) – siehe THIRD-PARTY.md.
      </p>
    </div>
  )
}
