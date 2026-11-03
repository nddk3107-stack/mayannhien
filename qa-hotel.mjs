// qa-hotel.mjs — Hotel module: 18 test cases (bao phủ 26 yêu cầu Part 4)
// Browser thật Chromium/Playwright. KHÔNG sửa app để qua test.
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'http://localhost:5175/'
const OUT = path.resolve('qa-evidence/final/hotel')
fs.mkdirSync(OUT, { recursive: true })

let passed = 0
let failed = 0
const results = []
const consoleErrors = []
const pageErrors = []
let apiFailurePhase = false
let expectNetworkFail = false // voucher invalid -> server trả 400 có chủ đích
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
// DB tạm của suite có thể chưa có user hotela/hotelb -> đăng ký trước khi dùng.

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
  if (expectNetworkFail && text.includes('Failed to load resource')) return
  consoleErrors.push(text)
})
page.on('pageerror', (err) => pageErrors.push(String(err)))

async function failRoute(route) {
  await route.abort()
}
async function routeApi(pattern) {
  await page.route(pattern, async (route) => {
    if (apiFailurePhase) return failRoute(route)
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
  const name = email.split('@')[0]
  await page.locator('.user-chip', { hasText: name }).waitFor({ timeout: 5000 })
}

async function gotoHotelFresh() {
  await page.goto(`${BASE}#/hotel`)
  await page.reload()
  await page.locator('.hotel-card').first().waitFor({ timeout: 10000 })
}

// Luồng mới: khách sạn -> trang chọn phòng (#/rooms) -> chọn phòng -> thanh toán phòng.
async function pickFirstRoom() {
  await page.locator('.hotel-card').first().locator('button', { hasText: 'Chọn phòng' }).click()
  await page.locator('.room-card').first().waitFor({ timeout: 8000 })
  await page.locator('.pick-room-btn').first().click()
  await page.locator('.hotel-checkout h1').waitFor({ timeout: 8000 })
}

console.log('=== QA HOTEL — Mây An Nhiên (browser thật) ===')
await reset()


// ---------- 1. Load hotel ----------
await step('1', 'Trang hotel load thành công + runtime 0 lỗi', async () => {
  assert(page.url().includes('#/'), 'URL sai: ' + page.url())
  await page.locator('.nav button', { hasText: 'Khách sạn' }).click()
  await page.locator('.hotel-card').first().waitFor({ timeout: 10000 })
  const hero = await page.locator('.page-hero h1').textContent()
  assert(hero.includes('Khách sạn và resort'), 'Hero sai: ' + hero)
  const cards = await page.locator('.hotel-card').count()
  assert(cards === 3, `Đang có ${cards} hotel card (mong 3)`)
  const first = await page.locator('.hotel-card').first().textContent()
  assert(first.includes('Marina Bay'), 'Hotel đầu không phải Marina Bay')
  const title = await page.title()
  assert(title.includes('Khách sạn'), 'document.title không đổi theo trang: ' + title)
  const file = await shot(page, 'load')
  return `hero OK; ${cards} card; title="${title}"; ảnh ${file}`
})

// ---------- 2. Search keyword hợp lệ (từ trang chủ, pill Khách sạn) ----------
await step('2', 'Search keyword hợp lệ từ home -> trang hotel lọc đúng', async () => {
  await reset()
  await page.locator('.search-services button', { hasText: 'Khách sạn' }).click()
  await page.locator('.search-card input[maxlength="80"]').fill('Đà Nẵng')
  await page.locator('.search-submit').click()
  await page.locator('.hotel-grid .hotel-card').first().waitFor({ timeout: 8000 })
  assert(page.url().includes('#/hotel'), 'Không điều hướng sang #/hotel: ' + page.url())
  const summary = await page.locator('.search-summary').textContent()
  assert(summary.includes('Đà Nẵng'), 'SearchSummary thiếu keyword: ' + summary)
  const count = await page.locator('.results-count').textContent()
  assert(count.includes('1 khách sạn'), 'Kết quả sai: ' + count)
  const card = await page.locator('.hotel-card').first().textContent()
  assert(card.includes('Marina Bay'), 'Kết quả không phải Marina Bay')
  const file = await shot(page, 'search')
  return `1 kết quả Marina Bay; summary OK; ảnh ${file}`
})

// ---------- 3. Search keyword không tồn tại ----------
await step('3', 'Search keyword không tồn tại -> trạng thái rỗng có hướng dẫn', async () => {
  await reset()
  await page.locator('.search-services button', { hasText: 'Khách sạn' }).click()
  await page.locator('.search-card input[maxlength="80"]').fill('Tokyo')
  await page.locator('.search-submit').click()
  await page.locator('.empty-result').waitFor({ timeout: 8000 })
  const txt = await page.locator('.empty-result').textContent()
  assert(txt.includes('Không tìm thấy'), 'Không có empty state')
  assert(txt.includes('từ khóa khác') || txt.includes('gỡ bộ lọc'), 'Empty state thiếu hướng dẫn')
  const cards = await page.locator('.hotel-card').count()
  assert(cards === 0, `Còn ${cards} card khi search không tồn tại`)
  const file = await shot(page, 'empty')
  return `empty state + hướng dẫn; 0 card; ảnh ${file}`
})

// ---------- 4. Filter: promo / miễn phí hủy / đánh giá / trung tâm / giá ----------
await step('4', 'Filter: khuyến mãi / miễn phí hủy / đánh giá / trung tâm / giá', async () => {
  await gotoHotelFresh()
  const cb = page.locator('.filter-panel input[type="checkbox"]')
  const count = () => page.locator('.hotel-card').count()
  assert(await count() === 3, 'Ban đầu chưa phải 3 card')
  await cb.nth(0).check()
  assert(await count() === 2, `promoOnly -> ${await count()} (mong 2)`)
  await cb.nth(0).uncheck()
  await cb.nth(1).check()
  assert(await count() === 1, `freeCancel -> ${await count()} (mong 1)`)
  const free = await page.locator('.hotel-card h3').textContent()
  assert(free.includes('Sapa'), 'Hotel free-cancel sai: ' + free)
  await cb.nth(1).uncheck()
  await cb.nth(2).check()
  assert(await count() === 3, `highRating -> ${await count()} (mong 3)`)
  await cb.nth(2).uncheck()
  await cb.nth(3).check()
  // location 'Trung tâm Sa Pa' (h2) + perk 'Trung tâm' (h3) -> đúng 2
  assert(await count() === 2, `central -> ${await count()} (mong 2)`)
  const central = await page.locator('.hotel-card h3').allTextContents()
  assert(central.some((n) => n.includes('Sapa')) && central.some((n) => n.includes('Hanoi')), 'Hotel trung tâm sai: ' + central.join(', '))
  await cb.nth(3).uncheck()
  await page.locator('.filter-panel input[type="range"]').fill('1000000')
  assert(await count() === 1, `maxPrice 1tr -> ${await count()} (mong 1)`)
  const cheap = await page.locator('.hotel-card h3').textContent()
  assert(cheap.includes('Sapa'), 'Hotel giá thấp sai: ' + cheap)
  await page.locator('.filter-panel input[type="range"]').fill('5000000')
  assert(await count() === 3, 'Khôi phục filter -> phải về 3 card')
  const file = await shot(page, 'filters')
  return `promo 3->2; hủy 1; rating 3; trung tâm 2; giá 1; khôi phục 3; ảnh ${file}`
})


// ---------- 5. Chọn khách sạn -> trang phòng -> checkout phòng ----------
await step('5', 'Chọn khách sạn -> danh sách phòng -> chọn phòng -> thanh toán phòng', async () => {
  await gotoHotelFresh()
  await page.locator('.hotel-card').first().locator('button', { hasText: 'Chọn phòng' }).click()
  await page.locator('.room-card').first().waitFor({ timeout: 8000 })
  const roomCards = await page.locator('.room-card').count()
  assert(roomCards >= 2, `Marina Bay phải có >=2 phòng (đang có ${roomCards})`)
  const chip = await page.locator('.room-amenity-chips li').first().textContent()
  assert(chip.trim().length > 2, 'Room card thiếu chip tiện nghi')
  await page.locator('.pick-room-btn').first().click()
  await page.locator('.hotel-checkout h1').waitFor({ timeout: 8000 })
  const heading = await page.locator('.hotel-checkout h1').textContent()
  assert(heading.includes('Thanh toán đặt phòng'), 'Checkout heading sai: ' + heading)
  const sum = norm(await page.locator('.booking-summary').textContent())
  assert(sum.includes('Khách sạn'), 'Summary thiếu Khách sạn')
  assert(sum.includes('Marina Bay Đà Nẵng Resort'), 'Summary thiếu tên hotel')
  assert(sum.includes('Phòng Deluxe Giáp Biển'), 'Summary thiếu tên phòng đã chọn')
  const trip = await page.locator('.traveler-card').first().textContent()
  assert(trip.includes('Nhận phòng') && trip.includes('Trả phòng'), 'Thiếu nhãn nhận/trả phòng')
  assert(trip.includes('Giường king'), 'Thiếu loại giường của phòng')
  const file = await shot(page, 'checkout')
  return `${roomCards} phòng + tiện nghi; Marina Bay + Phòng Deluxe; nhãn nhận/trả đúng; ảnh ${file}`
})

// ---------- 6. Voucher nhập tay: hợp lệ / sai loại / mã sai + tổng đúng ----------
await step('6', 'Voucher nhập tay: hợp lệ (Enter) / sai loại / mã sai; tiền phòng đúng', async () => {
  // 3 đêm (mặc định +7 -> +10) × 1.850.000 = 5.550.000
  let sum = norm(await page.locator('.booking-summary').textContent())
  assert(sum.includes('5.550.000'), 'Tiền phòng 3 đêm phải 5.550.000: ' + sum)
  assert(sum.includes('0 ₫') || /Giảm giá voucher.{0,40}0/.test(sum), 'Chưa có voucher thì giảm phải 0: ' + sum)
  // Mã hợp lệ — bấm Enter trong ô nhập
  await page.locator('.voucher-input').fill('SALECUOITUAN')
  await page.locator('.voucher-input').press('Enter')
  await page.locator('.voucher-applied').waitFor({ timeout: 6000 })
  sum = norm(await page.locator('.booking-summary').textContent())
  assert(sum.includes('666.000'), 'Giảm 12% của 5.550.000 phải 666.000: ' + sum)
  assert(sum.includes('4.884.000'), 'Tổng sau giảm phải 4.884.000: ' + sum)
  // Mã sai loại dịch vụ (BAYNGAY chỉ áp flight/combo) -> backend từ chối
  expectNetworkFail = true
  await page.locator('.voucher-clear').click()
  await page.locator('.voucher-input').fill('BAYNGAY')
  await page.locator('.voucher-apply').click()
  await page.locator('.voucher-status.error', { hasText: 'không áp dụng' }).waitFor({ timeout: 6000 })
  const err1 = await page.locator('.voucher-status.error').textContent()
  assert(err1.includes('không áp dụng cho khách sạn'), 'BAYNGAY phải bị từ chối cho hotel: ' + err1)
  // Mã không tồn tại
  await page.locator('.voucher-input').fill('MAKHONGTONTAI')
  await page.locator('.voucher-apply').click()
  await page.locator('.voucher-status.error', { hasText: 'không tồn tại' }).waitFor({ timeout: 6000 })
  expectNetworkFail = false
  // Không còn voucher áp dụng -> tổng về lại giá gốc
  await page.locator('.voucher-input').fill('')
  sum = norm(await page.locator('.booking-summary').textContent())
  assert(sum.includes('5.550.000'), 'Sau khi gỡ voucher tổng phải về 5.550.000: ' + sum)
  const file = await shot(page, 'voucher')
  return '5.550.000 - 666.000 = 4.884.000 (SALECUOITUAN); BAYNGAY + mã sai bị backend chặn; ảnh ' + file
})


// ---------- 7. Ngày nhận/trả trong checkout + validation ngày ----------
await step('7', 'Ngày nhận/trả: đúng format + chặn ngày sai (inline) + khôi phục', async () => {
  const ci = page.locator('.stay-grid input[type="date"]').first()
  const co = page.locator('.stay-grid input[type="date"]').nth(1)
  const v1 = await ci.inputValue()
  const v2 = await co.inputValue()
  assert(/\d{4}-\d{2}-\d{2}/.test(v1) && /\d{4}-\d{2}-\d{2}/.test(v2), 'Sai format ngày nhận/trả: ' + v1 + '/' + v2)
  assert(v2 > v1, 'Ngày trả phải sau ngày nhận: ' + v1 + ' -> ' + v2)
  assert(v1 >= todayISO(), 'Ngày nhận phải từ hôm nay: ' + v1)
  // Trả <= nhận -> lỗi CẠNH ô nhập (app-side, không im lặng)
  await co.fill(v1)
  await page.locator('.field-error', { hasText: 'sau ngày nhận phòng' }).waitFor({ timeout: 4000 })
  // Nhận quá khứ -> app tự chặn và báo tiếng Việt
  await ci.fill('2020-01-01')
  await page.locator('.field-error', { hasText: 'từ hôm nay' }).waitFor({ timeout: 4000 })
  // Khôi phục ngày gốc -> hết lỗi, tiền phòng về đúng
  await ci.fill(v1)
  await co.fill(v2)
  await page.locator('.field-error').waitFor({ state: 'detached', timeout: 4000 })
  const priceLine = norm(await page.locator('.room-price-line').textContent())
  assert(priceLine.includes('5.550.000'), 'Sau khi khôi phục ngày, tiền phòng phải về 5.550.000: ' + priceLine)
  // Validation ngày phía app ở ô tìm kiếm trang chủ (giữ nguyên hành vi cũ)
  await reset()
  await page.locator('.search-services button', { hasText: 'Khách sạn' }).click()
  await page.locator('.search-card input[type="date"]').first().fill('2020-01-01')
  await page.locator('.search-submit').click()
  await page.locator('.toast').waitFor({ timeout: 4000 })
  const t1 = await page.locator('.toast').textContent()
  assert(t1.includes('Ngày đi phải từ hôm nay'), 'Không chặn ngày quá khứ: ' + t1)
  await page.locator('.search-card input[type="date"]').first().fill(todayISO())
  await page.locator('.search-card input[type="date"]').nth(1).fill('2020-01-01')
  await page.locator('.search-submit').click()
  await page.locator('.toast').waitFor({ timeout: 4000 })
  const t2 = await page.locator('.toast').textContent()
  assert(t2.includes('Ngày về phải sau ngày đi'), 'Không chặn về<đi: ' + t2)
  return `nhận ${v1} -> trả ${v2}; lỗi inline ngày quá khứ/về<nhận + khôi phục OK; toast search đúng`
})

// ---------- 8. Login gate ----------
await step('8', 'Login gate: pay khi chưa đăng nhập -> modal, validation login, không plaintext', async () => {
  await ensureUser('hotela@mayan.test', 'secret123')
  await ensureUser('hotelb@mayan.test', 'secret123')
  await gotoHotelFresh()
  await pickFirstRoom()
  await page.locator('.pay-btn').click()
  await page.locator('.login-modal').waitFor({ timeout: 5000 })
  const hint = await page.locator('.pay-hint').textContent()
  assert(hint.includes('cần đăng nhập'), 'Thiếu pay-hint: ' + hint)
  const bookingsBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('may-an-nhien-bookings-hotela@mayan.test') || '[]').length)
  assert(bookingsBefore === 0, 'Không được tạo booking khi chưa login')
  await page.locator('.login-submit').click()
  await page.locator('.login-error').waitFor({ timeout: 3000 })
  assert((await page.locator('.login-error').textContent()).includes('Email không hợp lệ'), 'Thiếu lỗi email rỗng')
  await page.locator('.login-field input[type="email"]').fill('abc')
  await page.locator('.login-submit').click()
  assert((await page.locator('.login-error').textContent()).includes('Email không hợp lệ'), 'Không bắt email sai format')
  await page.locator('.login-field input[type="email"]').fill('hotela@mayan.test')
  await page.locator('.login-field input[type="password"]').fill('123')
  await page.locator('.login-submit').click()
  assert((await page.locator('.login-error').textContent()).includes('ít nhất 6 ký tự'), 'Không bắt password < 6')
  await page.locator('.login-field input[type="password"]').fill('secret123')
  await page.locator('.login-submit').click()
  await page.locator('.login-modal').waitFor({ state: 'detached', timeout: 5000 })
  await page.locator('.user-chip', { hasText: 'hotela' }).waitFor({ timeout: 5000 })
  const ls = await page.evaluate(() => Object.entries(localStorage).map(([k, v]) => `${k}=${v}`).join('|'))
  assert(!ls.includes('secret123'), 'localStorage đang lưu plaintext password!')
  const file = await shot(page, 'logingate')
  return 'gate chặn + 3 lỗi validation + login hotela OK, 0 plaintext; ảnh ' + file
})

