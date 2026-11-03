// MANUAL QA + E2E chuyên cho trang Vé máy bay — chạy trên Chromium thật (Playwright)
// Chạy: node qa-flight.mjs  → kết quả: qa-evidence/flight-results.json + ảnh qa-evidence/flight/
import { chromium, request } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = 'http://localhost:5175'
mkdirSync('qa-evidence/flight', { recursive: true })

const results = []
const pageErrors = []
const consoleErrors = []
let apiFailurePhase = false // giai đoạn chủ động chặn API → console error network là cố ý

const assert = (cond, msg) => { if (!cond) throw new Error(msg) }
const step = async (id, name, fn) => {
  try {
    const detail = (await fn()) || ''
    results.push({ id, name, status: 'PASS', detail })
    console.log(`PASS [${id}] ${name} -- ${detail}`)
  } catch (err) {
    const msg = String(err.message || err).split('\n')[0].slice(0, 260)
    results.push({ id, name, status: 'FAIL', detail: msg })
    console.log(`FAIL [${id}] ${name} -- ${msg}`)
  }
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => pageErrors.push(e.message))
page.on('console', (m) => {
  if (m.type() !== 'error') return
  const t = m.text()
  if (t.includes('Failed to load resource') && apiFailurePhase) return // chủ động chặn API
  if (t.includes('favicon')) return
  consoleErrors.push(t.slice(0, 220))
})

const shot = (name) => page.screenshot({ path: `qa-evidence/flight/${name}.png` })
const waitToast = async (text) => {
  try {
    await page.locator('.toast', { hasText: text }).waitFor({ timeout: 6000 })
  } catch {
    const now = await page.locator('.toast').textContent().catch(() => '(khong co toast)')
    throw new Error(`Toast "${text}" không xuất hiện (hiện tại: "${now}")`)
  }
  return true
}
const waitL = async (loc, label, timeout = 8000, state = 'visible') => {
  try {
    await loc.waitFor({ timeout, state })
  } catch {
    throw new Error(`[${label}] không thỏa sau ${timeout}ms (state=${state})`)
  }
}
const overflow = () => page.evaluate(() => {
  const d = document.documentElement
  return Math.max(d.scrollWidth, document.body.scrollWidth) - window.innerWidth
})

// ===== 1. FLIGHT PAGE LOAD =====
await step('1', 'Flight page load (HTTP, hash, UI, không lỗi runtime)', async () => {
  const resp = await page.goto(`${BASE}/#/flight`, { waitUntil: 'networkidle' })
  assert(resp && resp.status() === 200, `HTTP ${resp?.status()}`)
  assert(page.url().includes('#/flight'), `URL sai: ${page.url()}`)
  await page.locator('.page-hero h1', { hasText: 'Tìm vé máy bay giá tốt' }).waitFor({ timeout: 8000 })
  await page.locator('.flight-card').first().waitFor({ timeout: 8000 })
  const cards = await page.locator('.flight-card').count()
  assert(cards >= 3, `Chỉ có ${cards} chuyến bay`)
  assert(await page.locator('.header .nav').isVisible(), 'Header nav không thấy')
  assert(await page.locator('.filter-panel').isVisible(), 'Bộ lọc không thấy')
  assert((await overflow()) <= 1, 'Tràn ngang trang')
  assert(pageErrors.length === 0, `pageerror: ${pageErrors[0]}`)
  await shot('01-load')
  return `${cards} chuyến bay, HTTP 200, không lỗi runtime`
})

// ===== 2. SEARCH =====
await step('2', 'Search: rỗng / hợp lệ / không tồn tại / theo hãng / nút xóa', async () => {
  // 2a. search rỗng
  await page.goto(`${BASE}/#/home`, { waitUntil: 'networkidle' })
  await page.locator('label.field.wide input').fill('')
  await page.locator('.search-submit').click()
  await waitToast('Vui lòng nhập điểm đến')
  assert(page.url().includes('#/home'), 'Search rỗng vẫn chuyển trang!')
  // 2b. hợp lệ — kết quả PHẢI thay đổi (3 -> 1)
  await page.locator('label.field.wide input').fill('Đà Nẵng')
  await page.locator('.search-submit').click()
  await page.locator('.search-summary').waitFor({ timeout: 6000 })
  await page.waitForTimeout(400)
  const nDaNang = await page.locator('.flight-card').count()
  assert(nDaNang === 1, `Tìm "Đà Nẵng" ra ${nDaNang} chuyến (mong đợi 1)`)
  assert((await page.locator('.search-summary').textContent()).includes('Đà Nẵng'), 'Summary thiếu keyword')
  await shot('02a-search-kq')
  // 2c. keyword không tồn tại
  await page.goto(`${BASE}/#/home`, { waitUntil: 'networkidle' })
  await page.locator('label.field.wide input').fill('Tokyo')
  await page.locator('.search-submit').click()
  await page.locator('.empty-result').waitFor({ timeout: 6000 })
  const emptyTxt = await page.locator('.empty-result').textContent()
  assert(emptyTxt.includes('Không có chuyến bay phù hợp'), `Empty state sai: ${emptyTxt.slice(0, 80)}`)
  await shot('02b-search-rong')
  // 2d. search theo hãng
  await page.goto(`${BASE}/#/home`, { waitUntil: 'networkidle' })
  await page.locator('label.field.wide input').fill('Vietjet')
  await page.locator('.search-submit').click()
  await page.waitForTimeout(500)
  const nVj = await page.locator('.flight-card').count()
  const vjTxt = await page.locator('.flight-card').first().textContent()
  assert(nVj === 1 && vjTxt.includes('Vietjet'), `Search hãng: ${nVj} chuyến, "${vjTxt.slice(0, 40)}"`)
  // 2e. nút xóa search
  await page.locator('.search-summary button', { hasText: 'Xóa bộ tìm kiếm' }).click()
  await page.waitForTimeout(400)
  assert((await page.locator('.search-summary').count()) === 0, 'Summary không biến mất')
  const nAll = await page.locator('.flight-card').count()
  assert(nAll === 3, `Sau xóa search còn ${nAll} chuyến (mong đợi 3)`)
  return 'rỗng bị chặn; Đà Nẵng=1; Tokyo=empty; Vietjet=1; xóa -> 3 chuyến'
})

