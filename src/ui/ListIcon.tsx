import { findListIcon } from './listIcons'

/**
 * Zeichnet ein Listensymbol.
 *
 * Eigene Datei, damit `listIcons.ts` nur Daten exportiert – das hält Fast
 * Refresh im Dev-Server intakt (siehe `.oxlintrc.json`).
 *
 * Ohne Kennung oder bei unbekannter Kennung wird nichts gezeichnet – die
 * Oberfläche zeigt dann nur den Namen. Das ist der Fall bei Listen aus der Zeit
 * vor dieser Funktion und bei einer künftigen Symbolreihe, die diese Fassung
 * noch nicht kennt.
 */
export function ListIcon({ icon, className = 'h-5 w-5' }: { icon: string | null; className?: string }) {
  const definition = findListIcon(icon)
  if (!definition) return null

  return (
    /*
      Zwei Arten der Zeichnung: Die handgezeichneten Symbole sind Striche, die
      von Material Design Icons sind Flächen. Beides mit derselben Einstellung
      zu zeichnen ließe die einen wie Gerüste und die anderen wie Kleckse
      aussehen.
    */
    <svg
      viewBox={definition.viewBox ?? '0 0 24 24'}
      className={className}
      fill={definition.filled ? 'currentColor' : 'none'}
      stroke={definition.filled ? 'none' : 'currentColor'}
      strokeWidth={definition.filled ? undefined : 1.8}
      strokeLinecap={definition.filled ? undefined : 'round'}
      strokeLinejoin={definition.filled ? undefined : 'round'}
      aria-hidden="true"
      data-testid="list-icon"
      data-icon={definition.id}
    >
      {definition.paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
