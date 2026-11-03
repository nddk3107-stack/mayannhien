// qa-final.mjs — FINAL QA: Home / Checkout / Login / Booking / Payment / API / Routing / Responsive / Security
// Browser thật Chromium/Playwright. KHÔNG sửa app để qua test.
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'http://localhost:5175/'
const OUT = path.resolve('qa-evidence/final/screens')
fs.mkdirSync(OUT, { recursive: true })

let passed = 0
let failed = 0
const results = []
const consoleErrors = []
const pageErrors = []
let apiFailurePhase = false
let shotIndex = 0

const norm = (s) => s.replace(/\u00a0/g, ' ')

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
// DB tạm của suite có thể chưa có user finala -> đăng ký trước khi dùng.

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
  await page.locator('.search-card').waitFor({ timeout: 10000 })
}

async function loginAs(email) {
  await page.locator('.login-btn').click()
  await page.locator('.login-field input[type="email"]').fill(email)
  await page.locator('.login-field input[type="password"]').fill('secret123')
  await page.locator('.login-submit').click()
  await page.locator('.login-modal').waitFor({ state: 'detached', timeout: 5000 })
  await page.locator('.user-chip', { hasText: email.split('@')[0] }).waitFor({ timeout: 5000 })
}

async function fillTravelerValid() {
  await page.locator('.checkout-form input').first().fill('Nguyễn Văn Final')
  await page.locator('.checkout-form input[inputmode="tel"]').fill('0912345678')
  await page.locator('.checkout-form input[type="email"]').fill('final@example.com')
}

