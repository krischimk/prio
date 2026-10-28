import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { CompletedTasksSection } from '../../src/ui/CompletedTasksSection'
import { localList, localTask } from '../support/factories'

const workspace=vi.hoisted(()=>({repositories:{countCompletedTasks:vi.fn(),listCompletedTasks:vi.fn()},dataVersion:0,nowMs:Date.parse('2026-01-01T10:00:00Z')}))
vi.mock('../../src/app/useWorkspace',()=>({useWorkspace:()=>workspace,useWorkspaceData:()=>workspace}))
vi.mock('../../src/ui/useView',()=>({useView:()=>({tagFilter:[],setTaskDetail:vi.fn()})}))
vi.mock('../../src/ui/TaskRow',()=>({TaskRow:({task}:{task:{title:string}})=><li>{task.title}</li>}))
beforeEach(()=>{
  workspace.dataVersion=0
  vi.resetAllMocks()
  workspace.repositories.countCompletedTasks.mockResolvedValue(1234)
  workspace.repositories.listCompletedTasks.mockResolvedValue([localTask({title:'Erledigte Aufgabe',completed:true})])
})
it('zählt geschlossen, liest erst beim Öffnen und lädt nach dem Einklappen keine Inhalte neu',async()=>{
  const lists=[localList({keep_completed:true})]
  const {rerender}=render(<CompletedTasksSection lists={lists} currentUserId="user-1" />)
  await screen.findByRole('button',{name:/Erledigt\s*1234/})
  expect(workspace.repositories.listCompletedTasks).not.toHaveBeenCalled()
  workspace.nowMs+=30_000
  rerender(<CompletedTasksSection lists={lists} currentUserId="user-1" />)
  expect(workspace.repositories.countCompletedTasks).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button',{name:/Erledigt\s*1234/}))
  await screen.findByText('Erledigte Aufgabe')
  expect(workspace.repositories.listCompletedTasks).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button',{name:/Erledigt\s*1234/}))
  workspace.dataVersion++
  rerender(<CompletedTasksSection lists={lists} currentUserId="user-1" />)
  await waitFor(()=>expect(workspace.repositories.countCompletedTasks).toHaveBeenCalledTimes(2))
  expect(workspace.repositories.listCompletedTasks).toHaveBeenCalledTimes(1)
})