// ---------- 9. Form thông tin khách (lỗi CẠNH ô nhập) ----------
await step('9', 'Form khách: rỗng / tên ngắn / SĐT sai / email sai hiện lỗi cạnh ô', async () => {
  const name = page.locator('.checkout-form input').first()
  const phone = page.locator('.checkout-form input[inputmode="tel"]')
  const email = page.locator('.checkout-form input[type="email"]')
  await name.fill('')
  await page.locator('.pay-btn').click()
  await page.locator('.field-error', { hasText: 'họ tên' }).first().waitFor({ timeout: 4000 })
  await name.fill('A')
  await page.locator('.pay-btn').click()
  await page.locator('.field-error', { hasText: 'tối thiểu 2 ký tự' }).first().waitFor({ timeout: 4000 })
  await name.fill('Nguyễn Văn Test')
  await phone.fill('abc')
  await page.locator('.pay-btn').click()
  await page.locator('.field-error', { hasText: 'Số điện thoại' }).first().waitFor({ timeout: 4000 })
  await phone.fill('0912345678')
  await email.fill('sai-email')
  await page.locator('.pay-btn').click()
  await page.locator('.field-error', { hasText: 'Email chưa hợp lệ' }).first().waitFor({ timeout: 4000 })
  await email.fill('test@example.com')
  const maxName = await name.getAttribute('maxlength')
  assert(maxName === '60', 'maxlength họ tên phải là 60, got ' + maxName)
  // Dữ liệu hợp lệ được giữ lại sau các lần lỗi
  assert((await name.inputValue()) === 'Nguyễn Văn Test', 'Mất dữ liệu hợp lệ khi có lỗi')
  const file = await shot(page, 'form')
  return 'rỗng/tên ngắn/SĐT/email đều hiện lỗi cạnh ô; maxlength=60; giữ dữ liệu; ảnh ' + file
})

