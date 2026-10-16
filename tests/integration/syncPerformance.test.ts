import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFakeServer } from '../support/fakeGateway'
import { createDevice, type DeviceHarness } from '../support/harness'
import { remoteList, remoteTask } from '../support/factories'
import { createWorkspaceRuntime, type WorkspaceRuntime } from '../../src/app/workspaceRuntime'
import { readMeta } from '../../src/db/metaStore'
import { META_PULL_CHECKPOINT } from '../../src/sync/syncStore'
import { createSyncEngine } from '../../src/sync/syncEngine'
import { deleteLocalDatabase } from '../../src/db/localDb'
import { FakeNetworkMonitor } from '../support/fakeAuth'

const { permission } = vi.hoisted(() => ({ permission: vi.fn(async () => 'unsupported') }))
vi.mock('../../src/reminders/capacitorNotifications', () => ({
  createCapacitorNotificationsPort: () => ({ checkPermission: permission }),
}))
const devices: DeviceHarness[] = []
const runtimes: WorkspaceRuntime[] = []
afterEach(async () => {
  for (const runtime of runtimes.splice(0)) runtime.schliessen()
  await Promise.all(devices.splice(0).map(device => device.dispose()))
  await deleteLocalDatabase('performance-user')
  vi.useRealTimers()
  vi.restoreAllMocks()
})
function seededServer() {
  const server = createFakeServer()
  const list = remoteList({ owner_id: 'performance-user' })
  server.lists.set(list.id, list)
  for (let index = 0; index < 100; index++) {
    const task = remoteTask({ id: `performance-${index}`, list_id: list.id })
    server.tasks.set(task.id, task)
  }
  return server
}
function gate() {
  let release!: () => void
  return { promise: new Promise<void>(resolve => { release = resolve }), release: () => release() }
}

