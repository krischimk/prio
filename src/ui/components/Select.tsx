import { useId, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react'
import { Select as ArkSelect, createListCollection } from '@ark-ui/react/select'
import { useBackLayer } from '../../app/useBackLayer'
import { CheckIcon, ChevronIcon } from '../icons'
import { focusRing, input, layer } from '../styles'

export interface SelectOption {
  value: string
  label: string
  icon?: ReactNode
  disabled?: boolean
  /** Ein alter genauer Minutenwert bleibt lesbar, ohne die Auswahl zu erweitern. */
  hidden?: boolean
}

/** Eine Auswahl, deren Feld und Menü dieselbe Sprache wie die App sprechen. */
export function Select({ id, label, value, options, onChange, disabled = false, icon, layout = '', triggerRef,
  open: controlledOpen, onOpenChange, onFocus, name, title, compact = false }: {
  id?: string; label: string; value: string; options: SelectOption[]; onChange: (value: string) => void
  disabled?: boolean; icon?: ReactNode; layout?: string; triggerRef?: Ref<HTMLButtonElement>
  open?: boolean; onOpenChange?: (open: boolean) => void; name?: string; title?: string; compact?: boolean
  onFocus?: () => void
}) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const [localOpen, setLocalOpen] = useState(false)
  const open = !disabled && (controlledOpen ?? localOpen)
  const setOpen = onOpenChange ?? setLocalOpen
  const trigger = useRef<HTMLButtonElement | null>(null)
  useImperativeHandle(triggerRef, () => trigger.current!, [])
  const collection = useMemo(() => createListCollection({ items: options }), [options])
  const selected = options.find(option => option.value === value)
  const leadingIcon = icon ?? selected?.icon
  const close = () => {
    setOpen(false)
    trigger.current?.focus({ preventScroll: true })
  }
  useBackLayer(open, close, `${selectId}:auswahl`)

  return <ArkSelect.Root collection={collection} value={[value]} disabled={disabled} name={name}
    ids={{ trigger: selectId }} open={open} onOpenChange={details => setOpen(details.open)}
    onValueChange={details => { if (details.value[0] !== undefined) onChange(details.value[0]) }}
    // Inline bleibt das Menü in der Fokusfalle des Dialogs und im Aufgabenformular.
    // Feste Position + Begrenzung auf den Viewport verhindern abgeschnittene Menüs.
    positioning={{ strategy: 'fixed', placement: 'bottom-start', sameWidth: true, fitViewport: true, hideWhenDetached: true, gutter: 4, overflowPadding: 8 }}
    lazyMount unmountOnExit className={`min-w-0 ${layout}`}>
    <ArkSelect.Label htmlFor={selectId} className="sr-only">{label}</ArkSelect.Label>
    <ArkSelect.Control>
      <ArkSelect.Trigger ref={trigger} title={title} data-value={value} onFocus={onFocus}
        className={`${compact ? `select-trigger-compact ${focusRing}` : input} flex cursor-pointer items-center gap-2 text-left transition-colors hover:border-brand-line data-[state=open]:border-brand-line disabled:cursor-not-allowed disabled:opacity-50`}>
        {leadingIcon ? <span className="inline-flex shrink-0 text-ink-muted">{leadingIcon}</span> : null}
        <ArkSelect.ValueText className="min-w-0 flex-1 truncate">{selected?.label ?? label}</ArkSelect.ValueText>
        <ArkSelect.Indicator className="inline-flex shrink-0 text-ink-faint transition-transform data-[state=open]:rotate-180">
          <ChevronIcon offen className="size-icon-meta" />
        </ArkSelect.Indicator>
      </ArkSelect.Trigger>
    </ArkSelect.Control>
    <ArkSelect.Positioner className={layer.hint}>
      <ArkSelect.Content className="select-menu scroll-area overflow-y-auto overscroll-contain rounded-card border border-line-strong bg-raised p-1 text-body text-ink shadow-xl shadow-page/50 outline-none"
        onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() } }}>
        {options.filter(option => !option.hidden).map(option => <ArkSelect.Item key={option.value} item={option}
          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-control px-3 py-2 data-[highlighted]:bg-surface data-[state=checked]:text-brand-ink data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40">
          {option.icon ? <span className="inline-flex shrink-0 text-ink-muted">{option.icon}</span> : null}
          <ArkSelect.ItemText className="min-w-0 flex-1 break-words">{option.label}</ArkSelect.ItemText>
          <ArkSelect.ItemIndicator className="inline-flex shrink-0 text-brand-soft"><CheckIcon className="size-icon-meta" /></ArkSelect.ItemIndicator>
        </ArkSelect.Item>)}
      </ArkSelect.Content>
    </ArkSelect.Positioner>
    {/* Ark empfiehlt dieses native Gegenstück für Formulare und Autofill. */}
    <ArkSelect.HiddenSelect aria-labelledby="" />
  </ArkSelect.Root>
}
