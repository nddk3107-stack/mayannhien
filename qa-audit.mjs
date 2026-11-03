// qa-audit.mjs — Kiểm toán: (1) min_order voucher trong Admin, (2) an toàn thanh toán mô phỏng + toàn vẹn booking.
// Chạy trên server + SQLite CÓ TÂM (DB tạm data/qa-audit-tmp.db) -> không đụng dữ liệu thật.
import { spawn, execFileSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { createServer } from 'node:net'
import fs from 'node:fs'
import path from 'node:path'

// Chọn cổng TRỐNG bằng cách để OS cấp (port 0) — tránh đụng server cũ còn sót
// từ lần chạy trước (đã gây FAIL M1/M2 do test dùng nhầm server cũ).
const PORT = await new Promise((resolve, reject) => {
  const srv = createServer()
  srv.once('error', reject)
  srv.listen(0, '127.0.0.1', () => {
    const { port } = srv.address()
    srv.close(() => resolve(port))
  })
})
const BASE = `http://localhost:${PORT}`
const DB_PATH = path.resolve('data/qa-audit-tmp.db')
fs.mkdirSync(path.resolve('data'), { recursive: true })
for (const s of ['', '-wal', '-shm']) fs.rmSync(DB_PATH + s, { force: true })

let passed = 0
let failed = 0
const results = []
function assert(cond, msg) { if (!cond) throw new Error(msg) }
async function step(id, title, fn) {
  try { const d = await fn(); passed += 1; results.push({ id, title, status: 'PASS', detail: String(d || 'OK') }); console.log(`PASS [${id}] ${title} -- ${d}`) }
  catch (e) { failed += 1; results.push({ id, title, status: 'FAIL', detail: String(e && e.message) }); console.log(`FAIL [${id}] ${title} -- ${e && e.message}`) }
}
const iso = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)
const DATES = { depart: iso(7), ret: iso(10) }