// ---------- 10. Payment methods ----------
await step('10', 'Chọn 3 phương thức thanh toán — summary phản ánh đúng', async () => {
  const methods = page.locator('.pay-methods button')
  assert((await methods.count()) === 3, 'Cần đúng 3 phương thức')
  await methods.nth(1).click()
  assert(norm(await page.locator('.booking-summary').textContent()).includes('Ví điện tử'), 'Summary chưa theo Ví điện tử')
  await methods.nth(2).click()
  assert(norm(await page.locator('.booking-summary').textContent()).includes('Thẻ quốc tế'), 'Summary chưa theo Thẻ quốc tế')
  await methods.nth(0).click()
  assert(norm(await page.locator('.booking-summary').textContent()).includes('ATM'), 'Summary chưa theo ATM')
  await methods.nth(2).click()
  return 'ATM / Ví điện tử / Thẻ quốc tế đổi đúng trong summary'
})

// ---------- 11. Payment -> tạo booking hotel ----------
await step('11', 'Payment thành công -> booking hotel (phòng + voucher) hiện ở Đặt chỗ của tôi', async () => {
  // Áp dụng voucher trước khi thanh toán: 5.550.000 - 12% = 4.884.000
  await page.locator('.voucher-input').fill('SALECUOITUAN')
  await page.locator('.voucher-apply').click()
  await page.locator('.voucher-applied').waitFor({ timeout: 6000 })
  await page.locator('.pay-btn').click()
  await page.locator('.pay-btn', { hasText: 'Đang xử lý' }).waitFor({ timeout: 3000 })
  await page.locator('.booking-card').first().waitFor({ timeout: 8000 })
  assert(page.url().includes('#/bookings'), 'Không về trang bookings sau pay: ' + page.url())
  const card = norm(await page.locator('.booking-card').first().textContent())
  assert(card.includes('Marina Bay'), 'Booking thiếu tên hotel: ' + card)
  assert(card.includes('Khách sạn'), 'Booking thiếu serviceName: ' + card)
  assert(card.includes('Đã xác nhận'), 'Trạng thái không phải Đã xác nhận')
  assert(card.includes('4.884.000'), 'Tổng booking phải 4.884.000 (voucher 12%): ' + card)
  assert(card.includes('Nguyễn Văn Test'), 'Booking thiếu traveler')
  assert(card.includes('SALECUOITUAN'), 'Booking thiếu mã voucher')
  assert(card.includes('Thẻ quốc tế'), 'Booking thiếu phương thức thanh toán')
  assert(card.includes('Phòng Deluxe Giáp Biển'), 'Booking thiếu thông tin phòng')
  assert(card.includes('3 đêm'), 'Booking thiếu số đêm lưu trú')
  const match = card.match(/Mã ([A-Z0-9]{6})/)
  assert(match, 'Không thấy Booking ID')
  const file = await shot(page, 'booking')
  return `booking ${match[1]}; tổng 4.884.000; phòng Deluxe 3 đêm; Thẻ quốc tế; ảnh ${file}`
})

