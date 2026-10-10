import { useRef, useState } from 'react'
import type { CloudConflict, CloudRow } from '../domain/cloudMerge'
import { fromRemoteList, fromRemoteMember, fromRemoteTask, fromRemotePreference, fromRemoteUserPreference } from '../domain/mapping'
import { compareTasks } from '../domain/ordering'
import type { RemoteList, RemoteListMember, RemoteListPreference, RemoteUserPreference, RemoteTask } from '../domain/types'
import { useTasks } from '../app/hooks'
import { useAuth } from '../auth/useAuth'
import { useWorkspace } from '../app/useWorkspace'
import { Sheet } from './components/Sheet'
import { Button } from './components/Button'
import { errorBox } from './styles'
import { formatCompletedLabel, formatCreatedLabel, formatDueLabel, formatReminderLabel } from './datetime'
import { describeRecurrence } from './recurrence'
import { formatReminderOffset } from './reminder'
import { findListIcon } from './listIcons'
import { ListIcon } from './ListIcon'
import { useView } from './useView'

function ConflictVersion({ conflict, row, viewerId }: { conflict: CloudConflict; row: CloudRow | null; viewerId: string | null }) {
  const { lists } = useView()
  const show = (field: string) => conflict.fields.includes(field) || conflict.fields.includes('unknown-base')
  const task = conflict.table === 'tasks' && row ? fromRemoteTask(row as RemoteTask) : null
  const tasks = useTasks(task && show('position') ? task.list_id : null)
  if (!row) return 'In der Cloud nicht vorhanden.'
  if (task) {
    const list = lists.find(entry => entry.id === task.list_id)
    const section = list?.sections.find(entry => entry.id === task.section_id)
    const ordered = [...tasks.filter(entry => entry.id !== task.id && !entry.completed && entry.section_id === task.section_id), task].sort(compareTasks)
    const index = ordered.findIndex(entry => entry.id === task.id)
    const before = ordered[index - 1]
    const after = ordered[index + 1]
    return <>
      <p className="break-words font-medium">{task.title}</p>
      {task.description ? <p className="whitespace-pre-wrap break-words">{task.description}</p> : show('description') ? <p>Keine Beschreibung.</p> : null}
      <p>{task.deleted_at ? 'Gelöscht' : task.completed ? 'Erledigt' : 'Offen'}</p>
      {show('created_at') ? <p>{formatCreatedLabel(task.created_at)}</p> : null}
      {show('completed_at') && task.completed_at ? <p>{formatCompletedLabel(task.completed_at)}</p> : null}
      {show('due_at') || task.due_at ? <p>{task.due_at ? formatDueLabel(task.due_at, task.completed).text : 'Keine Fälligkeit.'}</p> : null}
      {show('recurrence') ? <p>Wiederholung: {describeRecurrence(task.recurrence) ?? 'Keine'}</p> : null}
      {show('reminders') ? <div>
        <p>Erinnerungen: {task.reminders.length === 0 ? 'Keine' : null}</p>
        {task.reminders.map((reminder, index) => <p key={index} className="break-words">
          {reminder.form === 'offset' ? formatReminderOffset(reminder.minutes) : formatReminderLabel(reminder.at)}
          {reminder.mutedBy?.length ? ` · stumm für ${reminder.mutedBy.map(id => id === viewerId ? 'dich' : id.slice(0, 8)).join(', ')}` : ''}
        </p>)}
      </div> : null}
      {show('successor_id') ? <p>{task.successor_id ? 'Seriennachfolger vorhanden.' : 'Kein Seriennachfolger.'}</p> : null}
      {show('list_id') ? <p>Liste: {list?.name ?? 'Nicht mehr verfügbar'}</p> : null}
      {show('section_id') ? <p>Bereich: {task.section_id === null ? 'Ohne Bereich' : section?.name ?? 'Inzwischen entfernt'}</p> : null}
      {show('position') ? <div>
        <p className="text-meta text-ink-muted">Verglichen mit den aktuell geladenen offenen Aufgaben:</p>
        <p>{before ? `Nach „${before.title}“` : 'Am Anfang'} · {after ? `vor „${after.title}“` : 'am Ende'}</p>
      </div> : null}
    </>
  }
  if (conflict.table === 'lists') {
    const list = fromRemoteList(row as RemoteList)
    return <>
      <p className="break-words font-medium">{list.name}</p>
      <p>{list.deleted_at ? 'Gelöscht' : 'Aktiv'}</p>
      {show('icon') ? <p className="flex items-center gap-2"><ListIcon icon={list.icon} />{findListIcon(list.icon)?.label ?? 'Kein Symbol'}</p> : null}
      {show('is_shared') ? <p>{list.is_shared ? 'Geteilt' : 'Privat'}</p> : null}
      {show('sections') ? <p>Bereiche: {list.sections?.length ? list.sections.map(section => section.name).join(', ') : 'Keine'}</p> : null}
      {show('keep_completed') ? <p>Erledigte Aufgaben: {list.keep_completed ? 'Dauerhaft unter Abgehakt' : 'Nach sieben Tagen endgültig löschen'}</p> : null}
    </>
  }
  if (conflict.table === 'preferences') {
    const preference = fromRemotePreference(row as RemoteListPreference)
    return <><p>Liste: {lists.find(list => list.id === preference.list_id)?.name ?? 'Nicht mehr verfügbar'}</p>
      <p>{preference.include_in_overview ? 'In deiner Gesamtansicht' : 'Aus deiner Gesamtansicht ausgeschlossen'}</p></>
  }
  if (conflict.table === 'userPreferences') {
    const preference = fromRemoteUserPreference(row as RemoteUserPreference)
    return <><p>Ansicht: {preference.overview_mode === 'by_list' ? 'Nach Listen gruppiert' : 'Neueste zuerst'}</p>
      <p>Standardliste: {preference.default_list_id ? lists.find(list => list.id === preference.default_list_id)?.name ?? 'Nicht mehr verfügbar' : 'Jedes Mal auswählen'}</p></>
  }
  const member = fromRemoteMember(row as RemoteListMember)
  return <>
    <p>Liste: {lists.find(list => list.id === member.list_id)?.name ?? 'Nicht mehr verfügbar'}</p>
    <p>{member.user_id === viewerId ? 'Deine Mitgliedschaft' : `Person ${member.user_id.slice(0, 8)}`}</p>
    <p>{row.deleted_at ? 'Mitgliedschaft beendet' : 'Aktive Mitgliedschaft'}</p>
  </>
}