// ===== 3. NGÀY BAY =====
await step('3', 'Ngày bay: quá khứ / về<đi / về=đi / Một chiều ↔ Khứ hồi', async () => {
  // 3a. ngày quá khứ — PHẢI có toast chặn (không được submit im lặng)
  await page.goto(`${BASE}/#/home`, { waitUntil: 'networkidle' })
  await page.locator('label.field.wide input').fill('Đà Nẵng')
  await page.locator('label.field', { hasText: 'Ngày đi' }).locator('input').fill('2020-01-01')
  await page.locator('.search-submit').click()
  await waitToast('Ngày đi')
  assert(page.url().includes('#/home'), 'Ngày quá khứ vẫn chuyển trang!')
  await shot('03a-ngay-qua-khu')
  // 3b. ngày về < ngày đi
  await page.locator('label.field', { hasText: 'Ngày đi' }).locator('input').fill('2027-05-10')
  await page.locator('label.field', { hasText: 'Ngày về' }).locator('input').fill('2027-05-01')
  await page.locator('.search-submit').click()
  await waitToast('Ngày về phải sau ngày đi')
  assert(page.url().includes('#/home'), 'Về<đi vẫn chuyển trang!')
  // 3c. ngày về = ngày đi (hợp lệ — bay về trong ngày)
  await page.locator('label.field', { hasText: 'Ngày về' }).locator('input').fill('2027-05-10')
  await page.locator('.search-submit').click()
  await page.locator('.search-summary').waitFor({ timeout: 6000 })
  const sum = await page.locator('.search-summary span').textContent()
  assert(sum.includes('2027-05-10 → 2027-05-10'), `Summary sai: ${sum}`)
  // 3d. Một chiều — ô ngày về bị khóa
  await page.goto(`${BASE}/#/home`, { waitUntil: 'networkidle' })
  await page.locator('.trip-toggle button', { hasText: 'Một chiều' }).click()
  const retDisabled = await page.locator('label.field', { hasText: 'Ngày về' }).locator('input').isDisabled()
  assert(retDisabled, 'Ô ngày về không bị khóa khi chọn Một chiều')
  await page.locator('label.field', { hasText: 'Ngày đi' }).locator('input').fill('2027-06-01')
  await page.locator('.search-submit').click()
  await page.locator('.search-summary').waitFor({ timeout: 6000 })
  const sumOW = await page.locator('.search-summary span').textContent()
  assert(!sumOW.includes('→'), `Một chiều không được có ngày về: ${sumOW}`)
  // 3e. Khứ hồi — ngày về mở lại
  await page.goto(`${BASE}/#/home`, { waitUntil: 'networkidle' })
  await page.locator('.trip-toggle button', { hasText: 'Khứ hồi' }).click()
  const retEnabled = !(await page.locator('label.field', { hasText: 'Ngày về' }).locator('input').isDisabled())
  assert(retEnabled, 'Ô ngày về không mở lại khi chọn Khứ hồi')
  return 'quá khứ bị chặn; về<đi bị chặn; về=đi hợp lệ; Một chiều khóa ngày về; Khứ hồi mở lại'
})

