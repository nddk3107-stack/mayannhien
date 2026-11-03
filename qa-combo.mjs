// qa-combo.mjs — Combo module: 17 test cases (Part 5)
// Browser thật Chromium/Playwright. KHÔNG sửa app để qua test.
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'http://localhost:5175/'
const OUT = path.resolve('qa-evidence/final/combo')
fs.mkdirSync(OUT, { recursive: true })

let passed = 0
let failed = 0
const results = []
const consoleErrors = []
const pageErrors = []
let apiFailurePhase = false
let shotIndex = 0

const norm = (s) => s.replace(/\u00a0/g, ' ')
const todayISO = () => new Date().toISOString().slice(0, 10)

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
// DB tạm của suite có thể chưa có user comboa/combob -> đăng ký trước khi dùng.

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

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

page.on('console', (msg) => {
  if (msg.type() !== 'error') return
  const text = msg.text()
  if (apiFailurePhase && (text.includes('API request failed') || text.includes('Failed to load resource'))) return
  consoleErrors.push(text)
})
page.on('pageerror', (err) => pageErrors.push(String(err)))

async function routeApi(pattern) {
  await page.route(pattern, async (route) => {
    if (apiFailurePhase) return route.abort()
    return route.continue()
  })
}
await routeApi('**/api/catalog*')
await routeApi('**/api/travel*')

async function reset() {
  await page.goto(`${BASE}#/`)
  await page.reload()
}

async function loginAs(email) {
  await page.locator('.login-btn').click()
  await page.locator('.login-field input[type="email"]').fill(email)
  await page.locator('.login-field input[type="password"]').fill('secret123')
  await page.locator('.login-submit').click()
  await page.locator('.login-modal').waitFor({ state: 'detached', timeout: 5000 })
  await page.locator('.user-chip', { hasText: email.split('@')[0] }).waitFor({ timeout: 5000 })
}

async function gotoComboFresh() {
  await page.goto(`${BASE}#/combo`)
  await page.reload()
  await page.locator('.hotel-card').first().waitFor({ timeout: 10000 })
}

console.log('=== QA COMBO — Mây An Nhiên (browser thật) ===')
await reset()

// ---------- 1. Load combo ----------
await step('1', 'Trang combo load thành công + runtime 0 lỗi', async () => {
  await page.locator('.nav button', { hasText: 'Combo' }).click()
  await page.locator('.hotel-card').first().waitFor({ timeout: 10000 })
  const hero = await page.locator('.page-hero h1').textContent()
  assert(hero.includes('Combo bay + khách sạn'), 'Hero sai: ' + hero)
  const cards = await page.locator('.hotel-card').count()
  assert(cards === 3, `Đang có ${cards} combo card (mong 3)`)
  const first = await page.locator('.hotel-card').first().textContent()
  assert(first.includes('Combo Marina Bay') && first.includes('+ vé bay'), 'Card đầu sai: ' + first.slice(0, 80))
  const title = await page.title()
  assert(title.includes('Combo du lịch'), 'document.title sai: ' + title)
  const count = await page.locator('.results-count').textContent()
  assert(count.includes('3 combo'), 'ResultsCount sai: ' + count)
  const file = await shot(page, 'load')
  return `hero OK; 3 combo; title="${title}"; ảnh ${file}`
})

// ---------- 2. Search keyword hợp lệ ----------
await step('2', 'Search keyword hợp lệ từ home -> combo lọc đúng', async () => {
  await reset()
  await page.locator('.search-services button', { hasText: 'Combo' }).click()
  await page.locator('.search-card input[maxlength="80"]').fill('Đà Nẵng')
  await page.locator('.search-submit').click()
  await page.locator('.hotel-card').first().waitFor({ timeout: 8000 })
  assert(page.url().includes('#/combo'), 'Không điều hướng sang #/combo: ' + page.url())
  const summary = await page.locator('.search-summary').textContent()
  assert(summary.includes('Đà Nẵng'), 'SearchSummary thiếu keyword: ' + summary)
  const count = await page.locator('.results-count').textContent()
  assert(count.includes('1 combo'), 'Kết quả sai: ' + count)
  const card = await page.locator('.hotel-card').first().textContent()
  assert(card.includes('Combo Marina Bay'), 'Kết quả sai: ' + card.slice(0, 60))
  const file = await shot(page, 'search')
  return '1 kết quả Combo Marina Bay; summary OK; ảnh ' + file
})

