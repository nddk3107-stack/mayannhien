// ui-audit/shot-audit.mjs — chụp ảnh TRƯỚC (site Mây An Nhiên) + ảnh tham chiếu Traveloka THẬT
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve('ui-audit')
fs.mkdirSync(OUT, { recursive: true })
fs.mkdirSync(path.join(OUT, 'before'), { recursive: true })
fs.mkdirSync(path.join(OUT, 'reference'), { recursive: true })

const BASE = 'http://localhost:5175/'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const browser = await chromium.launch()

async function newPage(vw, vh) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, userAgent: UA, locale: 'vi-VN' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e)))
  return page
}

// ---------- 1. Site hiện tại (TRƯỚC) ----------
async function shootOurs(prefix, vw, vh) {
  const page = await newPage(vw, vh)
  const tag = vw <= 500 ? 'm' : 'd'
  const go = async (hash, sel, name, full = false) => {
    await page.goto(BASE + hash)
    await page.reload()
    try { await page.locator(sel).first().waitFor({ timeout: 9000 }) } catch { /* giữ ảnh kể cả khi chờ lỗi */ }
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(OUT, 'before', `${prefix}-${tag}-${name}.png`), fullPage: full })
    console.log('OURS', prefix, tag, name)
  }
  await go('#/', '.search-card', 'home', true)
  await go('#/flight', '.flight-card', 'flight')
  await go('#/hotel', '.hotel-card', 'hotel')
  await go('#/combo', '.hotel-card', 'combo')
  await go('#/flight', '.flight-card', 'x')
  // checkout + login modal (desktop only cho login)
  await page.locator('.flight-card').first().locator('button', { hasText: 'Chọn vé' }).click()
  await page.locator('.checkout-layout h1').waitFor({ timeout: 8000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(OUT, 'before', `${prefix}-${tag}-checkout.png`) })
  console.log('OURS', prefix, tag, 'checkout')
  if (vw > 500) {
    await page.locator('.pay-btn').click()
    await page.locator('.login-modal').waitFor({ timeout: 5000 })
    await page.screenshot({ path: path.join(OUT, 'before', `${prefix}-${tag}-login.png`) })
    console.log('OURS', prefix, tag, 'login')
    await page.locator('.login-close').click()
  }
  // bookings (guest)
  await page.goto(BASE + '#/bookings')
  await page.reload()
  await page.locator('.bookings-page').waitFor({ timeout: 8000 })
  await page.screenshot({ path: path.join(OUT, 'before', `${prefix}-${tag}-bookings.png`) })
  console.log('OURS', prefix, tag, 'bookings')
  await page.context().close()
}

// ---------- 2. Traveloka (tham chiếu THẬT) ----------
async function shootTraveloka(prefix, vw, vh) {
  const page = await newPage(vw, vh)
  const tag = vw <= 500 ? 'm' : 'd'
  const targets = [
    ['https://www.traveloka.com/vi-vn', 'home'],
    ['https://www.traveloka.com/vi-vn/flight', 'flight'],
    ['https://www.traveloka.com/vi-vn/hotel', 'hotel'],
  ]
  for (const [url, name] of targets) {
    try {
      await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(5000) // chờ SPA render
      await page.screenshot({ path: path.join(OUT, 'reference', `${prefix}-${tag}-${name}.png`) })
      console.log('REF', prefix, tag, name, '| title:', await page.title())
    } catch (e) {
      console.log('REF-FAIL', name, String(e).slice(0, 120))
    }
  }
  await page.context().close()
}

await shootOurs('ours', 1440, 900)
await shootOurs('ours', 375, 812)
await shootTraveloka('tl', 1440, 900)
await shootTraveloka('tl', 375, 812)

await browser.close()
console.log('DONE')
