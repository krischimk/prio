/**
 * Produktionsbuild gegen den isolierten Mock, ausschließlich synthetische Daten.
 * Aufruf: node tests/performance/interactions.mjs before|after 100 mobile|desktop 4 7
 * Bundle vorher nach node_modules/.cache/prio-perf-before bzw. -after bauen.
 * Gemessen wird im Browser vom Eingabeereignis bis zum ersten Animation Frame
 * mit dem erwarteten Zustand. Locator-Suche und Klickvorbereitung liegen davor.
 * Kein CPU-Sampling während der Zeitmessung. Läufe einzeln ausführen.
 */
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { openSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
const [build='after', countArg='100', mode='mobile', rateArg='4', samplesArg='7', suite='core'] = process.argv.slice(2)
const count=Number(countArg), rate=Number(rateArg), samples=Number(samplesArg)
const mock='http://127.0.0.1:54341', origin='http://127.0.0.1:4194'
const processes=[]
async function server(cmd,args,url) { const process=spawn(cmd,args,{stdio:['ignore',openSync('test-results/performance/servers.log','a'),openSync('test-results/performance/servers.log','a')]}); processes.push(process); for(let i=0;i<100;i++){try{if((await fetch(url)).ok)return}catch{} await new Promise(r=>setTimeout(r,100))}throw new Error('Server not ready '+url) }
await mkdir('test-results/performance',{recursive:true})
const results=[]
let browser, page, cdp
try {
await server('node',['tests/mock-supabase/server.mjs','54341'],mock+'/__test__/health')
await server('node',['node_modules/vite/bin/vite.js','preview','--outDir',`node_modules/.cache/prio-perf-${build}`,'--host','127.0.0.1','--port','4194','--strictPort'],origin)
const session=await fetch(mock+'/auth/v1/signup',{method:'POST',body:JSON.stringify({email:'performance@example.com',password:'testonly123',data:{username:'performance'}})}).then(r=>r.json())
const stamp={created_at:new Date().toISOString(),updated_at:new Date().toISOString(),deleted_at:null}
const listIds=[randomUUID(),randomUUID()]
const lists=listIds.map((id,i)=>({...stamp,id,name:`Messliste ${i+1}`,owner_id:session.user.id,is_shared:false,icon:null,sections:[],keep_completed:false,ratings_enabled:true,allow_duplicate_titles:true,completion_retention_started_at:stamp.created_at}))
const tasks=Array.from({length:count},(_,i)=>({...stamp,id:randomUUID(),list_id:listIds[i%2],section_id:null,title:`Messaufgabe ${i+1}`,description:`Eine **formatierte Notiz ${i+1}** mit \`Code\`.\n\nWeitere Informationen und Details.\n\n- Ein Punkt\n- Ein zweiter Punkt`,checklist:Array.from({length:5},(_,j)=>({id:randomUUID(),text:`Schritt ${j+1}`,completed:false,deleted_at:null})),checklist_hide_completed:false,tags:['Test'],rating:{importance:i%10,effort:5,urgency:5,urgencyMode:'auto',effortFromChecklist:true},due_at:new Date(Date.now()+(i%14+1)*86400000).toISOString(),available_from:null,reminders:[],recurrence:null,position:i,completed:false,completed_at:null,completed_expires_at:null,expired_at:null,successor_id:null,reopen_context:null,recurrence_rule:null,recurrence_series_id:null}))
const preference={...stamp,id:session.user.id,default_list_id:null,overview_mode:'by_list',detailed_ratings:false,task_expansions:{},calendar_preferences:{days:{[new Date().toISOString().slice(0,10)]:'low',[new Date(Date.now()+86400000).toISOString().slice(0,10)]:'none'},notes:{},repeats:'active',open:false,timeZone:'Europe/Berlin'}}
const changes=[...lists.map(row=>({table:'lists',row})),...tasks.map(row=>({table:'tasks',row})),{table:'userPreferences',row:preference},...listIds.map(list_id=>({table:'preferences',row:{...stamp,list_id,user_id:session.user.id,include_in_overview:true,sort_mode:'manual',position:null,hidden:false}}))].map(row=>({...row,expected:null}))
const seeded=await fetch(mock+'/rest/v1/rpc/sync_push',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({p_changes:changes})}).then(r=>r.json())
if(seeded.some(row=>row.kind==='rejected'))throw new Error(JSON.stringify(seeded.filter(row=>row.kind==='rejected')))
browser=await chromium.launch({headless:true})
const context=await browser.newContext({viewport:mode==='mobile'?{width:390,height:844}:{width:1280,height:900},hasTouch:mode==='mobile',colorScheme:'dark'})
await context.addInitScript(({session})=>{
  localStorage.setItem('prio.auth',JSON.stringify(session))
  window.__perf={reads:{},longTasks:[],start:0,startup:null}
  for(const Type of [IDBObjectStore,IDBIndex]) for(const method of ['get','getAll','getAllKeys','openCursor','openKeyCursor','count']) {
    const original=Type.prototype[method]
    if(!original)continue
    Type.prototype[method]=function(...args){const key=(this.objectStore?.name??this.name)+'.'+method;window.__perf.reads[key]=(window.__perf.reads[key]??0)+1;return original.apply(this,args)}
  }
  new PerformanceObserver(list=>window.__perf.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true})
  const startup=()=>{if(document.querySelector('[data-task-row]'))window.__perf.startup=performance.now();else requestAnimationFrame(startup)}
  requestAnimationFrame(startup)
}, {session})
page=await context.newPage()
cdp=await context.newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate',{rate})
page.on('pageerror',error=>console.error('PAGE',error.message))
await page.goto(origin)
await page.waitForFunction(()=>window.__perf.startup!==null,undefined,{timeout:120000})
results.push({name:'cold start',ms:await page.evaluate(()=>window.__perf.startup)})
await page.waitForTimeout(1000)
const row=`[data-task-row][data-id="${tasks[0].id}"]`
const dialog='[role="dialog"][aria-label="Aufgabe"]'
const drawer='[role="dialog"][aria-label="Menü"]'
const checklist=row+' button[data-checklist-toggle]'
const note=row+' button[data-testid="beschreibung-mehr"]'
async function measure(name, selector, condition, event='click', key) {
  await page.waitForFunction(selector=>{const element=document.querySelector(selector);return element&&!element.disabled&&!element.closest('[inert]')},selector)
  let box
  for(let attempt=0;attempt<20;attempt++){
    box=await page.evaluate(selector=>{
      const element=document.querySelector(selector)
      if(!element||element.disabled||element.closest('[inert]'))return null
      element.scrollIntoView({block:'center',behavior:'instant'})
      const rect=element.getBoundingClientRect()
      return rect.width&&rect.height?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null
    },selector)
    if(box)break
    await page.waitForTimeout(50)
  }
  if(!box)throw new Error('Missing target '+selector)
  await page.evaluate(({condition,event})=>{
    const p=window.__perf;p.reads={};p.longTasks=[];p.result=null
    const matches=c=>{
      if(c.all)return c.all.every(matches)
      const element=document.querySelector(c.selector)
      if(c.absent)return !element
      if(!element)return false
      if(c.attribute)return c.notValue!==undefined?element.getAttribute(c.attribute)!==c.notValue:element.getAttribute(c.attribute)===c.value
      if(c.countText)return element.textContent.split(c.countText).length-1===c.textCount
      if(c.text)return element.textContent.includes(c.text)
      if(c.value!==undefined)return element.value===c.value
      if(c.checked!==undefined)return element.checked===c.checked
      return true
    }
    document.addEventListener(event,e=>{
      p.start=e.timeStamp
      const frame=()=>{
        if(matches(condition)){p.ready=performance.now();requestAnimationFrame(()=>{p.result={ms:p.ready-p.start,reads:p.reads,longTasks:p.longTasks.filter(t=>t.start+t.duration>=p.start)}})}
        else requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
    },{capture:true,once:true})
  },{condition,event})
  if(event==='click')await page.mouse.click(box.x+box.width/2,box.y+box.height/2)
  else await page.keyboard.press(key)
  await page.waitForFunction(()=>window.__perf.result!==null,undefined,{timeout:60000})
  const metrics=await page.evaluate(()=>window.__perf.result)
  results.push({name,iteration:results.filter(r=>r.name===name).length,...metrics})
  console.log(JSON.stringify({name,ms:Math.round(metrics.ms),long:Math.round(metrics.longTasks.reduce((n,t)=>n+t.duration,0))}))
  await page.waitForTimeout(250)
}
async function openMenu(){
 if(mode==='mobile'){
  await page.locator('button[aria-label^="Menü öffnen"]').click()
  await page.waitForFunction(()=>document.querySelector('[data-testid="drawer-sheet"]')?.getBoundingClientRect().x>=-1)
 }
}
async function selectList(name, operation='list switch') {
 await openMenu()
 const selector=(mode==='mobile'?drawer:'[aria-label="Listen"]')+' button'
 await page.locator(selector).filter({hasText:name}).first().evaluate(el=>el.setAttribute('data-perf-target','true'))
 await measure(operation,'[data-perf-target="true"]',name==='Gesamtansicht'?{all:[{selector:'section[aria-label="Gesamtansicht"]'},{selector:'[data-task-row]'}]}:{all:[{selector:'[data-testid="app-bar-title"], [data-testid="list-title"]',text:name},{selector:'[data-task-row]'}]})
 await page.locator('[data-perf-target]').evaluateAll(els=>els.forEach(el=>el.removeAttribute('data-perf-target')))
}
if(suite==='core'){
for(let i=0;i<samples;i++){
 await measure('checklist open',checklist,{selector:checklist,attribute:'aria-expanded',value:'true'})
 await measure('checklist check',row+' input[aria-label="Checklistenpunkt: Schritt 1"]',{selector:row+' input[aria-label="Checklistenpunkt: Schritt 1"]',checked:true})
 await measure('checklist uncheck',row+' input[aria-label="Checklistenpunkt: Schritt 1"]',{selector:row+' input[aria-label="Checklistenpunkt: Schritt 1"]',checked:false})
 await measure('checklist close',checklist,{selector:checklist,attribute:'aria-expanded',value:'false'})
 await measure('note open',note,{selector:note,attribute:'aria-expanded',value:'true'})
 await measure('note close',note,{selector:note,attribute:'aria-expanded',value:'false'})
 await measure('task open',row+' [data-testid="task-row"] .text-title',{selector:'#detail-title',value:'Messaufgabe 1'})
 await page.locator('#detail-title').press('End')
 await measure('title input','#detail-title',{selector:'#detail-title',value:'Messaufgabe 1x'},'input','x')
 await page.locator('#detail-title').press('Backspace')
 await measure('task close',dialog+' button[aria-label="Schließen"]',{selector:dialog,absent:true})
 if(mode==='mobile'){
  await measure('drawer open','button[aria-label^="Menü öffnen"]',{selector:drawer,attribute:'aria-hidden',value:'false'})
  await page.waitForFunction(()=>document.querySelector('[data-testid="drawer-sheet"]')?.getBoundingClientRect().x>=-1)
  await measure('drawer close',drawer+' button[aria-label="Menü schließen"]',{selector:drawer,attribute:'aria-hidden',value:'true'})
 }
}
for(let i=0;i<samples;i++){
 await selectList(`Messliste ${i%2+1}`)
 await measure('sort menu open','button[aria-label="Sortierung ändern"]',{selector:'input[name="list-sort"]'})
 // Zuverlässig bis zur tatsächlichen Reihenfolge warten, nicht nur zum Schließen des Menüs.
 const scores=await page.locator('[data-task-row]').evaluateAll(rows=>rows.map(row=>({id:row.dataset.id,priority:Number(row.querySelector('[aria-label="Priorität"]')?.getAttribute('aria-valuenow'))})))
 // Die Testzeilen haben dieselbe Erstellzeit; bei gleicher Priorität zählt die ID.
 const best=scores.sort((a,b)=>b.priority-a.priority || a.id.localeCompare(b.id))[0].id
 await measure('sort priority','fieldset[aria-label="Sortierung der Liste"] label:nth-of-type(2) input',{selector:`[data-task-row]:first-child[data-id="${best}"]`})
 await page.locator('button[aria-label="Sortierung ändern"]').click()
 const first=tasks.find(t=>t.list_id===listIds[i%2]).id
 await measure('sort manual','input[name="list-sort"]',{selector:`[data-task-row]:first-child[data-id="${first}"]`})
}

} else {
 await selectList('Messliste 1','setup list')
 for(let i=0;i<samples;i++){
  if(mode==='mobile')await measure('list settings open','[data-testid="app-bar-title"]',{selector:'[role="dialog"][aria-label="Liste verwalten"]'})
  else {
   await page.getByRole('button',{name:'Liste verwalten',exact:true}).evaluate(el=>el.setAttribute('data-perf-target','settings'))
   await measure('list settings open','[data-perf-target="settings"]',{selector:'[role="dialog"][aria-label="Liste verwalten"]'})
  }
  await measure('list settings close','[role="dialog"][aria-label="Liste verwalten"] button[aria-label="Schließen"]',{selector:'[role="dialog"][aria-label="Liste verwalten"]',absent:true})
  if(mode==='mobile')await openMenu()
  const account=page.locator((mode==='mobile'?drawer+' ':'')+'button').filter({hasText:/^Konto$/}).first()
  if(mode==='mobile')await account.evaluate(el=>el.setAttribute('data-perf-target','account'))
  const accountSelector=mode==='mobile'?'[data-perf-target="account"]':'button[aria-label="Konto"]'
  await measure('account open',accountSelector,{selector:'[role="dialog"][aria-label="Konto"]'})
  await measure('account close','[role="dialog"][aria-label="Konto"] button[aria-label="Schließen"]',{selector:'[role="dialog"][aria-label="Konto"]',absent:true})
  await measure('task open for note',row+' [data-testid="task-row"] .text-title',{selector:'#detail-title',value:'Messaufgabe 1'})
  const editor=dialog+' [contenteditable="true"][aria-label="Notiz"]'
  await page.locator(editor).press('Control+End')
  await measure('note input',editor,{selector:editor,countText:'X',textCount:i+1},'input','X')
  await measure('task save',dialog+' button[aria-label="Speichern"]',{selector:dialog,absent:true})
  await measure('task complete',row+' input[type="checkbox"]',{selector:row,absent:true})
  await page.locator('[role="status"] button').filter({hasText:'Rückgängig'}).evaluate(el=>el.setAttribute('data-perf-target','undo'))
  await measure('completion undo','[data-perf-target="undo"]',{selector:row})
 }
 await selectList('Gesamtansicht','overview switch')
 for(let i=0;i<samples;i++){
  await measure('calendar open','button[aria-label="Kalender anzeigen"]',{selector:'[aria-label="Kalendertage"]'})
  const grid='[aria-label="Kalendertage"] button'
  let firstDay=await page.locator(grid).first().getAttribute('aria-label')
  await measure('calendar next month','button[aria-label="Nächster Monat"]',{selector:grid,attribute:'aria-label',notValue:firstDay})
  firstDay=await page.locator(grid).first().getAttribute('aria-label')
  await measure('calendar previous month','button[aria-label="Voriger Monat"]',{selector:grid,attribute:'aria-label',notValue:firstDay})
  const capacity='[aria-label="Deine Zeit an diesem Tag"] button'
  if(await page.locator(capacity+':nth-of-type(1)').getAttribute('aria-pressed')!=='true'){
    await page.locator(capacity+':nth-of-type(1)').click()
    await page.waitForFunction(selector=>document.querySelector(selector)?.getAttribute('aria-pressed')==='true',capacity+':nth-of-type(1)')
  }
  await measure('day low capacity',capacity+':nth-of-type(2)',{selector:capacity+':nth-of-type(2)',attribute:'aria-pressed',value:'true'})
  await measure('day normal capacity',capacity+':nth-of-type(1)',{selector:capacity+':nth-of-type(1)',attribute:'aria-pressed',value:'true'})
  await measure('calendar close','button[aria-label="Kalender schließen"]',{selector:'[aria-label="Kalendertage"]',absent:true})
 }
}
for(const offline of [false,true]){
 await page.evaluate(()=>navigator.serviceWorker.ready)
 await context.setOffline(offline)
 await page.reload()
 await page.waitForFunction(()=>window.__perf.startup!==null,undefined,{timeout:60000})
 results.push({name:offline?'offline start':'warm start',ms:await page.evaluate(()=>window.__perf.startup)})
}
await writeFile(`test-results/performance/${build}-${count}-${mode}-${rate}-precise${suite==='core'?'':'-'+suite}.json`,JSON.stringify({build,count,mode,rate,samples,results},null,2))
}catch(error){if(page)console.log('ORDER',await page.locator('[data-task-row]').evaluateAll(rows=>rows.slice(0,5).map(row=>({id:row.dataset.id,text:row.textContent.slice(0,100)}))));if(page)console.error((await page.locator('body').innerText()).slice(-1500));await writeFile(`test-results/performance/${build}-${count}-${mode}-${rate}-partial${suite==='core'?'':'-'+suite}.json`,JSON.stringify({build,count,mode,rate,results},null,2));throw error}
finally{if(browser)await browser.close();for(const p of processes)p.kill('SIGTERM')}