// ---------- 3. Search keyword không tồn tại ----------
await step('3', 'Search keyword không tồn tại -> empty state', async () => {
  await reset()
  await page.locator('.search-services button', { hasText: 'Combo' }).click()
  await page.locator('.search-card input[maxlength="80"]').fill('Tokyo')
  await page.locator('.search-submit').click()
  await page.locator('.empty-result').waitFor({ timeout: 8000 })
  const txt = await page.locator('.empty-result').textContent()
  assert(txt.includes('Không tìm thấy'), 'Không có empty state')
  assert(txt.includes('từ khóa hiện tại'), 'Empty state thiếu hướng dẫn: ' + txt.slice(0, 80))
  assert((await page.locator('.hotel-card').count()) === 0, 'Còn card khi search không tồn tại')
  const file = await shot(page, 'empty')
  return 'empty state đúng; 0 card; ảnh ' + file
})

// ---------- 4. Chọn combo -> checkout ----------
await step('4', 'Chọn combo — thông tin truyền đúng sang checkout', async () => {
  await gotoComboFresh()
  await page.locator('.hotel-card').first().locator('button', { hasText: 'Đặt ngay' }).click()
  await page.locator('.checkout-layout h1').waitFor({ timeout: 8000 })
  const heading = await page.locator('.checkout-layout h1').textContent()
  assert(heading.includes('Thanh toán đặt chỗ'), 'Checkout heading sai: ' + heading)
  const sum = norm(await page.locator('.booking-summary').textContent())
  assert(sum.includes('Combo du lịch'), 'Summary thiếu Dịch vụ = Combo du lịch')
  assert(sum.includes('Combo Marina Bay Đà Nẵng Resort + vé bay'), 'Summary thiếu tên combo')
  const trip = await page.locator('.traveler-card').first().textContent()
  assert(trip.includes('Nhận phòng') && trip.includes('Trả phòng'), 'Thiếu nhãn nhận/trả phòng')
  const file = await shot(page, 'checkout')
  return 'Dịch vụ=Combo du lịch; tên combo + nhãn ngày đúng; ảnh ' + file
})

// ---------- 5. Giá / promo: cả 3 mã đều áp được cho combo ----------
await step('5', 'Giá gốc / 3 mã giảm giá áp đúng cho combo / tổng đúng', async () => {
  // combo-1 = 1.850.000 + 1.290.000 - 450.000 = 2.690.000
  let sum = norm(await page.locator('.booking-summary').textContent())
  assert(sum.includes('2.690.000'), 'Giá gốc combo phải 2.690.000: ' + sum)
  assert(sum.includes('-322.800'), 'SALECUOITUAN 12% phải giảm 322.800: ' + sum)
  assert(sum.includes('2.367.200'), 'Tổng sau 12% phải 2.367.200: ' + sum)
  assert(!sum.includes('không áp dụng'), 'SALECUOITUAN phải áp được cho combo')
  const promos = page.locator('.mini-promos button')
  // COMBOHE 25% chỉ dành cho combo
  await promos.nth(2).click()
  sum = norm(await page.locator('.booking-summary').textContent())
  assert(sum.includes('COMBOHE'), 'Chưa chọn được COMBOHE')
  assert(!sum.includes('không áp dụng'), 'COMBOHE phải áp được cho combo')
  assert(sum.includes('-672.500') && sum.includes('2.017.500'), 'COMBOHE 25% sai: ' + sum)
  // BAYNGAY 8% áp cho combo
  await promos.nth(1).click()
  sum = norm(await page.locator('.booking-summary').textContent())
  assert(sum.includes('-215.200') && sum.includes('2.474.800'), 'BAYNGAY 8% sai: ' + sum)
  // Quay lại p1
  await promos.nth(0).click()
  sum = norm(await page.locator('.booking-summary').textContent())
  assert(sum.includes('-322.800') && sum.includes('2.367.200'), 'Quay lại p1 không khôi phục')
  const file = await shot(page, 'promo')
  return 'gốc 2.690.000; p1 -322.800; p3 -672.500; p2 -215.200; ảnh ' + file
})

