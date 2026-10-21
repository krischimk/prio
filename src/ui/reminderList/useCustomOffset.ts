import { useEffect, useRef, useState } from 'react'
import { MAX_OFFSET_MINUTES } from '../../domain/reminder'

export const OFFSET_UNITS = { minutes: { label: 'Minuten', minutes: 1 }, hours: { label: 'Stunden', minutes: 60 }, days: { label: 'Tage', minutes: 1440 }, weeks: { label: 'Wochen', minutes: 10080 } } as const
type OffsetUnit = keyof typeof OFFSET_UNITS

function fields(value: number): { amount: string; unit: OffsetUnit; direction: string } {
  const absolute = Math.abs(value)
  const unit = absolute > 0 ? (['weeks', 'days', 'hours'] as const).find(unit => absolute % OFFSET_UNITS[unit].minutes === 0) ?? 'minutes' : 'minutes'
  return { amount: String(absolute / OFFSET_UNITS[unit].minutes), unit, direction: value < 0 ? 'nachher' : 'vorher' }
}

/** Der Abstand bleibt minutengenau; Einheit und leere Eingabe sind Eingabehilfen. */
export function useCustomOffset({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  const [selection, setSelection] = useState(() => fields(value))
  const emitted = useRef(value)
  useEffect(() => {
    if (value !== emitted.current) { emitted.current = value; setSelection(fields(value)) }
  }, [value])
  function change(patch: Partial<typeof selection>) {
    const next = { ...selection, ...patch }
    setSelection(next)
    if (next.amount === '') return
    const amount = Number(next.amount)
    if (!Number.isFinite(amount) || amount < 0) return
    const minutes = Math.min(MAX_OFFSET_MINUTES, Math.round(amount * OFFSET_UNITS[next.unit].minutes))
    emitted.current = next.direction === 'nachher' ? -minutes : minutes
    onChange(emitted.current)
  }
  return { ...selection, change, max: MAX_OFFSET_MINUTES / OFFSET_UNITS[selection.unit].minutes }
}
