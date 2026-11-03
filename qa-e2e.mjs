// E2E regression cho Mây An Nhiên (chạy: npm run e2e)
// Tài khoản demo1/demo2@mayan.test chỉ dùng cho test cục bộ — không phải credential
// thật; repo không chứa bất kỳ secret/API key nào.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = 'http://localhost:5175'
const results = []
const runtimeErrors = []

const step = async (id, name, fn) => {
  try {
    const detail = (await fn()) || ''
    results.push({ id, name, status: 'PASS', detail })
    console.log(`PASS [${id}] ${name}${detail ? ' -- ' + detail : ''}`)
  } catch (err) {
    const msg = String(err.message || err).split('\n')[0].slice(0, 240)
    results.push({ id, name, status: 'FAIL', detail: msg })
    console.log(`FAIL [${id}] ${name} -- ${msg}`)
  }
}

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
// DB tạm của suite có thể chưa có user demo1/demo2 -> đăng ký trước khi dùng.

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', (err) => runtimeErrors.push(`pageerror: ${err.message}`))
page.on('console', (msg) => {
  if (msg.type() === 'error') runtimeErrors.push(`console: ${msg.text().slice(0, 200)}`)
})

const toast = page.locator('.toast')
const bookingCards = page.locator('.booking-card')
const waitToast = async (substring, timeout = 5000) => {
  await page.locator('.toast', { hasText: substring }).waitFor({ timeout })
  return substring
}

// ---------- 1. Vào trang vé máy bay ----------
await step('1', 'Vào trang vé máy bay qua URL #/flight', async () => {
  await page.goto(`${BASE}/#/flight`, { waitUntil: 'networkidle' })
  await page.locator('.page-hero h1', { hasText: 'Tìm vé máy bay giá tốt' }).waitFor({ timeout: 8000 })
  assert(page.url().includes('#/flight'), `URL không đúng: ${page.url()}`)
  return 'PageHero vé máy bay hiển thị, hash #/flight đúng'
})

// ---------- 2. Tìm & chọn chuyến ----------
await step('2', 'Chọn một chuyến bay (nút Chọn vé)', async () => {
  const firstCard = page.locator('.flight-card').first()
  await firstCard.waitFor({ timeout: 8000 })
  const airline = await firstCard.locator('h3').textContent()
  await firstCard.locator('button', { hasText: 'Chọn vé' }).click()
  await page.locator('.checkout-layout h1', { hasText: 'Thanh toán đặt chỗ' }).waitFor({ timeout: 8000 })
  return `Đã chọn: ${airline} -> trang checkout`
})

// ---------- 3. Nhập thông tin hành khách ----------
await step('3', 'Nhập đầy đủ thông tin hành khách', async () => {
  await page.locator('label.field', { hasText: 'Họ tên' }).locator('input').fill('Nguyễn Văn E2E')
  await page.locator('label.field', { hasText: 'Số điện thoại' }).locator('input').fill('0912345678')
  await page.locator('label.field', { hasText: 'Email' }).locator('input').fill('demo1@mayan.test')
  const nameVal = await page.locator('label.field', { hasText: 'Họ tên' }).locator('input').inputValue()
  assert(nameVal === 'Nguyễn Văn E2E', 'Giá trị họ tên không được ghi nhận')
  return 'Tên / SĐT / Email đã nhập'
})

// ---------- 4. Checkout ----------
await step('4', 'Kiểm tra trang checkout đầy đủ khối thông tin', async () => {
  assert(await page.locator('.trip-info-row').isVisible(), 'Thiếu khối Thông tin chuyến đi')
  assert(await page.locator('.booking-summary').isVisible(), 'Thiếu tóm tắt đặt chỗ')
  const total = await page.locator('.booking-summary .summary-total strong').textContent()
  assert(/[\d.]/.test(total), `Tổng tiền không hợp lệ: ${total}`)
  assert(await page.locator('.pay-methods').isVisible(), 'Thiếu chọn phương thức thanh toán')
  return `Tổng tiền hiển thị: ${total.trim()}`
})