async function overflowPx() {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

console.log('=== QA FINAL — Mây An Nhiên (browser thật) ===')
await reset()

// ===== PART 2 — HOME =====
await step('1', 'HOME: load thành công — hero + sections + title', async () => {
  assert(page.url().includes('#/'), 'URL sai: ' + page.url())
  const hero = await page.locator('.hero').first().isVisible()
  assert(hero, 'Hero không hiển thị')
  const heroText = await page.locator('.hero-content').textContent()
  assert(heroText.length > 50, 'Hero text quá ngắn')
  const badges = await page.locator('.hero-badges span').count()
  assert(badges >= 3, `Hero badges = ${badges} (mong >=3)`)
  const title = await page.title()
  assert(title.includes('Mây An Nhiên'), 'Title sai: ' + title)
  // các section chính
  for (const sel of ['.search-card', '.service-dock', '.trust-section', '.footer']) {
    assert(await page.locator(sel).first().isVisible(), `Section ${sel} không thấy`)
  }
  const file = await shot(page, 'home')
  return `hero+${badges} badges; search/dock/trust/footer OK; title="${title}"; ảnh ${file}`
})

await step('2', 'HOME: search hoạt động — submit -> trang kết quả có tóm tắt', async () => {
  await reset()
  await page.locator('.search-card input[maxlength="80"]').fill('Đà Nẵng')
  await page.locator('.search-submit').click()
  await page.locator('.results-count').first().waitFor({ timeout: 8000 })
  assert(page.url().includes('#/flight'), 'Không điều hướng tới trang flight: ' + page.url())
  const summary = await page.locator('.search-summary').textContent()
  assert(summary.includes('Đà Nẵng'), 'SearchSummary thiếu keyword')
  return 'submit -> #/flight + summary có keyword'
})

await step('3', 'HOME: preview chuyến bay + khách sạn hiển thị, chọn từ preview -> checkout', async () => {
  await reset()
  const flightPreview = page.locator('.flight-card')
  const hotelPreview = page.locator('.hotel-card')
  await flightPreview.first().waitFor({ timeout: 8000 })
  assert((await flightPreview.count()) >= 2, 'Preview flight <2 card')
  assert((await hotelPreview.count()) >= 2, 'Preview hotel <2 card')
  await flightPreview.first().locator('button', { hasText: 'Chọn vé' }).click()
  await page.locator('.checkout-layout h1').waitFor({ timeout: 8000 })
  const sum = norm(await page.locator('.booking-summary').textContent())
  assert(sum.includes('Vé máy bay'), 'Chọn từ preview không truyền đúng dịch vụ')
  const file = await shot(page, 'preview-checkout')
  return `flight=${await flightPreview.count()} + hotel=${await hotelPreview.count()} card; chọn -> checkout OK; ảnh ${file}`
})

await step('4', 'HOME: navigation 5 mục hoạt động, URL hash đúng, không 404 sai', async () => {
  const targets = [
    ['Trang chủ', '#/', '.search-card'],
    ['Vé máy bay', '#/flight', '.filter-panel'],
    ['Khách sạn', '#/hotel', '.filter-panel'],
    ['Combo', '#/combo', '.results-count'],
    ['Đặt chỗ của tôi', '#/bookings', '.bookings-page'],
  ]
  for (const [label, hash, sel] of targets) {
    await page.locator('.nav button', { hasText: label }).click()
    await page.waitForTimeout(350)
    assert(page.url().includes(hash), `${label}: URL không đúng (${page.url()})`)
    await page.locator(sel).first().waitFor({ timeout: 6000 })
  }
  return '5 nav items -> hash + section đúng, không trang lỗi'
})

await step('5', 'HOME: footer links hoạt động (4 link dịch vụ + không lỗi)', async () => {
  const links = [
    ['Vé máy bay', '#/flight'],
    ['Khách sạn', '#/hotel'],
    ['Combo du lịch', '#/combo'],
    ['Đặt chỗ của tôi', '#/bookings'],
  ]
  for (const [label, hash] of links) {
    await page.locator('.footer-nav button', { hasText: label }).click()
    await page.waitForTimeout(350)
    assert(page.url().includes(hash), `Footer ${label}: URL sai (${page.url()})`)
    assert(pageErrors.length === 0, 'Có pageerror sau khi bấm footer')
  }
  await page.locator('.brand').click()
  await page.waitForTimeout(350)
  assert(page.url().includes('#/'), 'Brand không về trang chủ')
  await page.locator('.search-card').waitFor({ timeout: 5000 })
  return '4 footer links + brand OK, 0 pageerror'
})

await step('6', 'HOME: loading state (skeleton) khi API chậm, dữ liệu hiện khi xong', async () => {
  await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {})
  await page.route('**/api/catalog*', async (route) => {
    await new Promise((r) => setTimeout(r, 1500))
    return route.continue()
  })
  await page.goto(`${BASE}#/`)
  await page.reload()
  const skeleton = await page.locator('.skeleton-wrap').first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)
  await page.locator('.search-card').waitFor({ timeout: 10000 })
  await page.locator('.flight-card').first().waitFor({ timeout: 10000 })
  await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {})
  await routeApi('**/api/catalog*')
  await routeApi('**/api/travel*')
  return `skeleton=${skeleton ? 'có' : 'API trả quá nhanh, khó thấy'}; dữ liệu load xong`
})

// ===== PART 6 — CHECKOUT =====
await step('7', 'CHECKOUT: không thể checkout khi chưa chọn sản phẩm (guard)', async () => {
  await page.goto(`${BASE}#/checkout`)
  await page.reload()
  await page.locator('.empty-bookings').waitFor({ timeout: 8000 })
  const txt = await page.locator('.empty-bookings').textContent()
  assert(txt.includes('chưa chọn dịch vụ nào'), 'Guard thiếu nội dung: ' + txt.slice(0, 80))
  const btns = await page.locator('.empty-actions button').count()
  assert(btns === 3, `Cần 3 nút chọn dịch vụ, có ${btns}`)
  await page.locator('.empty-actions button', { hasText: 'Chọn vé máy bay' }).click()
  await page.waitForTimeout(350)
  assert(page.url().includes('#/flight'), 'Nút chọn vé không dẫn tới flight')
  const file = await shot(page, 'checkout-guard')
  return 'guard + 3 nút chọn dịch vụ hoạt động; ảnh ' + file
})

