// qa-room.mjs — E2E luồng ĐẶT PHÒNG khách sạn (Chromium thật):
// chọn phòng -> checkout -> voucher nhập tay -> login gate -> thanh toán -> booking -> refresh.
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'http://localhost:5175/'
const OUT = path.resolve('qa-evidence/final/room')
fs.mkdirSync(OUT, { recursive: true })

let passed = 0
let failed = 0
const results = []
const consoleErrors = []
const pageErrors = []
let expectNetworkFail = false // voucher lỗi -> server 400 có chủ đích
let shotIndex = 0

const norm = (s) => s.replace(/ /g, ' ')
const todayISO = () => new Date().toISOString().slice(0, 10)

function assert(cond, msg) { if (!cond) throw new Error(msg) }
const API_BASE = 'http://localhost:' + (Number(process.env.QA_API_PORT) || 3001)
async function ensureUser(email, password) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      body: JSON.stringify({ email, password, name: email.split('@')[0] }),
    })
    if (res.ok) return
    const body = await res.json().catch(() => ({}))
    if (res.status === 409) return
    throw new Error(`register ${email}: ${res.status} ${JSON.stringify(body)}`)
  } catch (err) {
    if (err.message && err.message.startsWith('register')) throw err
    throw new Error(`Không kết nối API ${API_BASE} để đăng ký user test: ${err.message}`)
  }
}
// DB tạm của suite có thể chưa có user roomqa -> đăng ký trước khi dùng.

async function shot(page, name) {
  shotIndex += 1
  const file = `${String(shotIndex).padStart(2, '0')}-${name}.png`
  await page.screenshot({ path: path.join(OUT, file) })
  return file
}
async function step(id, title, fn) {
  try {
    const detail = await fn()
    passed += 1
    results.push({ id, title, status: 'PASS', detail: String(detail || 'OK') })
    console.log(`PASS [${id}] ${title} -- ${detail}`)
  } catch (err) {
    failed += 1
    results.push({ id, title, status: 'FAIL', detail: String(err && err.message) })
    console.log(`FAIL [${id}] ${title} -- ${err && err.message}`)
  }
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()

function attachRuntime(p) {
  p.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (expectNetworkFail && text.includes('Failed to load resource')) return
    consoleErrors.push(text)
  })
  p.on('pageerror', (err) => pageErrors.push(String(err)))
}
attachRuntime(page)

console.log('=== QA ROOM (E2E) — Mây An Nhiên ===')

// ---------- R1. Guard khi chưa chọn khách sạn ----------
await step('R1', '#/rooms khi chưa chọn khách sạn -> guard, không crash', async () => {
  await page.goto(`${BASE}#/rooms`, { waitUntil: 'networkidle' })
  await page.reload()
  await page.locator('.empty-bookings h2', { hasText: 'Bạn chưa chọn khách sạn' }).waitFor({ timeout: 8000 })
  await page.locator('.empty-bookings button', { hasText: 'Xem khách sạn' }).click()
  await page.locator('.hotel-card').first().waitFor({ timeout: 8000 })
  assert(page.url().includes('#/hotel'), 'Nút guard không về #/hotel: ' + page.url())
  return 'guard đúng + nút điều hướng về #/hotel'
})

// ---------- R2. Danh sách phòng ----------
await step('R2', 'Trang phòng: >=2 phòng, tiện nghi, giá/đêm, badge, ảnh', async () => {
  await page.locator('.hotel-card').first().locator('button', { hasText: 'Chọn phòng' }).click()
  await page.locator('.room-card').first().waitFor({ timeout: 8000 })
  const count = await page.locator('.room-card').count()
  assert(count >= 2, `Marina Bay phải có >=2 phòng, got ${count}`)
  const chips = await page.locator('.room-card').first().locator('.room-amenity-chips li').count()
  assert(chips >= 4, `Room card phải có >=4 chip tiện nghi, got ${chips}`)
  const price = norm(await page.locator('.room-card').first().locator('.room-price strong').textContent())
  assert(price.includes('1.850.000'), 'Giá/đêm phòng đầu sai: ' + price)
  const cardText = norm(await page.locator('.room-card').first().textContent())
  assert(cardText.includes('Giường king'), 'Thiếu loại giường')
  assert(cardText.includes('Ăn sáng') && cardText.includes('Hoàn hủy'), 'Thiếu badge điều kiện')
  assert(await page.locator('.room-card-img').first().isVisible(), 'Ảnh phòng không thấy')
  const file = await shot(page, 'rooms')
  return `${count} phòng, ${chips} chip tiện nghi, giá 1.850.000/đêm; ảnh ${file}`
})