// ---------- 5. Login gate khi chưa đăng nhập ----------
await step('5', 'Chưa đăng nhập bấm thanh toán -> login gate xuất hiện', async () => {
  await page.locator('.pay-btn').click()
  await page.locator('.login-modal').waitFor({ timeout: 5000 })
  const hint = await page.locator('.pay-hint').textContent().catch(() => '')
  assert(await page.locator('.login-modal').isVisible(), 'Login modal không thấy')
  return `Login modal hiển thị${hint ? ` ("${hint.trim()}")` : ''}`
})

// ---------- 6. Đăng nhập (kèm validation) ----------
await step('6', 'Validation login rồi đăng nhập thành công', async () => {
  await ensureUser('demo1@mayan.test', 'secret123')
  await page.locator('.login-field input[type="email"]').fill('sai-email')
  await page.locator('.login-submit').click()
  await page.locator('.login-error', { hasText: 'Email không hợp lệ' }).waitFor({ timeout: 3000 })
  await page.locator('.login-field input[type="email"]').fill('demo1@mayan.test')
  await page.locator('.login-field input[type="password"]').fill('123')
  await page.locator('.login-submit').click()
  await page.locator('.login-error', { hasText: 'ít nhất 6 ký tự' }).waitFor({ timeout: 3000 })
  await page.locator('.login-field input[type="password"]').fill('secret123')
  await page.locator('.login-submit').click()
  await page.locator('.login-modal').waitFor({ state: 'detached', timeout: 5000 })
  await page.locator('.user-chip', { hasText: 'demo1' }).waitFor({ timeout: 5000 })
  return '2 lỗi validation hiển thị đúng, đăng nhập demo1 thành công'
})

// ---------- 7. Chọn phương thức thanh toán ----------
await step('7', 'Chọn phương thức thanh toán (Ví điện tử)', async () => {
  const walletBtn = page.locator('.pay-methods button', { hasText: 'Ví điện tử' })
  await walletBtn.click()
  assert((await walletBtn.getAttribute('class'))?.includes('active'), 'Nút ví điện tử chưa active')
  const summaryPay = await page.locator('.booking-summary .summary-item', { hasText: 'Thanh toán' }).locator('b').textContent()
  assert(summaryPay.includes('Ví điện tử'), `Tóm tắt không ghi phương thức: ${summaryPay}`)
  return 'Ví điện tử selected + hiển thị trong tóm tắt'
})

// ---------- 8. Thanh toán thành công ----------
await step('8', 'Bấm thanh toán -> xử lý -> chuyển trang đặt chỗ', async () => {
  await page.locator('.pay-btn').click()
  const disabledDuring = await page.locator('.pay-btn').isDisabled()
  await page.locator('.bookings-page').waitFor({ timeout: 8000 })
  assert(disabledDuring, 'Nút thanh toán không bị disabled trong lúc xử lý (chống bấm trùng FAIL)')
  const successToast = await toast.textContent().catch(() => '')
  return `Chuyển sang trang Đặt chỗ của tôi${successToast ? `; toast: "${successToast.trim().slice(0, 60)}"` : ''}`
})

// ---------- 9. Booking được tạo ----------
await step('9', 'Xác nhận booking vừa tạo (mã MAN, trạng thái, phương thức)', async () => {
  await bookingCards.first().waitFor({ timeout: 5000 })
  const card = bookingCards.first()
  const text = await card.textContent()
  assert(/MAN\d{5,}/.test(text), 'Không thấy mã đơn MAN...')
  assert(text.includes('Đã xác nhận'), 'Không thấy trạng thái Đã xác nhận')
  assert(text.includes('Ví điện tử'), 'Không thấy phương thức thanh toán trong đơn')
  assert(text.includes('Nguyễn Văn E2E'), 'Không thấy thông tin người đặt')
  const code = text.match(/MAN\d{5,}/)[0]
  return `Đơn ${code} — E2E, Ví điện tử, Đã xác nhận`
})

