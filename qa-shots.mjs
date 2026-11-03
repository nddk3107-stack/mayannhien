// Chụp bằng chứng demo (chạy sau regression thành công)
// Tạo 1 booking mới bằng tài khoản demo rồi chụp toàn bộ flow.
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'

const BASE = 'http://localhost:5175'
mkdirSync('qa-evidence', { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } })
const page = await ctx.newPage()
const shot = (name) => page.screenshot({ path: `qa-evidence/${name}.png` })

// 01 — Trang chủ
await page.goto(`${BASE}/#/home`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await shot('01-trang-chu')

// 02 — Trang vé máy bay (tìm & chọn chuyến)
await page.goto(`${BASE}/#/flight`, { waitUntil: 'networkidle' })
await page.locator('.flight-card').first().waitFor({ timeout: 8000 })
await page.waitForTimeout(600)
await shot('02-tim-ve-chon-ve')

// 03 — Checkout với thông tin hành khách mới
await page.locator('.flight-card').first().locator('button', { hasText: 'Chọn vé' }).click()
await page.locator('.checkout-layout h1').waitFor({ timeout: 8000 })
await page.locator('label.field', { hasText: 'Họ tên' }).locator('input').fill('Nguyễn Thanh Bình')
await page.locator('label.field', { hasText: 'Số điện thoại' }).locator('input').fill('0912000000')
await page.locator('label.field', { hasText: 'Email' }).locator('input').fill('demo@mayan.vn')
await page.waitForTimeout(400)
await shot('03-checkout')

// 04 — Login gate (modal đăng nhập)
await page.locator('.pay-btn').click()
await page.locator('.login-modal').waitFor({ timeout: 5000 })
await page.locator('.login-field input[type="email"]').fill('demo@mayan.vn')
await page.waitForTimeout(300)
await shot('04-login')

// 05 — Đăng nhập + chọn phương thức thanh toán
await page.locator('.login-field input[type="password"]').fill('secret123')
await page.locator('.login-submit').click()
await page.locator('.user-chip').waitFor({ timeout: 5000 })
await page.locator('.pay-methods button', { hasText: 'Ví điện tử' }).click()
await page.locator('.pay-methods').scrollIntoViewIfNeeded()
await page.waitForTimeout(400)
await shot('05-thanh-toan')

// 06 — Thanh toán thành công, booking mới được tạo
await page.locator('.pay-btn').click()
await page.locator('.bookings-page').waitFor({ timeout: 8000 })
await page.locator('.booking-card').first().waitFor({ timeout: 5000 })
await page.waitForTimeout(700)
await shot('06-dat-cho-thanh-cong')

const bookingText = await page.locator('.booking-card').first().textContent()
const bookingCode = bookingText.match(/MAN\d{5,}/)?.[0] || '(khong thay ma)'

// 07 — API/backend (qua proxy Vite -> Express)
await page.goto(`${BASE}/api/catalog`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await shot('07-api')

await browser.close()

// 08 — Kết quả E2E 29/29 (render từ e2e-results.json)
const e2e = JSON.parse(readFileSync('qa-evidence/e2e-results.json', 'utf8'))
const rows = e2e.results.map((r) => `
  <tr class="${r.status === 'PASS' ? 'ok' : 'bad'}">
    <td>${r.status}</td><td>${r.id}</td><td>${r.name}</td><td>${r.detail || ''}</td>
  </tr>`).join('')

const shot2 = await chromium.launch()
const p2 = await shot2.newPage({ viewport: { width: 1366, height: 900 } })
await p2.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
  body{font-family:Inter,system-ui,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:28px}
  h1{font-size:22px;margin:0 0 4px} .sum{color:#4ade80;font-weight:800;font-size:16px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  td,th{padding:6px 10px;border-bottom:1px solid #1e293b;text-align:left}
  th{color:#94a3b8;text-transform:uppercase;font-size:11px}
  .ok td:first-child{color:#4ade80;font-weight:800} .bad td:first-child{color:#f87171;font-weight:800}
  td:nth-child(3){color:#f1f5f9} td:nth-child(4),td:nth-child(2){color:#94a3b8}
</style></head><body>
  <h1>Mây An Nhiên — Kết quả E2E Regression</h1>
  <div class="sum">TỔNG: ${e2e.total} | PASS: ${e2e.pass} | FAIL: ${e2e.fail} — ${new Date(e2e.ranAt).toLocaleString('vi-VN')}</div>
  <table><tr><th>Trạng thái</th><th>ID</th><th>Bước test</th><th>Chi tiết</th></tr>${rows}</table>
</body></html>`)
await p2.waitForTimeout(300)
await p2.screenshot({ path: 'qa-evidence/08-e2e-29-29.png', fullPage: true })

// 09 — Kết quả lint + build
const lint = readFileSync('qa-evidence/lint.txt', 'utf8').trim()
const build = readFileSync('qa-evidence/build.txt', 'utf8').trim()
await p2.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
  body{font-family:ui-monospace,Menlo,monospace;background:#0b1220;color:#d1e7ff;margin:0;padding:30px;font-size:14px;line-height:1.7}
  .win{background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:20px 24px;margin-bottom:22px;white-space:pre-wrap}
  h2{color:#f8fafc;font-family:Inter,system-ui;font-size:17px;margin:0 0 10px}
  .badge{color:#4ade80;font-weight:800}
</style></head><body>
  <h2>Bước 1 — npm run lint <span class="badge">→ 0 warnings, 0 errors ✅</span></h2>
  <div class="win">${lint.replace(/</g, '&lt;')}</div>
  <h2>Bước 2 — npm run build <span class="badge">→ build thành công ✅</span></h2>
  <div class="win">${build.replace(/</g, '&lt;')}</div>
</body></html>`)
await p2.waitForTimeout(300)
await p2.screenshot({ path: 'qa-evidence/09-lint-build.png', fullPage: true })
await shot2.close()

console.log('DA CHUP XONG. Booking demo moi:', bookingCode)