// ---------- 6. Ngày nhận/trả + validation ngày search ----------
await step('6', 'Ngày nhận/trả hiển thị + validation ngày phía app', async () => {
  const depart = await page.locator('.trip-info-row span').nth(2).locator('b').textContent()
  const ret = await page.locator('.trip-info-row span').nth(3).locator('b').textContent()
  assert(/\d{4}-\d{2}-\d{2}/.test(depart), 'Ngày nhận sai format: ' + depart)
  assert(ret > depart, 'Trả phòng phải sau nhận')
  assert(depart >= todayISO(), 'Ngày nhận phải từ hôm nay')
  await reset()
  await page.locator('.search-services button', { hasText: 'Combo' }).click()
  await page.locator('.search-card input[type="date"]').first().fill('2020-01-01')
  await page.locator('.search-submit').click()
  await page.locator('.toast').waitFor({ timeout: 4000 })
  assert((await page.locator('.toast').textContent()).includes('Ngày đi phải từ hôm nay'), 'Không chặn ngày quá khứ')
  return `nhận ${depart} -> trả ${ret}; toast quá khứ đúng`
})

// ---------- 7. Login gate ----------
await step('7', 'Login gate: pay khi chưa đăng nhập -> modal, validation login, không plaintext', async () => {
  await ensureUser('comboa@mayan.test', 'secret123')
  await ensureUser('combob@mayan.test', 'secret123')
  await gotoComboFresh()
  await page.locator('.hotel-card').first().locator('button', { hasText: 'Đặt ngay' }).click()
  await page.locator('.checkout-layout h1').waitFor({ timeout: 8000 })
  await page.locator('.pay-btn').click()
  await page.locator('.login-modal').waitFor({ timeout: 5000 })
  const bookingsBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('may-an-nhien-bookings-comboa@mayan.test') || '[]').length)
  assert(bookingsBefore === 0, 'Không được tạo booking khi chưa login')
  await page.locator('.login-field input[type="email"]').fill('sai-email')
  await page.locator('.login-submit').click()
  assert((await page.locator('.login-error').textContent()).includes('Email không hợp lệ'), 'Không bắt email sai')
  await page.locator('.login-field input[type="email"]').fill('comboa@mayan.test')
  await page.locator('.login-field input[type="password"]').fill('123')
  await page.locator('.login-submit').click()
  assert((await page.locator('.login-error').textContent()).includes('ít nhất 6 ký tự'), 'Không bắt password < 6')
  await page.locator('.login-field input[type="password"]').fill('secret123')
  await page.locator('.login-submit').click()
  await page.locator('.login-modal').waitFor({ state: 'detached', timeout: 5000 })
  await page.locator('.user-chip', { hasText: 'comboa' }).waitFor({ timeout: 5000 })
  const ls = await page.evaluate(() => Object.entries(localStorage).map(([k, v]) => `${k}=${v}`).join('|'))
  assert(!ls.includes('secret123'), 'localStorage lưu plaintext password!')
  const file = await shot(page, 'logingate')
  return 'gate chặn + validation OK + login comboa; 0 plaintext; ảnh ' + file
})

// ---------- 8. Form thông tin khách ----------
await step('8', 'Form khách: rỗng / tên ngắn / SĐT sai / email sai / hợp lệ', async () => {
  const name = page.locator('.checkout-form input').first()
  const phone = page.locator('.checkout-form input[inputmode="tel"]')
  const email = page.locator('.checkout-form input[type="email"]')
  await name.fill('')
  await page.locator('.pay-btn').click()
  await page.locator('.toast').waitFor({ timeout: 4000 })
  assert((await page.locator('.toast').textContent()).includes('họ tên'), 'Không bắt họ tên rỗng')
  await name.fill('A')
  await page.locator('.pay-btn').click()
  await page.locator('.toast').waitFor({ timeout: 4000 })
  assert((await page.locator('.toast').textContent()).includes('tối thiểu 2 ký tự'), 'Không bắt tên 1 ký tự')
  await name.fill('Nguyễn Văn Test')
  await phone.fill('abc')
  await page.locator('.pay-btn').click()
  await page.locator('.toast').waitFor({ timeout: 4000 })
  assert((await page.locator('.toast').textContent()).includes('Số điện thoại'), 'Không bắt SĐT sai')
  await phone.fill('0912345678')
  await email.fill('sai-email')
  await page.locator('.pay-btn').click()
  await page.locator('.toast').waitFor({ timeout: 4000 })
  assert((await page.locator('.toast').textContent()).includes('Email chưa hợp lệ'), 'Không bắt email sai')
  await email.fill('test@example.com')
  const maxName = await name.getAttribute('maxlength')
  assert(maxName === '60', 'maxlength họ tên phải 60, got ' + maxName)
  return 'rỗng/tên ngắn/SĐT/email đều bị chặn; hợp lệ đã điền'
})