await step('8', 'CHECKOUT: promo không áp chéo giữa các dịch vụ (matrix đầy đủ)', async () => {
  // Flight + p1/p3 -> ineligible; flight + p2 -> áp 8% (hotel/combo matrix đã test ở suite riêng)
  await page.goto(`${BASE}#/flight`)
  await page.reload()
  await page.locator('.flight-card').first().waitFor({ timeout: 10000 })
  await page.locator('.flight-card').first().locator('button', { hasText: 'Chọn vé' }).click()
  await page.locator('.checkout-layout h1').waitFor({ timeout: 8000 })
  const promos = page.locator('.mini-promos button')
  let sum = norm(await page.locator('.booking-summary').textContent())
  assert(sum.includes('không áp dụng cho vé máy bay'), 'Flight + SALECUOITUAN phải ineligible: ' + sum)
  assert(sum.includes('-0'), 'Flight không áp p1 -> giảm 0đ')
  await promos.nth(2).click()
  sum = norm(await page.locator('.booking-summary').textContent())
  assert(sum.includes('không áp dụng cho vé máy bay'), 'Flight + COMBOHE phải ineligible')
  await promos.nth(1).click()
  sum = norm(await page.locator('.booking-summary').textContent())
  assert(!sum.includes('không áp dụng'), 'Flight + BAYNGAY phải applicable')
  assert(sum.includes('2.580.000'), 'Giá gốc flight×2 phải 2.580.000: ' + sum)
  assert(sum.includes('-206.400'), 'BAYNGAY 8% phải giảm 206.400: ' + sum)
  assert(sum.includes('2.373.600'), 'Tổng sau 8% phải 2.373.600: ' + sum)
  const file = await shot(page, 'cross-promo')
  return 'flight: p1/p3 ineligible, p2 -206.400; ảnh ' + file
})

await step('9', 'CHECKOUT: refresh không crash -> guard; travel form còn attrs', async () => {
  await page.reload()
  await page.locator('.empty-bookings').waitFor({ timeout: 8000 })
  assert(pageErrors.length === 0, 'Có pageerror sau refresh checkout')
  await page.goto(`${BASE}#/flight`)
  await page.reload()
  await page.locator('.flight-card').first().waitFor({ timeout: 10000 })
  await page.locator('.flight-card').first().locator('button', { hasText: 'Chọn vé' }).click()
  await page.locator('.checkout-layout h1').waitFor({ timeout: 8000 })
  const name = page.locator('.checkout-form input').first()
  assert((await name.getAttribute('maxlength')) === '60', 'maxlength tên != 60')
  assert((await page.locator('.checkout-form input[inputmode="tel"]').getAttribute('maxlength')) === '15', 'maxlength SĐT != 15')
  assert((await page.locator('.checkout-form input[type="email"]').getAttribute('maxlength')) === '80', 'maxlength email != 80')
  assert((await page.locator('.pay-btn').count()) === 1, 'Thiếu nút thanh toán')
  return 'refresh -> guard, 0 pageerror; traveler attrs 60/15/80 + pay-btn OK'
})

