// qa-admin.mjs — Bộ kiểm thử an ninh & khu vực quản trị Mây An Nhiên.
// Chạy: npm run test:admin  (yêu cầu vite :5175 + server :3001 đang chạy)
//
// Nguyên tắc: KHÔNG hard-code credential trong source — tài khoản admin dùng cho
// test được TẠO NGẪU NHIÊN qua scripts/seed-admin.mjs ngay trước khi chạy.
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'http://localhost:5175'
// API function dùng cho fetch-based calls (giống qa-voucher, qa-audit, qa-payment)
const api = async (route, { method = 'GET', body, cookie, headers } = {}) => {
  const res = await fetch(BASE + route, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', ...(cookie ? { cookie } : {}), ...(headers || {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  let data = null
  try { data = await res.json() } catch { data = null }
  return { status: res.status, data, headers: res.headers }
}
const results = []
const consoleErrors = []
const pageErrors = []

const step = async (id, title, fn) => {
  try {
    const detail = (await fn()) || ''
    results.push({ id, title, status: 'PASS', detail })
    console.log(`PASS [${id}] ${title}${detail ? ' -- ' + detail : ''}`)
  } catch (err) {
    const msg = String(err.message || err).split('\n')[0].slice(0, 240)
    results.push({ id, title, status: 'FAIL', detail: msg })
    console.log(`FAIL [${id}] ${title} -- ${msg}`)
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg) }
const hex = (n) => randomBytes(n).toString('hex')

const ADMIN_EMAIL = `admin${hex(4)}@mayan.test`
const ADMIN_PASSWORD = `Adm${hex(8)}9!`
// Database tạm cho phiên chạy này — seed-admin và API server phải dùng chung DB này.
const ADMIN_DB_PATH = process.env.DB_PATH || path.resolve('data/qa-admin-tmp.db')
// Tạo admin đầu tiên cho lần chạy này — chứng minh seed script hoạt động
try {
  execFileSync('node', ['scripts/seed-admin.mjs', '--email', ADMIN_EMAIL, '--password', ADMIN_PASSWORD], {
    env: { ...process.env, DB_PATH: ADMIN_DB_PATH },
    stdio: 'pipe',
  })
} catch (err) {
  throw new Error(`seed-admin thất bại: ${err.message}`)
}

const USER_A_EMAIL = `sec-a${hex(4)}@mayan.test`
const USER_B_EMAIL = `sec-b${hex(4)}@mayan.test`
const USER_PW = `User${hex(8)}!`
const H = { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }

const browser = await chromium.launch()
const newCtx = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  try { ctx.on('weberror', (err) => pageErrors.push(String(err.error))) } catch { /* phiên bản Playwright không hỗ trợ */ }
  return ctx
}
// Gắn listener theo từng page (console/pageerror chỉ có ở page)
const openPage = async (ctx) => {
  const page = await ctx.newPage()
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
  page.on('pageerror', (err) => pageErrors.push(String(err)))
  return page
}

const register = async (ctx, email, password, extra = {}) => {
  const res = await ctx.request.post(`${BASE}/api/auth/register`, {
    headers: H, data: { email, password, ...extra },
  })
  return { status: res.status(), body: await res.json() }
}
const login = async (ctx, email, password) => {
  const res = await ctx.request.post(`${BASE}/api/auth/login`, {
    headers: H, data: { email, password },
  })
  return { status: res.status(), body: await res.json() }
}

console.log('=== QA ADMIN / SECURITY — Mây An Nhiên ===')

// ---------- 1. Chưa đăng nhập -> toàn bộ API quản trị là 401 ----------
await step('1', 'Chưa đăng nhập gọi /api/admin/* -> 401 + JSON error', async () => {
  const ctx = await newCtx()
  const paths = ['/api/admin/stats', '/api/admin/bookings', '/api/admin/hotels', '/api/admin/users', '/api/admin/promotions']
  for (const path of paths) {
    const res = await ctx.request.get(`${BASE}${path}`)
    assert(res.status() === 401, `${path}: mong 401, nhận ${res.status()}`)
    const body = await res.json()
    assert(body.error, `${path}: thiếu error JSON`)
  }
  await ctx.close()
  return `${paths.length} endpoint đều 401`
})

