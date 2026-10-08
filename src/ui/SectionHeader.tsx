import { ChevronIcon } from './icons'
import { focusRing, mutedText } from './styles'

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
  abschnittId,
  hervorgehoben = false,
  gruppe,
  handlers,
}: {
  name: string
  anzahl: number
  offen: boolean
  onToggle: () => void
  className?: string
  /** Kennung des Bereichs – das Ziehen erkennt daran sein Ziel. */
  abschnittId?: string
  /** Ziel eines laufenden Ziehens: Der Kopf zeigt, wohin die Aufgabe kommt. */
  hervorgehoben?: boolean
  /** Der Gruppenschluessel – das Ziehen findet darueber die Gruppe. */
  gruppe?: string
  /** Zieh-Griffe: Der Kopf laesst sich greifen, um Bereiche umzusortieren. */
  handlers?: Record<string, unknown>
}) {
  return (
    <button
      type="button"
      aria-expanded={offen}
      onClick={onToggle}
      className={`${focusRing} flex w-full items-center gap-1.5 rounded-control py-1 text-left ${
        hervorgehoben ? 'bg-brand-tint/40 text-brand-faint' : ''
      } ${className}`}
      data-testid="section-header"
      data-section-header=""
      data-section-id={abschnittId}
      data-gruppe-kopf={gruppe}
      {...handlers}
      data-drop-target={hervorgehoben ? 'true' : undefined}
    >
      <ChevronIcon offen={offen} className={`h-3.5 w-3.5 shrink-0 ${mutedText}`} />
      <span
        className={`text-label font-semibold tracking-wide uppercase ${
          hervorgehoben ? 'text-brand-faint' : 'text-ink-soft'
        }`}
      >
        {name}
      </span>
      <span className={`text-label ${mutedText}`}>{anzahl}</span>
    </button>
  )
}
