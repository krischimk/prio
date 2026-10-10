import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { TaskDraftContext, type TaskDraft, type TaskDraftState } from './taskDraftContext'

/**
 * Ungespeicherte Eingaben der laufenden Sitzung, über beiden Ansichten.
 * Gespeicherte Daten kommen weiterhin ausschließlich aus den Datenbank-Hooks.
 */
export function TaskDraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Record<string, TaskDraft>>({})
  const [listNames, setListNames] = useState<Record<string, string>>({})
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
    drafts, change, discard, beginSave, saved, failed, listNames, setListName, discardListName,
  }), [drafts, change, discard, beginSave, saved, failed, listNames, setListName, discardListName])
  return <TaskDraftContext.Provider value={value}>{children}</TaskDraftContext.Provider>
}