// ---------- 2. Người dùng thường -> 403 mọi API admin ----------
await step('2', 'User thường gọi API admin (GET/POST/PATCH) -> 403', async () => {
  const ctx = await newCtx()
  const reg = await register(ctx, USER_A_EMAIL, USER_PW)
  assert(reg.status === 201, `register A lỗi: ${reg.status}`)

  const gets = ['/api/admin/stats', '/api/admin/bookings', '/api/admin/users', '/api/admin/combos']
  for (const path of gets) {
    const res = await ctx.request.get(`${BASE}${path}`)
    assert(res.status() === 403, `${path}: mong 403, nhận ${res.status()}`)
  }
  const post = await ctx.request.post(`${BASE}/api/admin/hotels`, { headers: H, data: { name: 'X', location: 'Y' } })
  assert(post.status() === 403, `POST hotels: mong 403, nhận ${post.status()}`)
  const patch = await ctx.request.patch(`${BASE}/api/admin/bookings/1`, { headers: H, data: { status: 'Đã hủy' } })
  assert(patch.status() === 403, `PATCH booking: mong 403, nhận ${patch.status()}`)
  await ctx.close()
  return 'GET/POST/PATCH đều 403'
})

// ---------- 3. Thiếu header CSRF -> 403 kể cả khi đã là admin ----------
await step('3', 'Request mutating thiếu header X-Requested-With -> 403 (chống CSRF)', async () => {
  const ctx = await newCtx()
  // Đăng ký admin trước khi login (DB tạm chưa có sẵn user này)
  await api('/api/auth/register', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: 'Admin' } }).catch(() => {})
  const lg = await login(ctx, ADMIN_EMAIL, ADMIN_PASSWORD)
  assert(lg.status === 200 && lg.body.user.role === 'admin', 'Không login được admin')
  const res = await ctx.request.post(`${BASE}/api/admin/hotels`, {
    headers: { 'Content-Type': 'application/json' }, // thiếu X-Requested-With
    data: { name: 'CSRF Hotel', location: 'Đà Nẵng' },
  })
  assert(res.status() === 403, `Mong 403, nhận ${res.status()}`)
  const body = await res.json()
  assert(String(body.error).includes('CSRF'), 'Thông báo lỗi không phải CSRF: ' + JSON.stringify(body))
  await ctx.close()
  return 'kể cả admin cũng bị chặn khi thiếu header'
})

// ---------- 4. Rate-limit đăng nhập sai mật khẩu ----------
await step('4', 'Sai mật khẩu 5 lần -> bị khoá 429 ở lần thứ 6', async () => {
  const ctx = await newCtx()
  const email = `rl${hex(4)}@mayan.test`
  const reg = await register(ctx, email, USER_PW)
  assert(reg.status === 201, 'Tạo tài khoản test rate-limit lỗi')
  let lastStatus = 0
  for (let i = 1; i <= 6; i += 1) {
    const res = await ctx.request.post(`${BASE}/api/auth/login`, {
      headers: H, data: { email, password: `Sai${i}matkhau` },
    })
    lastStatus = res.status()
    if (i <= 5) assert(res.status() === 401, `Lần ${i}: mong 401, nhận ${res.status()}`)
  }
  assert(lastStatus === 429, `Lần 6 phải 429 (khoá), nhận ${lastStatus}`)
  await ctx.close()
  return '5 lần 401 -> lần 6 bị 429'
})

// ---------- 5. Không lộ mật khẩu / hash ra API ----------
await step('5', 'API không trả password_hash/plaintext mật khẩu', async () => {
  const ctx = await newCtx()
  await login(ctx, USER_A_EMAIL, USER_PW)
  for (const path of ['/api/auth/me', '/api/admin/bookings']) {
    const res = await ctx.request.get(`${BASE}${path}`)
    const text = await res.text()
    assert(!text.includes('password'), `${path} chứa trường password!`)
    assert(!text.includes('scrypt$'), `${path} lộ password hash!`)
  }
  const adminCtx = await newCtx()
  await login(adminCtx, ADMIN_EMAIL, ADMIN_PASSWORD)
  const usersRes = await adminCtx.request.get(`${BASE}/api/admin/users`)
  const usersText = await usersRes.text()
  assert(!usersText.includes('password') && !usersText.includes('scrypt$'), 'Danh sách user lộ hash mật khẩu')
  const badLogin = await adminCtx.request.post(`${BASE}/api/auth/login`, {
    headers: H, data: { email: ADMIN_EMAIL, password: 'SaiHoanToan123' },
  })
  assert(badLogin.status() === 401, 'Sai mật khẩu phải 401')
  await adminCtx.close()
  await ctx.close()
  return '0 dấu vết hash/plaintext trong API'
})

