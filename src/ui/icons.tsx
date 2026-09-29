/**
 * Bediensymbole als eingebettete SVGs.
 *
 * Diese Zeichen gehören zur Oberfläche selbst – Menü, Schließen, Plus und so
 * weiter. Bewusst keine Icon-Bibliothek: Es sind wenige, und jede Bibliothek
 * wäre mehr Abhängigkeit als Nutzen.
 *
 * Die **Listen**symbole sind etwas anderes und liegen in `listIcons.ts`; sie
 * kommen aus fremden Sammlungen.
 */

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export function MenuIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

export function PlusIcon({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function CloseIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function CheckIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  )
}

export function MoveIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />
    </svg>
  )
}

export function TrashIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />
    </svg>
  )
}

/** Wiederholung – kennzeichnet eine wiederkehrende Aufgabe. */
export function RepeatIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" />
      <path d="M20.5 3.5V9H15" />
    </svg>
  )
}

/** Erinnerung – kennzeichnet eine Aufgabe mit Benachrichtigung. */
export function BellIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  )
}

/** Erinnerung, die für mich stummgeschaltet ist – Glocke mit Schrägstrich. */
export function BellOffIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="M6 9a6 6 0 0 1 9.2-5.1M18 9c0 4 1.5 5.5 1.5 5.5h-11" />
      <path d="M4 4l16 16" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  )
}

/**
 * Stern zum Merken eines Wertes.
 *
 * Gefüllt heißt „gemerkt". Der Umriss kommt aus `base`, die Füllung wird
 * überschrieben – so bleibt der Stern dieselbe Form wie die übrigen
 * Bediensymbole.
 */
export function StarIcon({
  className = 'h-4 w-4',
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      {...base}
      fill={filled ? 'currentColor' : 'none'}
    >
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
    </svg>
  )
}
