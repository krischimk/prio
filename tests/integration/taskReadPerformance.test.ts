import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { LocalDatabase } from '../../src/db/localDb'
import { createRepositories } from '../../src/db/repositories'
import { createFixedClock } from '../../src/domain/clock'
import { localList, localTask } from '../support/factories'
import { toRemoteTask } from '../../src/domain/mapping'

const databases: Dexie[]=[]
afterEach(async()=>{for(const db of databases.splice(0)) await db.delete()})
async function fixture() {
  const db=new LocalDatabase(`task-read-${crypto.randomUUID()}`);databases.push(db);await db.open()
  const list=localList({keep_completed:true}), clock=createFixedClock()
  await db.lists.put(list)
  await db.tasks.bulkPut([
    localTask({id:'open-a',list_id:list.id,tags:['Uni']}),localTask({id:'open-b',list_id:list.id,tags:['Uni','Dringend']}),
    ...Array.from({length:1000},(_,index)=>localTask({id:`done-${index}`,list_id:list.id,completed:true,completed_at:clock.now(),tags:index%2?['Uni','Dringend']:['Uni']})),
  ])
  const repositories=createRepositories(db,clock), read:string[]=[]
  db.tasks.hook('reading',task=>{read.push(task.id);return task})
  return {db,list,repositories,read,clock}
}
describe('Gezielte lokale Aufgabenabfragen',()=>{
  it('liest für zwei offene Aufgaben nur zwei Zeilen aus 1002 Aufgaben',async()=>{
    const {repositories,list,read}=await fixture()
    expect((await repositories.listTasks(list.id)).map(task=>task.id).sort()).toEqual(['open-a','open-b'])
    expect(read).toHaveLength(2)
  })
  it('liest Tagvorschläge aus dem Index ohne Aufgabeninhalte zu laden',async()=>{
    const {repositories,read}=await fixture()
    expect(await repositories.listTaskTags()).toEqual(['Dringend','Uni'])
    expect(read).toHaveLength(0)
  })
  it('zählt Erledigtes einschließlich AND-Tagfilter ohne Aufgabeninhalte',async()=>{
    const {repositories,list,read}=await fixture()
    expect(await repositories.countCompletedTasks(list.id)).toBe(1000)
    expect(await repositories.countCompletedTasks(list.id,['uni','dringend'])).toBe(500)
    expect(read).toHaveLength(0)
  })
  it('hält die Indizes beim Abhaken, Bearbeiten, Verschieben und Löschen aktuell',async()=>{
    const {db,repositories,list,clock}=await fixture()
    const other=await repositories.createList('Zweite',list.owner_id,{keepCompleted:true})
    await repositories.setTaskCompleted('open-a',true)
    expect(await repositories.countCompletedTasks(list.id)).toBe(1001)
    await repositories.updateTask('open-a',{tags:['Neu']})
    expect(await repositories.countCompletedTasks(list.id,['neu'])).toBe(1)
    await repositories.moveTask('open-a',other.id)
    expect(await repositories.countCompletedTasks(list.id,['neu'])).toBe(0)
    expect(await repositories.countCompletedTasks(other.id,['neu'])).toBe(1)
    await repositories.deleteTask('open-a')
    expect(await repositories.countCompletedTasks(other.id)).toBe(0)
    expect(await repositories.listTaskTags()).not.toContain('Neu')
    await db.tasks.update('done-1',{completed_expires_at:clock.now()})
    expect(await repositories.countCompletedTasks(list.id,['dringend'])).toBe(499)
    await db.tasks.update('done-3',{expired_at:clock.now()})
    expect(await repositories.countCompletedTasks(list.id,['dringend'])).toBe(498)
    expect(Object.keys(toRemoteTask((await db.tasks.get('done-2'))!))).not.toContain('read_state')
  })
  it('ergänzt Indizes beim Update einer echten Version-8-Datenbank ohne Dirty-Markierung',async()=>{
    const name=`old-task-index-${crypto.randomUUID()}`,old=new Dexie(name)
    old.version(8).stores({lists:'id,owner_id,updated_at,dirty,deleted_at',list_members:'[list_id+user_id],list_id,user_id,updated_at,dirty',tasks:'id,list_id,updated_at,dirty,completed_at,deleted_at',meta:'key',reminders:'[taskId+at],taskId,notificationId,at',list_preferences:'[list_id+user_id],list_id,user_id,dirty,updated_at',user_preferences:'id,dirty,updated_at'})
    await old.open()
    const list=localList({keep_completed:true}),task=localTask({id:'old',list_id:list.id,dirty:0,tags:['Alt']})
    await old.table('lists').put(list);await old.table('tasks').put(task);old.close()
    const next=new LocalDatabase(name);databases.push(next);await next.open()
    const repositories=createRepositories(next)
    expect((await repositories.listTasks(list.id)).map(task=>task.id)).toEqual(['old'])
    expect(await repositories.listTaskTags()).toEqual(['Alt'])
    expect(await next.tasks.where('dirty').equals(1).count()).toBe(0)
  })
})