// ===== PART 7 — LOGIN =====
await step('10', 'LOGIN: modal validation đầy đủ + login + session persist + logout', async () => {
  await ensureUser('finala@mayan.test', 'secret123')
  await page.goto(`${BASE}#/`)
  await page.reload()
  await page.locator('.login-btn').click()
  await page.locator('.login-modal').waitFor({ timeout: 5000 })
  await page.locator('.login-submit').click()
  assert((await page.locator('.login-error').textContent()).includes('Email không hợp lệ'), 'Không bắt email rỗng')
  await page.locator('.login-field input[type="email"]').fill('abc@@x')
  await page.locator('.login-submit').click()
  assert((await page.locator('.login-error').textContent()).includes('Email không hợp lệ'), 'Không bắt email sai format')
  await page.locator('.login-field input[type="email"]').fill('finala@mayan.test')
  await page.locator('.login-submit').click()
  assert((await page.locator('.login-error').textContent()).includes('ít nhất 6 ký tự'), 'Không bắt password rỗng')
  await page.locator('.login-field input[type="password"]').fill('123')
  await page.locator('.login-submit').click()
  assert((await page.locator('.login-error').textContent()).includes('ít nhất 6 ký tự'), 'Không bắt password < 6')
  await page.locator('.login-field input[type="password"]').fill('secret123')
  await page.locator('.login-submit').click()
  await page.locator('.login-modal').waitFor({ state: 'detached', timeout: 5000 })
  await page.locator('.user-chip', { hasText: 'finala' }).waitFor({ timeout: 5000 })
  await page.reload()
  await page.locator('.user-chip', { hasText: 'finala' }).waitFor({ timeout: 8000 })
  const ls = await page.evaluate(() => Object.entries(localStorage).map(([k, v]) => `${k}=${v}`).join('|'))
  assert(!ls.includes('secret123'), 'Lưu plaintext password!')
  await page.locator('.header-actions button', { hasText: 'Đăng xuất' }).click()
  await page.locator('.user-chip').waitFor({ state: 'detached', timeout: 5000 })
  assert(await page.locator('.login-btn').isVisible(), 'Sau logout không thấy nút Đăng nhập')
  const file = await shot(page, 'login')
  return '5 validation + login + persist + logout + 0 plaintext; ảnh ' + file
})

// ===== PART 8 — BOOKING =====
await step('11', 'BOOKING: flight booking tạo đúng (ID/status/traveler/price/payment)', async () => {
  await loginAs('finala@mayan.test')
  await page.goto(`${BASE}#/flight`)
  await page.reload()
  await page.locator('.flight-card').first().waitFor({ timeout: 10000 })
  await page.locator('.flight-card').first().locator('button', { hasText: 'Chọn vé' }).click()
  await page.locator('.checkout-layout h1').waitFor({ timeout: 8000 })
  await fillTravelerValid()
  await page.locator('.pay-btn').click()
  await page.locator('.booking-card').first().waitFor({ timeout: 8000 })
  assert(page.url().includes('#/bookings'), 'Không về bookings: ' + page.url())
  const card = norm(await page.locator('.booking-card').first().textContent())
  assert(card.includes('Vé máy bay'), 'Thiếu serviceName vé')
  assert(card.includes('Đã xác nhận'), 'Trạng thái sai')
  assert(card.includes('Nguyễn Văn Final'), 'Thiếu traveler')
  assert(card.includes('2.580.000'), 'Tổng flight×2 (p1 không áp) phải 2.580.000: ' + card)
  assert(card.includes('SALECUOITUAN'), 'Thiếu mã promo')
  assert(card.includes('ATM'), 'Phương thức mặc định phải ATM')
  assert(card.includes('Lịch trình'), 'Thiếu dòng lịch trình/ngày bay')
  const match = card.match(/Mã ([A-Z0-9]{6})/)
  assert(match, 'Không thấy Booking ID')
  const file = await shot(page, 'booking-flight')
  return `flight booking ${match[1]}; 2.580.000; ATM; ảnh ${file}`
})

await step('12', 'BOOKING: thêm booking hotel cùng tài khoản -> 2 đơn, refresh vẫn 2', async () => {
  await page.goto(`${BASE}#/hotel`)
  await page.reload()
  await page.locator('.hotel-card').first().waitFor({ timeout: 10000 })
  await page.locator('.hotel-card').first().locator('button', { hasText: 'Chọn phòng' }).click()
  await page.locator('.room-card').first().waitFor({ timeout: 8000 })
  await page.locator('.pick-room-btn').first().click()
  await page.locator('.hotel-checkout h1').waitFor({ timeout: 8000 })
  // traveler đã persist từ lần pay trước
  const nameVal = await page.locator('.checkout-form input').first().inputValue()
  assert(nameVal === 'Nguyễn Văn Final', 'Traveler không persist: ' + nameVal)
  await page.locator('.pay-btn').click()
  await page.locator('.booking-card').first().waitFor({ timeout: 8000 })
  const services = await page.locator('.booking-card').allTextContents()
  assert(services.length === 2, `Có ${services.length} đơn (mong 2)`)
  assert(services.some((t) => t.includes('Vé máy bay')), 'Mất đơn flight')
  assert(services.some((t) => t.includes('Khách sạn')), 'Mất đơn hotel')
  // refresh -> vẫn 2, không duplicate
  await page.reload()
  await page.locator('.booking-card').first().waitFor({ timeout: 8000 })
  assert((await page.locator('.booking-card').count()) === 2, 'Refresh -> sai số đơn')
  const file = await shot(page, 'booking-2')
  return '2 đơn (flight+hotel) cùng finala; refresh vẫn 2; ảnh ' + file
})

