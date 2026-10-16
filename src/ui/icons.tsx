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

/** 24er Raster, 1,8er Strich; regulär 20 px, Fakten verwenden size-icon-meta. */
const iconClass = 'size-icon shrink-0'

export function ChecklistIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <path d="m3 6 2 2 3-4M11 6h10M3 13h5M11 13h10M3 20h5M11 20h10" />
  </svg>
}

export function TagIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <path d="M3 3h8l10 10-8 8L3 11z" /><circle cx="7.5" cy="7.5" r="1" />
  </svg>
}

export function GripIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01" strokeWidth="3" />
  </svg>
}

export function SunIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" />
  </svg>
}
export function MoonIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <path d="M20.5 13.5A9 9 0 0 1 10.5 3 9 9 0 1 0 20.5 13.5Z" />
  </svg>
}
export function ShareIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.5 10.5 7-4M8.5 13.5l7 4" />
  </svg>
}
export function SectionsIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <path d="M4 4h16M8 8h12M8 12h12M4 16h16M8 20h12" />
  </svg>
}
export function ArrowLeftIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <path d="M20 12H4m7-7-7 7 7 7" />
  </svg>
}
export function EyeIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
  </svg>
}
export function EyeOffIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <path d="m3 3 18 18M10 5.2a11 11 0 0 1 11 6.8 12 12 0 0 1-3 4M6 6.5A12 12 0 0 0 3 12s3 7 9 7a11 11 0 0 0 4-1M10 10a3 3 0 0 0 4 4" />
  </svg>
}

export function MenuIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

export function PlusIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function EditIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <path d="m15 5 4 4M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15z" />
  </svg>
}

export function SettingsIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <path d="M4 6h16M4 12h16M4 18h16" />
    <path d="M8 3v6M16 9v6M10 15v6" />
  </svg>
}

export function IconChoiceIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <circle cx="8" cy="8" r="4" /><path d="m16 4 5 8H11z" /><rect x="4" y="15" width="7" height="6" rx="1" /><path d="M17 16v6M14 19h6" />
  </svg>
}

export function OverviewIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" />
    <rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" />
  </svg>
}

export function CloseIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function CheckIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  )
}

export function MoveIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />
    </svg>
  )
}

export function TrashIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />
    </svg>
  )
}

/** Wiederholung – kennzeichnet eine wiederkehrende Aufgabe. */
export function RepeatIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" />
      <path d="M20.5 3.5V9H15" />
    </svg>
  )
}

/** Erinnerung – kennzeichnet eine Aufgabe mit Benachrichtigung. */
export function BellIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  )
}

/** Erinnerung, die für mich stummgeschaltet ist – Glocke mit Schrägstrich. */
export function BellOffIcon({ className = iconClass }: { className?: string }) {
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
  className = iconClass,
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

/** Pfeil an einem Abschnittskopf – zeigt, ob der Abschnitt offen ist. */
export function ChevronIcon({ offen, className = iconClass }: { offen: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`${className} transition-transform ${offen ? 'rotate-90' : ''}`}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

export function CalendarIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 11h18" />
  </svg>
}

export function ClockIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
  </svg>
}

export function DescriptionIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <path d="M4 6h16M4 10h16M4 14h16M4 18h10" />
  </svg>
}

export function SaveIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <path d="M5 3h12l4 4v14H3V3zM7 3v6h10V3M7 21v-7h10v7" />
  </svg>
}

export function RestoreIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <path d="M3 10a9 9 0 1 1 2 9M3 4v6h6M12 7v5l3 2" />
  </svg>
}

export function SyncIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <path d="M20 7a9 9 0 0 0-15 0M4 3v5h5M4 17a9 9 0 0 0 15 0M20 21v-5h-5" />
  </svg>
}

export function LogoutIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <path d="M9 4H4v16h5M8 12h13M17 8l4 4-4 4" />
  </svg>
}

export function DownloadIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <path d="M12 3v12M7 10l5 5 5-5M4 17v4h16v-4" />
  </svg>
}

export function SortIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <path d="M4 5h16M4 11h10M4 17h6M18 11v10M15 18l3 3 3-3" />
  </svg>
}

export function AlertIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <path d="M12 3 2 21h20L12 3zM12 9v5M12 17h.01" />
  </svg>
}

export function UserIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
    <circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" />
  </svg>
}
