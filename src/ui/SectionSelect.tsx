import type { ListSection } from '../domain/types'
import { Select } from './components/Select'
import { SectionsIcon } from './icons'

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
  disabled = false,
}: {
  id: string
  sections: ListSection[]
  value: string | null
  onChange: (wert: string | null) => void
  disabled?: boolean
}) {
  return <Select id={id} label="Bereich" value={value ?? ''} disabled={disabled} icon={<SectionsIcon />}
    onChange={value => onChange(value === '' ? null : value)}
    options={[{ value: '', label: 'Ohne Bereich' }, ...sections.map(section => ({ value: section.id, label: section.name }))]} />
}
