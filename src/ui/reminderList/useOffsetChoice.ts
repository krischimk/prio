import { useMemo, useState } from 'react'
import { useReminderPresets } from '../../app/hooks'
import { useWorkspace } from '../../app/useWorkspace'
import { FIXED_REMINDER_STEPS } from '../reminder'

/** Der Wert der Auswahl „Eigene …" – keine Zahl, damit sie nicht kollidiert. */
export const EIGENE = 'custom'

/**
 * Die Auswahl des Vorlaufs: feste Stufen, gemerkte Werte, eigener Wert.
 *
 * Der Offen-Zustand für „Eigene …" gehört hierher und nicht in die Komponente:
 * Sonst klappte er sofort wieder zu, sobald der eingestellte Wert zufällig eine
 * der festen Stufen trifft (0 ist eine).
 */
export function useOffsetChoice({
  minutes,
  onChange,
}: {
  minutes: number
  onChange: (minutes: number) => void
}) {
  const { repositories } = useWorkspace()
  const presets = useReminderPresets()

  // Feste Stufen und gemerkte Werte, ohne Doppelte und in steter Reihenfolge.
  const auswahl = useMemo(() => {
    const gesehen = new Set<number>()
    return [...FIXED_REMINDER_STEPS, ...presets].filter((wert) => {
      if (gesehen.has(wert)) return false
      gesehen.add(wert)
      return true
    })
  }, [presets])

  const [eigeneOffen, setEigeneOffen] = useState(!FIXED_REMINDER_STEPS.includes(minutes))
  const wert = eigeneOffen ? EIGENE : String(minutes)

  const waehlen = (gewaehlt: string) => {
    if (gewaehlt === EIGENE) {
      setEigeneOffen(true)
      return
    }
    setEigeneOffen(false)
    onChange(Number(gewaehlt))
  }

  const merken = async () => {
    const neu = presets.includes(minutes)
      ? presets.filter((wert2) => wert2 !== minutes)
      : [...presets, minutes]
    await repositories.setReminderPresets(neu)
  }

  return { auswahl, wert, waehlen, eigeneOffen, gemerkt: presets.includes(minutes), merken }
}
