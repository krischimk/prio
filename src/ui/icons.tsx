/** Bediensymbole im 24er Raster; ausgewählte Lucide-/MDI-Pfade liegen lokal. */
import { actionIconPaths } from './actionIconPaths'

function ActionIcon({ name, className }: { name: keyof typeof actionIconPaths; className: string }) {
  const icon = actionIconPaths[name]
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"
    {...base} fill={icon.filled ? 'currentColor' : 'none'} stroke={icon.filled ? 'none' : 'currentColor'}>
    {icon.paths.map((path, index) => <path key={index} d={path} />)}
  </svg>
}

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/** 24er Raster, 1,8er Strich; regulär 20 px, Fakten verwenden size-icon-meta. */
const iconClass = 'size-icon shrink-0'

export function BoldIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}><path d="M7 4h6a4 4 0 0 1 0 8H7m0-8v16h7a4 4 0 0 0 0-8H7" strokeWidth="2.5" /></svg>
}
export function ItalicIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}><path d="M10 4h9M5 20h9M15 4 9 20" /></svg>
}
export function UnderlineIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}><path d="M6 3v7a6 6 0 0 0 12 0V3M5 21h14" /></svg>
}
export function BulletListIcon({ className = iconClass }: { className?: string }) {
  return <ActionIcon name="BulletList" className={className} />
}
export function NumberedListIcon({ className = iconClass }: { className?: string }) {
  return <ActionIcon name="NumberedList" className={className} />
}
export function LinkIcon({ className = iconClass }: { className?: string }) {
  return <ActionIcon name="Link" className={className} />
}

export function ChecklistIcon({ className = iconClass }: { className?: string }) {
  return <ActionIcon name="Checklist" className={className} />
}

export function TagIcon({ className = iconClass }: { className?: string }) {
  return <ActionIcon name="Tag" className={className} />
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
  return <ActionIcon name="Share" className={className} />
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
  return <ActionIcon name="EyeOff" className={className} />
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
  return <ActionIcon name="Edit" className={className} />
}

export function SettingsIcon({ className = iconClass }: { className?: string }) {
  return <ActionIcon name="Settings" className={className} />
}

export function IconChoiceIcon({ className = iconClass }: { className?: string }) {
  return <ActionIcon name="IconChoice" className={className} />
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
  return <ActionIcon name="Trash" className={className} />
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
  return <ActionIcon name="Calendar" className={className} />
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
  return <ActionIcon name="Restore" className={className} />
}

export function SyncIcon({ className = iconClass }: { className?: string }) {
  return <ActionIcon name="Sync" className={className} />
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

export function FilterIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <path d="M3 4h18l-7 8v7l-4 2v-9z" />
  </svg>
}

export function EraserIcon({ className = iconClass }: { className?: string }) {
  return <ActionIcon name="Eraser" className={className} />
}

export function ImportanceIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z" />
  </svg>
}

export function EffortIcon({ className = iconClass }: { className?: string }) {
  return <ActionIcon name="Effort" className={className} />
}

export function UrgencyIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <path d="M9 2h6M12 2v3M18 6l2-2M12 9v5l3 2" /><circle cx="12" cy="14" r="8" />
  </svg>
}

export function PriorityIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <path d="m5 12 7-7 7 7M5 19l7-7 7 7" />
  </svg>
}

export function AlertIcon({ className = iconClass }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
    <path d="M12 3 2 21h20L12 3zM12 9v5M12 17h.01" />
  </svg>
}

export function UserIcon({ className = iconClass }: { className?: string }) {
  return <ActionIcon name="User" className={className} />
}

export function RemoveFormattingIcon({ className = iconClass }: { className?: string }) {
  return <ActionIcon name="RemoveFormatting" className={className} />
}

export function MarkdownIcon({ className = iconClass }: { className?: string }) {
  return <ActionIcon name="Markdown" className={className} />
}