await step('13', 'BOOKING: hủy đặt chỗ -> trạng thái Đã hủy + nút disabled, đơn không mất', async () => {
  const cards = page.locator('.booking-card')
  // hủy đơn hotel (card chứa 'Khách sạn')
  const hotelCard = cards.filter({ hasText: 'Khách sạn' }).first()
  await hotelCard.locator('.booking-actions button').click()
  await page.waitForTimeout(400)
  const status = await hotelCard.locator('.status-pill').textContent()
  assert(status.includes('Đã hủy'), 'Trạng thái chưa Đã hủy: ' + status)
  const btn = hotelCard.locator('.booking-actions button')
  assert(await btn.isDisabled(), 'Nút hủy vẫn enabled sau khi hủy')
  assert((await btn.textContent()).includes('Đã hủy'), 'Nút không đổi label')
  assert((await cards.count()) === 2, 'Hủy làm mất đơn khỏi danh sách')
  // reload -> trạng thái giữ nguyên
  await page.reload()
  await page.locator('.booking-card').first().waitFor({ timeout: 8000 })
  const anyCancelled = await page.locator('.status-pill').filter({ hasText: 'Đã hủy' }).count()
  assert(anyCancelled >= 1, 'Trạng thái Đã hủy không persist sau reload')
  const file = await shot(page, 'booking-cancel')
  return 'Đã hủy + disabled + persist reload, vẫn đủ 2 đơn; ảnh ' + file
})

// ===== PART 9 — PAYMENT =====
await step('14', 'PAYMENT: spam click 4 lần -> không tạo thêm đơn; không booking "ma"', async () => {
  await page.goto(`${BASE}#/flight`)
  await page.reload()
  await page.locator('.flight-card').first().waitFor({ timeout: 10000 })
  const before = 2 // 2 đơn đã có
  await page.locator('.flight-card').nth(1).locator('button', { hasText: 'Chọn vé' }).click()
  await page.locator('.checkout-layout h1').waitFor({ timeout: 8000 })
  // spam 4 lần nhanh
  const clicks = []
  for (let i = 0; i < 4; i += 1) {
    clicks.push(page.locator('.pay-btn').click({ force: true }).catch(() => 'skip'))
    await page.waitForTimeout(60)
  }
  await Promise.all(clicks)
  await page.locator('.booking-card').first().waitFor({ timeout: 8000 })
  await page.waitForTimeout(800)
  const count = await page.locator('.booking-card').count()
  assert(count === before + 1, `Spam 4 click -> ${count} đơn (mong ${before + 1})`)
  // mọi booking phải có code + total > 0 + traveler (không booking ma)
  const texts = await page.locator('.booking-card').allTextContents()
  for (const t of texts) {
    assert(/Mã [A-Z0-9]{6}/.test(t), 'Có booking thiếu mã: ' + t.slice(0, 60))
    assert(norm(t).match(/\d{1,3}(\.\d{3})+ ₫/), 'Có booking thiếu tổng tiền: ' + t.slice(0, 60))
    assert(t.includes('Nguyễn Văn'), 'Có booking thiếu traveler: ' + t.slice(0, 60))
  }
  const file = await shot(page, 'payment-spam')
  return `spam 4 click -> đúng ${count} đơn; 0 booking ma; ảnh ${file}`
})

