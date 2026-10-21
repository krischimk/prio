import type { ReactNode } from 'react'
import type { ListSection } from '../domain/types'
import { TaskFields } from './TaskFields'
import type { TaskForm } from './useTaskForm'
import { focusRing } from './styles'

/** Dieselben zusätzlichen Felder beim Anlegen und Bearbeiten. */
export function TaskMoreOptions({ form, sections, idPrefix, children }: {
  form: TaskForm; sections: ListSection[]; idPrefix: string; children?: ReactNode
}) {
  if (sections.length === 0 && !children) return null
  return <details className="border-t border-line pt-3">
    <summary className={`${focusRing} cursor-pointer rounded-control py-2 text-body text-ink-muted hover:text-ink`}>Mehr Optionen</summary>
    <div className="space-y-3 pt-3">
      <TaskFields form={form} sections={sections} idPrefix={`${idPrefix}-extra`} felder={['bereich']} />
      {children}
    </div>
  </details>
}
