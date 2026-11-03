// ui-audit/shot-reference-4.mjs — mobile Traveloka home sạch (đóng mọi modal, không bấm tab)
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve('ui-audit/reference')
fs.mkdirSync(OUT, { recursive: true })
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, userAgent: UA, locale: 'vi-VN', isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const closePopups = async () => {
  for (let i = 0; i < 3; i++) {
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
try {
  await page.goto('https://www.traveloka.com/vi-vn', { timeout: 30000, waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5000)
  await closePopups()
  await page.screenshot({ path: path.join(OUT, 'tl-m-home-clean.png') })
  console.log('m-home-clean done')
} catch (e) { console.log('FAIL', String(e).slice(0, 150)) }
await browser.close()
console.log('DONE-4')
