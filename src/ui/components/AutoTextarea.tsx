import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'
import { input } from '../styles'

/** Höhe folgt Inhalt und verfügbarer Breite, auch nach einem Ansichtswechsel. */
export function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const element = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const textarea = element.current
    if (!textarea) return
    const resize = () => {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight + 2}px`
    }
    resize()
    let width = textarea.clientWidth
    let frame: number | undefined
    const observer = new ResizeObserver(() => {
      if (width === textarea.clientWidth) return
      width = textarea.clientWidth
      // Eine neue Höhe kann ihrerseits die Scrollleiste und damit die Breite
      // ändern. Außerhalb der Observer-Zustellung folgt die nächste Messung.
      if (frame !== undefined) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => { frame = undefined; resize() })
    })
    observer.observe(textarea)
    return () => { observer.disconnect(); if (frame !== undefined) cancelAnimationFrame(frame) }
  }, [props.value])
  return <textarea {...props} ref={element} rows={1} className={`${input} resize-none overflow-hidden`} />
}