// ===== 4. FILTER =====
await step('4', 'Filter: khuyến mãi / giá / hãng / không mất kết quả sai', async () => {
  // goto chỉ đổi hash (state search của test 3 còn sống) -> phải reload để reset state React
  await page.goto(`${BASE}/#/flight`, { waitUntil: 'networkidle' })
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.flight-card').first().waitFor({ timeout: 8000 })
  assert((await page.locator('.search-summary').count()) === 0, 'State search cũ còn sót sau reload')
  const allTxt = await page.locator('.flight-list').textContent()
  for (const air of ['Vietnam Airlines', 'Vietjet Air', 'Bamboo Airways']) {
    assert(allTxt.includes(air), `Thiếu hãng ${air}`)
  }
  assert(allTxt.includes('1.290.000') && allTxt.includes('1.690.000') && allTxt.includes('1.990.000'), 'Giá vé không đúng dữ liệu')
  const cb = page.locator('.filter-panel input[type="checkbox"]').first()
  await cb.check()
  await page.waitForTimeout(300)
  const nPromo = await page.locator('.flight-card').count()
  assert(nPromo === 2, `Filter khuyến mãi: ${nPromo} chuyến (mong đợi 2)`)
  await shot('04-filter-promo')
  await cb.uncheck()
  await page.waitForTimeout(300)
  assert((await page.locator('.flight-card').count()) === 3, 'Bỏ filter không khôi phục 3 chuyến')
  const range = page.locator('.filter-panel input[type="range"]')
  await range.fill('500000')
  await page.waitForTimeout(300)
  await page.locator('.empty-result').waitFor({ timeout: 4000 })
  await range.fill('5000000')
  await page.waitForTimeout(300)
  const nBack = await page.locator('.flight-card').count()
  assert(nBack === 3, `Kéo lại giá: ${nBack} chuyến`)
  return '3 hãng + giá đúng; promo 3->2; giá thấp -> empty; khôi phục 3 (không có sort — N/A)'
})

// Ngày mặc định của app = now+7 / now+10 (cùng công thức với App)
const toISO = (d) => d.toISOString().slice(0, 10)
const expDep = toISO(new Date(Date.now() + 7 * 86400000))
const expRet = toISO(new Date(Date.now() + 10 * 86400000))

// ===== 5. CHỌN VÉ =====
await step('5', 'Chọn chuyến bay — thông tin truyền đúng sang checkout', async () => {
  await page.goto(`${BASE}/#/flight`, { waitUntil: 'networkidle' })
  await page.reload({ waitUntil: 'networkidle' }) // reset state về mặc định
  await page.locator('.flight-card').first().waitFor({ timeout: 8000 })
  const cardTxt = await page.locator('.flight-card').first().textContent()
  assert(cardTxt.includes('Vietnam Airlines') && cardTxt.includes('TP.HCM') && cardTxt.includes('Đà Nẵng'), 'Thẻ đầu không phải VN-184')
  await page.locator('.flight-card').first().locator('button', { hasText: 'Chọn vé' }).click()
  await page.locator('.checkout-layout h1', { hasText: 'Thanh toán đặt chỗ' }).waitFor({ timeout: 8000 })
  const trip = await page.locator('.trip-info-row').textContent()
  assert(trip.includes('Đà Nẵng'), `Điểm đến checkout sai: ${trip}`)
  assert(trip.includes('Khứ hồi'), 'Hình thức chuyến sai')
  assert(trip.includes(expDep) && trip.includes(expRet), `Ngày đi/về sai (mong đợi ${expDep}/${expRet}): ${trip}`)
  const name = await page.locator('.summary-name').textContent()
  assert(name.includes('Vietnam Airlines TP.HCM - Đà Nẵng'), `Tên chuyến sai: ${name}`)
  await shot('05-checkout')
  return `VN-184 truyền đúng: ${name.trim()} — ngày ${expDep}→${expRet}`
})

// ===== 7. CHECKOUT =====
await step('7', 'Checkout: giá/giảm giá/tổng đúng + attrs + refresh không crash', async () => {
  // giá: 1.290.000 x 2 khách = 2.580.000 (mặc định promo p1 KHÔNG áp vé bay -> giảm 0)
  const sum = await page.locator('.booking-summary').textContent()
  assert(sum.includes('2.580.000'), `Giá gốc/tổng sai: ${sum.slice(0, 200)}`)
  assert(sum.includes('SALECUOITUAN'), 'Mã promo mặc định không hiển thị')
  assert(sum.includes('vé máy bay'), 'Thiếu cảnh báo promo không áp dụng')
  // NBSP (U+00A0) trong chuỗi Intl → chuẩn hóa trước khi so
  const disc = (await page.locator('.discount-value').textContent()).replace(/[\u00a0\u202f]/g, ' ').trim()
  assert(disc === '-0 ₫', `Giảm giá phải là 0đ với promo khách sạn, nhận được: "${disc}"`)
  assert(sum.includes('Thẻ ATM nội địa'), 'Phương thức mặc định thiếu trong tóm tắt')
  // attrs form
  const nameI = page.locator('label.field', { hasText: 'Họ tên' }).locator('input')
  const phoneI = page.locator('label.field', { hasText: 'Số điện thoại' }).locator('input')
  const emailI = page.locator('label.field', { hasText: 'Email' }).locator('input')
  assert((await nameI.getAttribute('maxlength')) === '60', 'Thiếu maxlength họ tên')
  assert((await phoneI.getAttribute('maxlength')) === '15', 'Thiếu maxlength SĐT')
  assert((await phoneI.getAttribute('inputmode')) === 'tel', 'Thiếu inputMode tel')
  assert((await emailI.getAttribute('type')) === 'email', 'Thiếu type=email')
  // không chọn gì + refresh -> guard, không crash, không có nút pay
  await page.reload(`${BASE}/#/checkout`, { waitUntil: 'networkidle' })
  await page.locator('.empty-bookings h2', { hasText: 'Bạn chưa chọn dịch vụ nào' }).waitFor({ timeout: 8000 })
  assert((await page.locator('.pay-btn').count()) === 0, 'Vẫn có nút thanh toán khi chưa chọn vé')
  assert(pageErrors.length === 0, `pageerror khi refresh checkout: ${pageErrors[0]}`)
  await shot('07a-checkout-guard')
  return '2.580.000đ; giảm 0đ + cảnh báo promo; attrs đủ; refresh -> guard, không crash'
})

