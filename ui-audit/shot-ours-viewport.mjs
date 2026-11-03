// ui-audit/shot-ours-viewport.mjs — chụp site hiện tại (viewport-only, không fullPage) để audit hero/header
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve('ui-audit/before')
fs.mkdirSync(OUT, { recursive: true })
const BASE = 'http://localhost:5175/'
const browser = await chromium.launch()

for (const [vw, vh, tag] of [[1440, 900, 'd'], [768, 1024, 't'], [375, 812, 'm']]) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, locale: 'vi-VN' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e)))
  await page.goto(BASE + '#/', { timeout: 20000 })
  await page.reload()
  try { await page.locator('.search-card').first().waitFor({ timeout: 9000 }) } catch {}
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(OUT, `ours-${tag}-home-vp.png`) })
  console.log('OURS', tag, 'home-vp')
  await ctx.close()
}
await browser.close()
console.log('DONE-VP')