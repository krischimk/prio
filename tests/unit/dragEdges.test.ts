import { afterEach, expect, it, vi } from 'vitest'
import { createTaskDragEdges } from '../../src/ui/mobile/dragEdges'

afterEach(() => vi.useRealTimers())
it('öffnet und schließt nur nach durchgehender Wartezeit an dem jeweiligen Rand', () => {
  vi.useFakeTimers()
  let mode: 'closed' | 'open' | 'drag' = 'closed'
  const edges = createTaskDragEdges({ mode: () => mode, width: () => 390, change: value => { mode = value } })
  edges.start(true); edges.move(10)
  vi.advanceTimersByTime(500); edges.move(100); vi.advanceTimersByTime(100)
  expect(mode).toBe('closed')
  edges.move(10); vi.advanceTimersByTime(550)
  expect(mode).toBe('drag')
  edges.move(380); vi.advanceTimersByTime(550)
  expect(mode).toBe('closed')
  edges.stop()
})
it('reagiert weder auf Listen-Ziehen noch auf eine beendete Aufgaben-Ziehung', () => {
  vi.useFakeTimers()
  const change = vi.fn()
  const edges = createTaskDragEdges({ mode: () => 'closed', width: () => 390, change })
  edges.start(false); edges.move(10); vi.advanceTimersByTime(1000)
  edges.start(true); edges.move(10); edges.stop(); vi.advanceTimersByTime(1000)
  expect(change).not.toHaveBeenCalled()
})