// ---------- 9. Payment methods ----------
await step('9', 'Chọn 3 phương thức thanh toán — summary phản ánh đúng', async () => {
  const methods = page.locator('.pay-methods button')
  assert((await methods.count()) === 3, 'Cần đúng 3 phương thức')
  await methods.nth(0).click()
  assert(norm(await page.locator('.booking-summary').textContent()).includes('ATM'), 'Summary chưa theo ATM')
  await methods.nth(2).click()
  assert(norm(await page.locator('.booking-summary').textContent()).includes('Thẻ quốc tế'), 'Summary chưa theo Thẻ quốc tế')
  await methods.nth(1).click()
  assert(norm(await page.locator('.booking-summary').textContent()).includes('Ví điện tử'), 'Summary chưa theo Ví điện tử')
  return 'ATM / Thẻ quốc tế / Ví điện tử đổi đúng trong summary'
})

// ---------- 10. Payment -> tạo booking combo ----------
await step('10', 'Payment thành công -> booking combo tạo đúng + hiện ở Đặt chỗ của tôi', async () => {
  await page.locator('.pay-btn').click()
  await page.locator('.pay-btn', { hasText: 'Đang xử lý' }).waitFor({ timeout: 3000 })
  await page.locator('.booking-card').first().waitFor({ timeout: 8000 })
  assert(page.url().includes('#/bookings'), 'Không về trang bookings sau pay: ' + page.url())
  const card = norm(await page.locator('.booking-card').first().textContent())
  assert(card.includes('Combo Marina Bay'), 'Booking thiếu tên combo: ' + card)
  assert(card.includes('Combo du lịch'), 'Booking thiếu serviceName: ' + card)
  assert(card.includes('Đã xác nhận'), 'Trạng thái không phải Đã xác nhận')
  assert(card.includes('2.367.200'), 'Tổng booking phải 2.367.200 (sau giảm 12%): ' + card)
  assert(card.includes('Nguyễn Văn Test'), 'Booking thiếu traveler')
  assert(card.includes('SALECUOITUAN'), 'Booking thiếu mã promo')
  assert(card.includes('Ví điện tử'), 'Booking thiếu phương thức thanh toán')
  const match = card.match(/Mã ([A-Z0-9]{6})/)
  assert(match, 'Không thấy Booking ID')
  const file = await shot(page, 'booking')
  return `booking ${match[1]}; tổng 2.367.200; Ví điện tử; ảnh ${file}`
})

// ---------- 11. Reload -> booking còn ----------
await step('11', 'Reload trang bookings -> đơn vẫn tồn tại (lưu localStorage)', async () => {
  await page.reload()
  await page.locator('.booking-card').first().waitFor({ timeout: 8000 })
  assert((await page.locator('.booking-card').count()) === 1, 'Sau reload phải còn đúng 1 booking')
  const card = norm(await page.locator('.booking-card').first().textContent())
  assert(card.includes('2.367.200') && card.includes('Combo du lịch'), 'Booking sai sau reload')
  const session = await page.evaluate(() => localStorage.getItem('may-an-nhien-session') || '')
  assert(session.includes('comboa@mayan.test'), 'Session không persist')
  return 'reload -> còn nguyên 1 booking + session comboa'
})