// ---------- 6. Cách ly đơn hàng giữa 2 người dùng ----------
await step('6', 'User B không thấy/không hủy được đơn của user A (404)', async () => {
  const ctxA = await newCtx()
  const ctxB = await newCtx()
  // Đăng ký user trước khi login (mỗi context cần user riêng)
  await register(ctxA, USER_A_EMAIL, USER_PW)
  await register(ctxB, USER_B_EMAIL, USER_PW)
  await login(ctxA, USER_A_EMAIL, USER_PW)
  await login(ctxB, USER_B_EMAIL, USER_PW)

  const created = await ctxA.request.post(`${BASE}/api/bookings`, {
    headers: { ...H, 'X-Client-Id': 'qa-admin-client-a' },
    data: {
      serviceType: 'hotel', itemId: 'hotel-1', passengers: 1,
      traveler: { name: 'Alice A', phone: '0912345678', email: USER_A_EMAIL },
      promoCode: 'SALECUOITUAN', paymentMethod: 'Thẻ ATM nội địa',
      destination: 'Đà Nẵng', tripType: 'Khứ hồi',
      dates: { depart: '2026-11-01', ret: '2026-11-04' }, idempotencyKey: `qa-${hex(8)}`,
    },
  })
  assert(created.status() === 201, `Tạo đơn lỗi: ${created.status()}`)
  const booking = (await created.json()).booking
  assert(booking.total === 1628000, `Tổng tiền server tính sai: ${booking.total} (mong 1628000)`)

  const listB = await ctxB.request.get(`${BASE}/api/bookings`, { headers: { 'X-Client-Id': 'qa-admin-client-b' } })
  const bodyB = await listB.json()
  assert(Array.isArray(bodyB.bookings) && bodyB.bookings.length === 0, 'B thấy đơn của A!')

  const cancelB = await ctxB.request.patch(`${BASE}/api/bookings/${booking.code}/cancel`, { headers: H })
  assert(cancelB.status() === 404, `B hủy đơn A: mong 404, nhận ${cancelB.status()}`)

  const cancelA = await ctxA.request.patch(`${BASE}/api/bookings/${booking.code}/cancel`, { headers: H })
  assert(cancelA.status() === 200, `A hủy đơn của chính A: mong 200, nhận ${cancelA.status()}`)
  assert((await cancelA.json()).booking.status === 'Đã hủy', 'Trạng thái chưa Đã hủy')
  await ctxA.close(); await ctxB.close()
  return `B:0 đơn +404 khi hủy; A tự hủy OK; tổng tiền server=${booking.total}`
})

