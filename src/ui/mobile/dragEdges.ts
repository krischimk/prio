/** Nur Aufgaben aktivieren Randwechsel; Verlassen des Randes verwirft die Wartezeit. */
export function createTaskDragEdges(options: {
  mode: () => 'closed' | 'open' | 'drag'; width: () => number; change: (mode: 'closed' | 'drag') => void
}) {
  let active = false
  let edge: 'left' | 'right' | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const clear = () => { if (timer !== null) clearTimeout(timer); timer = null; edge = null }
  return {
    start(taskPointer: boolean) { clear(); active = taskPointer },
    move(x: number) {
      if (!active) return
      const mode = options.mode()
      const next = x <= 28 && mode === 'closed' ? 'left'
        : x >= options.width() - 28 && mode === 'drag' ? 'right' : null
      if (next === edge) return
      clear()
      if (!next) return
      edge = next
      timer = setTimeout(() => {
        timer = null
        if (active) options.change(next === 'left' ? 'drag' : 'closed')
      }, 550)
    },
    stop() { clear(); active = false },
  }
}