// ---------- 10. Vào 'Đặt chỗ của tôi' ----------
await step('10', 'Mục Đặt chỗ của tôi hiển thị booking', async () => {
  await page.locator('.nav button', { hasText: 'Đặt chỗ của tôi' }).click()
  await page.locator('.bookings-page').waitFor({ timeout: 5000 })
  assert(await bookingCards.first().isVisible({ timeout: 5000 }), 'Không thấy booking')
  const count = await bookingCards.count()
  return `Hiển thị ${count} đơn`
})

// ---------- 11. F5 reload ----------
await step('11', 'F5/reload — booking vẫn còn (persistence)', async () => {
  const before = await bookingCards.count()
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.bookings-page').waitFor({ timeout: 8000 })
  await page.waitForTimeout(500)
  const after = await bookingCards.count()
  assert(after >= before && after > 0, `Mất booking sau reload (trước ${before}, sau ${after})`)
  return `Vẫn còn ${after} đơn sau reload`
})

// ---------- 12. Logout ----------
await step('12', 'Logout — không còn thấy booking của tài khoản trước', async () => {
  await page.locator('.header-actions button', { hasText: 'Đăng xuất' }).click()
  await page.locator('.user-chip').waitFor({ state: 'detached', timeout: 5000 })
  await page.waitForTimeout(400)
  const stillVisible = await bookingCards.count()
  const emptyVisible = await page.locator('.empty-bookings').isVisible().catch(() => false)
  assert(stillVisible === 0, `Vẫn thấy ${stillVisible} đơn sau đăng xuất (khách không được thấy đơn của user)`)
  assert(emptyVisible, 'Không thấy trạng thái rỗng sau đăng xuất')
  return 'Đăng xuất -> danh sách rỗng (đơn của demo1 bị ẩn)'
})

// ---------- 13. Tài khoản khác ----------
await step('13', 'Tài khoản demo2 không thấy booking của demo1', async () => {
  await ensureUser('demo2@mayan.test', 'secret123')
  await page.locator('.login-btn').click()
  await page.locator('.login-field input[type="email"]').fill('demo2@mayan.test')
  await page.locator('.login-field input[type="password"]').fill('secret123')
  await page.locator('.login-submit').click()
  await page.locator('.user-chip', { hasText: 'demo2' }).waitFor({ timeout: 5000 })
  await page.locator('.nav button', { hasText: 'Đặt chỗ của tôi' }).click()
  await page.locator('.bookings-page').waitFor({ timeout: 5000 })
  await page.waitForTimeout(400)
  const leak = await bookingCards.count()
  assert(leak === 0, `Tài khoản demo2 thấy ${leak} đơn của tài khoản khác (rò rỉ dữ liệu!)`)
  assert(await page.locator('.empty-bookings').isVisible(), 'demo2 không thấy trạng thái rỗng')
  return 'demo2 thấy danh sách rỗng — không rò rỉ'
})

// ---------- T1: Validation thanh toán ----------
await step('T1', 'Validation SĐT sai + Email sai khi thanh toán', async () => {
  await page.locator('.nav button', { hasText: 'Vé máy bay' }).click()
  await page.locator('.flight-card').first().waitFor({ timeout: 8000 })
  await page.locator('.flight-card').first().locator('button', { hasText: 'Chọn vé' }).click()
  await page.locator('.checkout-layout h1').waitFor({ timeout: 8000 })
  await page.locator('label.field', { hasText: 'Số điện thoại' }).locator('input').fill('abc')
  await page.locator('.pay-btn').click()
  await toast.waitFor({ timeout: 4000 })
  const t = await toast.textContent()
  assert(t.includes('Số điện thoại chưa hợp lệ'), `Toast sai: "${t}"`)
  assert(!page.url().includes('bookings'), 'Vẫn chuyển trang dù SĐT sai')
  await page.locator('label.field', { hasText: 'Số điện thoại' }).locator('input').fill('0912345678')
  await page.locator('label.field', { hasText: 'Email' }).locator('input').fill('email-sai')
  await page.locator('.pay-btn').click()
  await page.waitForTimeout(400)
  const t2 = await toast.textContent()
  assert(t2.includes('Email chưa hợp lệ'), `Toast sai: "${t2}"`)
  await page.locator('label.field', { hasText: 'Email' }).locator('input').fill('demo2@mayan.test')
  return 'SĐT sai + Email sai đều bị chặn đúng'
})