describe('Wiederkehrende Sync-Arbeit', () => {
  it('schreibt bei 100 unveränderten Aufgaben keine Vergleichsstände erneut', async () => {
    const server = seededServer()
    const device = await createDevice({ userId: 'performance-user', gateway: server.gatewayFor('performance-user') })
    devices.push(device)
    await device.engine.sync()
    const put = vi.spyOn(device.db.meta, 'put')
    const rows = vi.spyOn(device.db.tasks, 'put')
    const result = await device.engine.sync()
    const basisWrites = put.mock.calls.filter(([row]) => row.key.startsWith('cloud-row:')).length
    expect({ basisWrites, taskWrites: rows.mock.calls.length, changed: result }).toMatchObject({ basisWrites: 0, taskWrites: 0, changed: { changed: false } })
  })

  it('fasst 100 Anforderungen während eines Durchlaufs zu einem Folgedurchlauf zusammen', async () => {
    const server = createFakeServer()
    const gateway = server.gatewayFor('performance-user')
    const started = gate(), resume = gate()
    const pull = gateway.pull.bind(gateway)
    let calls = 0
    gateway.pull = async () => {
      calls++
      const snapshot = await pull()
      if (calls === 1) { started.release(); await resume.promise }
      return snapshot
    }
    const device = await createDevice({ userId: 'performance-user', gateway })
    devices.push(device)
    const first = device.engine.sync()
    await started.promise
    const requests = Array.from({ length: 100 }, () => device.engine.sync())
    const list = await device.repositories.createList('Während des Abgleichs', 'performance-user')
    resume.release()
    await Promise.all([first, ...requests])
    expect(server.listById(list.id)?.name).toBe('Während des Abgleichs')
    expect(calls).toBe(2)
    expect(device.engine.isBusy()).toBe(false)
  })

  it('löst für unveränderte Downloads weder neue Datenabfragen noch Erinnerungsprüfungen aus', async () => {
    const server = seededServer()
    const runtime = await createWorkspaceRuntime({ userId: 'performance-user', gateway: server.gatewayFor('performance-user'), network: new FakeNetworkMonitor(true) })
    runtimes.push(runtime)
    await runtime.synchronisieren()
    await vi.waitFor(() => expect(runtime.zustand().syncing).toBe(false))
    const version = runtime.zustand().datenVersion
    permission.mockClear()
    await runtime.synchronisieren()
    expect({ version: runtime.zustand().datenVersion, reminderChecks: permission.mock.calls.length }).toEqual({ version, reminderChecks: 0 })
  })

  it('aktualisiert zeitabhängige Anzeigen ohne einen Datenbank-Leseimpuls', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    const runtime = await createWorkspaceRuntime({ userId: 'performance-user', gateway: createFakeServer().gatewayFor('performance-user'), network: new FakeNetworkMonitor(false) })
    runtimes.push(runtime)
    await runtime.synchronisieren()
    const version = runtime.zustand().datenVersion
    const before=runtime.zustand().jetztMs
    vi.advanceTimersByTime(30_000)
    expect(runtime.zustand()).toMatchObject({ datenVersion: version, jetztMs: before+30_000 })
  })
  it('bestätigt einen Cursor nur zusammen mit allen übernommenen Zeilen und verwendet ihn nach Neustart', async () => {
    const server=seededServer(), gateway=server.gatewayFor('performance-user')
    const pull=gateway.pull.bind(gateway)
    let version='1'
    const checkpoints: unknown[]=[]
    gateway.pull=async checkpoint=>{
      checkpoints.push(checkpoint)
      return {...await pull(),checkpoint:{snapshot:version,listIds:[...server.lists.keys()]}}
    }
    const device=await createDevice({userId:'performance-user',gateway});devices.push(device)
    await device.engine.sync()
    const before=await readMeta(device.db,META_PULL_CHECKPOINT)
    const [id,task]=[...server.tasks][0]
    server.tasks.set(id,{...task,title:'Delta'})
    version='2'
    vi.spyOn(device.db.tasks,'put').mockRejectedValueOnce(new Error('Lokaler Schreibfehler'))
    expect((await device.engine.sync()).kind).toBe('partial')
    expect(await readMeta(device.db,META_PULL_CHECKPOINT)).toBe(before)
    expect((await device.repositories.getTask(id))?.title).toBe(task.title)
    await device.engine.sync()
    expect((await device.repositories.getTask(id))?.title).toBe('Delta')
    const next=createSyncEngine({db:device.db,gateway,currentUserId:'performance-user'})
    await next.sync()
    expect(checkpoints.at(-1)).toMatchObject({snapshot:'2'})
  })

  it('bereinigt entzogene fremde Listen auch ohne neue Mitgliedschaftszeile und meldet eine Änderung', async () => {
    const server=createFakeServer(), gateway=server.gatewayFor('performance-user')
    const list=remoteList({owner_id:'someone-else'})
    // Bereits bestätigter Zugriff; der Server liefert dessen Entzug separat.
    gateway.pull=async checkpoint=>checkpoint ? {lists:[],members:[],tasks:[],removedListIds:[list.id],checkpoint:{snapshot:'2',listIds:[]}}
      : {lists:[list],members:[],tasks:[remoteTask({list_id:list.id})],checkpoint:{snapshot:'1',listIds:[list.id]}}
    const device=await createDevice({userId:'performance-user',gateway});devices.push(device)
    await device.engine.sync()
    const own=await device.repositories.createList('Meine Liste','performance-user')
    const result=await device.engine.sync()
    expect(result.changed).toBe(true)
    expect(await device.db.lists.get(list.id)).toBeUndefined()
    expect(await device.db.tasks.where('list_id').equals(list.id).count()).toBe(0)
    expect(await device.db.lists.get(own.id)).toBeDefined()
  })

  it('fasst auch Kontakte und Folgeprüfungen der Laufzeit zusammen', async () => {
    const server=createFakeServer(), gateway=server.gatewayFor('performance-user')
    const runtime=await createWorkspaceRuntime({userId:'performance-user',gateway,network:new FakeNetworkMonitor(true)})
    runtimes.push(runtime)
    await runtime.synchronisieren()
    const started=gate(), resume=gate(), pull=gateway.pull.bind(gateway)
    let calls=0
    gateway.pull=async()=>{calls++;const snapshot=await pull();if(calls===1){started.release();await resume.promise}return snapshot}
    const contacts=vi.spyOn(gateway,'coMemberContacts')
    const first=runtime.synchronisieren();await started.promise
    const requests=Array.from({length:100},()=>runtime.synchronisieren())
    resume.release();await Promise.all([first,...requests])
    expect(calls).toBe(2)
    expect(contacts).toHaveBeenCalledTimes(2)
    expect(runtime.zustand().syncing).toBe(false)
  })

  it('lässt einen beendeten Arbeitsbereich keine verspätete Antwort in die neue Laufzeit schreiben', async () => {
    const server=seededServer(), firstGateway=server.gatewayFor('performance-user'), nextGateway=server.gatewayFor('performance-user')
    const firstStarted=gate(), firstResume=gate(), nextStarted=gate(), nextResume=gate()
    const firstPull=firstGateway.pull.bind(firstGateway), nextPull=nextGateway.pull.bind(nextGateway)
    firstGateway.pull=async()=>{const snapshot=await firstPull();firstStarted.release();await firstResume.promise;return {...snapshot,checkpoint:{snapshot:'1',listIds:[...server.lists.keys()]}}}
    let nextCalls=0
    nextGateway.pull=async()=>{const snapshot=await nextPull();if(++nextCalls===1){nextStarted.release();await nextResume.promise}return {...snapshot,checkpoint:{snapshot:'2',listIds:[...server.lists.keys()]}}}
    const first=await createWorkspaceRuntime({userId:'performance-user',gateway:firstGateway,network:new FakeNetworkMonitor(true)});runtimes.push(first)
    await firstStarted.promise
    const finishedFirst=first.synchronisieren()
    first.schliessen()
    const next=await createWorkspaceRuntime({userId:'performance-user',gateway:nextGateway,network:new FakeNetworkMonitor(true)});runtimes.push(next)
    await nextStarted.promise
    firstResume.release();await finishedFirst
    const finishedNext=next.synchronisieren()
    nextResume.release();await finishedNext
    expect(next.zustand().datenVersion).toBeGreaterThan(0)
    expect(await next.repositories.listLists()).toHaveLength(1)
  })

  it('meldet Übernahmen eines anderen Tabs einmalig, ohne leere Cursorfortschritte als Datenänderung zu zählen', async()=>{
    const server=seededServer(), gateway=server.gatewayFor('performance-user')
    const device=await createDevice({userId:'performance-user',gateway});devices.push(device)
    const other=createSyncEngine({db:device.db,gateway:server.gatewayFor('performance-user'),currentUserId:'performance-user'})
    await device.engine.sync();await other.sync()
    expect((await device.engine.sync()).changed).toBe(false)
    const [id,task]=[...server.tasks][0]
    server.tasks.set(id,{...task,title:'Aus anderem Tab'})
    expect((await other.sync()).changed).toBe(true)
    expect((await device.engine.sync()).changed).toBe(true)
    expect((await device.engine.sync()).changed).toBe(false)
  })

  it('schreibt einen unveränderten Konflikt ohne alte Vergleichsbasis nicht immer wieder',async()=>{
    const server=seededServer(),device=await createDevice({userId:'performance-user',gateway:server.gatewayFor('performance-user')});devices.push(device)
    await device.engine.sync()
    await device.db.meta.delete('cloud-row:tasks:performance-0')
    await device.repositories.updateTask('performance-0',{title:'Unbekannte Offline-Basis'})
    expect((await device.engine.sync()).kind).toBe('conflict')
    const put=vi.spyOn(device.db.meta,'put')
    const result=await device.engine.sync()
    expect(put.mock.calls.filter(([row])=>row.key.startsWith('cloud-row:'))).toHaveLength(0)
    expect(result.changed).toBe(false)
  })

})