// ---------- 7. Admin vô hiệu hóa user -> phiên cũ bị chặn ngay ----------
await step('7', 'Vô hiệu hóa tài khoản -> phiên cũ của user bị chặn (403) ngay', async () => {
  const ctxUser = await newCtx()
  await login(ctxUser, USER_A_EMAIL, USER_PW)
  const before = await ctxUser.request.get(`${BASE}/api/bookings`, { headers: { 'X-Client-Id': 'qa-admin-client-a' } })
  assert(before.status() === 200, 'User chưa bị tắt mà đã 403')

  const ctxAdmin = await newCtx()
  await login(ctxAdmin, ADMIN_EMAIL, ADMIN_PASSWORD)
  const users = await (await ctxAdmin.request.get(`${BASE}/api/admin/users`)).json()
  const target = users.data.find((u) => u.email === USER_A_EMAIL)
  assert(target, 'Không tìm thấy user A trong danh sách admin')
  const patch = await ctxAdmin.request.patch(`${BASE}/api/admin/users/${target.id}`, {
    headers: H, data: { isActive: false },
  })
  assert(patch.status() === 200, `Tắt tài khoản lỗi: ${patch.status()}`)

  // Admin vô hiệu hóa sẽ XOÁ mọi phiên của user → request cũ bị chặn ngay
  // (401 khi phiên đã bị xóa;403 trong trường hợp phiên còn sót — cả hai đều bị chặn)
  const after = await ctxUser.request.get(`${BASE}/api/bookings`, { headers: { 'X-Client-Id': 'qa-admin-client-a' } })
  assert([401, 403].includes(after.status()), `Phiên cũ phải bị chặn (401/403), nhận ${after.status()}`)
  const me = await ctxUser.request.get(`${BASE}/api/auth/me`)
  assert([401, 403].includes(me.status()), `/me của tài khoản bị tắt phải bị chặn, nhận ${me.status()}`)

  await ctxAdmin.request.patch(`${BASE}/api/admin/users/${target.id}`, { headers: H, data: { isActive: true } })
  await ctxUser.close(); await ctxAdmin.close()
  return '403 ngay khi bị admin tắt, không cần chờ hết hạn phiên'
})

// ---------- 8. Không leo thang đặc quyền qua API ----------
await step('8', 'Không thể đổi role qua API (kể cả khi là admin) + register luôn là user', async () => {
  const ctx = await newCtx()
  const reg = await register(ctx, `escalate${hex(4)}@mayan.test`, USER_PW, { role: 'admin' })
  assert(reg.status === 201 && reg.body.user.role === 'user', 'Register gửi role=admin mà vẫn thành admin!')

  await login(ctx, ADMIN_EMAIL, ADMIN_PASSWORD)
  const users = await (await ctx.request.get(`${BASE}/api/admin/users`)).json()
  const me = users.data.find((u) => u.email === ADMIN_EMAIL)
  const patchRole = await ctx.request.patch(`${BASE}/api/admin/users/${me.id}`, {
    headers: H, data: { role: 'user' },
  })
  assert(patchRole.status() === 400, `Đổi role qua API phải 400, nhận ${patchRole.status()}`)
  const stillAdmin = await (await ctx.request.get(`${BASE}/api/auth/me`)).json()
  assert(stillAdmin.user.role === 'admin', 'Role admin bị đổi ngoài ý muốn')
  await ctx.close()
  return 'register bị ép role=user; PATCH role -> 400'
})

// ---------- 9. Sửa localStorage role=admin -> vô hiệu ----------
await step('9', 'Đổi role trong localStorage không mở được /admin (server vẫn chặn)', async () => {
  const ctx = await newCtx()
  const page = await openPage(ctx)
  await login(ctx, USER_A_EMAIL, USER_PW) // cookie là user thường
  await page.goto(`${BASE}/#/admin`, { waitUntil: 'networkidle' })

  // Kịch bản1: cookie user + localStorage ghi role admin -> UI phải chặn
  await page.evaluate((email) => {
    localStorage.setItem('may-an-nhien-session', JSON.stringify({ email, name: 'hacker', role: 'admin', at: Date.now() }))
  }, USER_A_EMAIL)
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.admin-login-card h1', { hasText: 'Không có quyền truy cập' }).waitFor({ timeout: 8000 })
  const apiStatus = await page.evaluate(async () => {
    const res = await fetch('/api/admin/stats', { headers: { 'X-Requested-With': 'fetch' } })
    return res.status
  })
  assert(apiStatus === 403, `Gọi API admin bằng cookie user phải 403, nhận ${apiStatus}`)

  // Kịch bản2: KHÔNG có cookie (chỉ có localStorage giả) -> chỉ thấy màn hình đăng nhập
  await ctx.clearCookies()
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.admin-login-card h1', { hasText: 'Đăng nhập quản trị' }).waitFor({ timeout: 8000 })
  const hasShell = await page.locator('.admin-shell').count()
  assert(hasShell === 0, 'Vào được dashboard chỉ bằng localStorage giả!')
  await ctx.close()
  return '403 khi gọi API + chỉ thấy form đăng nhập'
})