// ---------- 12. Account isolation ----------
await step('12', 'Isolation: logout -> trống; tài khoản B không thấy đơn A; login lại A -> còn', async () => {
  await page.locator('.header-actions button', { hasText: 'Đăng xuất' }).click()
  await page.locator('.user-chip').waitFor({ state: 'detached', timeout: 5000 })
  await page.waitForTimeout(400)
  assert((await page.locator('.booking-card').count()) === 0, 'Khách vẫn thấy đơn của comboa!')
  assert(await page.locator('.empty-bookings').isVisible(), 'Không thấy trạng thái rỗng khi là khách')
  await loginAs('combob@mayan.test')
  await page.waitForTimeout(300)
  assert((await page.locator('.booking-card').count()) === 0, 'combob thấy đơn của comboa!')
  await page.locator('.header-actions button', { hasText: 'Đăng xuất' }).click()
  await page.locator('.user-chip').waitFor({ state: 'detached', timeout: 5000 })
  await loginAs('comboa@mayan.test')
  await page.locator('.booking-card').first().waitFor({ timeout: 5000 })
  assert((await page.locator('.booking-card').count()) === 1, 'Mất đơn khi login lại comboa')
  const file = await shot(page, 'isolation')
  return 'khách=0; combob=0; comboa=1; ảnh ' + file
})

// ---------- 13. Double-submit payment ----------
await step('13', 'Double-click thanh toán -> chỉ tạo thêm đúng 1 đơn (không trùng)', async () => {
  await page.goto(`${BASE}#/combo`)
  await page.reload()
  await page.locator('.hotel-card').first().waitFor({ timeout: 10000 })
  await page.locator('.hotel-card').first().locator('button', { hasText: 'Đặt ngay' }).click()
  await page.locator('.checkout-layout h1').waitFor({ timeout: 8000 })
  const nameVal = await page.locator('.checkout-form input').first().inputValue()
  assert(nameVal.length >= 2, 'Traveler không persist từ lần điền trước')
  const clickPay = page.locator('.pay-btn').click()
  await page.waitForTimeout(120)
  const clickPay2 = page.locator('.pay-btn').click({ force: true }).catch(() => 'disabled')
  await Promise.all([clickPay, clickPay2])
  await page.locator('.booking-card').first().waitFor({ timeout: 8000 })
  const count = await page.locator('.booking-card').count()
  assert(count === 2, `Sau double-submit có ${count} booking (mong 2 = cũ 1 + mới 1)`)
  const card = norm(await page.locator('.booking-card').first().textContent())
  assert(card.includes('Combo'), 'Booking mới không phải combo')
  const file = await shot(page, 'double')
  return 'bấm đôi -> đúng 2 đơn (không nhân đôi); ảnh ' + file
})

// ---------- 14. Cancel / Back ----------
await step('14', 'Back-btn từ checkout về home; browser back/forward không crash', async () => {
  await page.goto(`${BASE}#/combo`)
  await page.reload()
  await page.locator('.hotel-card').first().waitFor({ timeout: 10000 })
  await page.locator('.hotel-card').first().locator('button', { hasText: 'Đặt ngay' }).click()
  await page.locator('.checkout-layout h1').waitFor({ timeout: 8000 })
  await page.locator('.back-btn').click()
  await page.locator('.search-card').waitFor({ timeout: 5000 })
  assert(!page.url().includes('checkout'), 'back-btn không về home: ' + page.url())
  await page.goBack()
  await page.waitForTimeout(400)
  assert(!page.url().includes('undefined'), 'URL lỗi: ' + page.url())
  await page.goForward()
  await page.waitForTimeout(300)
  return 'back-btn -> home; goBack/goForward không crash, URL sạch'
})