// ---------- 12. Reload -> booking còn ----------
await step('12', 'Reload trang bookings -> đơn vẫn tồn tại (lưu localStorage)', async () => {
  const before = await page.locator('.booking-card').count()
  assert(before === 1, `Trước reload có ${before} booking (mong 1)`)
  await page.reload()
  await page.locator('.booking-card').first().waitFor({ timeout: 8000 })
  const after = await page.locator('.booking-card').count()
  assert(after === 1, `Sau reload có ${after} booking (mong 1)`)
  const card = norm(await page.locator('.booking-card').first().textContent())
  assert(card.includes('Marina Bay') && card.includes('4.884.000'), 'Booking sai sau reload: ' + card)
  const session = await page.evaluate(() => localStorage.getItem('may-an-nhien-session') || '')
  assert(session.includes('hotela@mayan.test'), 'Session không persist sau reload')
  return 'reload -> còn nguyên 1 booking + session hotela vẫn có'
})

// ---------- 13. Account isolation ----------
await step('13', 'Isolation: logout -> trống; tài khoản B không thấy đơn A; login lại A -> còn', async () => {
  // logout -> khách không thấy đơn hotela
  await page.locator('.header-actions button', { hasText: 'Đăng xuất' }).click()
  await page.locator('.user-chip').waitFor({ state: 'detached', timeout: 5000 })
  await page.waitForTimeout(400)
  assert((await page.locator('.booking-card').count()) === 0, 'Khách vẫn thấy đơn của hotela!')
  assert(await page.locator('.empty-bookings').isVisible(), 'Không thấy trạng thái rỗng khi là khách')
  // login B -> không thấy đơn A
  await loginAs('hotelb@mayan.test')
  await page.waitForTimeout(300)
  assert((await page.locator('.booking-card').count()) === 0, 'hotelb thấy đơn của hotela!')
  // login lại A -> còn
  await page.locator('.header-actions button', { hasText: 'Đăng xuất' }).click()
  await page.locator('.user-chip').waitFor({ state: 'detached', timeout: 5000 })
  await loginAs('hotela@mayan.test')
  await page.locator('.booking-card').first().waitFor({ timeout: 5000 })
  assert((await page.locator('.booking-card').count()) === 1, 'Mất đơn khi login lại hotela')
  const file = await shot(page, 'isolation')
  return 'khách=0; hotelb=0; hotela=1; ảnh ' + file
})