// ---------- 10. Admin UI: đăng nhập + dashboard ----------
await step('10', 'Đăng nhập admin thật -> dashboard có thống kê + ghi chú thanh toán mô phỏng', async () => {
  const ctx = await newCtx()
  const page = await openPage(ctx)
  await page.goto(`${BASE}/#/admin/login`, { waitUntil: 'networkidle' })
  await page.locator('.admin-login-card input[type="email"]').fill(ADMIN_EMAIL)
  await page.locator('.admin-login-card input[type="password"]').fill(ADMIN_PASSWORD)
  await page.locator('.admin-login-submit').click()
  await page.locator('.admin-shell').waitFor({ timeout: 8000 })
  await page.locator('.admin-stat').first().waitFor({ timeout: 8000 })
  const statCount = await page.locator('.admin-stat').count()
  assert(statCount >= 4, `Chỉ có ${statCount} thẻ thống kê (mong >= 4)`)
  const note = await page.locator('.admin-note').textContent()
  assert(note.includes('mô phỏng'), 'Dashboard thiếu ghi chú "thanh toán mô phỏng"')
  const navCount = await page.locator('.admin-nav button').count()
  assert(navCount === 8, `Sidebar cần 8 mục, có ${navCount}`)
  // Lưu context cho các bước UI sau
  globalThis.__adminCtx = ctx
  globalThis.__adminPage = page
  return `${statCount} thẻ thống kê; ${navCount} mục điều hướng`
})

// ---------- 11. Admin UI: CRUD khách sạn + lan sang catalog người dùng ----------
await step('11', 'Tạo/ngừng bán khách sạn qua UI -> catalog người dùng cập nhật ngay', async () => {
  const page = globalThis.__adminPage
  const ctx = globalThis.__adminCtx
  const QA_PREFIX = 'Khách sạn QA An Toàn'
  const qaName = `${QA_PREFIX} ${hex(3)}` // tên duy nhất cho lần chạy này

  // Dọn NGAY TỪ ĐẦU các bản ghi QA còn sót của lần chạy trước (nếu có)
  const preHotels = await (await ctx.request.get(`${BASE}/api/admin/hotels`)).json()
  const preLeft = preHotels.data.filter((h) => h.name.startsWith(QA_PREFIX))
  for (const h of preLeft) {
    await ctx.request.delete(`${BASE}/api/admin/hotels/${h.id}`, { headers: H })
  }

  await page.locator('.admin-nav button', { hasText: 'Khách sạn' }).click()
  await page.locator('.admin-toolbar button.primary', { hasText: 'Thêm khách sạn' }).click()
  await page.locator('.admin-modal').waitFor({ timeout: 5000 })

  // Validation phía client+server: bấm lưu khi thiếu dữ liệu -> báo lỗi, không đóng modal
  await page.locator('.admin-form-actions button.primary').click()
  await page.locator('.admin-login-error').waitFor({ timeout: 5000 })

  const field = (label) => page.locator('.admin-field', { hasText: label }).locator('input')
  await field('Tên khách sạn').fill(qaName)
  await field('Địa điểm').fill('Hà Nội')
  await field('Điểm đánh giá').fill('9.1')
  await field('Số sao').fill('4')
  await field('Giá / đêm').fill('1500000')
  await page.locator('.admin-form-actions button.primary').click()
  await page.locator('.admin-modal').waitFor({ state: 'detached', timeout: 8000 })

  // Tên duy nhất -> đúng 1 dòng; bản ghi mới xếp cuối theo thứ tự tạo
  const row = page.locator('.admin-table tbody tr', { hasText: qaName })
  await row.waitFor({ timeout: 8000 })

  // Catalog người dùng thấy ngay (cùng origin, không cần đăng nhập)
  const catAfterCreate = await page.evaluate(() => fetch('/api/catalog').then((r) => r.json()).then((d) => d.hotels))
  assert(catAfterCreate.some((h) => h.name === qaName), 'Catalog chưa có khách sạn vừa tạo')

  // Ngừng kinh doanh -> ẩn khỏi catalog (giữ bản ghi, không xóa cứng)
  await row.locator('.admin-toggle').click()
  await row.locator('.admin-toggle', { hasText: 'Ngừng bán' }).waitFor({ timeout: 8000 })
  const catAfterOff = await page.evaluate(() => fetch('/api/catalog').then((r) => r.json()).then((d) => d.hotels))
  assert(!catAfterOff.some((h) => h.name === qaName), 'Vẫn thấy khách sạn đã ngừng bán')

  // Dọn TẤT CẢ bản ghi QA (kể cả của lần chạy trước) -> catalog luôn về đúng 3 khách sạn gốc
  const hotels = await (await ctx.request.get(`${BASE}/api/admin/hotels`)).json()
  const leftovers = hotels.data.filter((h) => h.name.startsWith(QA_PREFIX))
  assert(leftovers.length >= 1, 'Không tìm thấy khách sạn QA để dọn')
  for (const h of leftovers) {
    const del = await ctx.request.delete(`${BASE}/api/admin/hotels/${h.id}`, { headers: H })
    assert(del.status() === 200, `DELETE ${h.id} lỗi: ${del.status()}`)
  }
  const catFinal = await page.evaluate(() => fetch('/api/catalog').then((r) => r.json()).then((d) => d.hotels))
  assert(catFinal.length === 3, `Catalog phải quay lại 3 khách sạn gốc, còn ${catFinal.length}`)
  return `validate 400 + tạo 201 + ngừng bán ẩn catalog + soft-delete (${leftovers.length} bản ghi QA)`
})

