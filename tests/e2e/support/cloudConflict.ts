import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { createList, createTask, MOCK_URL, openTaskEditor, PASSWORD, register, serverState, uniqueEmail } from './helpers'
import * as mobile from './mobile'

/** Gerät offline bearbeiten; ein unabhängiger Schreiber ändert dieselbe Cloud-Aufgabe. */
export async function createCloudConflict(page: Page, request: APIRequestContext, phone: boolean) {
  const email = uniqueEmail('cloud-conflict')
  await (phone ? mobile.register : register)(page,email)
  await (phone ? mobile.createList : createList)(page,'Projekt')
  await (phone ? mobile.createTask : createTask)(page,'Ausgangslage')
  await expect.poll(async()=> (await serverState(request)).tasks.length).toBe(1)
  const [base] = (await serverState(request)).tasks
  await page.route('**/rest/v1/**',route=>route.abort())
  const editor = await openTaskEditor(page, 'Ausgangslage')
  await editor.getByLabel('Titel', { exact: true }).fill('Meine Offline-Eingabe')
  await editor.getByRole('button', { name: 'Speichern', exact: true }).click()
  await expect(editor).toBeHidden()
  const login=await request.post(`${MOCK_URL}/auth/v1/token?grant_type=password`,{data:{email,password:PASSWORD}})
  expect(login.ok()).toBe(true)
  const {access_token}=await login.json()
  const answer=await request.post(`${MOCK_URL}/rest/v1/rpc/sync_push`,{
    headers:{Authorization:`Bearer ${access_token}`},
    data:{p_changes:[{table:'tasks',row:{...base,title:'Cloud-Titel',description:'Unabhängige Cloud-Notiz'},expected:base}]},
  })
  expect((await answer.json())[0].kind).toBe('written')
  await page.unroute('**/rest/v1/**')
  if (phone) await mobile.openMenu(page)
  await page.getByRole('button',{name:'Jetzt synchronisieren',exact:true}).click()
  await expect(page.getByTestId('sync-status')).toContainText('Änderungskonflikt')
  expect((await serverState(request)).tasks[0].title).toBe('Cloud-Titel')
  await page.getByRole('button',{name:'Konflikte klären',exact:true}).click()
  const sheet=page.getByRole('dialog',{name:'Änderungskonflikte',exact:true})
  await expect(sheet).toContainText('Meine Offline-Eingabe')
  await expect(sheet).toContainText('Cloud-Titel')
  return sheet
}
