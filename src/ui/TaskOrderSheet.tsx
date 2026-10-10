import { useState } from 'react'
import { useTasks } from '../app/hooks'
import { useWorkspace } from '../app/useWorkspace'
import type { LocalTask } from '../domain/types'
import { Button } from './components/Button'
import { Sheet } from './components/Sheet'
import { errorBox, input } from './styles'

/** Die bestehende Reihenfolge ändern, ohne eine Ziehgeste zu benötigen. */
export function TaskOrderSheet({ task, onClose }: { task: LocalTask; onClose: () => void }) {
  const tasks = useTasks(task.list_id)
  const { repositories } = useWorkspace()
  const peers = tasks.filter(row => row.section_id === task.section_id && row.id !== task.id)
  const [beforeId, setBeforeId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const apply = async () => {
    if (busy || !tasks.some(row => row.id === task.id)) return
    setBusy(true); setError(null)
    try {
      if (beforeId && !peers.some(row => row.id === beforeId)) throw new Error('Die gewählte Nachbaraufgabe ist nicht mehr verfügbar. Wähle die Position erneut.')
      const ids = peers.map(row => row.id)
      ids.splice(beforeId ? ids.indexOf(beforeId) : ids.length, 0, task.id)
      // Andere Gruppen behalten ihre relative Reihenfolge und ihre Positionen.
      await repositories.reorderTasks(task.list_id, ids)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Die Reihenfolge konnte nicht gespeichert werden.')
      setBusy(false)
    }
  }
  return <Sheet title="Reihenfolge ändern" subtitle={task.title} name="aufgabe-ordnen" onClose={() => { if (!busy) onClose() }}>
    <div className="space-y-4 p-5">
      <p className="text-body text-ink-muted">Wähle die Position innerhalb des aktuellen Bereichs.</p>
      <label className="block space-y-2 text-body">
        <span>Einfügen vor</span>
        <select className={input} value={beforeId} disabled={busy} onChange={event => setBeforeId(event.target.value)}>
          <option value="">Am Ende</option>
          {peers.map(row => <option key={row.id} value={row.id}>{row.title}</option>)}
        </select>
      </label>
      {error ? <p role="alert" className={errorBox}>{error}</p> : null}
      <Button variant="primary" disabled={busy || !tasks.some(row => row.id === task.id)} onClick={() => void apply()}>Position übernehmen</Button>
    </div>
  </Sheet>
}