const fields: Record<string, string> = {
  title: 'Titel', description: 'Beschreibung', name: 'Listenname', due_at: 'Fälligkeit', recurrence: 'Wiederholung', reminders: 'Erinnerungen',
  completed: 'Erledigt-Status', completed_at: 'Abschlusszeitpunkt', successor_id: 'Seriennachfolger', list_id: 'Liste', section_id: 'Bereich',
  position: 'Reihenfolge', sections: 'Bereiche', icon: 'Listensymbol', is_shared: 'Freigabe', deleted_at: 'Löschstatus', keep_completed: 'Aufbewahrung erledigter Aufgaben', reopen_context: 'Rückkehr und Seriennachfolger',
  include_in_overview: 'Aufnahme in die Gesamtansicht', default_list_id: 'Standardliste', overview_mode: 'Bevorzugte Ansicht',
}

/** Öffnet sich nur auf Wunsch und nur für tatsächliche Cloud-Konflikte. */
export function CloudConflictsSheet({ conflicts, open, onClose }: { conflicts: CloudConflict[]; open: boolean; onClose: () => void }) {
  const { repositories, runSync } = useWorkspace()
  const { state } = useAuth()
  const viewerId = state.status === 'authenticated' ? state.user.id : null
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const choose = async (conflict: CloudConflict, choice: 'local' | 'remote') => {
    if (saving.current) return
    saving.current = true
    setBusy(true); setError(null)
    try {
      await repositories.resolveCloudConflict(conflict, choice)
      await runSync()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Die Entscheidung konnte nicht gespeichert werden.')
    } finally { saving.current = false; setBusy(false) }
  }
  if (!open) return null
  return <Sheet name="cloud-conflicts" title="Änderungskonflikte" onClose={() => { if (!busy) onClose() }}>
    <div className="space-y-4 p-4 text-body text-ink">
      <p>Deine Eingaben sind erhalten geblieben. Änderungen an verschiedenen Feldern werden automatisch zusammengeführt. Für diese Änderungen ist deine Entscheidung nötig.</p>
      {error ? <p role="alert" className={errorBox}>{error}</p> : null}
      {conflicts.length === 0 ? <p>Alle Konflikte sind geklärt.</p> : conflicts.map(conflict => <section key={`${conflict.table}:${conflict.id}`} className="space-y-3 rounded-card border border-line p-3">
        <p className="text-meta text-ink-muted">{conflict.fields.includes('unknown-base') ? 'Für diese Eingabe fehlt ein bestätigter Ausgangsstand. Vergleiche deshalb beide vollständigen Fassungen.' : conflict.fields.includes('missing') ? 'Die zuvor vorhandene Cloud-Fassung fehlt.' : [...new Set(conflict.fields.map(field => fields[field] ?? 'Weitere Angaben'))].join(', ')}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0 space-y-1"><h3 className="font-medium">Auf diesem Gerät</h3><ConflictVersion conflict={conflict} row={conflict.local} viewerId={viewerId} /></div>
          <div className="min-w-0 space-y-1"><h3 className="font-medium">In der Cloud</h3><ConflictVersion conflict={conflict} row={conflict.remote} viewerId={viewerId} /></div>
        </div>
        <p className="text-meta text-ink-muted">{conflict.base ? '„Cloudstand übernehmen“ ersetzt deine gespeicherte lokale Änderung. „Meine Änderungen verwenden“ behält die von dir geänderten Felder und zusammengehörigen Angaben; andere Cloud-Änderungen bleiben erhalten.' : 'Hier fehlt die gemeinsame Ausgangsfassung. Deine Wahl übernimmt deshalb eine der beiden vollständigen Fassungen.'}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => { void choose(conflict, 'remote') }}>Cloudstand übernehmen</Button>
          <Button variant="secondary" disabled={busy} onClick={() => { void choose(conflict, 'local') }}>Meine Änderungen verwenden</Button>
        </div>
      </section>)}
      <Button variant="ghost" disabled={busy} onClick={onClose}>Schließen</Button>
    </div>
  </Sheet>
}