// ---------- R3. Tiện nghi KHÁC NHAU giữa các phòng ----------
await step('R3', 'Mỗi phòng có tiện nghi riêng (không hard-code chung)', async () => {
  const sets = await page.locator('.room-card .room-amenity-chips').allTextContents()
  assert(sets.length >= 2, 'Cần >=2 phòng để so sánh')
  assert(sets[0].trim() !== sets[1].trim(), 'Hai phòng có tiện nghi GIỐNG NHAU (hard-code?)')
  const names = await page.locator('.room-card h3').allTextContents()
  assert(names[0] !== names[1], 'Tên hai phòng trùng nhau')
  return `phòng A "${names[0]}" != phòng B "${names[1]}" (tiện nghi khác nhau)`
})

// ---------- R4. Chọn phòng -> checkout đầy đủ ----------
await step('R4', 'Checkout phòng: ảnh, thông tin, ngày, tiện nghi theo nhóm, giá đúng', async () => {
  await page.locator('.pick-room-btn').first().click()
  await page.locator('.hotel-checkout h1').waitFor({ timeout: 8000 })
  assert(await page.locator('.room-gallery-main').isVisible(), 'Thư viện ảnh phòng không thấy')
  const specs = norm(await page.locator('.room-specs').textContent())
  assert(specs.includes('Giường king'), 'Thiếu giường trong room-specs')
  assert(specs.includes('m²'), 'Thiếu diện tích')
  assert(specs.includes('Tối đa'), 'Thiếu sức chứa')
  const d1 = await page.locator('.stay-grid input[type="date"]').first().inputValue()
  const d2 = await page.locator('.stay-grid input[type="date"]').nth(1).inputValue()
  assert(/\d{4}-\d{2}-\d{2}/.test(d1) && d1 >= todayISO() && d2 > d1, 'Ngày nhận/trả sai: ' + d1 + '/' + d2)
  const groups = await page.locator('.amenity-group').count()
  assert(groups >= 3, `Tiện nghi phải chia >=3 nhóm, got ${groups}`)
  const priceLine = norm(await page.locator('.room-price-line').textContent())
  assert(priceLine.includes('× 3 đêm × 1 phòng'), 'Dòng giá sai: ' + priceLine)
  assert(priceLine.includes('5.550.000'), 'Tiền phòng 3 đêm phải 5.550.000: ' + priceLine)
  const sum = norm(await page.locator('.booking-summary').textContent())
  assert(sum.includes('Marina Bay Đà Nẵng Resort') && sum.includes('Phòng Deluxe Giáp Biển'), 'Summary thiếu hotel/phòng')
  const file = await shot(page, 'checkout')
  return `${groups} nhóm tiện nghi; giá đúng; ảnh ${file}`
})

// ---------- R5. Refresh giữ nguyên phòng ----------
await step('R5', 'F5 tại checkout phòng -> vẫn còn phòng đã chọn (sessionStorage)', async () => {
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.hotel-checkout h1').waitFor({ timeout: 8000 })
  const sum = norm(await page.locator('.booking-summary').textContent())
  assert(sum.includes('Phòng Deluxe Giáp Biển'), 'Mất phòng sau refresh')
  const sel = await page.evaluate(() => sessionStorage.getItem('may-an-nhien-room-sel') || '')
  assert(sel.includes('room-hotel-1-1'), 'sessionStorage mất lựa chọn phòng: ' + sel)
  return 'reload -> phòng vẫn hiển thị + sessionStorage còn'
})

// ---------- R6. Context mới -> guard checkout-hotel ----------
await step('R6', 'Tab mới (chưa chọn gì) vào #/checkout-hotel -> guard, không crash', async () => {
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const p2 = await ctx2.newPage()
  attachRuntime(p2)
  await p2.goto(`${BASE}#/checkout-hotel`, { waitUntil: 'networkidle' })
  await p2.reload()
  await p2.locator('.empty-bookings h2', { hasText: 'Bạn chưa chọn phòng nào' }).waitFor({ timeout: 8000 })
  await p2.locator('.empty-bookings button', { hasText: 'Chọn khách sạn' }).click()
  await p2.locator('.hotel-card').first().waitFor({ timeout: 8000 })
  assert(p2.url().includes('#/hotel'), 'Nút guard không về #/hotel: ' + p2.url())
  await ctx2.close()
  return 'guard đúng ở tab mới + nút về #/hotel'
})

