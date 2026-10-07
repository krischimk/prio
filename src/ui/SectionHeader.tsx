import { ChevronIcon } from './icons'
import { mutedText } from './styles'

/**
 * Der Kopf eines Abschnitts in der Aufgabenliste.
 *
 * Antippen klappt den Abschnitt zu oder auf. Die Zahl daneben sagt, wie viele
 * Aufgaben darin stehen – auch zugeklappt, sonst wäre nicht zu sehen, ob sich
 * das Aufklappen lohnt.
 */
export function SectionHeader({
  name,
  anzahl,
  offen,
  onToggle,
  className = '',
}: {
  name: string
  anzahl: number
  offen: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-expanded={offen}
      onClick={onToggle}
      className={`flex w-full items-center gap-1.5 py-1 text-left ${className}`}
      data-testid="section-header"
    >
      <ChevronIcon offen={offen} className={`h-3.5 w-3.5 shrink-0 ${mutedText}`} />
      <span className="text-[11px] font-semibold tracking-wide text-neutral-300 uppercase">
        {name}
      </span>
      <span className={`text-[11px] ${mutedText}`}>{anzahl}</span>
    </button>
  )
}
