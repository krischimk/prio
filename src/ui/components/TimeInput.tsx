import { useEffect, useRef, useState } from 'react'
import { Popover } from '@ark-ui/react/popover'
import { useBackLayer } from '../../app/useBackLayer'
import { normalizeTime } from '../datetime'
import { ClockIcon } from '../icons'
import { input, layer, numeric } from '../styles'
import { IconButton } from './IconButton'

/** Direkt tippen oder Stunde/Minute wählen; in beiden Fällen 24-Stunden-Uhr. */
export function TimeInput({ id, label, value, scopeValue, disabled, onChange, open: controlledOpen, onOpenChange, onFocus }: {
  id: string; label: string; value: string; scopeValue: string; disabled: boolean; onChange: (value: string) => void
  open?: boolean; onOpenChange?: (open: boolean) => void
  onFocus?: () => void
}) {
  const [localOpen, setLocalOpen] = useState(false)
  const open = controlledOpen ?? localOpen
  const setOpen = onOpenChange ?? setLocalOpen
  const [draft, setDraft] = useState<string | null>(null)
  const [lastValue, setLastValue] = useState(scopeValue)
  const element = useRef<HTMLInputElement>(null)
  if (lastValue !== scopeValue) { setLastValue(scopeValue); setDraft(null) }
  const shown = lastValue !== scopeValue ? value : draft ?? value
  const [hour, minute] = (normalizeTime(shown) || value || '00:00').split(':')
  useEffect(() => {
    element.current?.setCustomValidity(disabled || normalizeTime(shown) ? '' : 'Bitte eine gültige Uhrzeit eingeben, zum Beispiel 14:30.')
  }, [shown, disabled])
  useBackLayer(open, () => setOpen(false), `${id}:uhrzeit`)
  return <Popover.Root open={open} onOpenChange={details => setOpen(details.open)} onEscapeKeyDown={event => { event.preventDefault(); setOpen(false) }} positioning={{ strategy: 'fixed', placement: 'bottom-end', gutter: 8 }} lazyMount unmountOnExit>
    <div className="relative w-28 shrink-0">
      <label htmlFor={id} className="sr-only">{label}</label>
      <input ref={element} id={id} aria-label={label} placeholder="HH:mm" disabled={disabled}
        onFocus={onFocus}
        value={shown} pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]" title="Uhrzeit im 24-Stunden-Format, zum Beispiel 14:30"
        onChange={event => {
          setDraft(event.target.value)
          const next = normalizeTime(event.target.value)
          event.target.setCustomValidity(next ? '' : 'Bitte eine gültige Uhrzeit eingeben, zum Beispiel 14:30.')
          if (next) { onChange(next); setOpen(false) }
        }}
        onBlur={event => { if (normalizeTime(event.target.value)) setDraft(null) }}
        className={`${input} ${numeric} date-time-clock`} />
      <Popover.Trigger asChild><IconButton aria-label={`${label} wählen`} disabled={disabled} layout="absolute inset-y-0 left-0"><ClockIcon /></IconButton></Popover.Trigger>
    </div>
    <Popover.Positioner className={layer.top}><Popover.Content className="w-52 rounded-card border border-line-strong bg-raised p-3 shadow-lg shadow-page/50" aria-label="Uhrzeit wählen">
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-meta text-ink-muted"><span>Stunde</span>
          <select aria-label={`${label}: Stunde`} className={input} value={hour} onChange={event => {
            setDraft(null); onChange(`${event.target.value}:${minute}`)
          }}>{Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0')).map(item => <option key={item} value={item}>{item}</option>)}</select>
        </label>
        <label className="space-y-1 text-meta text-ink-muted"><span>Minute</span>
          <select aria-label={`${label}: Minute`} className={input} value={minute} onChange={event => {
            setDraft(null); onChange(`${hour}:${event.target.value}`); setOpen(false)
          }}>{Number(minute) % 5 !== 0 ? <option value={minute} disabled hidden>{minute}</option> : null}
            {Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0')).map(item => <option key={item} value={item}>{item}</option>)}</select>
        </label>
      </div>
    </Popover.Content></Popover.Positioner>
  </Popover.Root>
}
