import type { ReactNode } from 'react'
import type { ListSection } from '../domain/types'
import { TaskFields } from './TaskFields'
import type { TaskForm } from './useTaskForm'
import { focusRing } from './styles'
import { useView } from './useView'
import { TaskUrgencyEditor } from './TaskRating'
import { Button } from './components/Button'
import { EraserIcon } from './icons'

/** Dieselben zusätzlichen Felder beim Anlegen und Bearbeiten. */
export function TaskMoreOptions({ form, sections, idPrefix, children, ratingsEnabled = false }: {
  form: TaskForm; sections: ListSection[]; idPrefix: string; children?: ReactNode; ratingsEnabled?: boolean
}) {
  const { overview } = useView()
  const urgency = ratingsEnabled && form.werte.rating !== null && form.dueIso !== null && !overview.userPreference?.detailed_ratings
  const rated = ratingsEnabled && form.werte.rating !== null
  if (sections.length === 0 && !children && !rated) return null
  return <details className="border-t border-line pt-3">
    <summary className={`${focusRing} cursor-pointer rounded-control py-2 text-body text-ink-muted hover:text-ink`}>Mehr Optionen</summary>
    <div className="space-y-3 pt-3">
      {urgency ? <div className="px-2"><TaskUrgencyEditor form={form} /></div> : null}
      <TaskFields form={form} sections={sections} idPrefix={`${idPrefix}-extra`} felder={['bereich']} />
      {rated ? <Button variant="ghost" size="sm" onClick={() => form.setzen('rating', null)}><EraserIcon />Bewertung entfernen</Button> : null}
      {children}
    </div>
  </details>
}
