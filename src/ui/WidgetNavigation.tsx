import { useEffect, useRef, useState } from 'react'
import { App } from '@capacitor/app'
import { hasNativeWidgets } from '../widgets/native'
import { useView } from './useView'
import { useAuth } from '../auth/useAuth'

/** Explizite native Intents; auch bei bereits geöffneter App dieselben Wege. */
export function WidgetNavigation() {
  const { state } = useAuth()
  const { lists, overview, selectList, setTaskDetail, setOverviewCreating } = useView()
  const [request, setRequest] = useState<URL | null>(null)
  const handled = useRef<URL | null>(null)
  useEffect(() => {
    if (!hasNativeWidgets()) return
    let active = true
    const accept = (url: string) => { try { const value = new URL(url); if (active && value.protocol === 'prio-widget:' && value.host === 'open') setRequest(value) } catch { /* Fremde App-Links gehören nicht zum Widget. */ } }
    void App.getLaunchUrl().then(result => { if (result) accept(result.url) })
    const listener = App.addListener('appUrlOpen', ({ url }) => accept(url))
    return () => { active = false; void listener.then(value => value.remove()) }
  }, [])
  useEffect(() => {
    if (!request || handled.current === request || state.status !== 'authenticated' || overview.status !== 'ready') return
    const params = request.searchParams
    if (params.get('account') && params.get('account') !== state.user.id) { handled.current = request; return }
    const listId = params.get('list') || null
    if (listId && !lists.some(list => list.id === listId)) { selectList(null); handled.current = request; return }
    selectList(listId)
    if (params.get('action') === 'create') {
      if (listId) setTaskDetail({ taskId: null, listId })
      else setOverviewCreating(true)
    } else if (params.get('action') === 'task' && params.get('task')) setTaskDetail({ taskId: params.get('task'), listId: listId ?? '' })
    handled.current = request
  }, [request, state, lists, overview.status, selectList, setTaskDetail, setOverviewCreating])
  return null
}
