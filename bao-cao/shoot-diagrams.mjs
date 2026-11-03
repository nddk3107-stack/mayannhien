// bao-cao/shoot-diagrams.mjs — render 4 sơ đồ SVG (HTML) thành PNG cho báo cáo DOCX
// Dùng Playwright có sẵn trong devDependencies của project. Không thêm dependency.
import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const diagrams = [
  { file: 'kien-truc.html', out: 'kien-truc.png', w: 960, h: 620 },
  { file: 'usecase.html', out: 'usecase.png', w: 980, h: 740 },
  { file: 'activity-dat-ve.html', out: 'activity-dat-ve.png', w: 900, h: 1315 },
  { file: 'sequence-thanh-toan.html', out: 'sequence-thanh-toan.png', w: 960, h: 790 },
]

const browser = await chromium.launch()
const ctx = await browser.newContext({ deviceScaleFactor: 2 })
const page = await ctx.newPage()

for (const d of diagrams) {
  await page.setViewportSize({ width: d.w, height: d.h })
  await page.goto('file://' + path.join(dir, 'diagrams', d.file))
  await page.screenshot({ path: path.join(dir, 'diagrams', d.out), clip: { x: 0, y: 0, width: d.w, height: d.h } })
  console.log('OK', d.out)
}

await browser.close()
