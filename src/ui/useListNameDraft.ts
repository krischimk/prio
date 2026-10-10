import { useContext } from 'react'
import type { LocalList } from '../domain/types'
import { TaskDraftContext } from './taskDraftContext'

export function useListNameDraft(list: LocalList) {
  const context = useContext(TaskDraftContext)
  if (!context) throw new Error('useListNameDraft braucht einen TaskDraftProvider.')
  return {
    name: context.listNames[list.id] ?? list.name,
    setName: (name: string) => context.setListName(list.id, name),
    discard: () => context.discardListName(list.id),
  }
}