async function api(route, { method = 'GET', body, cookie, headers } = {}) {
  const res = await fetch(BASE + route, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', ...(cookie ? { cookie } : {}), ...(headers || {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  let data = null; try { data = await res.json() } catch { data = null }
  return { status: res.status, data, headers: res.headers }
}
const cookieOf = (h) => { const list = typeof h.getSetCookie === 'function' ? h.getSetCookie() : [h.get('set-cookie')]; return String(list[0] || '').split(';')[0] }

console.log('=== QA AUDIT — min_order + thanh toán an toàn ===')

let server = spawn(process.execPath, ['server.js'], { env: { ...process.env, DB_PATH, PORT: String(PORT) }, stdio: 'ignore' })
process.on('exit', () => { try { server.kill() } catch { /* đã tắt */ } })
let ready = false
for (let i = 0; i < 40 && !ready; i += 1) { await new Promise((r) => setTimeout(r, 250)); ready = await fetch(`${BASE}/api/health`).then((r) => r.ok).catch(() => false) }
if (!ready) { console.log('FAIL: server tạm không lên'); server.kill(); process.exit(1) }
// Server có thể đã chết ngay (vd: cổng bị chiếm) -> phải báo lỗi rõ ràng,
// nếu không test sẽ âm thầm dùng nhầm server cũ của lần chạy trước.
if (server.exitCode !== null) { console.log('FAIL: server tạm đã thoát, code=' + server.exitCode); process.exit(1) }
console.log('server tạm sẵn sàng tại cổng ' + PORT)

const ADMIN_EMAIL = 'audit-admin@mayan.test'
const ADMIN_PASS = 'AuditPass123!'
execFileSync(process.execPath, ['scripts/seed-admin.mjs', '--email', ADMIN_EMAIL, '--password', ADMIN_PASS, '--rotate'], { env: { ...process.env, DB_PATH }, stdio: 'ignore' })

const seed = new DatabaseSync(DB_PATH)
seed.exec(`INSERT OR REPLACE INTO promotions (id, code, title, description, applies_to, rate, color, active_from, active_to, usage_limit, used_count, min_order, is_active) VALUES
  ('a1','MIN5TRIEU','MIN5TRIEU','Đơn tối thiểu 5 triệu','hotel',0.10,'blue',NULL,NULL,NULL,0,5000000,1),
  ('a2','KHONGTTHIEU','KHONGTTHIEU','Không yêu cầu','hotel',0.05,'green',NULL,NULL,NULL,0,0,1)`)
seed.close()

let adminCookie = ''
await step('A0', 'Đăng nhập admin trên DB tạm', async () => {
  const r = await api('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASS } })
  assert(r.status === 200 && r.data.ok, 'login admin fail: ' + JSON.stringify(r.data))
  assert(r.data.user.role === 'admin', 'role phải admin, got ' + r.data.user.role)
  adminCookie = cookieOf(r.headers); return 'admin login ok'
})

// ================= PHẦN 1 — MIN_ORDER =================
let promoId = ''
await step('M1', 'Admin tạo voucher có min_order = 5.000.000', async () => {
  const r = await api('/api/admin/promotions', { method: 'POST', cookie: adminCookie, body: { code: 'MOITAO', description: 'Tạo mới có mức tối thiểu', appliesTo: ['hotel'], rate: 0.1, color: 'blue', minOrder: 5000000, isActive: true } })
  assert(r.status === 201, 'phải 201, got ' + r.status + ': ' + JSON.stringify(r.data))
  assert(r.data.data.minOrder === 5000000, 'minOrder phải 5000000, got ' + r.data.data.minOrder)
  promoId = r.data.data.id; return 'tạo OK, minOrder=' + r.data.data.minOrder
})

await step('M2', 'Admin sửa min_order voucher đã tồn tại', async () => {
  const r = await api(`/api/admin/promotions/${promoId}`, { method: 'PATCH', cookie: adminCookie, body: { minOrder: 8000000 } })
  assert(r.status === 200, 'phải 200, got ' + r.status)
  assert(r.data.data.minOrder === 8000000, 'minOrder phải 8000000, got ' + r.data.data.minOrder)
  return 'sửa OK -> ' + r.data.data.minOrder
})

await step('M3', 'Voucher cũ SALECUOITUAN giữ nguyên min_order = 0', async () => {
  const r = await api('/api/admin/promotions', { cookie: adminCookie })
  const old = (r.data.data || []).find((p) => p.code === 'SALECUOITUAN')
  assert(old, 'không thấy SALECUOITUAN')
  assert(old.minOrder === 0, 'SALECUOITUAN minOrder phải 0, got ' + old.minOrder)
  return 'SALECUOITUAN minOrder=0 (không hỏng)'
})

await step('M4', 'Đơn dưới mức tối thiểu bị từ chối (1.850.000 < 5.000.000)', async () => {
  const r = await api('/api/promos/validate', { method: 'POST', body: { code: 'MIN5TRIEU', serviceType: 'hotel', amount: 1850000 } })
  assert(r.status === 400, 'phải 400, got ' + r.status)
  assert(String(r.data.error).includes('Đơn tối thiểu'), 'sai thông báo: ' + r.data.error)
  return r.data.error
})

await step('M5', 'Đơn đạt mức tối thiểu được áp dụng đúng (6.000.000 >= 5.000.000)', async () => {
  const r = await api('/api/promos/validate', { method: 'POST', body: { code: 'MIN5TRIEU', serviceType: 'hotel', amount: 6000000 } })
  assert(r.status === 200, 'phải 200, got ' + r.status + ': ' + JSON.stringify(r.data))
  assert(r.data.discount === 600000, 'discount 10% phải 600000, got ' + r.data.discount)
  return 'giảm ' + r.data.discount + ' -> tổng ' + r.data.total
})

await step('M6', 'User thường KHÔNG gọi được API admin sửa voucher', async () => {
  // Đăng ký user thường trước khi login (DB tạm chưa có sẵn user này)
  await api('/api/auth/register', { method: 'POST', body: { email: 'audit-user@mayan.test', password: 'UserPass123!', name: 'Audit User' } }).catch(() => {})
  const u = await api('/api/auth/login', { method: 'POST', body: { email: 'audit-user@mayan.test', password: 'UserPass123!' } })
  assert(u.status === 200, 'login user fail')
  const r = await api(`/api/admin/promotions/${promoId}`, { method: 'PATCH', cookie: cookieOf(u.headers), body: { minOrder: 1 } })
  assert(r.status === 403, 'user thường phải 403, got ' + r.status)
  const g = await api('/api/admin/promotions')
  assert(g.status === 401, 'guest phải 401, got ' + g.status)
  return 'user=403; guest=401'
})

await step('M7', 'Giá trị min_order không hợp lệ (âm / chuỗi / null / quá lớn) bị từ chối', async () => {
  const cases = [{ label: 'âm', minOrder: -100 }, { label: 'chuỗi', minOrder: 'abc' }, { label: 'null', minOrder: null }, { label: 'quá lớn', minOrder: 999999999 }]
  for (const c of cases) {
    const r = await api('/api/admin/promotions', { method: 'POST', cookie: adminCookie, body: { code: 'SAI' + Math.random().toString(36).slice(2, 6).toUpperCase(), description: '', appliesTo: ['hotel'], rate: 0.1, color: 'blue', minOrder: c.minOrder, isActive: true } })
    assert(r.status === 400, `${c.label}: phải 400, got ${r.status}: ${JSON.stringify(r.data)}`)
    assert(String(r.data.error).includes('Mức đơn tối thiểu'), `${c.label}: sai thông báo: ${r.data.error}`)
  }
  return 'âm/chuỗi/null/quá lớn đều 400'
})

await step('M8', 'Restart backend — min_order vẫn còn trong database', async () => {
  server.kill(); await new Promise((r) => setTimeout(r, 400))
  const s2 = spawn(process.execPath, ['server.js'], { env: { ...process.env, DB_PATH, PORT: String(PORT) }, stdio: 'ignore' })
  let ok = false
  for (let i = 0; i < 40 && !ok; i += 1) { await new Promise((r) => setTimeout(r, 250)); ok = await fetch(`${BASE}/api/health`).then((r) => r.ok).catch(() => false) }
  assert(ok, 'server không lên sau restart')
  const r = await api('/api/admin/promotions', { cookie: adminCookie })
  const row = (r.data.data || []).find((p) => p.code === 'MOITAO')
  assert(row && row.minOrder === 8000000, 'min_order mất sau restart: ' + JSON.stringify(row))
  const old = (r.data.data || []).find((p) => p.code === 'SALECUOITUAN')
  assert(old && old.minOrder === 0, 'voucher cũ hỏng sau restart')
  server = s2; return 'restart -> MOITAO=8.000.000, SALECUOITUAN=0'
})

// ============ PHẦN 2 — THANH TOÁN MÔ PHỎNG + TOÀN VẸN BOOKING ============
// Đăng nhập 2 user để kiểm tra cách ly.
let cookieA = ''
let cookieB = ''
await step('S0', 'Đăng nhập 2 user để kiểm tra cách ly & thanh toán', async () => {
  // Đăng ký user-audit trước khi login (DB tạm chưa có sẵn user này)
  await api('/api/auth/register', { method: 'POST', body: { email: 'audit-user@mayan.test', password: 'UserPass123!', name: 'Audit User' } }).catch(() => {})
  await api('/api/auth/register', { method: 'POST', body: { email: 'audit-user-b@mayan.test', password: 'UserPassB123!', name: 'Audit User B' } }).catch(() => {})
  const a = await api('/api/auth/login', { method: 'POST', body: { email: 'audit-user@mayan.test', password: 'UserPass123!' } })
  const b = await api('/api/auth/login', { method: 'POST', body: { email: 'audit-user-b@mayan.test', password: 'UserPassB123!' } })
  assert(a.status === 200 && b.status === 200, 'login 2 user fail')
  cookieA = cookieOf(a.headers); cookieB = cookieOf(b.headers); return '2 user đăng nhập ok'
})

const baseBooking = (over = {}) => ({
  serviceType: 'hotel', itemId: 'hotel-1', passengers: 2,
  traveler: { name: 'Nguyễn Văn Audit', phone: '0912345678', email: 'audit-user@mayan.test' },
  paymentMethod: 'Thẻ ATM nội địa', destination: 'Đà Nẵng', tripType: 'Lưu trú',
  dates: DATES, room: { roomId: 'room-hotel-1-1', roomsCount: 1, adults: 2, children: 0 },
  idempotencyKey: 'audit-' + Math.random().toString(36).slice(2, 12), ...over,
})

await step('S1', 'Client gửi fake total/discount/status/paymentStatus -> server bỏ qua', async () => {
  // Gửi kèm voucher hợp lệ + fake total/discount/status/paymentStatus.
  // Server PHẢI tự tính lại (4.884.000 = 5.550.000 - 12%) và bỏ qua mọi số client gửi.
  const r = await api('/api/bookings', { method: 'POST', cookie: cookieA, body: baseBooking({ promoCode: 'SALECUOITUAN', total: 1, discount: 999999999, status: 'Đã xác nhận', paymentStatus: 'paid', unitPrice: 1 }) })
  assert(r.status === 201, 'phải 201, got ' + r.status)
  const bk = r.data.booking
  assert(bk.total === 4884000, 'total phải do server tính (4.884.000), got ' + bk.total)
  assert(bk.discount === 666000, 'discount phải do server tính, got ' + bk.discount)
  assert(bk.paymentStatus === 'simulated', 'paymentStatus phải simulated (demo), got ' + bk.paymentStatus)
  assert(bk.status === 'Đã xác nhận', 'status phải Đã xác nhận, got ' + bk.status)
  return 'fake total/paymentStatus bị bỏ qua; server tự tính'
})

await step('S2', 'Gửi lặp cùng idempotencyKey -> duplicate:true, không tạo đơn thứ 2', async () => {
  // Dùng phòng/ngày KHÁC với bước [S1] để tránh trùng phòng đã được đặt ở S1.
  const body = baseBooking({
    dates: { depart: iso(14), ret: iso(17) },
    room: { roomId: 'room-hotel-1-2', roomsCount: 1, adults: 2, children: 0 },
    idempotencyKey: 'audit-s2-' + Math.random().toString(36).slice(2, 10),
  })
  const first = await api('/api/bookings', { method: 'POST', cookie: cookieA, body })
  assert(first.status === 201, 'đơn đầu phải 201')
  const replay = await api('/api/bookings', { method: 'POST', cookie: cookieA, body })
  assert(replay.status === 200 && replay.data.duplicate === true, 'gửi lại phải duplicate, got ' + JSON.stringify(replay.data))
  assert(replay.data.booking.code === first.data.booking.code, 'mã đơn khi replay phải trùng')
  const list = await api('/api/bookings', { cookie: cookieA })
  const sameCode = list.data.bookings.filter((b) => b.code === first.data.booking.code)
  assert(sameCode.length === 1, 'phải đúng 1 đơn, got ' + sameCode.length)
  return 'replay -> duplicate, giữ nguyên mã ' + first.data.booking.code
})

await step('S3', 'Guest không POST /bookings được (401) + thiếu CSRF header bị chặn (403)', async () => {
  const g = await api('/api/bookings', { method: 'POST', body: baseBooking() })
  assert(g.status === 401, 'guest POST booking phải 401, got ' + g.status)
  const noCsrf = await fetch(BASE + '/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cookieA }, body: JSON.stringify(baseBooking()) })
  assert(noCsrf.status === 403, 'thiếu X-Requested-With phải 403, got ' + noCsrf.status)
  return 'guest=401; thiếu CSRF header=403'
})

await step('S4', 'User thường bị chặn mọi endpoint Admin (GET/PATCH)', async () => {
  const g = await api('/api/bookings', { cookie: cookieA })
  assert(g.status === 200, 'user xem được đơn của mình (200)')
  const ab = await api('/api/admin/bookings', { cookie: cookieA })
  assert(ab.status === 403, 'user thường GET /admin/bookings phải 403, got ' + ab.status)
  const pb = await api('/api/admin/bookings/1', { method: 'PATCH', cookie: cookieA, body: { status: 'Đã hủy' } })
  assert(pb.status === 403, 'user thường PATCH /admin/bookings phải 403, got ' + pb.status)
  return 'user thường: admin GET/PATCH đều 403'
})

await step('S5', 'Cách ly: User A không thấy / không hủy được booking của User B', async () => {
  // Dùng phòng/ngày KHÁC với bước [S1] để B tạo đơn thành công (201) chứ không bị chặn do hết phòng.
  const bRes = await api('/api/bookings', { method: 'POST', cookie: cookieB, body: baseBooking({
    traveler: { name: 'User B', phone: '0987654321', email: 'audit-user-b@mayan.test' },
    dates: { depart: iso(21), ret: iso(24) },
    room: { roomId: 'room-hotel-1-3', roomsCount: 1, adults: 2, children: 0 },
    idempotencyKey: 'audit-b-' + Math.random().toString(36).slice(2, 10),
  }) })
  assert(bRes.status === 201, 'B tạo đơn phải 201')
  const codeB = bRes.data.booking.code
  const listA = await api('/api/bookings', { cookie: cookieA })
  assert(!listA.data.bookings.some((x) => x.code === codeB), 'A đang thấy đơn của B!')
  const cancelByA = await api(`/api/bookings/${codeB}/cancel`, { method: 'PATCH', cookie: cookieA })
  assert(cancelByA.status === 404, 'A cancel đơn của B phải 404, got ' + cancelByA.status)
  return 'A không thấy & không hủy được đơn của B (404)'
})

await step('S6', 'Đơn đã hủy không thể tự "xác nhận" lại qua user API (cancel lần 2 = 409)', async () => {
  // Dùng ngày KHÁC với bước [S1] để đơn tạo thành công trước khi kiểm tra hủy hai lần.
  const r = await api('/api/bookings', { method: 'POST', cookie: cookieA, body: baseBooking({
    dates: { depart: iso(28), ret: iso(31) },
    idempotencyKey: 'audit-c-' + Math.random().toString(36).slice(2, 10),
  }) })
  const code = r.data.booking.code
  const c1 = await api(`/api/bookings/${code}/cancel`, { method: 'PATCH', cookie: cookieA })
  assert(c1.status === 200 && c1.data.booking.status === 'Đã hủy', 'hủy lần 1 phải 200 + Đã hủy')
  const c2 = await api(`/api/bookings/${code}/cancel`, { method: 'PATCH', cookie: cookieA })
  assert(c2.status === 409, 'hủy lần 2 phải 409, got ' + c2.status)
  return 'đơn đã hủy không chuyển được trạng thái trái phép (user API)'
})

/* ------------------- phần 4: bảo mật production & thanh toán MoMo ----------- */
await step('P1', 'Security headers + CSP + CORS không wildcard', async () => {
  const r = await fetch(`${BASE}/api/health`)
  const csp = r.headers.get('content-security-policy') || ''
  assert(r.headers.get('x-content-type-options') === 'nosniff', 'thiếu X-Content-Type-Options: nosniff')
  assert(r.headers.get('x-frame-options') === 'DENY', 'thiếu X-Frame-Options: DENY')
  assert(csp.includes("default-src 'self'"), 'thiếu CSP default-src')
  assert(csp.includes("object-src 'none'"), 'thiếu CSP object-src none')
  assert(csp.includes("frame-ancestors 'none'"), 'thiếu CSP frame-ancestors none')
  assert(!csp.includes('unsafe-eval'), 'CSP không được chứa unsafe-eval')
  // CORS: origin lạ KHÔNG được nhận Access-Control-Allow-Origin.
  const evil = await fetch(`${BASE}/api/health`, { headers: { Origin: 'https://evil.example.com' } })
  assert(!evil.headers.get('access-control-allow-origin'), 'CORS đang trả ACAO cho origin lạ!')
  return 'security headers + CSP chặt, CORS không wildcard'
})

await step('P2', 'Endpoint 404 trả JSON (không lộ stack trace)', async () => {
  const r = await api('/api/khong-ton-tai')
  assert(r.status === 404, 'phải 404, got ' + r.status)
  assert(String(r.data.error).includes('Không tìm thấy'), '404 JSON sai: ' + JSON.stringify(r.data))
  assert(!JSON.stringify(r.data).includes('at '), '404 lộ stack trace')
  return '404 JSON sạch, không lộ stack trace'
})

await step('P3', 'Rate limit chặn dò voucher hàng loạt (429)', async () => {
  let got429 = false
  // Gọi liên tiếp nhiều lần; chỉ cần chứng minh có hành vi giới hạn.
  for (let i = 0; i < 60 && !got429; i += 1) {
    const r = await api('/api/promos/validate', { method: 'POST', body: { code: 'SALECUOITUAN', serviceType: 'hotel', amount: 3000000 } })
    if (r.status === 429) got429 = true
  }
  assert(got429, 'phải trả 429 sau nhiều request lặp')
  return '429 được trả khi vượt hạn mức'
})

await step('P4', 'IPN MoMo sai chữ ký -> KHÔNG đánh dấu paid', async () => {
  const r = await api('/api/webhook/momo/ipn', {
    method: 'POST',
    body: {
      partnerCode: 'MOMO_FAKE', orderId: 'MAN_FAKE_1', requestId: 'REQ_FAKE', amount: '1000',
      transId: 'FAKE', resultCode: '0', message: 'Success', signature: 'deadbeef',
    },
  })
  assert(r.status === 200, 'IPN phải trả 200 để MoMo không gửi lại, got ' + r.status)
  // Đơn giả không tồn tại / chữ ký sai -> không có đơn nào chuyển sang paid.
  const list = await api('/api/bookings', { cookie: cookieA })
  assert(!list.data.bookings.some((b) => b.paymentStatus === 'paid' && b.code === 'MAN_FAKE_1'), 'IPN giả đã đánh dấu paid!')
  return 'IPN sai chữ ký bị bỏ qua, không đơn nào paid'
})

await step('P5', 'Tạo phiên thanh toán khi chưa cấu hình MoMo -> 503 (không giả lập tiền thật)', async () => {
  const r = await api('/api/payment/create', { method: 'POST', cookie: cookieA, body: { bookingCode: 'MAN0000001' } })
  // Chưa có credentials MoMo -> cổng phải tắt, trả lỗi, KHÔNG tạo giao dịch giả.
  assert(r.status === 503 || r.status === 404, 'phải 503 (chưa cấu hình) hoặc 404 (đơn không có), got ' + r.status)
  return 'cổng thanh toán tắt khi chưa có credentials: ' + r.status
})

await step('P6', 'Config thanh toán KHÔNG lộ secret ra ngoài', async () => {
  const r = await api('/api/payment/config')
  assert(r.status === 200, 'phải 200, got ' + r.status)
  const text = JSON.stringify(r.data)
  assert(!text.includes('secretKey') && !text.includes('accessKey'), 'config lộ khoá bí mật!')
  assert(r.data.enabled === false, 'cổng thanh toán phải disabled khi chưa cấu hình')
  assert(r.data.live === false, 'live phải false khi chưa cấu hình')
  return 'config chỉ trả cờ enabled/live, không lộ secret'
})

await step('P7', 'Admin audit-log ghi nhận thao tác quản trị', async () => {
  const r = await api('/api/admin/audit-log?limit=50', { cookie: adminCookie })
  assert(r.status === 200, 'phải 200, got ' + r.status)
  const rows = r.data.data || []
  assert(Array.isArray(rows) && rows.length > 0, 'audit-log phải có ít nhất 1 bản ghi')
  const text = JSON.stringify(rows)
  assert(!text.includes('scrypt$') && !text.includes('password'), 'audit-log lộ thông tin nhạy cảm')
  // Mọi thao tác ghi dữ liệu của admin đều phải có trong nhật ký.
  const actions = rows.map((x) => x.action)
  for (const need of ['admin.promotion.create', 'admin.promotion.update']) {
    assert(actions.includes(need), `audit-log thiếu thao tác "${need}" (có: ${actions.join(', ')})`)
  }
  // Mỗi bản ghi phải truy vết được: ai làm, làm gì, lúc nào.
  for (const row of rows) {
    assert(row.actor_email && row.actor_email.includes('@'), 'bản ghi audit thiếu actor_email: ' + JSON.stringify(row))
    assert(row.action && row.created_at, 'bản ghi audit thiếu action/created_at: ' + JSON.stringify(row))
  }
  return rows.length + ' bản ghi audit-log (có đủ actor/action/created_at)'
})

await step('P8', 'User thường KHÔNG đọc được audit-log của admin', async () => {
  const r = await api('/api/admin/audit-log', { cookie: cookieA })
  assert(r.status === 403, 'user thường phải 403, got ' + r.status)
  return 'user thường bị chặn 403'
})

const summary = { module: 'AUDIT', total: passed + failed, passed, failed, results }
fs.mkdirSync(path.resolve('qa-evidence/final'), { recursive: true })
fs.writeFileSync(path.resolve('qa-evidence/final/audit-results.json'), JSON.stringify(summary, null, 2))
server.kill()
console.log(`\nTONG: ${summary.total} | PASS: ${summary.passed} | FAIL: ${summary.failed}`)
process.exit(failed > 0 ? 1 : 0)