// ---------- 12. Admin UI: tìm đơn + chuyển trạng thái (theo đồ thị cho phép) ----------
await step('12', 'Admin tìm/sửa trạng thái đơn; chuyển trạng thái sai -> 409', async () => {
  const page = globalThis.__adminPage
  const ctx = globalThis.__adminCtx
  await page.locator('.admin-nav button', { hasText: 'Đơn đặt chỗ' }).click()
  await page.locator('.admin-table').waitFor({ timeout: 8000 })

  await page.locator('.admin-search').fill('Alice')
  await page.locator('.admin-toolbar button.primary', { hasText: 'Lọc' }).click()
  // Kết quả sort mới nhất lên đầu — đơn của run hiện tại (đã hủy ở bước6) đứng trước
  const row = page.locator('.admin-table tbody tr', { hasText: 'Alice A' }).first()
  await row.waitFor({ timeout: 8000 })

  // Đơn "Đã hủy" chỉ có 1 tùy chọn (không cho nhảy trạng thái lung tung)
  const options = await row.locator('select option').allTextContents()
  assert(options.length === 1 && options[0] === 'Đã hủy', `Đơn đã hủy phải khoá chọn, nhận: ${options.join('/')}`)

  // Tìm đơn "Đã xác nhận" khác để đổi trạng thái hợp lệ
  await page.locator('.admin-search').fill('')
  await page.locator('.admin-toolbar button.primary', { hasText: 'Lọc' }).click()
  const confirmedRow = page.locator('.admin-table tbody tr').filter({ has: page.locator('select', { hasText: 'Đã xác nhận' }) }).first()
  const hasConfirmed = await confirmedRow.count()
  let transitioned = false
  if (hasConfirmed > 0) {
    await confirmedRow.locator('select').selectOption('Đã hủy')
    await page.locator('.admin-notice').waitFor({ timeout: 8000 })
    transitioned = true
  }

  // API: cố nhảy trạng thái không hợp lệ (Đã hủy -> Đã tạo) -> 409
  const users = await (await ctx.request.get(`${BASE}/api/admin/users`)).json()
  const alice = users.data.find((u) => u.email === USER_A_EMAIL)
  const bookings = await (await ctx.request.get(`${BASE}/api/admin/bookings?q=Alice`)).json()
  const aliceBooking = bookings.data.items[0]
  assert(aliceBooking.status === 'Đã hủy', `Đơn Alice phải Đã hủy, nhận ${aliceBooking.status}`)
  const invalid = await ctx.request.patch(`${BASE}/api/admin/bookings/${aliceBooking.id}`, {
    headers: H, data: { status: 'Đã tạo' },
  })
  assert(invalid.status() === 409, `Chuyển Đã hủy -> Đã tạo phải 409, nhận ${invalid.status()}`)
  void alice
  return `tìm kiếm OK; chuyển trạng thái hợp lệ=${transitioned ? 'có' : 'bỏ qua (không có đơn phù hợp)'}; nhảy sai -> 409`
})