// ===== 8. LOGIN GATE =====
await step('8', 'Login gate: modal, validation email/password, không lưu plaintext', async () => {
  await page.goto(`${BASE}/#/flight`, { waitUntil: 'networkidle' })
  await page.locator('.flight-card').first().waitFor({ timeout: 8000 })
  await page.locator('.flight-card').first().locator('button', { hasText: 'Chọn vé' }).click()
  await page.locator('.checkout-layout h1').waitFor({ timeout: 8000 })
  await page.locator('.pay-btn').click()
  await page.locator('.login-modal').waitFor({ timeout: 5000 })
  await shot('08-login-modal')
  // email sai
  await page.locator('.login-field input[type="email"]').fill('sai-email')
  await page.locator('.login-submit').click()
  await page.locator('.login-error', { hasText: 'Email không hợp lệ' }).waitFor({ timeout: 3000 })
  // password < 6
  await page.locator('.login-field input[type="email"]').fill('flighta@mayan.test')
  await page.locator('.login-field input[type="password"]').fill('123')
  await page.locator('.login-submit').click()
  await page.locator('.login-error', { hasText: 'ít nhất 6 ký tự' }).waitFor({ timeout: 3000 })
  // type=password + toggle
  assert((await page.locator('.login-field input[type="password"]').getAttribute('type')) === 'password', 'Password không phải type password')
  await page.locator('.password-row button').click()
  assert((await page.locator('.login-field input').nth(1).getAttribute('type')) === 'text', 'Toggle Hiện/Ẩn không hoạt động')
  await page.locator('.password-row button').click()
  // login hợp lệ
  await page.locator('.login-field input[type="password"]').fill('secret123')
  await page.locator('.login-submit').click()
  await page.locator('.login-modal').waitFor({ state: 'detached', timeout: 5000 })
  await page.locator('.user-chip', { hasText: 'flighta' }).waitFor({ timeout: 5000 })
  // không lưu plaintext password trong localStorage
  const storage = await page.evaluate(() => {
    const dump = {}
    for (let i = 0; i < localStorage.length; i += 1) { const k = localStorage.key(i); dump[k] = localStorage.getItem(k) }
    return JSON.stringify(dump)
  })
  assert(!storage.includes('secret123'), 'PASSWORD BỊ LƯU PLAINTEXT TRONG LOCALSTORAGE!')
  const sessionKeys = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('may-an-nhien-session') || '{}')))
  assert(!sessionKeys.includes('password'), 'Session chứa field password')
  return 'gate chặn; email/pw validation; toggle hoạt động; không lưu plaintext password'
})