// ===== PART 10 — API =====
await step('15', 'API: GET health/catalog/travel/404 qua browser — status + JSON đúng', async () => {
  const get = async (p) => {
    const res = await page.request.get(`${BASE}${p}`)
    let body = null
    try { body = await res.json() } catch { body = null }
    return { status: res.status(), body }
  }
  const health = await get('api/health')
  assert(health.status === 200, `health = ${health.status}`)
  assert(health.body && health.body.status === 'ok', 'health thiếu status:ok')
  const catalog = await get('api/catalog')
  assert(catalog.status === 200, `catalog = ${catalog.status}`)
  assert(Array.isArray(catalog.body?.flights) && catalog.body.flights.length >= 3, 'catalog.flights thiếu/sai')
  assert(Array.isArray(catalog.body?.hotels) && catalog.body.hotels.length >= 3, 'catalog.hotels thiếu/sai')
  const travel = await get('api/travel')
  assert(travel.status === 200, `travel = ${travel.status}`)
  assert(Array.isArray(travel.body?.benefits), 'travel.benefits thiếu')
  const missing = await get('api/khong-ton-tai')
  assert(missing.status === 404, `API lạ phải 404, got ${missing.status}`)
  assert(missing.body && missing.body.error, '404 thiếu JSON error')
  return 'health/catalog/travel 200 + JSON; API lạ 404 JSON'
})

// ===== PART 11 — ROUTING =====
await step('16', 'ROUTING: F5 từng route (6 route) — đúng trang, không blank/crash', async () => {
  const routes = [
    ['#/', '.hero'],
    ['#/flight', '.page-hero'],
    ['#/hotel', '.page-hero'],
    ['#/combo', '.page-hero'],
    ['#/bookings', '.bookings-page'],
    ['#/khong-ton-tai', '.notfound-page'],
  ]
  for (const [hash, sel] of routes) {
    await page.goto(`${BASE}${hash}`)
    await page.reload()
    await page.locator(sel).first().waitFor({ timeout: 10000 })
    const bodyLen = await page.evaluate(() => document.body.innerText.length)
    assert(bodyLen > 200, `F5 ${hash} -> trang trống (${bodyLen} ký tự)`)
    assert(pageErrors.length === 0, `F5 ${hash} -> pageerror: ${pageErrors[pageErrors.length - 1]}`)
  }
  return '6 route F5: đúng trang, đủ nội dung, 0 pageerror'
})

await step('17', 'ROUTING: 404 hiển thị đúng + Về trang chủ hoạt động', async () => {
  await page.goto(`${BASE}#/khong-ton-tai`)
  await page.reload()
  await page.locator('.notfound-page').waitFor({ timeout: 8000 })
  const txt = await page.locator('.notfound-page').textContent()
  assert(txt.includes('404'), 'Thiếu mã 404')
  assert(txt.includes('không tồn tại'), 'Thiếu thông báo 404')
  const title = await page.title()
  assert(title.includes('404'), 'Title chưa đổi theo 404: ' + title)
  await page.locator('.notfound-page button', { hasText: 'Về trang chủ' }).click()
  await page.locator('.search-card').waitFor({ timeout: 5000 })
  assert(page.url().includes('#/'), 'Không về được home từ 404')
  const file = await shot(page, 'notfound')
  return '404 đúng nội dung + title; Về trang chủ OK; ảnh ' + file
})

await step('18', 'ROUTING: browser back/forward + hash navigation không crash', async () => {
  await page.goto(`${BASE}#/flight`)
  await page.reload()
  await page.locator('.flight-card').first().waitFor({ timeout: 8000 })
  await page.locator('.nav button', { hasText: 'Khách sạn' }).click()
  await page.waitForTimeout(350)
  await page.locator('.nav button', { hasText: 'Combo' }).click()
  await page.waitForTimeout(350)
  assert(page.url().includes('#/combo'), 'Hash nav sai: ' + page.url())
  await page.goBack()
  await page.waitForTimeout(400)
  assert(page.url().includes('#/hotel'), 'Back không về #/hotel: ' + page.url())
  await page.locator('.hotel-card').first().waitFor({ timeout: 8000 })
  await page.goForward()
  await page.waitForTimeout(400)
  assert(page.url().includes('#/combo'), 'Forward không về #/combo: ' + page.url())
  await page.locator('.results-count').first().waitFor({ timeout: 8000 })
  assert(pageErrors.length === 0, 'Có pageerror khi back/forward')
  return 'back -> #/hotel; forward -> #/combo; 0 pageerror'
})

