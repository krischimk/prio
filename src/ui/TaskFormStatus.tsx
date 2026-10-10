import { Button } from './components/Button'
import { errorBox } from './styles'
import type { TaskForm } from './useTaskForm'

export function TaskFormStatus({ form }: { form: TaskForm }) {
  if (!form.error) return null
  return (
    <div role="alert" className={`${errorBox} space-y-2`}>
      <p>{form.error}</p>
      {form.neuLaden ? (
        <>
          <p>„Aktuellen Stand laden“ ersetzt deine ungespeicherten Eingaben.</p>
          <Button variant="secondary" size="sm" disabled={form.busy} onClick={form.neuLaden}>
            Aktuellen Stand laden
          </Button>
        </>
      ) : null}
    </div>
  )
}