// ===== 6. PASSENGER FORM (đã đăng nhập -> validation chạy tới phần dữ liệu) =====
await step('6', 'Passenger form: rỗng / ngắn / dài / SĐT / email / ký tự lạ', async () => {
  const nameI = page.locator('label.field', { hasText: 'Họ tên' }).locator('input')
  const phoneI = page.locator('label.field', { hasText: 'Số điện thoại' }).locator('input')
  const emailI = page.locator('label.field', { hasText: 'Email' }).locator('input')
  const pay = page.locator('.pay-btn')
  // a. bỏ trống họ tên
  await nameI.fill('')
  await phoneI.fill('0912345678')
  await emailI.fill('flighta@mayan.test')
  await pay.click()
  await waitToast('họ tên')
  assert(page.url().includes('#/checkout'), 'Vẫn chuyển trang dù thiếu họ tên')
  // b. tên quá ngắn
  await nameI.fill('A')
  await pay.click()
  await waitToast('tối thiểu 2 ký tự')
  // c. tên quá dài — maxlength chặn gõ tay ở mức 60
  await nameI.fill('')
  await nameI.focus()
  await page.keyboard.type('x'.repeat(70))
  const lenAfterType = (await nameI.inputValue()).length
  assert(lenAfterType === 60, `Gõ 70 ký tự nhưng field giữ ${lenAfterType} (mong đợi 60 do maxlength)`)
  // d. SĐT sai dạng chữ
  await nameI.fill('Nguyễn Văn Test')
  await phoneI.fill('abc')
  await pay.click()
  await waitToast('Số điện thoại chưa hợp lệ')
  // e. SĐT quá ngắn
  await phoneI.fill('09123')
  await pay.click()
  await waitToast('Số điện thoại chưa hợp lệ')
  // f. email sai
  await phoneI.fill('0912345678')
  await emailI.fill('sai-email')
  await pay.click()
  await waitToast('Email chưa hợp lệ')
  // g. ký tự bất thường trong tên — hiển thị literal, không crash
  await nameI.fill('<img src=x onerror=alert(1)>')
  await emailI.fill('')
  await pay.click()
  await waitToast('Email chưa hợp lệ')
  assert((await nameI.inputValue()) === '<img src=x onerror=alert(1)>', 'Tên ký tự lạ bị biến đổi')
  assert(pageErrors.length === 0, `pageerror với ký tự lạ: ${pageErrors[0]}`)
  // h. dữ liệu hợp lệ -> chuẩn bị cho payment
  await nameI.fill('Nguyễn Văn Test')
  await phoneI.fill('0912345678')
  await emailI.fill('flighta@mayan.test')
  await shot('06-passenger-hop-le')
  return 'rỗng/ngắn/dài/SĐT/email đều bị chặn; maxlength=60; ký tự lạ an toàn; dữ liệu hợp lệ đã điền'
})

// ===== 9. PAYMENT =====
await step('9', 'Payment: 3 phương thức + summary + xử lý đơn (1 lần bấm)', async () => {
  const methods = page.locator('.pay-methods button')
  assert((await methods.count()) === 3, `Chỉ có ${await methods.count()} phương thức`)
  // ATM là mặc định (design: luôn có 1 PT được chọn -> trường "chưa chọn" không tồn tại, N/A)
  const active0 = await page.locator('.pay-methods button.active').textContent()
  assert(active0.includes('ATM'), `Mặc định không phải ATM: ${active0}`)
  for (const label of ['Ví điện tử', 'Thẻ quốc tế', 'Thẻ ATM']) {
    await page.locator('.pay-methods button', { hasText: label }).click()
    await page.waitForTimeout(150)
    const act = await page.locator('.pay-methods button.active').textContent()
    assert(act.includes(label.replace('Thẻ ATM', 'ATM')), `Không active khi chọn ${label}: ${act}`)
    const row = await page.locator('.booking-summary .summary-item', { hasText: 'Thanh toán' }).locator('b').textContent()
    assert(row.length > 0, `Summary thiếu phương thức khi chọn ${label}`)
  }
  await page.locator('.pay-methods button', { hasText: 'Ví điện tử' }).click()
  await page.waitForTimeout(150)
  // bấm 1 lần -> trạng thái xử lý -> booking
  const pay = page.locator('.pay-btn')
  await pay.click()
  const processing = (await pay.textContent()).includes('Đang xử lý') && (await pay.isDisabled())
  await shot('09-dang-xu-ly')
  assert(processing, 'Nút không chuyển trạng thái đang xử lý')
  await page.locator('.bookings-page').waitFor({ timeout: 8000 })
  await waitToast('Đặt chỗ thành công')
  return '3 phương thức hoạt động; ATM mặc định; bấm 1 lần -> Đang xử lý -> thành công'
})

// ===== 10. BOOKING =====
await step('10', 'Booking được tạo đủ: mã / trạng thái / chuyến / khách / PT / tổng tiền', async () => {
  await page.locator('.booking-card').first().waitFor({ timeout: 5000 })
  const txt = await page.locator('.booking-card').first().textContent()
  assert(/MAN\d{5,}/.test(txt), 'Thiếu mã booking')
  assert(txt.includes('Đã xác nhận'), 'Thiếu trạng thái')
  assert(txt.includes('Vietnam Airlines TP.HCM - Đà Nẵng'), 'Thiếu thông tin chuyến bay')
  assert(txt.includes('Nguyễn Văn Test'), 'Thiếu hành khách')
  assert(txt.includes('0912345678'), 'Thiếu SĐT hành khách')
  assert(txt.includes('Ví điện tử'), 'Thiếu payment method')
  assert(txt.includes('2.580.000'), 'Thiếu tổng tiền')
  assert(txt.includes('Lịch trình: Đà Nẵng'), 'Thiếu lịch trình')
  await shot('10-booking')
  const code = txt.match(/MAN\d{5,}/)[0]
  return `${code} — VN-184, Nguyễn Văn Test, Ví điện tử, 2.580.000₫`
})

