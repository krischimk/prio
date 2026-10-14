import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { TaskDraftContext, emptyNewListDraft, type TaskDraft, type TaskDraftState } from './taskDraftContext'

/**
 * Ungespeicherte Eingaben der laufenden Sitzung, über beiden Ansichten.
 * Gespeicherte Daten kommen weiterhin ausschließlich aus den Datenbank-Hooks.
 */
export function TaskDraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Record<string, TaskDraft>>({})
  const [overviewTarget, selectOverviewTarget] = useState<string | null>(null)
  const [listNames, setListNames] = useState<Record<string, string>>({})
  const [newList, setNewList] = useState(emptyNewListDraft)
  const savingList = useRef(false)
  const changeNewList = useCallback<TaskDraftState['changeNewList']>(patch => {
    if (!savingList.current) setNewList(previous => ({ ...previous, ...patch, error: null }))
  }, [])
  const beginListSave = useCallback(() => {
    if (savingList.current) return false
    savingList.current = true
    setNewList(previous => ({ ...previous, busy: true, error: null }))
    return true
  }, [])
  const listSaved = useCallback(() => {
    savingList.current = false
    setNewList(emptyNewListDraft)
  }, [])
  const listFailed = useCallback((message: string) => {
    savingList.current = false
    setNewList(previous => ({ ...previous, busy: false, error: message }))
  }, [])
  const pending = useRef(new Set<string>())
  const change = useCallback<TaskDraftState['change']>((key, initial, update) => {
    if (pending.current.has(key)) return
    setDrafts(previous => ({ ...previous, [key]: update(previous[key] ?? initial) }))
  }, [])
  const discard = useCallback((key: string) => {
    if (pending.current.has(key)) return
    setDrafts(previous => {
      const next = { ...previous }
      delete next[key]
      return next
    })
  }, [])
  const beginSave = useCallback<TaskDraftState['beginSave']>((key, initial) => {
    // Zwei Submit-Ereignisse können vor dem nächsten React-Render eintreffen.
    if (pending.current.has(key)) return false
    pending.current.add(key)
    setDrafts(previous => ({ ...previous, [key]: { ...(previous[key] ?? initial), busy: true, error: null, conflict: false } }))
    return true
  }, [])
  const saved = useCallback((key: string) => {
    pending.current.delete(key)
    discard(key)
  }, [discard])
  const failed = useCallback<TaskDraftState['failed']>((key, error, conflict) => {
    pending.current.delete(key)
    setDrafts(previous => previous[key]
      ? { ...previous, [key]: { ...previous[key], busy: false, error, conflict } }
      : previous)
  }, [])
  const setListName = useCallback((id: string, value: string) => {
    setListNames(previous => ({ ...previous, [id]: value }))
  }, [])
  const discardListName = useCallback((id: string) => {
    setListNames(previous => {
      const next = { ...previous }
      delete next[id]
      return next
    })
  }, [])
  const value = useMemo<TaskDraftState>(() => ({
    newList, changeNewList, beginListSave, listSaved, listFailed,
    drafts, overviewTarget, selectOverviewTarget, change, discard, beginSave, saved, failed, listNames, setListName, discardListName,
  }), [newList, changeNewList, beginListSave, listSaved, listFailed, drafts, overviewTarget, change, discard, beginSave, saved, failed, listNames, setListName, discardListName])
  return <TaskDraftContext.Provider value={value}>{children}</TaskDraftContext.Provider>
}