// ---------- R7. Đổi ngày / số phòng -> tính lại tiền ----------
await step('R7', 'Đổi số đêm và số phòng -> tổng tiền phòng tính lại tức thì', async () => {
  const ci = page.locator('.stay-grid input[type="date"]').first()
  const co = page.locator('.stay-grid input[type="date"]').nth(1)
  const v1 = await ci.inputValue()
  const v2 = await co.inputValue()
  const plus5 = new Date(Date.parse(v1) + 5 * 86400000).toISOString().slice(0, 10)
  await co.fill(plus5)
  await page.locator('.room-price-line', { hasText: '5 đêm' }).waitFor({ timeout: 4000 })
  let line = norm(await page.locator('.room-price-line').textContent())
  assert(line.includes('9.250.000'), '5 đêm phải 9.250.000: ' + line)
  await page.locator('.stay-grid select').first().selectOption('2')
  await page.locator('.room-price-line', { hasText: '2 phòng' }).waitFor({ timeout: 4000 })
  line = norm(await page.locator('.room-price-line').textContent())
  assert(line.includes('18.500.000'), '5 đêm × 2 phòng phải 18.500.000: ' + line)
  await page.locator('.stay-grid select').first().selectOption('1')
  await co.fill(v2)
  await page.locator('.room-price-line', { hasText: '5.550.000' }).waitFor({ timeout: 4000 })
  assert((await page.locator('.field-error').count()) === 0, 'Còn lỗi ngày sau khi khôi phục')
  return '5 đêm=9.250.000; ×2 phòng=18.500.000; khôi phục=5.550.000'
})

// ---------- R8. Voucher nhập tay ----------
await step('R8', 'Voucher: rỗng/sai mã/sai loại đều chặn; hợp lệ + tự kiểm lại khi đổi ngày', async () => {
  await page.locator('.voucher-apply').click()
  await page.locator('.voucher-status.error', { hasText: 'Vui lòng nhập mã' }).waitFor({ timeout: 4000 })
  expectNetworkFail = true
  await page.locator('.voucher-input').fill('MAKHONGCO')
  await page.locator('.voucher-apply').click()
  await page.locator('.voucher-status.error', { hasText: 'không tồn tại' }).waitFor({ timeout: 6000 })
  await page.locator('.voucher-input').fill('BAYNGAY')
  await page.locator('.voucher-apply').click()
  await page.locator('.voucher-status.error', { hasText: 'không áp dụng' }).waitFor({ timeout: 6000 })
  expectNetworkFail = false
  await page.locator('.voucher-input').fill('SALECUOITUAN')
  await page.locator('.voucher-input').press('Enter')
  await page.locator('.voucher-applied').waitFor({ timeout: 6000 })
  let sum = norm(await page.locator('.booking-summary').textContent())
  assert(sum.includes('666.000') && sum.includes('4.884.000'), 'Sau áp dụng voucher sai số: ' + sum)
  // Đổi ngày -> backend kiểm lại: voucher vẫn sống + giảm theo số đêm mới (4 đêm)
  const ci = page.locator('.stay-grid input[type="date"]').first()
  const v1 = await ci.inputValue()
  const co = page.locator('.stay-grid input[type="date"]').nth(1)
  const plus4 = new Date(Date.parse(v1) + 4 * 86400000).toISOString().slice(0, 10)
  await co.fill(plus4)
  await page.locator('.booking-summary .discount-value', { hasText: '888.000' }).waitFor({ timeout: 6000 })
  assert(await page.locator('.voucher-applied').isVisible(), 'Mất voucher sau khi đổi ngày')
  sum = norm(await page.locator('.booking-summary').textContent())
  assert(sum.includes('6.512.000'), '4 đêm sau giảm phải 6.512.000: ' + sum)
  // Khôi phục 3 đêm -> giảm về 666.000
  await co.fill(new Date(Date.parse(v1) + 3 * 86400000).toISOString().slice(0, 10))
  await page.locator('.booking-summary .discount-value', { hasText: '666.000' }).waitFor({ timeout: 6000 })
  const file = await shot(page, 'voucher')
  return 'rỗng/sai mã/sai loại chặn; SALECUOITUAN=666.000; đổi ngày tự tính lại; ảnh ' + file
})