// ---------- 14. Double-submit payment ----------
await step('14', 'Double-click thanh toán -> chỉ tạo thêm đúng 1 đơn (không trùng)', async () => {
  await page.goto(`${BASE}#/hotel`)
  await page.reload()
  await page.locator('.hotel-card').first().waitFor({ timeout: 10000 })
  await pickFirstRoom()
  // traveler đã lưu từ localStorage (loadTraveler) — kiểm tra
  const nameVal = await page.locator('.checkout-form input').first().inputValue()
  assert(nameVal.length >= 2, 'Traveler không persist từ lần điền trước')
  // Đổi ngày nhận/trả khác với đơn đã đặt ở bước 11 (tránh 409 Conflict do phòng đã bị chiếm)
  const today = new Date()
  const d15 = new Date(today); d15.setDate(d15.getDate() + 15)
  const d18 = new Date(today); d18.setDate(d18.getDate() + 18)
  const fmt = (d) => d.toISOString().slice(0, 10)
  await page.locator('.stay-grid input[type="date"]').first().fill(fmt(d15))
  await page.locator('.stay-grid input[type="date"]').nth(1).fill(fmt(d18))
  await page.locator('.room-price-line').waitFor({ timeout: 5000 })
  const clientId = await page.evaluate(() => localStorage.getItem('may-an-nhien-client') || 'anonymous-client')
  const listMyBookings = async () => {
    const res = await page.request.get(`${API_BASE}/api/bookings`, {
      headers: { 'X-Client-Id': clientId, 'X-Requested-With': 'fetch' },
    })
    assert(res.status() === 200, `GET /api/bookings backend trả ${res.status()}`)
    const body = await res.json()
    return Array.isArray(body.bookings) ? body.bookings : []
  }
  const beforeCount = (await listMyBookings()).length

  // Bấm 2 lần liên tiếp trước khi React kịp disable (bỏ qua lỗi UI race: nút bị disable/detach sau click đầu)
  const clickPay = page.locator('.pay-btn').click().catch(() => {})
  await page.waitForTimeout(120)
  const clickPay2 = page.locator('.pay-btn').click({ force: true }).catch(() => {})
  await Promise.all([clickPay, clickPay2])
  await page.locator('.booking-card').first().waitFor({ timeout: 8000 })
  const count = await page.locator('.booking-card').count()
  assert(count === 2, `Sau double-submit có ${count} booking (mong 2 = cũ 1 + mới 1)`)
  const card = norm(await page.locator('.booking-card').first().textContent())
  assert(card.includes('Marina Bay'), 'Booking mới không phải hotel')
  const codes = await page.locator('.booking-card .booking-actions').count()
  assert(codes === 2, 'Có booking lặp (2 khối actions mới)')
  const codeMatch = card.match(/Mã\s*(MAN\d+)/)
  assert(codeMatch, 'Không thấy mã đơn của booking mới')

  // ----- Verify PHAI BÊN BACKEND: double-click chỉ tạo đúng 1 đơn mới, không nhân đôi -----
  // Đơn tạo qua UI gắn client_id (localStorage may-an-nhien-client) -> phải gửi cùng header
  // khi gọi API từ page.request để đọc đúng danh sách đơn của trình duyệt này.
  const afterList = await listMyBookings()
  assert(afterList.length === beforeCount + 1, `Backend tạo ${afterList.length - beforeCount} đơn mới (mong đúng 1)`)
  const newest = afterList.slice().sort((a, b) => (b.createdAtIso || '').localeCompare(a.createdAtIso || ''))[0]
  assert(newest, 'Backend không lấy được đơn mới sau double-submit')
  assert(newest.code === codeMatch[1], `Backend đơn mới sai mã (${newest.code} vs ${codeMatch[1]})`)
  assert(newest.dates.depart === fmt(d15) && newest.dates.ret === fmt(d18), `Backend đơn mới sai ngày (${newest.dates.depart}->${newest.dates.ret}, mong ${fmt(d15)}->${fmt(d18)})`)
  assert(Number(newest.total) > 0, 'Backend đơn mới thiếu tổng tiền')

  const file = await shot(page, 'double')
  return `bấm đôi -> UI ${count} đơn, backend +1 đơn (mã ${codeMatch[1]}, đúng ngày), không nhân đôi; ảnh ${file}`
})

