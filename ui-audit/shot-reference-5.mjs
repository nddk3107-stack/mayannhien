// ui-audit/shot-reference-5.mjs — chụp Traveloka qua URL quảng cáo (UTM) user cung cấp
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve('ui-audit/reference')
fs.mkdirSync(OUT, { recursive: true })
const URL = 'https://www.traveloka.com/vi-vn?utm_source=coccoc&utm_medium=ads_search&utm_campaign=VN_TV_SM_AU_AL_RSA_Coccoc_Brand_44774905&utm_id=UvU49UwP&utm_term=traveloka&utm_content=45454104&ctm_event_id=225928695'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

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

for (const [vw, vh, tag, mobile] of [[1440, 900, 'd', false], [375, 812, 'm', true]]) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: vw, height: vh },
    userAgent: mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : UA,
    locale: 'vi-VN', isMobile: mobile, hasTouch: mobile,
  })
  const page = await ctx.newPage()
  try {
    await page.goto(URL, { timeout: 45000, waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(6000)
    await closePopups(page)
    const blocked = await page.getByText('Truy cập tạm thời bị hạn chế', { exact: false }).first().isVisible().catch(() => false)
    if (blocked) console.log(tag, 'BLOCKED bot-check')
    else console.log(tag, 'OK page loaded:', (await page.title()).slice(0, 80))
    await page.screenshot({ path: path.join(OUT, `tl-utm-${tag}-home.png`) })
    // thử bấm tab Vé máy bay (chỉ khi chưa bị chặn)
    if (!blocked) {
      try {
        const tab = page.getByText('Vé máy bay', { exact: true }).first()
        await tab.waitFor({ state: 'visible', timeout: 8000 })
        await tab.click()
        await page.waitForTimeout(3000)
        await closePopups(page)
        await page.screenshot({ path: path.join(OUT, `tl-utm-${tag}-flightwidget.png`) })
        console.log(tag, 'flightwidget done')
      } catch (e) { console.log(tag, 'tab FAIL', String(e).slice(0, 100)) }
    }
  } catch (e) { console.log(tag, 'FAIL', String(e).slice(0, 150)) }
  await browser.close()
  await new Promise((r) => setTimeout(r, 4000))
}
console.log('DONE-5')