// ---------- R9. Login gate + lỗi cạnh ô nhập ----------
await step('R9', 'Pay chưa đăng nhập -> login gate; lỗi form hiện cạnh ô; đăng nhập OK', async () => {
  await ensureUser('roomqa@mayan.test', 'secret123')
  await page.locator('.pay-btn').click()
  await page.locator('.login-modal').waitFor({ timeout: 5000 })
  const hint = await page.locator('.pay-hint').textContent()
  assert(hint.includes('cần đăng nhập'), 'Thiếu pay-hint: ' + hint)
  // đăng nhập trực tiếp trong modal đang mở
  await page.locator('.login-field input[type="email"]').fill('roomqa@mayan.test')
  await page.locator('.login-field input[type="password"]').fill('secret123')
  await page.locator('.login-submit').click()
  await page.locator('.login-modal').waitFor({ state: 'detached', timeout: 5000 })
  await page.locator('.user-chip', { hasText: 'roomqa' }).waitFor({ timeout: 5000 })
  // lỗi cạnh ô khi form rỗng
  const name = page.locator('.checkout-form input').first()
  await name.fill('')
  await page.locator('.pay-btn').click()
  await page.locator('.field-error', { hasText: 'họ tên' }).first().waitFor({ timeout: 4000 })
  await name.fill('Nguyễn Văn Room')
  await page.locator('.checkout-form input[inputmode="tel"]').fill('0912345678')
  await page.locator('.checkout-form input[type="email"]').fill('roomqa@mayan.test')
  const ls = await page.evaluate(() => Object.entries(localStorage).map(([k, v]) => `${k}=${v}`).join('|'))
  assert(!ls.includes('secret123'), 'localStorage đang lưu plaintext password!')
  return 'login gate + lỗi cạnh ô + đăng nhập roomqa, 0 plaintext; ảnh ' + await shot(page, 'logingate')
})

// ---------- R10. Thanh toán -> booking phòng ----------
await step('R10', 'Double-click thanh toán -> đúng 1 booking phòng, thông tin đầy đủ', async () => {
  const methods = page.locator('.pay-methods button')
  assert((await methods.count()) === 3, 'Cần đúng 3 phương thức')
  await methods.nth(1).click()
  assert(norm(await page.locator('.booking-summary').textContent()).includes('Ví điện tử'), 'Summary chưa theo Ví điện tử')
  await methods.nth(2).click()
  assert(norm(await page.locator('.booking-summary').textContent()).includes('Thẻ quốc tế'), 'Summary chưa theo Thẻ quốc tế')
  // bấm đôi thật nhanh
  const c1 = page.locator('.pay-btn').click()
  await page.waitForTimeout(100)
  const c2 = page.locator('.pay-btn').click({ force: true }).catch(() => 'disabled')
  await Promise.all([c1, c2])
  await page.locator('.booking-card').first().waitFor({ timeout: 8000 })
  assert(page.url().includes('#/bookings'), 'Không về bookings: ' + page.url())
  const count = await page.locator('.booking-card').count()
  assert(count === 1, `Sau double-click phải đúng 1 đơn, got ${count}`)
  const card = norm(await page.locator('.booking-card').first().textContent())
  assert(card.includes('Marina Bay'), 'Booking thiếu tên khách sạn')
  assert(card.includes('Phòng Deluxe Giáp Biển'), 'Booking thiếu tên phòng')
  assert(card.includes('3 đêm'), 'Booking thiếu số đêm')
  assert(card.includes('4.884.000'), 'Tổng phải 4.884.000 (voucher 12%): ' + card)
  assert(card.includes('SALECUOITUAN'), 'Booking thiếu voucher')
  assert(card.includes('Thẻ quốc tế'), 'Booking thiếu phương thức')
  assert(card.includes('Nguyễn Văn Room'), 'Booking thiếu traveler')
  assert(card.includes('Đã xác nhận'), 'Trạng thái sai')
  const match = card.match(/Mã ([A-Z0-9]{6})/)
  assert(match, 'Không thấy mã booking')
  return `booking ${match[1]}; 1 đơn duy nhất; 4.884.000; ảnh ` + await shot(page, 'booking')
})