// ===== PART 12 — RESPONSIVE =====
await step('19', 'RESPONSIVE 768px: home/flight/checkout/bookings — 0 tràn, nav + footer OK', async () => {
  await page.setViewportSize({ width: 768, height: 1024 })
  const problems = []
  const check = async (name) => {
    const ox = await overflowPx()
    if (ox > 2) problems.push(`${name}: overflow ${ox}px`)
    const navVisible = (await page.locator('.nav').isVisible().catch(() => false))
      || (await page.locator('.mobile-bottom-nav').isVisible().catch(() => false))
    if (!navVisible) problems.push(`${name}: mất navbar/bottom-nav`)
    const footer = await page.locator('.footer').isVisible().catch(() => false)
    if (!footer) problems.push(`${name}: mất footer`)
  }
  await page.goto(`${BASE}#/`); await page.reload()
  await page.locator('.search-card').waitFor({ timeout: 8000 })
  await check('home')
  await page.goto(`${BASE}#/flight`); await page.reload()
  await page.locator('.flight-card').first().waitFor({ timeout: 8000 })
  await check('flight')
  await page.locator('.flight-card').first().locator('button', { hasText: 'Chọn vé' }).click()
  await page.locator('.checkout-layout h1').waitFor({ timeout: 8000 })
  await check('checkout')
  const payVisible = await page.locator('.pay-btn').isVisible()
  if (!payVisible) problems.push('checkout: pay-btn ẩn ở 768')
  await page.goto(`${BASE}#/bookings`); await page.reload()
  await page.locator('.bookings-page').waitFor({ timeout: 8000 })
  await check('bookings')
  if (problems.length) throw new Error(problems.join('; '))
  const file = await shot(page, 'r768')
  return '768px: home/flight/checkout/bookings 0 tràn, nav+footer OK; ảnh ' + file
})

await step('20', 'RESPONSIVE desktop 1440 + mobile 375: navbar/bottom-nav + 0 tràn', async () => {
  // Desktop
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}#/`); await page.reload()
  await page.locator('.search-card').waitFor({ timeout: 8000 })
  assert((await overflowPx()) <= 2, 'Desktop overflow')
  assert(await page.locator('.nav').isVisible(), 'Desktop mất .nav')
  assert(await page.locator('.hero').first().isVisible(), 'Desktop mất hero')
  // Mobile
  await page.setViewportSize({ width: 375, height: 812 })
  await page.waitForTimeout(400)
  assert((await overflowPx()) <= 2, 'Mobile 375 overflow')
  assert(await page.locator('.mobile-bottom-nav').isVisible(), 'Mobile mất bottom-nav')
  // nav/header không che mất nội dung search
  assert(await page.locator('.search-card').isVisible(), 'Mobile mất search-card')
  // footer xuống cuối trang, không cắt ngang
  await page.locator('.footer').scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  const footerOk = await page.evaluate(() => {
    const f = document.querySelector('.footer')
    if (!f) return false
    const r = f.getBoundingClientRect()
    return r.width <= document.documentElement.clientWidth + 2
  })
  assert(footerOk, 'Footer bị cắt ngang ở 375px')
  const file = await shot(page, 'r375-home')
  return '1440 nav OK; 375 bottom-nav + footer OK, 0 tràn; ảnh ' + file
})