// ===== 11. PERSISTENCE =====
await step('11', 'F5: booking còn, không duplicate, thông tin hành khách đúng', async () => {
  const before = await page.locator('.booking-card').count()
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.bookings-page').waitFor({ timeout: 8000 })
  await page.waitForTimeout(500)
  const after = await page.locator('.booking-card').count()
  assert(after === before && after > 0, `Trước F5: ${before}, sau F5: ${after} (duplicate/mất đơn!)`)
  const txt = await page.locator('.booking-card').first().textContent()
  assert(txt.includes('Nguyễn Văn Test') && txt.includes('0912345678'), 'Thông tin hành khách sai sau reload')
  assert(txt.includes('Ví điện tử'), 'PT thanh toán mất sau reload')
  return `${after} đơn sau F5, thông tin giữ nguyên`
})

// ===== 12. ACCOUNT ISOLATION =====
await step('12', 'A thấy đơn A; B không thấy; logout/login lại A vẫn còn', async () => {
  // A đang đăng nhập, có đơn
  assert((await page.locator('.booking-card').count()) >= 1, 'A không thấy đơn của mình')
  // logout -> khách không thấy đơn A
  await page.locator('.header-actions button', { hasText: 'Đăng xuất' }).click()
  await page.locator('.user-chip').waitFor({ state: 'detached', timeout: 5000 })
  await page.waitForTimeout(400)
  assert((await page.locator('.booking-card').count()) === 0, 'Khách vẫn thấy đơn của A!')
  assert(await page.locator('.empty-bookings').isVisible(), 'Không thấy trạng thái rỗng khi là khách')
  // login B -> không thấy đơn A
  await page.locator('.login-btn').click()
  await page.locator('.login-field input[type="email"]').fill('flightb@mayan.test')
  await page.locator('.login-field input[type="password"]').fill('secret123')
  await page.locator('.login-submit').click()
  await page.locator('.user-chip', { hasText: 'flightb' }).waitFor({ timeout: 5000 })
  await page.locator('.nav button', { hasText: 'Đặt chỗ của tôi' }).click()
  await page.locator('.bookings-page').waitFor({ timeout: 5000 })
  await page.waitForTimeout(400)
  const leak = await page.locator('.booking-card').count()
  assert(leak === 0, `B thấy ${leak} đơn của A — RÒ RỈ!`)
  await shot('12-isolation-B')
  // logout -> login lại A -> đơn còn nguyên
  await page.locator('.header-actions button', { hasText: 'Đăng xuất' }).click()
  await page.locator('.user-chip').waitFor({ state: 'detached', timeout: 5000 })
  await page.locator('.login-btn').click()
  await page.locator('.login-field input[type="email"]').fill('flighta@mayan.test')
  await page.locator('.login-field input[type="password"]').fill('secret123')
  await page.locator('.login-submit').click()
  await page.locator('.user-chip', { hasText: 'flighta' }).waitFor({ timeout: 5000 })
  await page.locator('.nav button', { hasText: 'Đặt chỗ của tôi' }).click()
  await page.locator('.bookings-page').waitFor({ timeout: 5000 })
  await page.waitForTimeout(400)
  const backA = await page.locator('.booking-card').count()
  assert(backA >= 1, 'Mất đơn sau khi logout/login lại A!')
  return `A:${backA} đơn; khách:0; B:0 (không rò rỉ); login lại A: còn ${backA}`
})

