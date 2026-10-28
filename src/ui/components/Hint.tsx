import { createContext, useContext, useEffect, useId, useState, type ReactElement, type ReactNode } from 'react'
import { Tooltip } from '@ark-ui/react/tooltip'
import { Portal } from '@ark-ui/react/portal'
import { layer } from '../styles'

const SharedHints = createContext(false)
const contentClass = 'max-w-72 rounded-control border border-line-strong bg-raised px-3 py-2 text-meta text-ink shadow-lg shadow-page/50'

/** Ark unterstützt mehrere Trigger pro Tooltip: eine Maschine für alle Hinweise. */
export function HintProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [text, setText] = useState('')
  useEffect(() => {
    if (!open || !target) return
    const update = () => {
      if (!target.isConnected) setOpen(false)
      else setText(target.dataset.prioHint ?? '')
    }
    const attributes = new MutationObserver(update)
    attributes.observe(target, { attributes: true, attributeFilter: ['data-prio-hint'] })
    const removal = new MutationObserver(() => { if (!target.isConnected) setOpen(false) })
    removal.observe(target.ownerDocument.body, { childList: true, subtree: true })
    return () => { attributes.disconnect(); removal.disconnect() }
  }, [open, target])
  return <Tooltip.Root open={open} onOpenChange={details => setOpen(details.open)}
    onTriggerValueChange={details => { setTarget(details.triggerElement); setText(details.triggerElement?.dataset.prioHint ?? '') }}
    openDelay={400} closeDelay={100} positioning={{ strategy: 'fixed', placement: 'top' }} lazyMount unmountOnExit>
    <SharedHints value={true}>{children}</SharedHints>
    <Portal><Tooltip.Positioner className={`pointer-events-none ${layer.hint}`}>
      <Tooltip.Content className={contentClass}>{text}</Tooltip.Content>
    </Tooltip.Positioner></Portal>
  </Tooltip.Root>
}

/** Derselbe erklärende Hinweis bei Maus-Hover und Tastaturfokus. */
export function Hint({ text, children }: { text: string; children: ReactElement }) {
  const shared = useContext(SharedHints)
  const id = useId()
  if (shared) return <Tooltip.Trigger asChild value={id} data-prio-hint={text}>{children}</Tooltip.Trigger>
  // Einzelne Bausteine bleiben ohne App-Rahmen nutzbar, etwa in Unit-Tests.
  return <Tooltip.Root openDelay={400} closeDelay={100} positioning={{ strategy: 'fixed', placement: 'top' }} lazyMount unmountOnExit>
    <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
    <Portal><Tooltip.Positioner className={`pointer-events-none ${layer.hint}`}>
      <Tooltip.Content className={contentClass}>
        {text}
      </Tooltip.Content>
    </Tooltip.Positioner></Portal>
  </Tooltip.Root>
}