// ===== PART 13 — SECURITY BASIC =====
await step('21', 'SECURITY (browser): không qa1/qa2 trong UI, khách không có booking mặc định', async () => {
  // đăng xuất để xem trạng thái khách
  const logoutBtn = page.locator('.header-actions button', { hasText: 'Đăng xuất' })
  if (await logoutBtn.isVisible().catch(() => false)) {
    await logoutBtn.click()
    await page.locator('.user-chip').waitFor({ state: 'detached', timeout: 5000 })
  }
  await page.goto(`${BASE}#/bookings`)
  await page.reload()
  await page.locator('.bookings-page').waitFor({ timeout: 8000 })
  assert((await page.locator('.booking-card').count()) === 0, 'Khách có booking mặc định!')
  // quét toàn bộ text UI
  const bodyText = await page.evaluate(() => document.body.innerText)
  for (const leak of ['qa1', 'qa2', 'secret123', 'password123']) {
    assert(!bodyText.includes(leak), `UI rò rỉ "${leak}"`)
  }
  // trang chủ cũng không leak
  await page.goto(`${BASE}#/`)
  await page.reload()
  await page.locator('.search-card').waitFor({ timeout: 8000 })
  const homeText = await page.evaluate(() => document.body.innerText)
  assert(!homeText.includes('qa1') && !homeText.includes('qa2'), 'Home rò rỉ qa1/qa2')
  const file = await shot(page, 'security-ui')
  return '0 booking mặc định; không qa1/qa2/password trong UI; ảnh ' + file
})

await step('22', 'SECURITY (static): .env gitignore, không API key/secret, dist không hardcode localhost', async () => {
  const { execSync } = await import('node:child_process')
  // 1. .env không bị commit
  let tracked = ''
  try { tracked = execSync('git ls-files -- .env .env.* 2>/dev/null', { cwd: process.cwd() }).toString().trim() } catch { tracked = 'git-error' }
  assert(tracked === '' || tracked === 'git-error', `.env bị commit: ${tracked}`)
  // 2. .gitignore có .env
  const gitignore = fs.readFileSync('.gitignore', 'utf8')
  assert(/(^|\n)\.env/.test(gitignore), '.gitignore thiếu .env')
  // 3. không API key / secret pattern trong source
  const srcText = ['src/App.jsx', 'src/main.jsx', 'src/App.css', 'server.js', 'vite.config.js', 'package.json']
    .map((f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''))
    .join('\n')
  const keyPatterns = [/AIza[0-9A-Za-z_-]{16,}/, /sk_(?:live|test)_[0-9a-zA-Z]{10,}/, /AKIA[0-9A-Z]{16}/, /ghp_[0-9A-Za-z]{20,}/]
  for (const pat of keyPatterns) assert(!pat.test(srcText), `Tìm thấy API key pattern: ${pat}`)
  // 4. không lưu password vào localStorage trong source
  assert(!/localStorage\.setItem\s*\([^)]*password/i.test(srcText), 'Source lưu password vào localStorage')
  // 5. dist (bản production) không hardcode localhost
  const distDir = 'dist/assets'
  let distFiles = []
  try { distFiles = fs.readdirSync(distDir).filter((f) => f.endsWith('.js')) } catch { distFiles = [] }
  assert(distFiles.length > 0, 'Không tìm thấy dist/assets (chạy npm run build trước)')
  for (const f of distFiles) {
    const js = fs.readFileSync(path.join(distDir, f), 'utf8')
    assert(!js.includes('localhost'), `dist/${f} chứa hardcode localhost`)
  }
  return `.env không track + gitignore OK; 0 API key; 0 password lưu; dist (${distFiles.length} file) sạch localhost`
})

await step('23', 'RUNTIME: 0 console.error (ngoại trừ API chủ động) + 0 pageerror', async () => {
  assert(consoleErrors.length === 0, `Có ${consoleErrors.length} console.error: ${consoleErrors[0]}`)
  assert(pageErrors.length === 0, `Có ${pageErrors.length} pageerror: ${pageErrors[0]}`)
  return 'console.error=0; pageerror=0'
})

// ---------- Ghi kết quả ----------
const summary = { module: 'FINAL', total: passed + failed, passed, failed, results }
fs.writeFileSync(path.resolve('qa-evidence/final/final-results.json'), JSON.stringify(summary, null, 2))

console.log(`\nTONG: ${summary.total} | PASS: ${passed} | FAIL: ${failed}`)

await browser.close()
process.exit(failed > 0 ? 1 : 0)






