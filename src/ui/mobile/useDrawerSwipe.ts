import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useDragDropMonitor } from '@dnd-kit/react'

interface Gesture {
  id: number; x: number; y: number; lastX: number; lastAt: number
  width: number; from: number; moving: boolean; velocity: number
}
const clamp = (value: number) => Math.max(0, Math.min(1, value))

/**
 * Fingerbewegung schreibt nur die Darstellung, nicht bei jedem Bild den ganzen
 * Arbeitsbereich neu. Erst Loslassen entscheidet über Menü und Zurück-Verlauf.
 * Material Standard Spatial: Steifigkeit 700, Dämpfung hier 1 statt 0,9,
 * damit die am Rand verankerte Fläche nicht über ihren Anschlag hinausschwingt.
 */
export function useDrawerSwipe(open: boolean, change: (open: boolean) => void) {
  const root = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLElement>(null)
  const position = useRef(open ? 1 : 0)
  const velocity = useRef(0)
  const frame = useRef<number | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const dragging = useRef(false)
  const suppressClick = useRef(false)
  const [visible, setVisible] = useState(open)

  const stop = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
  }
  const draw = (value: number, motion: 'tracking' | 'settling' | 'idle') => {
    position.current = clamp(value)
    if (root.current) {
      root.current.style.setProperty('--drawer-progress', String(position.current))
      root.current.dataset.drawerMotion = motion
    }
  }
  const settle = (target: number, initialVelocity = velocity.current) => {
    stop()
    const from = position.current
    const omega = Math.sqrt(700)
    const start = performance.now()
    if (target > 0 || from > 0) setVisible(true)
    const finish = () => {
      velocity.current = 0
      draw(target, 'idle')
      setVisible(target === 1)
      frame.current = null
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || Math.abs(target - from) < 0.001) { finish(); return }
    draw(from, 'settling')
    // Kritisch gedämpfte Feder, einschließlich der Geschwindigkeit beim
    // Loslassen. Neue Gesten übernehmen jederzeit die aktuelle Position.
    const tick = (now: number) => {
      const t = (now - start) / 1000
      const distance = from - target
      const b = initialVelocity + omega * distance
      const decay = Math.exp(-omega * t)
      const value = target + (distance + b * t) * decay
      velocity.current = (b - omega * (distance + b * t)) * decay
      draw(value, 'settling')
      if ((Math.abs(value - target) < 0.001 && Math.abs(velocity.current) < 0.01) || t > 0.7) finish()
      else frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
  }

  // Nur der Zielzustand löst eine Bewegung aus; Fingerpositionen bleiben lokal.
  useLayoutEffect(() => { settle(open ? 1 : 0) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stop(), [])
  useDragDropMonitor({
    onBeforeDragStart: event => { if (gesture.current?.moving) event.preventDefault() },
    onDragStart: () => { dragging.current = true; gesture.current = null },
    onDragEnd: () => { dragging.current = false },
  })

  const finishGesture = (event: ReactPointerEvent<HTMLDivElement>, canceled: boolean) => {
    const current = gesture.current
    if (!current || current.id !== event.pointerId) return
    gesture.current = null
    if (!current.moving) return
    event.preventDefault()
    suppressClick.current = true
    // Eine Pause am Ende zählt nicht als schneller Flick. Maßgeblich ist die
    // letzte Bewegungsrichtung, nicht der Durchschnitt der gesamten Geste.
    const speed = event.timeStamp - current.lastAt < 100 ? current.velocity : 0
    const target = canceled ? open : Math.abs(speed) > 0.4 ? speed > 0 : position.current >= 0.5
    velocity.current = speed * 1000 / current.width
    settle(target ? 1 : 0)
    change(target)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  return {
    root, sheet, visible,
    handlers: {
      onPointerDownCapture: (event: ReactPointerEvent<HTMLDivElement>) => {
        // Eine neue Berührung oder ein Mausklick gehört nie mehr zur vorigen
        // Wischgeste, auch wenn diese keinen synthetischen Klick erzeugt hat.
        suppressClick.current = false
        if (event.pointerType !== 'touch' || !event.isPrimary || dragging.current) return
        const target = event.target as HTMLElement
        if (target.closest('input, textarea, select, [contenteditable="true"], [role="slider"], [data-no-drawer-swipe]')) return
        const dialog = target.closest('[role="dialog"]')
        if (dialog && dialog !== root.current) return
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY,
          lastX: event.clientX, lastAt: event.timeStamp, width: sheet.current?.getBoundingClientRect().width || 320,
          from: position.current, moving: false, velocity: 0 }
      },
      onPointerMoveCapture: (event: ReactPointerEvent<HTMLDivElement>) => {
        const current = gesture.current
        if (!current || current.id !== event.pointerId || dragging.current) return
        const dx = event.clientX - current.x, dy = Math.abs(event.clientY - current.y)
        if (!current.moving) {
          if (dy > 8 && dy > Math.abs(dx)) { gesture.current = null; return }
          if (Math.abs(dx) < 10 || Math.abs(dx) < dy * 1.5) return
          if ((current.from === 0 && dx < 0) || (current.from === 1 && dx > 0)) { gesture.current = null; return }
          stop()
          current.moving = true
          setVisible(true)
          event.currentTarget.setPointerCapture(event.pointerId)
        }
        event.preventDefault()
        const elapsed = event.timeStamp - current.lastAt
        if (elapsed > 0) current.velocity = (event.clientX - current.lastX) / elapsed
        current.lastX = event.clientX; current.lastAt = event.timeStamp
        draw(current.from + dx / current.width, 'tracking')
      },
      onPointerUpCapture: (event: ReactPointerEvent<HTMLDivElement>) => finishGesture(event, false),
      onPointerCancelCapture: (event: ReactPointerEvent<HTMLDivElement>) => finishGesture(event, true),
      onClickCapture: (event: React.MouseEvent<HTMLDivElement>) => {
        if (!suppressClick.current) return
        suppressClick.current = false
        event.preventDefault(); event.stopPropagation()
      },
    },
  }
}
