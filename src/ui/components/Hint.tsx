import type { ReactElement } from 'react'
import { Tooltip } from '@ark-ui/react/tooltip'
import { Portal } from '@ark-ui/react/portal'
import { layer } from '../styles'

/** Derselbe erklärende Hinweis bei Maus-Hover und Tastaturfokus. */
export function Hint({ text, children }: { text: string; children: ReactElement }) {
  return <Tooltip.Root openDelay={400} closeDelay={100} positioning={{ strategy: 'fixed', placement: 'top' }} lazyMount unmountOnExit>
    <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
    <Portal><Tooltip.Positioner className={`pointer-events-none ${layer.hint}`}>
      <Tooltip.Content className="max-w-72 rounded-control border border-line-strong bg-raised px-3 py-2 text-meta text-ink shadow-lg shadow-page/50">
        {text}
      </Tooltip.Content>
    </Tooltip.Positioner></Portal>
  </Tooltip.Root>
}