// ---------- T2: Double-click thanh toán ----------
await step('T2', 'Double-click thanh toán chỉ tạo 1 đơn', async () => {
  const before = await bookingCards.count().catch(() => 0)
  await page.locator('.pay-btn').click()
  await page.locator('.pay-btn').click({ force: true }).catch(() => {})
  await page.locator('.pay-btn').click({ force: true }).catch(() => {})
  await page.locator('.bookings-page').waitFor({ timeout: 8000 })
  await page.waitForTimeout(600)
  const after = await bookingCards.count()
  assert(after - before === 1, `Tạo ${after - before} đơn (mong đợi đúng 1)`)
  return `Tạo đúng 1 đơn (trước ${before} -> sau ${after})`
})

// ---------- T3: Cancel từ checkout (luồng phòng khách sạn) ----------
await step('T3', 'Nút Quay lại từ thanh toán phòng (cancel)', async () => {
  await page.locator('.nav button', { hasText: 'Khách sạn' }).click()
  await page.locator('.hotel-card').first().waitFor({ timeout: 8000 })
  await page.locator('.hotel-card').first().locator('button', { hasText: 'Chọn phòng' }).click()
  await page.locator('.room-card').first().waitFor({ timeout: 8000 })
  await page.locator('.pick-room-btn').first().click()
  await page.locator('.hotel-checkout h1').waitFor({ timeout: 8000 })
  await page.locator('.back-btn').click()
  await page.locator('.room-card').first().waitFor({ timeout: 5000 })
  assert(page.url().includes('#/rooms'), 'Cancel không về trang chọn phòng: ' + page.url())
  // từ trang chọn phòng về trang chủ bằng logo
  await page.locator('.brand').click()
  await page.locator('.hero-copy h1').waitFor({ timeout: 5000 })
  return 'Hủy checkout -> trang chọn phòng -> trang chủ OK'
})

// ---------- T4: Nút back của trình duyệt ----------
await step('T4', 'Back trình duyệt quay lại trang trước', async () => {
  await page.locator('.nav button', { hasText: 'Combo' }).click()
  await page.locator('.page-hero h1', { hasText: 'Combo bay' }).waitFor({ timeout: 5000 })
  await page.goBack()
  await page.locator('.hero-copy h1').waitFor({ timeout: 5000 })
  return 'goBack về trang chủ OK'
})

// ---------- T5: Search validation ----------
await step('T5', 'Validation tìm kiếm: trống & ngày về < ngày đi', async () => {
  await page.locator('label.field.wide input').fill('')
  await page.locator('.search-submit').click()
  await waitToast('Vui lòng nhập điểm đến')
  await page.locator('label.field.wide input').fill('Đà Nẵng')
  await page.locator('label.field', { hasText: 'Ngày đi' }).locator('input').fill('2027-05-10')
  await page.locator('label.field', { hasText: 'Ngày về' }).locator('input').fill('2027-05-01')
  await page.locator('.search-submit').click()
  await waitToast('Ngày về phải sau ngày đi')
  return 'Trống + ngày về trước ngày đi đều bị chặn'
})