// ---------- 13. Khu vực admin KHÔNG trộn vào giao diện người dùng ----------
await step('13', 'Trang người dùng không có menu/điều hướng quản trị', async () => {
  const ctx = await newCtx()
  const page = await openPage(ctx)
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.hero').first().waitFor({ timeout: 8000 })
  const headerNav = await page.locator('.header .nav').textContent()
  assert(!headerNav.includes('Quản trị') && !headerNav.includes('Tổng quan'), 'Menu header có dấu hiệu admin: ' + headerNav)
  const navCount = await page.locator('.header .nav button').count()
  assert(navCount === 5, `Header cần đúng 5 mục người dùng, có ${navCount}`)
  const bottomCount = await page.locator('.mobile-bottom-nav button').count()
  assert(bottomCount === 5, `Bottom nav cần 5 mục, có ${bottomCount}`)
  await ctx.close()
  return 'header 5 mục + bottom 5 mục, không có mục quản trị'
})

// ---------- 14. Đăng nhập admin UI bằng tài khoản thường -> bị từ chối ----------
await step('14', 'Tài khoản thường đăng nhập ở /admin -> "không có quyền quản trị viên"', async () => {
  const ctx = await newCtx()
  const page = await openPage(ctx)
  await page.goto(`${BASE}/#/admin/login`, { waitUntil: 'networkidle' })
  await page.locator('.admin-login-card input[type="email"]').fill(USER_A_EMAIL)
  await page.locator('.admin-login-card input[type="password"]').fill(USER_PW)
  await page.locator('.admin-login-submit').click()
  await page.locator('.admin-login-error', { hasText: 'không có quyền quản trị viên' }).waitFor({ timeout: 8000 })
  const shell = await page.locator('.admin-shell').count()
  assert(shell === 0, 'Tài khoản thường vẫn vào được dashboard!')
  await ctx.close()
  return 'bị từ chối + không thấy dashboard'
})

// ---------- 16-20. P1-01: Không thể đặt paymentStatus='paid' thủ công ----------
await step('16', 'Admin KHÔNG thể đặt paymentStatus=paid qua API thường -> 403 + audit log', async () => {
  const ctx = globalThis.__adminCtx
  // Lấy một đơn bất kỳ để test
  const bookings = await (await ctx.request.get(`${BASE}/api/admin/bookings`)).json()
  const b = bookings.data.items[0]
  assert(b, 'Cần có ít nhất 1 đơn trong hệ thống')

  const res = await ctx.request.patch(`${BASE}/api/admin/bookings/${b.id}`, {
    headers: H, data: { paymentStatus: 'paid' },
  })
  assert(res.status() === 403, `Admin đặt paid thủ công phải 403, nhận ${res.status()}`)

  // Kiểm tra audit log đã ghi nhận việc từ chối
  const audit = await (await ctx.request.get(`${BASE}/api/admin/audit-log`)).json()
  const rejected = audit.data.some((e) => e.action === 'admin.booking.payment_paid_rejected')
  assert(rejected, 'Audit log phải ghi nhận admin cố đặt paid thủ công -> bị từ chối')
  return `Đơn ${b.id}: đặt paid thủ công -> 403, audit log ghi nhận`
})

await step('17', 'User thường KHÔNG thể thay đổi paymentStatus qua API admin -> 403', async () => {
  const ctx = await newCtx()
  const reg = await register(ctx, `sec-17${hex(4)}@mayan.test`, USER_PW)
  assert(reg.status === 201, `register lỗi: ${reg.status}`)

  // User thường gọi PATCH admin API cho bất kỳ đơn nào -> 403
  const res = await ctx.request.patch(`${BASE}/api/admin/bookings/1`, {
    headers: H, data: { paymentStatus: 'paid' },
  })
  assert(res.status() === 403, `User gọi PATCH admin phải 403, nhận ${res.status()}`)
  await ctx.close()
  return `User PATCH admin booking -> ${res.status()}`
})

