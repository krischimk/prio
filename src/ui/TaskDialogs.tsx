import { useState } from 'react'
import { useTask, useTaskQuery } from '../app/hooks'
import { useAuth } from '../auth/useAuth'
import { useView } from './useView'
import { TaskEditor } from './TaskEditor'
import { TaskOrderSheet } from './TaskOrderSheet'
import { MoveTaskSheet } from './MoveTaskSheet'
import { ListSettingsSheet } from './ListSettingsSheet'
import { Screen } from './components/Screen'
import { Button } from './components/Button'
import { errorBox } from './styles'

/** Gemeinsame Dialoge bleiben beim Wechsel der Fensterbreite eingebunden. */
export function TaskDialogs() {
  const { state } = useAuth()
  const userId = state.status === 'authenticated' ? state.user.id : ''
  const { lists, overview, taskDetail, setTaskDetail, setOverviewCreating, listSettingsId, setListSettingsId } = useView()
  const query = useTaskQuery(taskDetail?.taskId ?? null)
  const list = lists.find(row => row.id === (query.task?.list_id ?? taskDetail?.listId))
  const settingsList = lists.find(row => row.id === listSettingsId)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [orderingId, setOrderingId] = useState<string | null>(null)
  const movingTask = useTask(movingId)
  const orderingTask = useTask(orderingId)
  const unavailable = taskDetail !== null && (query.status !== 'ready' || !list || (taskDetail.taskId !== null && query.task === null))
  const excluded = list && !overview.preferences.some(row => row.list_id === list.id && row.include_in_overview)
  return <>
    {settingsList ? <ListSettingsSheet key={settingsList.id} list={settingsList} currentUserId={userId} onClose={() => setListSettingsId(null)} /> : null}
    {taskDetail && list && !unavailable ? <TaskEditor key={taskDetail.taskId ?? `new:${list.id}`} task={query.task} listId={list.id}
      lists={lists} sections={list.sections} currentUserId={userId} onClose={() => setTaskDetail(null)}
      onRequestMove={task => setMovingId(task.id)} onRequestOrder={task => setOrderingId(task.id)}
      onChangeTarget={taskDetail.fromOverview ? () => { setTaskDetail(null); setOverviewCreating(true) } : undefined}
      targetHint={taskDetail.fromOverview && taskDetail.taskId === null && excluded ? `„${list.name}“ ist nicht in der Gesamtansicht. Deine neue Aufgabe wird dort gespeichert und erscheint in dieser Listenansicht.` : undefined} /> : null}
    {unavailable ? <Screen label="Aufgabe" name="aufgabe-laden" onClose={() => setTaskDetail(null)} header={
      <div className="p-4"><Button variant="secondary" onClick={() => setTaskDetail(null)}>Schließen</Button></div>
    }>
      <div className="space-y-3 p-5">
        {query.status === 'loading' ? <p role="status">Aufgabe wird geladen …</p> : query.status === 'error' ? <>
          <p role="alert" className={errorBox}>Die Aufgabe konnte nicht geladen werden. Dein Entwurf bleibt erhalten.</p>
          <Button variant="secondary" onClick={query.retry}>Erneut versuchen</Button>
        </> : <p role="status">Diese Aufgabe oder ihre Liste ist nicht mehr verfügbar.</p>}
      </div>
    </Screen> : null}
    {movingTask ? <MoveTaskSheet task={movingTask} lists={lists} onClose={() => setMovingId(null)} onMoved={() => setTaskDetail(null)} /> : null}
    {orderingTask ? <TaskOrderSheet task={orderingTask} onClose={() => setOrderingId(null)} /> : null}
  </>
}