// ---------- T6: Refresh từng route ----------
for (const [route, expectText] of [
  ['home', 'Trang chủ'],
  ['flight', 'Tìm vé máy bay'],
  ['hotel', 'Khách sạn'],
  ['combo', 'Combo bay'],
  ['bookings', 'Đặt chỗ của tôi'],
]) {
  await step(`T6-${route}`, `Refresh route #/${route} giữ đúng trang`, async () => {
    await page.goto(`${BASE}/#/${route}`, { waitUntil: 'networkidle' })
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByText(expectText, { exact: false }).first().waitFor({ timeout: 8000 })
    return `#${route} sống sót sau reload`
  })
}

// ---------- T7: 404 route ----------
await step('T7', 'Route lạ #/khong-ton-tai -> trang 404', async () => {
  await page.goto(`${BASE}/#/khong-ton-tai`, { waitUntil: 'networkidle' })
  await page.locator('.notfound-page h1', { hasText: 'Trang bạn tìm không tồn tại' }).waitFor({ timeout: 8000 })
  await page.locator('.notfound-page button', { hasText: 'Về trang chủ' }).click()
  await page.locator('.hero-copy h1').waitFor({ timeout: 5000 })
  return '404 hiển thị + nút về trang chủ hoạt động'
})

// ---------- T8: Refresh giữa checkout ----------
await step('T8', 'Refresh tại checkout khi chưa chọn gì -> guard', async () => {
  await page.goto(`${BASE}/#/checkout`, { waitUntil: 'networkidle' })
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.empty-bookings h2', { hasText: 'Bạn chưa chọn dịch vụ nào' }).waitFor({ timeout: 8000 })
  return 'Không crash, hiện hướng dẫn chọn dịch vụ'
})

// ---------- T9: Mobile 375/390/430 ----------
for (const width of [375, 390, 430]) {
  await step(`T9-${width}`, `Mobile ${width}px: bottom nav + không tràn ngang`, async () => {
    await page.setViewportSize({ width, height: 844 })
    for (const route of ['home', 'flight', 'checkout']) {
      await page.goto(`${BASE}/#/${route}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(400)
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement
        return Math.max(doc.scrollWidth, document.body.scrollWidth) - window.innerWidth
      })
      assert(overflow <= 1, `Tràn ngang ${overflow}px tại #/${route}`)
    }
    const navVisible = await page.locator('.mobile-bottom-nav').isVisible()
    assert(navVisible, 'Bottom nav không hiện trên mobile')
    const navCount = await page.locator('.mobile-bottom-nav button').count()
    assert(navCount === 5, `Bottom nav có ${navCount} nút (mong đợi 5)`)
    await page.setViewportSize({ width: 1440, height: 900 })
    return 'Không tràn ngang, bottom nav 5 mục'
  })
}

// ---------- T10: Runtime errors ----------
await step('T10', 'Không có runtime/pageerror trong toàn bộ phiên test', async () => {
  const real = runtimeErrors.filter((e) => !e.includes('favicon') && !e.includes('ERR_'))
  assert(real.length === 0, `${real.length} lỗi: ${real.slice(0, 3).join(' | ')}`)
  return '0 lỗi runtime'
})

// ---------- Tổng kết ----------
console.log('\n========== KET QUA E2E ==========')
const fail = results.filter((r) => r.status === 'FAIL')
for (const r of results) console.log(`${r.status} | ${r.id} | ${r.name}${r.detail ? ' -- ' + r.detail : ''}`)
console.log(`\nTONG: ${results.length} | PASS: ${results.length - fail.length} | FAIL: ${fail.length}`)

// Lưu bằng chứng kết quả cho báo cáo demo
mkdirSync('qa-evidence', { recursive: true })
writeFileSync('qa-evidence/e2e-results.json', JSON.stringify({
  ranAt: new Date().toISOString(),
  total: results.length,
  pass: results.length - fail.length,
  fail: fail.length,
  results,
}, null, 2))

await browser.close()
process.exit(fail.length > 0 ? 1 : 0)

