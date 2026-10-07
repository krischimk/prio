import type { ListSection } from '../domain/types'
import { input } from './styles'

/**
 * Auswahl des Bereichs in einer Aufgabe.
 *
 * „Ohne Bereich" ist der erste Eintrag und der Rückfall: Eine Aufgabe muss in
 * keinen Bereich gehören, und ein Verweis ins Leere wird genauso behandelt.
 */
export function SectionSelect({
  id,
  sections,
  value,
  onChange,
}: {
  id: string
  sections: ListSection[]
  value: string | null
  onChange: (wert: string | null) => void
}) {
  return (
    <select
      id={id}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      className={input}
    >
      <option value="">Ohne Bereich</option>
      {sections.map((section) => (
        <option key={section.id} value={section.id}>
          {section.name}
        </option>
      ))}
    </select>
  )
}