// ---------- R11. Persistence + isolation ----------
await step('R11', 'Reload vẫn giữ booking; logout ẩn đơn; login lại thấy đủ', async () => {
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.booking-card').first().waitFor({ timeout: 8000 })
  assert((await page.locator('.booking-card').count()) === 1, 'Refresh làm sai số đơn')
  // logout -> trống
  await page.locator('.header-actions button', { hasText: 'Đăng xuất' }).click()
  await page.locator('.user-chip').waitFor({ state: 'detached', timeout: 5000 })
  await page.waitForTimeout(400)
  assert((await page.locator('.booking-card').count()) === 0, 'Khách vẫn thấy đơn của roomqa!')
  // login lại -> đơn quay lại (server giữ theo scope)
  await page.locator('.login-btn').click()
  await page.locator('.login-field input[type="email"]').fill('roomqa@mayan.test')
  await page.locator('.login-field input[type="password"]').fill('secret123')
  await page.locator('.login-submit').click()
  await page.locator('.login-modal').waitFor({ state: 'detached', timeout: 5000 })
  await page.locator('.booking-card').first().waitFor({ timeout: 8000 })
  assert((await page.locator('.booking-card').count()) === 1, 'Mất đơn khi login lại')
  return 'reload=1; logout=0; login lại=1; ảnh ' + await shot(page, 'persistence')
})

// ---------- R12. Vé bay / combo không bị ảnh hưởng ----------
await step('R12', 'Flight + combo vẫn dùng checkout chung với mã giảm giá chip', async () => {
  await page.goto(`${BASE}#/flight`, { waitUntil: 'networkidle' })
  await page.locator('.flight-card').first().waitFor({ timeout: 8000 })
  await page.locator('.flight-card').first().locator('button', { hasText: 'Chọn vé' }).click()
  await page.locator('.checkout-layout h1').waitFor({ timeout: 8000 })
  assert((await page.locator('.mini-promos button').count()) === 3, 'Checkout vé bay mất 3 mã giảm giá chip')
  await page.locator('.back-btn').click()
  await page.locator('.search-card').waitFor({ timeout: 5000 })
  await page.goto(`${BASE}#/combo`, { waitUntil: 'networkidle' })
  await page.locator('.hotel-card').first().waitFor({ timeout: 8000 })
  await page.locator('.hotel-card').first().locator('button', { hasText: 'Đặt ngay' }).click()
  await page.locator('.checkout-layout h1').waitFor({ timeout: 8000 })
  assert(norm(await page.locator('.booking-summary').textContent()).includes('Combo'), 'Checkout combo sai dịch vụ')
  return 'flight: chip promo OK; combo: Đặt ngay -> checkout OK'
})

// ---------- R13. Mobile 375 ----------
await step('R13', 'Mobile 375px: rooms + checkout không tràn, bottom-nav đủ', async () => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(`${BASE}#/hotel`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const problems = []
  const ov = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if ((await ov()) > 2) problems.push('hotel overflow ' + (await ov()))
  if (!(await page.locator('.mobile-bottom-nav').isVisible())) problems.push('mất bottom-nav')
  await page.locator('.hotel-card').first().locator('button', { hasText: 'Chọn phòng' }).click()
  await page.locator('.room-card').first().waitFor({ timeout: 8000 })
  if ((await ov()) > 2) problems.push('rooms overflow ' + (await ov()))
  // Ảnh lazy-load có thể làm layout dịch chuyển nhẹ trên mobile -> chờ ổn định rồi bấm
  await page.locator('.pick-room-btn').first().scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)
  await page.locator('.pick-room-btn').first().click({ timeout: 15000 })
  await page.locator('.hotel-checkout h1').waitFor({ timeout: 8000 })
  if ((await ov()) > 2) problems.push('checkout overflow ' + (await ov()))
  if (!(await page.locator('.pay-btn').isVisible())) problems.push('pay-btn ẩn')
  if (!(await page.locator('.voucher-input').isVisible())) problems.push('voucher ẩn')
  if (problems.length) throw new Error(problems.join('; '))
  const file = await shot(page, 'mobile375')
  await page.setViewportSize({ width: 1440, height: 900 })
  return '375px: 0 tràn ngang ở hotel/rooms/checkout; ảnh ' + file
})

// ---------- R14. Runtime ----------
await step('R14', 'Runtime: 0 pageerror + 0 console.error (ngoại trừ 400 có chủ đích)', async () => {
  assert(pageErrors.length === 0, `Có ${pageErrors.length} pageerror: ${pageErrors[0]}`)
  assert(consoleErrors.length === 0, `Có ${consoleErrors.length} console.error: ${consoleErrors[0]}`)
  return 'pageerror=0; console.error=0'
})

const summary = { module: 'ROOM', total: passed + failed, passed, failed, results }
fs.writeFileSync(path.resolve('qa-evidence/final/room-results.json'), JSON.stringify(summary, null, 2))
console.log(`\nTONG: ${summary.total} | PASS: ${passed} | FAIL: ${failed}`)
await browser.close()
process.exit(failed > 0 ? 1 : 0)




