import { useLayoutEffect, useRef } from 'react'

/**
 * Laesst Elemente an ihren neuen Platz gleiten, statt zu springen.
 *
 * Das Verfahren heisst FLIP: Vorher messen (First), die Reihenfolge aendern
 * (Last), die Differenz als Verschiebung zuruecksetzen (Invert) und dann
 * animiert aufheben (Play). Gemessen wird ueber `data-flip-id`, animiert ueber
 * eine CSS-Ueberblendung auf `transform`.
 *
 * Warum nicht selbst rechnen? Die Zielpositionen haengen an Zeilenhoehen,
 * Abstaenden und Bereichen. Der Browser kennt sie bereits – er soll sie
 * ausrechnen, nicht wir.
 */
export function useFlip(containerRef: { current: HTMLElement | null }, abhaengigkeit: string) {
  const vorher = useRef(new Map<string, number>())

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const elemente = Array.from(container.querySelectorAll<HTMLElement>('[data-flip-id]'))
    const nachher = new Map<string, number>()

    for (const element of elemente) {
      const id = element.dataset.flipId
      if (!id) continue
      const top = element.getBoundingClientRect().top
      nachher.set(id, top)

      const alt = vorher.current.get(id)
      if (alt === undefined || alt === top) continue

      // Zuruecksetzen ohne Ueberblendung, einen Umlauf erzwingen, dann gleiten.
      element.style.transition = 'none'
      element.style.transform = `translateY(${alt - top}px)`
      void element.offsetHeight
      element.style.transition = 'transform 180ms ease'
      element.style.transform = ''
    }

    vorher.current = nachher
  }, [containerRef, abhaengigkeit])
}
