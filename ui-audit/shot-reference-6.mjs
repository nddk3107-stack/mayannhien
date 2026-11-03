// ui-audit/shot-reference-6.mjs — thử chụp widget "Chuyến bay" mobile (label đúng trên mobile)
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve('ui-audit/reference')
fs.mkdirSync(OUT, { recursive: true })
const URL = 'https://www.traveloka.com/vi-vn?utm_source=coccoc&utm_medium=ads_search&utm_campaign=VN_TV_SM_AU_AL_RSA_Coccoc_Brand_44774905&utm_id=UvU49UwP&utm_term=traveloka&utm_content=45454104&ctm_event_id=225928695'

const closePopups = async (page) => {
  for (let i = 0; i < 4; i++) {
    try {
      const guest = page.getByText('Tìm kiếm với tư cách là khách', { exact: false })
      const later = page.getByText('Để sau', { exact: false }).first()
      const dl = page.getByText('Tải ứng dụng để tiết kiệm hơn', { exact: false })
      if (await guest.isVisible().catch(() => false)) { await guest.click(); await page.waitForTimeout(1500); continue }
      if (await dl.isVisible().catch(() => false)) {
        if (await later.isVisible().catch(() => false)) { await later.click(); await page.waitForTimeout(1500); continue }
      }
      const closeBtn = page.locator('button[aria-label*="đóng" i], button[aria-label*="close" i]').first()
      if (await closeBtn.isVisible().catch(() => false)) { await closeBtn.click(); await page.waitForTimeout(1200); continue }
    } catch { /* bỏ qua */ }
    break
  }
}

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 375, height: 812 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  locale: 'vi-VN', isMobile: true, hasTouch: true,
})
const page = await ctx.newPage()
try {
  await page.goto(URL, { timeout: 45000, waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)
  await closePopups(page)
  // trên mobile icon label là "Chuyến bay" (không phải "Vé máy bay")
  const tab = page.getByText('Chuyến bay', { exact: true }).first()
  await tab.waitFor({ state: 'visible', timeout: 8000 })
  await tab.click()
  await page.waitForTimeout(4000)
  await closePopups(page)
  const blocked = await page.getByText('Truy cập tạm thời bị hạn chế', { exact: false }).first().isVisible().catch(() => false)
  console.log(blocked ? 'BLOCKED' : 'OK', page.url().slice(0, 100))
  await page.screenshot({ path: path.join(OUT, 'tl-utm-m-flightwidget.png') })
  console.log('m-flightwidget shot done')
} catch (e) { console.log('FAIL', String(e).slice(0, 150)) }
await browser.close()
console.log('DONE-6')