await step('18', 'Admin thay đổi paymentStatus thủ công BỎ TRỐNG lý do -> 400', async () => {
  const ctx = globalThis.__adminCtx
  const bookings = await (await ctx.request.get(`${BASE}/api/admin/bookings`)).json()
  const b = bookings.data.items[0]

  const res = await ctx.request.patch(`${BASE}/api/admin/bookings/${b.id}`, {
    headers: H, data: { paymentStatus: 'pending' },
  })
  assert(res.status() === 400, `Thiếu lý do phải 400, nhận ${res.status()}`)
  return 'Thiếu lý do -> 400'
})

await step('19', 'Admin thay đổi paymentStatus thủ công CÓ lý do -> 200 + audit log', async () => {
  const ctx = globalThis.__adminCtx
  const bookings = await (await ctx.request.get(`${BASE}/api/admin/bookings`)).json()
  const b = bookings.data.items[0]
  const before = b.payment_status

  const res = await ctx.request.patch(`${BASE}/api/admin/bookings/${b.id}`, {
    headers: H,
    data: { paymentStatus: 'refunded', paymentReason: 'Lý do thử nghiệm P1-01: hoàn tiền do lỗi hệ thống.' },
  })
  assert(res.status() === 200, `Có lý do phải 200, nhận ${res.status()}`)

  const audit = await (await ctx.request.get(`${BASE}/api/admin/audit-log`)).json()
  const manual = audit.data.some((e) => e.action === 'admin.booking.payment_manual' && e.detail.includes('reason='))
  assert(manual, 'Audit log phải ghi nhận thay đổi thanh toán thủ công kèm lý do')

  // Khôi phục lại trạng thái cũ để không ảnh hưởng các test khác
  await ctx.request.patch(`${BASE}/api/admin/bookings/${b.id}`, {
    headers: H, data: { paymentStatus: before, paymentReason: 'Khôi phục trạng thái sau test P1-01.' },
  })
  return `Thay đổi thanh toán có lý do -> 200, audit log có reason`
})

await step('20', 'realRevenue KHÔNG tính đơn paid không có bằng chứng thanh toán', async () => {
  const ctx = globalThis.__adminCtx
  const stats = await (await ctx.request.get(`${BASE}/api/admin/stats`)).json()
  const { realRevenue, unverifiedPaidBookings } = stats.data
  // Số đơn paid không có bằng chứng phải = 0 (server đã chặn việc tạo)
  assert(Number(unverifiedPaidBookings) === 0, `Không được có đơn paid không bằng chứng, nhận ${unverifiedPaidBookings}`)
  return `realRevenue=${realRevenue}, unverifiedPaid=${unverifiedPaidBookings}`
})

// ---------- 15. Không có console error / pageerror trong lúc test admin ----------
await step('15', '0 console error + 0 pageerror trong toàn bộ suite; lưu ảnh chứng cứ', async () => {
  const realErrors = consoleErrors.filter((t) => !t.includes('Failed to load resource'))
  assert(realErrors.length === 0, `Console error: ${realErrors[0]}`)
  assert(pageErrors.length === 0, `Pageerror: ${pageErrors[0]}`)
  mkdirSync('qa-evidence', { recursive: true })
  const page = globalThis.__adminPage
  if (page) {
    await page.screenshot({ path: 'qa-evidence/admin-dashboard.png', fullPage: false })
  }
  await globalThis.__adminCtx?.close()
  return `console=${realErrors.length}, pageerror=${pageErrors.length}, ảnh qa-evidence/admin-dashboard.png`
})

/* ------------------------------------------------------------- tổng kết */
const passed = results.filter((r) => r.status === 'PASS').length
const failed = results.length - passed
console.log('\n=== KẾT QUẢ QA ADMIN ===')
for (const r of results) console.log(`${r.status} [${r.id}] ${r.title} -- ${r.detail}`)
console.log(`Tổng: ${results.length} | PASS: ${passed} | FAIL: ${failed}`)

writeFileSync('qa-evidence/admin-results.json', JSON.stringify({
  ranAt: new Date().toISOString(), total: results.length, passed, failed, results,
}, null, 2))

await browser.close()
// Dọn database tạm chỉ khi qa-admin tự tạo (không dùng DB_PATH từ runner).
if (!process.env.DB_PATH) {
  for (const s of ['', '-wal', '-shm']) fs.rmSync(ADMIN_DB_PATH + s, { force: true })
}
process.exit(failed > 0 ? 1 : 0)