// ===== 13. PAYMENT EDGE CASES (cancel/back/refresh/double-click, không booking ma) =====
await step('13', 'Cancel + Back + refresh giữa checkout/payment + double-click', async () => {
  const countBookings = async () => {
    await page.locator('.nav button', { hasText: 'Đặt chỗ của tôi' }).click()
    await page.locator('.bookings-page').waitFor({ timeout: 6000 })
    await page.waitForTimeout(300)
    const n = await page.locator('.booking-card').count()
    return n
  }
  const chooseFlight = async () => {
    await page.goto(`${BASE}/#/flight`, { waitUntil: 'networkidle' })
    await page.locator('.flight-card').first().waitFor({ timeout: 8000 })
    await page.locator('.flight-card').first().locator('button', { hasText: 'Chọn vé' }).click()
    await page.locator('.checkout-layout h1').waitFor({ timeout: 8000 })
  }
  const n0 = await countBookings()

  // a. cancel checkout
  await chooseFlight()
  await page.locator('.back-btn').click()
  await page.locator('.hero-copy h1').waitFor({ timeout: 5000 })
  // b. back trình duyệt -> quay về checkout render được, không pageerror
  await page.goBack()
  await page.waitForTimeout(500)
  const backOk = (await page.locator('.checkout-layout h1').count()) > 0 || (await page.locator('.empty-bookings').count()) > 0
  assert(backOk, 'Back trình duyệt không render được trang nào')
  assert(pageErrors.length === 0, `pageerror sau goBack: ${pageErrors[0]}`)
  // c. quay lại checkout bình thường
  await chooseFlight()
  assert((await page.locator('.pay-btn').count()) === 1, 'Checkout mới không có nút thanh toán')
  // d. refresh giữa checkout -> guard, không crash, không booking ma
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.empty-bookings h2', { hasText: 'Bạn chưa chọn dịch vụ nào' }).waitFor({ timeout: 8000 })
  assert((await countBookings()) === n0, 'Tạo booking ma sau refresh checkout!')
  // e. refresh GIỮA lúc payment (bấm pay rồi reload ngay trong 700ms)
  await chooseFlight()
  const nameI = page.locator('label.field', { hasText: 'Họ tên' }).locator('input')
  await nameI.fill('Nguyễn Văn Test')
  await page.locator('label.field', { hasText: 'Số điện thoại' }).locator('input').fill('0912345678')
  await page.locator('label.field', { hasText: 'Email' }).locator('input').fill('flighta@mayan.test')
  await page.locator('.pay-btn').click()
  await page.reload({ waitUntil: 'domcontentloaded' }) // trong lúc "Đang xử lý"
  await page.waitForTimeout(1200)
  assert((await countBookings()) === n0, 'Booking ma tạo được sau refresh giữa payment!')
  // f. double-click thật nhanh -> đúng 1 đơn mới
  await chooseFlight()
  await nameI.fill('Nguyễn Văn Test')
  await page.locator('label.field', { hasText: 'Số điện thoại' }).locator('input').fill('0912345678')
  await page.locator('label.field', { hasText: 'Email' }).locator('input').fill('flighta@mayan.test')
  const pay = page.locator('.pay-btn')
  await pay.click()
  await pay.click({ force: true }).catch(() => {})
  await pay.click({ force: true }).catch(() => {})
  await page.locator('.bookings-page').waitFor({ timeout: 8000 })
  await page.waitForTimeout(700)
  const n1 = await page.locator('.booking-card').count()
  assert(n1 - n0 === 1, `Double-click tạo ${n1 - n0} đơn (mong đợi đúng 1)`)
  await shot('13-double-click')
  return `cancel/back/refresh an toàn; refresh giữa payment không tạo đơn ma; double-click -> +1 đơn (${n0}->${n1})`
})

// ===== 14. ROUTING =====
await step('14', 'Routing: 5 route + F5 từng route, không crash', async () => {
  const routes = [
    ['flight', 'Tìm vé máy bay'],
    ['hotel', 'Khách sạn'],
    ['combo', 'Combo bay'],
    ['bookings', 'Đặt chỗ của tôi'],
  ]
  for (const [route, expect] of routes) {
    await page.goto(`${BASE}/#/${route}`, { waitUntil: 'networkidle' })
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByText(expect, { exact: false }).first().waitFor({ timeout: 8000 })
    assert(page.url().includes(`#/${route}`), `Sai hash sau F5: ${page.url()}`)
  }
  await page.goto(`${BASE}/#/khong-ton-tai`, { waitUntil: 'networkidle' })
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.notfound-page h1', { hasText: 'Trang bạn tìm không tồn tại' }).waitFor({ timeout: 8000 })
  await page.locator('.notfound-page button', { hasText: 'Về trang chủ' }).click()
  await page.locator('.hero-copy h1').waitFor({ timeout: 5000 })
  assert(pageErrors.length === 0, `pageerror khi routing: ${pageErrors[0]}`)
  return '4 route sống sót sau F5; #/khong-ton-tai -> 404 đúng; không crash'
})

