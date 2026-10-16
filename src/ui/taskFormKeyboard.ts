import type { KeyboardEvent } from 'react'

/** Auf Formularebene vor den lokalen Enter-Aktionen von Tags und Checkliste. */
export function submitTaskShortcut(event: KeyboardEvent<HTMLFormElement>) {
  if (event.nativeEvent.isComposing || event.key !== 'Enter' || !event.ctrlKey) return
  if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) return
  event.preventDefault()
  event.stopPropagation()
  event.currentTarget.requestSubmit()
}
