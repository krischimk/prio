/**
 * Symbole als eingebettete SVGs.
 *
 * Bewusst keine Icon-Bibliothek: Es sind drei Symbole, und jede Bibliothek
 * wäre mehr Abhängigkeit als Nutzen.
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