// ===== 15. RESPONSIVE =====
await step('15', 'Responsive 375/390/430/768/Desktop: overflow, nav, layout', async () => {
  const checks = []
  for (const [w, h] of [[375, 812], [390, 844], [430, 932], [768, 1024], [1366, 860]]) {
    await page.setViewportSize({ width: w, height: h })
    for (const route of ['flight', 'home', 'checkout']) {
      await page.goto(`${BASE}/#/${route}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(350)
      const ov = await overflow()
      assert(ov <= 1, `Tràn ngang ${ov}px @${w}px trên #/${route}`)
    }
    const bottomVisible = await page.locator('.mobile-bottom-nav').isVisible()
    const headerNav = await page.locator('.header .nav').isVisible()
    if (w <= 720) {
      assert(bottomVisible, `Bottom nav không hiện @${w}px`)
      const n = await page.locator('.mobile-bottom-nav button').count()
      assert(n === 5, `Bottom nav @${w}px có ${n} mục (cần 5)`)
    } else {
      assert(!bottomVisible, `Bottom nav phải ẩn @${w}px`)
      assert(headerNav, `Header nav không hiện @${w}px`)
    }
    // card/button không tràn ngang viewport
    await page.goto(`${BASE}/#/flight`, { waitUntil: 'networkidle' })
    await page.locator('.flight-card').first().waitFor({ timeout: 6000 })
    const box = await page.locator('.flight-card').first().boundingBox()
    assert(box && box.x >= -1 && box.x + box.width <= w + 1, `Thẻ bay tràn viewport @${w}px`)
    if (w === 375) await shot('15-mobile-375')
    checks.push(`${w}`)
  }
  await page.setViewportSize({ width: 1366, height: 860 })
  return `OK @${checks.join('/')}px: không tràn, nav đúng, card trong viewport`
})

// ===== 16. API =====
await step('16', 'API: catalog/travel/404 + loading + error + retry + fallback', async () => {
  // 16a. endpoint thật
  const api = await request.newContext({ baseURL: BASE })
  const rCat = await api.get('/api/catalog')
  assert(rCat.status() === 200, `catalog: ${rCat.status()}`)
  const cat = await rCat.json()
  assert(Array.isArray(cat.flights) && cat.flights.length >= 3, 'catalog thiếu flights')
  assert(Array.isArray(cat.hotels) && cat.hotels.length >= 3, 'catalog thiếu hotels')
  const rTravel = await api.get('/api/travel')
  assert(rTravel.status() === 200, `travel: ${rTravel.status()}`)
  const travel = await rTravel.json()
  assert(Array.isArray(travel.benefits) && travel.benefits.length > 0, 'travel thiếu benefits')
  const r404 = await api.get('/api/khong-ton-tai')
  assert(r404.status() === 404, `API lạ: ${r404.status()}`)
  assert((await r404.json()).error, 'API 404 không trả JSON error')
  await api.dispose()

  // 16b. loading: delay API -> skeleton hiện trước khi có dữ liệu
  await page.route('**/api/catalog', async (route) => {
    await new Promise((r) => setTimeout(r, 1500))
    await route.continue()
  })
  await page.goto(`${BASE}/#/flight`, { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'commit' }) // reload đúng trang flight (reload KHÔNG nhận URL)
  await waitL(page.locator('.skeleton-block').first(), 'skeleton-loading', 5000)
  await shot('16a-loading-skeleton')
  await waitL(page.locator('.flight-card').first(), 'cards-sau-loading', 8000)
  await page.unroute('**/api/catalog')

  // 16c. error + fallback + retry (chặn cả 2 API) — TrustSection chỉ có ở HOME nên phải reload home
  apiFailurePhase = true
  await page.route('**/api/catalog', (route) => route.abort())
  await page.route('**/api/travel', (route) => route.abort())
  await page.goto(`${BASE}/#/home`, { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'networkidle' })
  await waitL(page.locator('.data-error-banner'), 'error-banner', 8000)
  assert((await page.locator('.data-error-banner').textContent()).includes('dùng dữ liệu dự phòng'), 'Banner thiếu nội dung fallback')
  await waitL(page.locator('.data-error-strip'), 'trust-strip', 8000)
  const fallbackCards = await page.locator('.flight-card').count() // dữ liệu fallback vẫn hiển thị
  assert(fallbackCards >= 3, `Fallback không hiển thị dữ liệu dự phòng (${fallbackCards} cards)`)
  await shot('16b-api-error')
  // retry khi API hồi phục
  await page.unroute('**/api/catalog')
  await page.unroute('**/api/travel')
  await page.locator('.data-error-banner button', { hasText: 'Thử lại' }).click()
  await waitL(page.locator('.data-error-banner'), 'banner-het-sau-retry', 8000, 'detached')
  await page.locator('.data-error-strip button', { hasText: 'Thử lại' }).click()
  await waitL(page.locator('.data-error-strip'), 'strip-het-sau-retry', 8000, 'detached')
  apiFailurePhase = false
  return 'catalog/travel 200 + 404 JSON; skeleton loading; error banner+strip; fallback OK; retry hồi phục'
})

// ===== 17. CONSOLE / RUNTIME =====
await step('17', 'Console: pageerror=0, console.error=0, không React warning', async () => {
  assert(pageErrors.length === 0, `${pageErrors.length} pageerror: ${pageErrors.slice(0, 2).join(' | ')}`)
  assert(consoleErrors.length === 0, `${consoleErrors.length} console.error: ${consoleErrors.slice(0, 3).join(' | ')}`)
  return '0 pageerror, 0 console.error (lọc lỗi mạng chủ động trong test API)'
})

// ===== TỔNG KẾT =====
console.log('\n========== FLIGHT QA KET QUA ==========')
const fail = results.filter((r) => r.status === 'FAIL')
for (const r of results) console.log(`${r.status} | ${r.id} | ${r.name} -- ${r.detail}`)
console.log(`\nTONG: ${results.length} | PASS: ${results.length - fail.length} | FAIL: ${fail.length}`)
writeFileSync('qa-evidence/flight-results.json', JSON.stringify({
  ranAt: new Date().toISOString(),
  total: results.length,
  pass: results.length - fail.length,
  fail: fail.length,
  pageErrors,
  consoleErrors,
  results,
}, null, 2))

await browser.close()
process.exit(fail.length > 0 ? 1 : 0)
