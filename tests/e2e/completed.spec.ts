import { expect, test, type Page } from '@playwright/test'
import * as desktop from './support/helpers'
import * as phone from './support/mobile'

for (const mobile of [false,true]) test.describe(mobile ? 'Abgehakt Telefon' : 'Abgehakt breit', () => {
  test.use({ viewport: mobile ? {width:390,height:844} : {width:1280,height:800}, hasTouch:mobile })
  test.beforeEach(async ({request}) => { await desktop.resetServer(request) })
  async function setting(page: Page, keep: boolean) {
    const scope=await desktop.openListSettings(page)
    await scope.getByLabel('Abgehakt am Listenende').setChecked(keep)
    await expect(scope.getByLabel('Abgehakt am Listenende')).toBeEnabled()
    await desktop.closeListSettings(page)
  }
  async function sync(page:Page) {
    if(mobile) await phone.openMenu(page)
    await page.getByRole('button',{name:'Jetzt synchronisieren',exact:true}).click()
    if(mobile) await page.getByRole('button',{name:'Menü schließen',exact:true}).click()
  }
  async function restore(page:Page) {
    if(mobile) await phone.openMenu(page)
    await page.getByRole('button',{name:mobile ? 'Aufgaben wiederherstellen' : 'Wiederherstellen',exact:true}).click()
    return page.getByRole('dialog',{name:'Aufgaben wiederherstellen'})
  }
  test('Wiederöffnen behält einen inzwischen bearbeiteten nächsten Termin',async ({page,request}) => {
    await (mobile ? phone.register : desktop.register)(page,desktop.uniqueEmail('completed-series'))
    await (mobile ? phone.createList : desktop.createList)(page,'Routinen')
    await setting(page,true)
    await (mobile ? phone.createTask : desktop.createTask)(page,'Serie')
    async function edit() {
      if(mobile) await phone.taskRow(page,'Serie').click()
      else await desktop.taskItem(page,'Serie').getByRole('button',{name:'Bearbeiten'}).click()
    }
    await edit()
    await page.getByLabel('Fällig am (optional)',{exact:true}).fill(new Date(Date.now()+86400000).toISOString().slice(0,16))
    await page.getByLabel('Wiederholung',{exact:true}).selectOption('daily')
    await page.getByRole('button',{name:'Speichern',exact:true}).click()
    await page.getByLabel('Aufgabe erledigen: Serie',{exact:true}).click()
    await expect.poll(async()=> (await desktop.serverState(request)).tasks.length).toBe(2)
    await edit()
    await page.getByLabel('Titel',{exact:true}).fill('Nächster Termin geändert')
    await page.getByRole('button',{name:'Speichern',exact:true}).click()
    const section=page.getByRole('region',{name:'Abgehakt',exact:true})
    await section.getByRole('button',{name:'Abgehakt 1'}).click()
    await section.getByRole('button',{name:'Wieder öffnen',exact:true}).click()
    await expect(page.getByLabel('Aufgabe erledigen: Serie',{exact:true})).toBeVisible()
    await expect(page.getByLabel('Aufgabe erledigen: Nächster Termin geändert',{exact:true})).toBeVisible()
    await expect.poll(async()=> (await desktop.serverState(request)).tasks.filter(task=>!task.completed && task.deleted_at===null).length).toBe(2)
  })
  test('alte Abschlüsse bleiben ausschließlich am Ende; Abschalten gewährt sieben Tage',async ({page,request},info) => {
    const email=desktop.uniqueEmail('completed-old')
    await (mobile ? phone.register : desktop.register)(page,email)
    await (mobile ? phone.createList : desktop.createList)(page,'Haushalt')
    await setting(page,true)
    await (mobile ? phone.createTask : desktop.createTask)(page,'Schon lange erledigt')
    await expect.poll(async()=> (await desktop.serverState(request)).tasks.length).toBe(1)
    const [base]=(await desktop.serverState(request)).tasks
    const login=await request.post(`${desktop.MOCK_URL}/auth/v1/token?grant_type=password`,{data:{email,password:desktop.PASSWORD}})
    const {access_token}=await login.json()
    const oldDate=new Date(Date.now()-40*86400000).toISOString()
    const answer=await request.post(`${desktop.MOCK_URL}/rest/v1/rpc/sync_push`,{headers:{Authorization:`Bearer ${access_token}`},data:{p_changes:[{table:'tasks',row:{...base,completed:true,completed_at:oldDate,completed_expires_at:null},expected:base}]}})
    expect((await answer.json())[0].kind).toBe('written')
    await sync(page)
    const section=page.getByRole('region',{name:'Abgehakt',exact:true})
    await expect(section.getByRole('button',{name:'Abgehakt 1'})).toHaveAttribute('aria-expanded','false')
    const panel=await restore(page)
    await expect(panel).not.toContainText('Schon lange erledigt')
    await panel.getByRole('button',{name:'Schließen',exact:true}).click()
    await section.getByRole('button',{name:'Abgehakt 1'}).click()
    await expect(section).toContainText('Schon lange erledigt')
    if(mobile) {
      await page.screenshot({path:info.outputPath('completed-phone.png'),fullPage:true})
      await page.setViewportSize({width:740,height:360})
      await page.screenshot({path:info.outputPath('completed-landscape.png'),fullPage:true})
      expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.setViewportSize({width:390,height:844})
    }
    await setting(page,false)
    await expect(section).toHaveCount(0)
    const restored=await restore(page)
    await expect(restored).toContainText('Schon lange erledigt')
    await expect.poll(async()=> Date.parse((await desktop.serverState(request)).tasks[0].completed_expires_at!)-Date.now()).toBeGreaterThan(6*86400000)
    expect((await desktop.serverState(request)).tasks[0].completed_at).toBe(oldDate)
  })
  test('ein verspäteter Abschluss wird endgültig entfernt und erscheint in keinem Wiederherstellungsbereich',async ({page,request})=> {
    const email=desktop.uniqueEmail('completed-expired')
    await (mobile ? phone.register : desktop.register)(page,email)
    await (mobile ? phone.createList : desktop.createList)(page,'Haushalt')
    await (mobile ? phone.createTask : desktop.createTask)(page,'Offen')
    await expect.poll(async()=> (await desktop.serverState(request)).tasks.length).toBe(1)
    const state=await desktop.serverState(request)
    const login=await request.post(`${desktop.MOCK_URL}/auth/v1/token?grant_type=password`,{data:{email,password:desktop.PASSWORD}})
    const {access_token}=await login.json()
    const oldDate=new Date(Date.now()-40*86400000).toISOString()
    const oldList={...state.lists[0],id:crypto.randomUUID(),name:'Alte Liste',completion_retention_started_at:oldDate}
    const oldTask={...state.tasks[0],id:crypto.randomUUID(),list_id:oldList.id,title:'Darf nicht zurückkommen',completed:true,completed_at:oldDate,completed_expires_at:null}
    const answer=await request.post(`${desktop.MOCK_URL}/rest/v1/rpc/sync_push`,{headers:{Authorization:`Bearer ${access_token}`},data:{p_changes:[{table:'lists',row:oldList,expected:null},{table:'tasks',row:oldTask,expected:null}]}})
    const result=await answer.json()
    expect(result[1].current.expired_at).toBeTruthy()
    await sync(page)
    const panel=await restore(page)
    await expect(panel.getByTestId('restore-list')).toHaveCount(0)
    await expect(panel.getByTestId('restore-deleted-empty')).toBeVisible()
    await expect(panel).not.toContainText('Darf nicht zurückkommen')
  })
})
