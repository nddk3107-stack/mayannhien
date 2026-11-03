// ui-audit/shot-reference-3.mjs — chụp widget "Vé máy bay" trên home Traveloka (tránh URL con bị chặn bot) desktop + mobile
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve('ui-audit/reference')
fs.mkdirSync(OUT, { recursive: true })
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

for (const [vw, vh, tag] of [[1440, 900, 'd'], [375, 812, 'm']]) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, userAgent: UA, locale: 'vi-VN' })
  const page = await ctx.newPage()
  try {
    await page.goto('https://www.traveloka.com/vi-vn', { timeout: 30000, waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(5000)
    try {
      const guest = page.getByText('Tìm kiếm với tư cách là khách', { exact: false })
      await guest.waitFor({ state: 'visible', timeout: 5000 })
      await guest.click(); await page.waitForTimeout(2000)
    } catch { console.log(tag, 'no modal') }
    // bấm tab "Vé máy bay"
    const tab = page.getByText('Vé máy bay', { exact: true }).first()
    await tab.waitFor({ state: 'visible', timeout: 8000 })
    await tab.click()
    await page.waitForTimeout(3000)
    await page.screenshot({ path: path.join(OUT, `tl-${tag}-flightwidget.png`) })
    console.log(tag, 'flightwidget done')
  } catch (e) { console.log(tag, 'FAIL', String(e).slice(0, 150)) }
  await browser.close()
  await new Promise((r) => setTimeout(r, 5000))
}
console.log('DONE-3')
