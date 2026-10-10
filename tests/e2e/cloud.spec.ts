import { expect,test } from '@playwright/test'
import { resetServer } from './support/helpers'
import { createCloudConflict } from './support/cloudConflict'

test.beforeEach(async({request})=>resetServer(request))

test('Cloud-Konfliktübersicht bleibt beim Ansichtswechsel offen und hält den Tastaturfokus',async({page,request},info)=>{
  const sheet=await createCloudConflict(page,request,false)
  await page.keyboard.press('Shift+Tab')
  await expect.poll(async()=>sheet.evaluate(element=>element.contains(document.activeElement))).toBe(true)
  await page.setViewportSize({width:390,height:844})
  await expect(sheet).toBeVisible()
  await page.screenshot({path:info.outputPath('cloud-conflict-phone.png')})
  await page.setViewportSize({width:740,height:360})
  await expect(sheet).toBeVisible()
  await page.screenshot({path:info.outputPath('cloud-conflict-landscape.png')})
  await sheet.getByRole('button',{name:'Cloudstand übernehmen',exact:true}).scrollIntoViewIfNeeded()
  await page.screenshot({path:info.outputPath('cloud-conflict-landscape-actions.png')})
  await sheet.getByRole('button',{name:'Cloudstand übernehmen',exact:true}).click()
  await expect(sheet).toContainText('Alle Konflikte sind geklärt.')
})
