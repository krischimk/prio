import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { DelayedLoading } from '../../src/ui/components/DelayedLoading'

afterEach(() => { cleanup(); vi.useRealTimers() })

it('zeigt bei kurzen Ladephasen nichts und erst nach 200 ms eine Rückmeldung', () => {
  vi.useFakeTimers()
  const view = render(<DelayedLoading>Aufgaben werden geladen …</DelayedLoading>)
  expect(screen.queryByRole('status')).toBeNull()
  act(() => vi.advanceTimersByTime(199))
  expect(screen.queryByRole('status')).toBeNull()
  act(() => vi.advanceTimersByTime(1))
  expect(screen.getByRole('status').textContent).toContain('Aufgaben werden geladen')
  view.unmount()
  expect(vi.getTimerCount()).toBe(0)
})