// ---------- 15. Mobile 375 / 390 / 430 ----------
await step('15', 'Mobile 375/390/430: không tràn ngang, card + pay + bottom-nav hiển thị', async () => {
  const sizes = [[375, 812], [390, 844], [430, 932]]
  const problems = []
  for (const [w, h] of sizes) {
    await page.goto(`${BASE}#/combo`)
    await page.reload()
    await page.locator('.hotel-card').first().waitFor({ timeout: 10000 })
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(400)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (overflow > 2) problems.push(`${w}px combo overflow ${overflow}px`)
    if (!(await page.locator('.hotel-card').first().isVisible())) problems.push(`${w}px combo-card ẩn`)
    if (!(await page.locator('.mobile-bottom-nav').isVisible())) problems.push(`${w}px mất bottom-nav`)
    if (!(await page.locator('.hotel-card').first().locator('button').isVisible())) problems.push(`${w}px nút Đặt ngay bị cắt`)
    await page.locator('.hotel-card').first().locator('button', { hasText: 'Đặt ngay' }).click()
    await page.locator('.checkout-layout h1').waitFor({ timeout: 5000 })
    const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (overflow2 > 2) problems.push(`${w}px checkout overflow ${overflow2}px`)
    if (!(await page.locator('.pay-btn').isVisible())) problems.push(`${w}px pay-btn ẩn`)
  }
  if (problems.length) throw new Error(problems.join('; '))
  await page.setViewportSize({ width: 375, height: 812 })
  await page.waitForTimeout(300)
  const file = await shot(page, 'mobile375')
  return '375/390/430: 0 tràn, card+pay+bottom-nav OK; ảnh ' + file
})

// ---------- 16. API: loading / error / retry / fallback ----------
await step('16', 'API: skeleton loading, lỗi API -> banner + không crash, retry -> khôi phục', async () => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {})
  await page.route('**/api/catalog*', async (route) => {
    if (apiFailurePhase) return route.abort()
    await new Promise((r) => setTimeout(r, 1200))
    return route.continue()
  })
  await page.route('**/api/travel*', (route) => (apiFailurePhase ? route.abort() : route.continue()))
  await page.goto(`${BASE}#/combo`)
  await page.reload()
  const skeleton = await page.locator('.skeleton-wrap').first().waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false)
  await page.locator('.hotel-card').first().waitFor({ timeout: 12000 })
  assert((await page.locator('.hotel-card').count()) === 3, 'Sau loading không đủ 3 combo')
  apiFailurePhase = true
  await page.reload()
  await page.locator('.hotel-card').first().waitFor({ timeout: 10000 })
  const fallback = await page.locator('.hotel-card').count()
  assert(fallback > 0, 'API chết -> mất hết dữ liệu (không fallback)')
  await page.locator('.data-error-banner').waitFor({ timeout: 8000 })
  assert((await page.locator('.data-error-banner').textContent()).includes('dữ liệu dự phòng'), 'Banner thiếu nội dung fallback')
  await page.goto(`${BASE}#/`)
  await page.reload()
  await page.locator('.data-error-strip').waitFor({ timeout: 8000 })
  apiFailurePhase = false
  await page.locator('.data-error-banner button', { hasText: 'Thử lại' }).click()
  await page.locator('.data-error-banner').waitFor({ state: 'detached', timeout: 8000 })
  await page.locator('.data-error-strip button', { hasText: 'Thử lại' }).click()
  await page.locator('.data-error-strip').waitFor({ state: 'detached', timeout: 8000 })
  await page.locator('.search-card').waitFor({ timeout: 5000 })
  const file = await shot(page, 'api')
  return `skeleton=${skeleton ? 'có' : 'khó thấy (API nhanh)'}; fallback ${fallback} card; banner+strip+retry OK; ảnh ${file}`
})

// ---------- 17. Console / runtime ----------
await step('17', 'Runtime: 0 console.error (ngoại trừ API chủ động) + 0 pageerror', async () => {
  assert(consoleErrors.length === 0, `Có ${consoleErrors.length} console.error: ${consoleErrors[0]}`)
  assert(pageErrors.length === 0, `Có ${pageErrors.length} pageerror: ${pageErrors[0]}`)
  const storage = await page.evaluate(() => Object.entries(localStorage).map(([k, v]) => `${k}=${v}`).join('|'))
  assert(!storage.includes('secret123'), 'Tìm thấy password trong localStorage!')
  return 'console.error=0; pageerror=0; không có plaintext password'
})

// ---------- Ghi kết quả ----------
const summary = { module: 'COMBO', total: passed + failed, passed, failed, results }
fs.writeFileSync(path.resolve('qa-evidence/final/combo-results.json'), JSON.stringify(summary, null, 2))

console.log(`\nTONG: ${summary.total} | PASS: ${passed} | FAIL: ${failed}`)

await browser.close()
process.exit(failed > 0 ? 1 : 0)