// ---------- 15. Cancel / Back ----------
await step('15', 'Back-btn từ thanh toán phòng -> trang chọn phòng; back/forward không crash', async () => {
  await page.goto(`${BASE}#/hotel`)
  await page.reload()
  await page.locator('.hotel-card').first().waitFor({ timeout: 10000 })
  await pickFirstRoom()
  await page.locator('.back-btn').click()
  await page.locator('.room-card').first().waitFor({ timeout: 5000 })
  assert(page.url().includes('#/rooms'), 'back-btn không về trang chọn phòng: ' + page.url())
  // browser back -> quay lại thanh toán (phòng vẫn giữ trong SPA/sessionStorage)
  await page.goBack()
  await page.waitForTimeout(400)
  assert(page.url().includes('checkout-hotel') || page.url().includes('rooms'), 'URL bất thường sau back: ' + page.url())
  assert(!page.url().includes('undefined'), 'URL lỗi: ' + page.url())
  // browser forward
  await page.goForward()
  await page.waitForTimeout(300)
  assert(!page.url().includes('undefined'), 'URL lỗi sau forward: ' + page.url())
  return 'back-btn -> #/rooms; goBack/goForward không crash, URL sạch'
})

// ---------- 16. Mobile 375 / 390 / 430 ----------
await step('16', 'Mobile 375/390/430: không tràn ngang, navbar + bottom-nav + card hiển thị', async () => {
  await page.goto(`${BASE}#/hotel`)
  await page.reload()
  const sizes = [[375, 812], [390, 844], [430, 932]]
  const problems = []
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(400)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (overflow > 2) problems.push(`${w}px hotel overflow ${overflow}px`)
    const cardVisible = await page.locator('.hotel-card').first().isVisible()
    if (!cardVisible) problems.push(`${w}px hotel-card ẩn`)
    const bottomNav = await page.locator('.mobile-bottom-nav').isVisible()
    if (!bottomNav) problems.push(`${w}px mất bottom-nav`)
    const searchBtn = await page.locator('.hotel-card').first().locator('button').isVisible()
    if (!searchBtn) problems.push(`${w}px nút Chọn phòng bị cắt`)
    await page.locator('.hotel-card').first().locator('button', { hasText: 'Chọn phòng' }).click()
    await page.locator('.room-card').first().waitFor({ timeout: 5000 })
    const overflowRoom = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (overflowRoom > 2) problems.push(`${w}px rooms overflow ${overflowRoom}px`)
    const pickVisible = await page.locator('.pick-room-btn').first().isVisible()
    if (!pickVisible) problems.push(`${w}px nút Đặt phòng bị cắt`)
    // Chờ ảnh lazy-load ổn định layout trước khi bấm (không ảnh hưởng logic app)
    await page.locator('.pick-room-btn').first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(600)
    await page.locator('.pick-room-btn').first().click({ timeout: 15000 })
    await page.locator('.hotel-checkout h1').waitFor({ timeout: 5000 })
    const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (overflow2 > 2) problems.push(`${w}px checkout overflow ${overflow2}px`)
    const payVisible = await page.locator('.pay-btn').isVisible()
    if (!payVisible) problems.push(`${w}px pay-btn ẩn`)
    const voucherVisible = await page.locator('.voucher-input').isVisible()
    if (!voucherVisible) problems.push(`${w}px ô voucher ẩn`)
    await page.goto(`${BASE}#/hotel`)
    await page.reload()
    await page.locator('.hotel-card').first().waitFor({ timeout: 8000 })
  }
  if (problems.length) throw new Error(problems.join('; '))
  await page.setViewportSize({ width: 375, height: 812 })
  await page.waitForTimeout(300)
  const file = await shot(page, 'mobile375')
  return '375/390/430: 0 tràn, card+pay+bottom-nav OK; ảnh ' + file
})

