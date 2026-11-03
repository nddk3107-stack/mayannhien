// ui-audit/shot-reference-2.mjs — chụp lại ảnh tham chiếu Traveloka: home sạch (đóng modal) + thử trang vé máy bay pace chậm
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve('ui-audit/reference')
fs.mkdirSync(OUT, { recursive: true })
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function freshBrowser() {
  return chromium.launch()
}

// --- Home sạch: đóng modal "Tìm kiếm với tư cách là khách" ---
{
  const browser = await freshBrowser()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA, locale: 'vi-VN' })
  const page = await ctx.newPage()
  try {
    await page.goto('https://www.traveloka.com/vi-vn', { timeout: 30000, waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(5000)
    // thử đóng modal đăng nhập nếu có
    try {
      const guest = page.getByText('Tìm kiếm với tư cách là khách', { exact: false })
      await guest.waitFor({ state: 'visible', timeout: 5000 })
      await guest.click(); await page.waitForTimeout(2500)
    } catch { console.log('no modal / no close') }
    await page.screenshot({ path: path.join(OUT, 'tl-d-home-clean.png') })
    console.log('home-clean done | title:', await page.title())
  } catch (e) { console.log('home-clean FAIL', String(e).slice(0, 150)) }
  await browser.close()
}

// --- Flight page, browser mới + pace chậm ---
await new Promise((r) => setTimeout(r, 8000))
{
  const browser = await freshBrowser()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA, locale: 'vi-VN' })
  const page = await ctx.newPage()
  try {
    await page.goto('https://www.traveloka.com/vi-vn/flight', { timeout: 40000, waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(8000)
    await page.screenshot({ path: path.join(OUT, 'tl-d-flight-2.png') })
    console.log('flight-2 done | title:', await page.title())
  } catch (e) { console.log('flight-2 FAIL', String(e).slice(0, 150)) }
  await browser.close()
}

console.log('DONE-2')