// ---------- 17. API: loading / error / retry / fallback ----------
await step('17', 'API: skeleton loading, lỗi API -> banner + không crash, retry -> khôi phục', async () => {
  await page.setViewportSize({ width: 1440, height: 900 })
  // Loading: chặn API trả về chậm -> thấy skeleton trên trang hotel
  await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {})
  await page.route('**/api/catalog*', async (route) => {
    if (apiFailurePhase) return route.abort()
    await new Promise((r) => setTimeout(r, 1200))
    return route.continue()
  })
  await page.route('**/api/travel*', (route) => (apiFailurePhase ? route.abort() : route.continue()))
  await page.goto(`${BASE}#/hotel`)
  await page.reload()
  const skeleton = await page.locator('.skeleton-wrap').first().waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false)
  await page.locator('.hotel-card').first().waitFor({ timeout: 12000 })
  const cardsAfterLoad = await page.locator('.hotel-card').count()
  assert(cardsAfterLoad === 3, `Sau loading có ${cardsAfterLoad} card (mong 3)`)
  // Error: abort cả 2 API -> không crash, có fallback + banner
  apiFailurePhase = true
  await page.reload()
  await page.locator('.hotel-card').first().waitFor({ timeout: 10000 })
  const fallback = await page.locator('.hotel-card').count()
  assert(fallback > 0, 'API chết -> mất hết dữ liệu (không fallback)')
  await page.locator('.data-error-banner').waitFor({ timeout: 8000 })
  const bannerText = await page.locator('.data-error-banner').textContent()
  assert(bannerText.includes('dữ liệu dự phòng'), 'Banner thiếu nội dung fallback: ' + bannerText)
  await page.goto(`${BASE}#/`)
  await page.reload()
  await page.locator('.data-error-strip').waitFor({ timeout: 8000 })
  // Retry: bỏ lỗi -> bấm Thử lại -> hết banner + strip
  apiFailurePhase = false
  await page.locator('.data-error-banner button', { hasText: 'Thử lại' }).click()
  await page.locator('.data-error-banner').waitFor({ state: 'detached', timeout: 8000 })
  await page.locator('.data-error-strip button', { hasText: 'Thử lại' }).click()
  await page.locator('.data-error-strip').waitFor({ state: 'detached', timeout: 8000 })
  await page.locator('.search-card').waitFor({ timeout: 5000 })
  const file = await shot(page, 'api')
  return `skeleton=${skeleton ? 'có' : 'khó thấy (API nhanh)'}; fallback ${fallback} card; banner+strip+retry OK; ảnh ${file}`
})

// ---------- 18. Console / runtime ----------
await step('18', 'Runtime: 0 console.error (ngoại trừ API chủ động) + 0 pageerror', async () => {
  assert(consoleErrors.length === 0, `Có ${consoleErrors.length} console.error: ${consoleErrors[0]}`)
  assert(pageErrors.length === 0, `Có ${pageErrors.length} pageerror: ${pageErrors[0]}`)
  const storage = await page.evaluate(() => Object.entries(localStorage).map(([k, v]) => `${k}=${v}`).join('|'))
  assert(!storage.includes('secret123'), 'Tìm thấy password trong localStorage!')
  return 'console.error=0; pageerror=0; không có plaintext password'
})

// ---------- Ghi kết quả ----------
const summary = { module: 'HOTEL', total: passed + failed, passed, failed, results }
fs.writeFileSync(path.resolve('qa-evidence/final/hotel-results.json'), JSON.stringify(summary, null, 2))

console.log(`\nTONG: ${summary.total} | PASS: ${passed} | FAIL: ${failed}`)

await browser.close()
process.exit(failed > 0 ? 1 : 0)
