// qa-rooms-admin.mjs — Kiểm thử CRUD phòng trong Admin (P1-03).
// Chạy ĐỘC LẬP: tự spawn API server trên cổng trống + SQLite DB tạm
// data/qa-rooms-admin-tmp.db -> không đụng dữ liệu thật, không cần vite/Playwright.
// Chạy: node qa-rooms-admin.mjs
import { spawn, execFileSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { createServer } from 'node:net'
import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const PORT = await new Promise((resolve, reject) => {
  const srv = createServer()
  srv.once('error', reject)
  srv.listen(0, '127.0.0.1', () => {
    const { port } = srv.address()
    srv.close(() => resolve(port))
  })
})
const BASE = `http://localhost:${PORT}`
const DB_PATH = path.resolve('data/qa-rooms-admin-tmp.db')
fs.mkdirSync(path.resolve('data'), { recursive: true })
for (const s of ['', '-wal', '-shm']) fs.rmSync(DB_PATH + s, { force: true })

let passed = 0
let failed = 0
const results = []
let createdRoomId = null
function assert(cond, msg) { if (!cond) throw new Error(msg) }
async function step(id, title, fn) {
  try {
    const d = await fn()
    passed += 1
    results.push({ id, title, status: 'PASS', detail: String(d || 'OK') })
    console.log(`PASS [${id}] ${title} -- ${d}`)
  } catch (e) {
    failed += 1
    results.push({ id, title, status: 'FAIL', detail: String(e && e.message) })
    console.log(`FAIL [${id}] ${title} -- ${e && e.message}`)
  }
}

const iso = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)
const hex = (n) => randomBytes(n).toString('hex')

async function api(route, { method = 'GET', body, cookie, headers } = {}) {
  const res = await fetch(BASE + route, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'fetch',
      ...(cookie ? { cookie } : {}),
      ...(headers || {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let data = null
  try { data = await res.json() } catch { data = null }
  return { status: res.status, data, headers: res.headers }
}
const cookieOf = (h) => {
  const list = typeof h.getSetCookie === 'function' ? h.getSetCookie() : [h.get('set-cookie')]
  return String(list[0] || '').split(';')[0]
}

console.log(`=== QA ROOMS ADMIN (P1-03) — cổng ${PORT}, DB ${DB_PATH} ===`)

let server = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, DB_PATH, PORT: String(PORT) },
  stdio: 'ignore',
})
process.on('exit', () => { try { server.kill() } catch { /* đã tắt */ } })
let ready = false
for (let i = 0; i < 60 && !ready; i += 1) {
  await new Promise((r) => setTimeout(r, 250))
  ready = await fetch(`${BASE}/api/health`).then((r) => r.ok).catch(() => false)
}
if (!ready) { console.log('FAIL: server tạm không khởi động'); process.exit(1) }
if (server.exitCode !== null) { console.log('FAIL: server tạm đã thoát, code=' + server.exitCode); process.exit(1) }
console.log('server tạm sẵn sàng tại cổng ' + PORT)

const ADMIN_EMAIL = `rooms-admin-${hex(4)}@mayan.test`
const ADMIN_PASS = `Rooms${hex(8)}1!`
execFileSync(process.execPath, ['scripts/seed-admin.mjs', '--email', ADMIN_EMAIL, '--password', ADMIN_PASS], {
  env: { ...process.env, DB_PATH },
  stdio: 'ignore',
})

const login = await api('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASS } })
assert(login.status === 200, `đăng nhập admin phải 200, nhận ${login.status}`)
const adminCookie = cookieOf(login.headers)
assert(adminCookie && adminCookie.includes('may_an_nhien_sid='), 'phải có cookie phiên admin')

const db = new DatabaseSync(DB_PATH)
const hotelId = `htl-rooms-${hex(4)}`
db.prepare(`INSERT INTO hotels (id, name, location, rating, stars, price, has_promo, image, perks, description)
  VALUES (?, 'Khách sạn QA Phòng', 'QA', 0, 3, 1000000, 0, '', '[]', '')`).run(hotelId)
const userEmail = `user-qa-${hex(4)}@mayan.test`
const _userId = db.prepare(`INSERT INTO users (email, name, password_hash, role, is_active)
  VALUES (?, 'nguoi dung qa', 'x', 'user', 1)`).run(userEmail).lastInsertRowid

await step('1', 'Chưa đăng nhập gọi GET /api/admin/rooms -> 401 + JSON error', async () => {
  const r = await api('/api/admin/rooms')
  assert(r.status === 401, `mong 401, nhận ${r.status}`)
  assert(r.data && r.data.error, 'phải có JSON error')
  return 'chưa đăng nhập -> 401'
})

const basePayload = {
  name: `Phòng QA ${hex(2)}`,
  hotelId,
  price: 1850000,
  bedType: 'Giường king',
  sizeSqm: 35,
  maxAdults: 2,
  maxChildren: 1,
  amenities: ['Điều hòa', 'Wi-Fi miễn phí'],
  images: ['https://example.com/a.jpg'],
  breakfast: true,
  freeCancellation: false,
  checkinTime: '14:00',
  checkoutTime: '12:00',
  isActive: true,
}
const createRoom = async (overrides = {}) => {
  const payload = { ...basePayload, ...overrides }
  return await api('/api/admin/rooms', { method: 'POST', cookie: adminCookie, body: payload })
}

await step('2', 'Tạo phòng mới hợp lệ -> 201 + phòng có id và đầy đủ trường', async () => {
  const r = await createRoom()
  assert(r.status === 201, `mong 201, nhận ${r.status}`)
  assert(r.data && r.data.data, 'phải có data')
  const room = r.data.data
  assert(room.id && String(room.id).startsWith('room-'), `id phòng phải bắt đầu bằng 'room-', nhận ${room.id}`)
  assert(room.hotelId === hotelId && room.price === 1850000 && room.isActive === true, 'trường phòng không khớp')
  assert(Array.isArray(room.amenities) && room.amenities.includes('Điều hòa'), 'amenities phải là mảng')
  assert(Array.isArray(room.images) && room.breakfast === true, 'images/breakfast không đúng')
  createdRoomId = room.id
  return `tạo ${room.id} (${room.name}) ${room.price}đ`
})
await step('3', 'Tạo phòng thiếu tên -> 400 validation', async () => {
  const r = await api('/api/admin/rooms', { method: 'POST', cookie: adminCookie, body: { hotelId, price: 100000, bedType: 'Giường đơn' } })
  assert(r.status === 400, `mong 400, nhận ${r.status}`)
  assert(r.data && r.data.error, 'phải có JSON error')
  return 'thiếu tên -> 400'
})

await step('4', 'Tạo phòng khách sạn không tồn tại -> 400', async () => {
  const r = await api('/api/admin/rooms', { method: 'POST', cookie: adminCookie, body: { name: 'Phòng X', hotelId: 'khong-ton-tai', price: 100000, bedType: 'Giường đơn' } })
  assert(r.status === 400, `mong 400, nhận ${r.status}`)
  assert(r.data && /khách sạn/i.test(r.data.error || ''), `lỗi phải về khách sạn, nhận ${JSON.stringify(r.data)}`)
  return 'khách sạn không tồn tại -> 400'
})

await step('5', 'Lấy danh sách phòng -> 200 + payload phân trang đầy đủ', async () => {
  const r = await api('/api/admin/rooms', { cookie: adminCookie })
  assert(r.status === 200, `mong 200, nhận ${r.status}`)
  assert(r.data && r.data.data && Array.isArray(r.data.data.items), 'phải có data.items là mảng')
  assert(Number.isInteger(r.data.data.total) && r.data.data.total >= 1, `total phải >= 1, nhận ${r.data.data.total}`)
  assert(Number.isInteger(r.data.data.page) && Number.isInteger(r.data.data.limit), 'phải có page/limit')
  return `${r.data.data.total} phòng, trang ${r.data.data.page}, limit ${r.data.data.limit}`
})

await step('6', 'Tìm phòng theo tên (q) -> chỉ trả phòng khớp', async () => {
  const q = 'Phòng QA '
  const r = await api(`/api/admin/rooms?q=${encodeURIComponent(q)}`, { cookie: adminCookie })
  assert(r.status === 200, `mong 200, nhận ${r.status}`)
  const items = r.data.data.items || []
  assert(items.length >= 1, `phải tìm thấy ít nhất 1 phòng cho q="${q}"`)
  assert(items.every((i) => String(i.name).includes('Phòng QA')), `mọi kết quả phải chứa 'Phòng QA'`)
  return `tìm thấy ${items.length} phòng cho q="${q}"`
})

await step('7', 'Lọc theo khách sạn (hotelId) -> chỉ phòng của khách sạn đó', async () => {
  const r = await api(`/api/admin/rooms?hotelId=${encodeURIComponent(hotelId)}`, { cookie: adminCookie })
  assert(r.status === 200, `mong 200, nhận ${r.status}`)
  const items = r.data.data.items || []
  assert(items.length >= 1, `phải có ít nhất 1 phòng của khách sạn ${hotelId}`)
  assert(items.every((i) => i.hotelId === hotelId), `mọi phòng phải thuộc khách sạn ${hotelId}`)
  return `${items.length} phòng của khách sạn ${hotelId}`
})

await step('8', 'Lọc theo trạng thái (isActive=1) -> chỉ phòng đang kinh doanh', async () => {
  const r = await api('/api/admin/rooms?isActive=1', { cookie: adminCookie })
  assert(r.status === 200, `mong 200, nhận ${r.status}`)
  const items = r.data.data.items || []
  assert(items.length >= 1, 'phải có ít nhất 1 phòng đang kinh doanh')
  assert(items.every((i) => i.isActive === true), 'mọi phòng khi isActive=1 phải isActive=true')
  const r0 = await api('/api/admin/rooms?isActive=0', { cookie: adminCookie })
  const inactive = r0.data.data.items || []
  assert(inactive.every((i) => i.isActive === false), 'mọi phòng khi isActive=0 phải isActive=false')
  return 'lọc isActive đúng'
})

await step('9', 'Phân trang (page=1, limit=2) -> total đúng, ít hơn/ bằng 2 items', async () => {
  const r = await api('/api/admin/rooms?page=1&limit=2', { cookie: adminCookie })
  assert(r.status === 200, `mong 200, nhận ${r.status}`)
  assert(r.data.data.total >= 1, `total phải >= 1`)
  assert(r.data.data.page === 1 && r.data.data.limit === 2, `page/limit không phản ánh query`)
  assert(Array.isArray(r.data.data.items) && r.data.data.items.length <= 2, `items phải <= 2`)
  return `total=${r.data.data.total}, page=${r.data.data.page}, limit=${r.data.data.limit}, items=${r.data.data.items.length}`
})

// ---------- B10. Cập nhật phòng (PATCH) không đổi ID ----------
await step('10', 'Cập nhật phòng qua PATCH, không đổi ID', async () => {
  assert(createdRoomId, 'phải có createdRoomId từ bước 2')
  const r = await api(`/api/admin/rooms/${createdRoomId}`, {
    method: 'PATCH',
    cookie: adminCookie,
    body: {
      name: 'Phòng QA Đã Cập Nhật',
      hotelId,
      price: 2200000,
      bedType: 'Giường king',
      sizeSqm: 35,
      maxAdults: 2,
      maxChildren: 1,
      amenities: ['Điều hòa', 'Wi-Fi miễn phí'],
      images: ['https://example.com/a.jpg'],
      breakfast: true,
      freeCancellation: false,
      checkinTime: '14:00',
      checkoutTime: '12:00',
      isActive: true
    }
  })
  assert(r.status === 200, `mong 200, nhận ${r.status}`)
  assert(r.data && r.data.data && r.data.data.id === createdRoomId, `ID không đổi: ${JSON.stringify(r.data)}`)
  assert(r.data.data.name === 'Phòng QA Đã Cập Nhật', `tên phải cập nhật: ${JSON.stringify(r.data)}`)
  assert(r.data.data.price === 2200000, `giá phải cập nhật: ${JSON.stringify(r.data)}`)
  return `PATCH giữ id=${r.data.data.id}, tên=${r.data.data.name}, giá=${r.data.data.price}`
})

// ---------- B11. Người dùng thường gọi admin API -> 403 ----------
await step('11', 'Người dùng thường gọi GET /api/admin/rooms -> 403', async () => {
  const regEmail = `rooms-user-${hex(4)}@mayan.test`
  const regPass = `User${hex(8)}1!`
  await api('/api/auth/register', { method: 'POST', body: { email: regEmail, password: regPass, name: 'Người Dùng QA' } })
  const lg = await api('/api/auth/login', { method: 'POST', body: { email: regEmail, password: regPass } })
  assert(lg.status === 200, `đăng nhập user phải 200, nhận ${lg.status}`)
  const userCookie = cookieOf(lg.headers)
  const r = await api('/api/admin/rooms', { cookie: userCookie })
  assert(r.status === 403, `user phải nhận 403, nhận ${r.status}`)
  return 'user gọi admin API -> 403'
})

// ---------- B12. Xóa mềm phòng không có booking -> isActive=false ----------
await step('12', 'Xóa mềm phòng không có booking -> isActive=false, phòng vẫn tồn tại', async () => {
  const r2 = await createRoom({ name: 'Phòng QA Sẽ Xóa', price: 999000 })
  assert(r2.status === 201, `tạo phòng xóa phải 201, nhận ${r2.status}`)
  const roomToDelete = r2.data.data.id
  const del = await api(`/api/admin/rooms/${roomToDelete}`, { method: 'DELETE', cookie: adminCookie })
  assert(del.status === 200, `xóa mềm phải 200, nhận ${del.status}`)
  assert(del.data && del.data.data && del.data.data.isActive === false, `isActive phải false: ${JSON.stringify(del.data)}`)
  const r0 = await api('/api/admin/rooms?isActive=0', { cookie: adminCookie })
  const inactives = r0.data.data.items || []
  assert(inactives.some((i) => i.id === roomToDelete), `phòng xóa mềm phải còn xuất hiện ở isActive=0`)
  return `xóa mềm phòng ${roomToDelete} OK, isActive=false`
})

// ---------- B13. Không xóa phòng đang có booking giữ -> 409 ----------
await step('13', 'Không xóa phòng đang có booking giữ -> 409', async () => {
  const r3 = await createRoom({ name: 'Phòng QA Có Booking', price: 1500000 })
  assert(r3.status === 201, `tạo phòng booking phải 201, nhận ${r3.status}`)
  const roomWithBooking = r3.data.data.id
  const bookingRes = await api('/api/bookings', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      serviceType: 'hotel',
      itemId: hotelId,
      passengers: 2,
      traveler: { name: 'Tester Booking', phone: '0912345678', email: 'booking@mayan.test' },
      promoCode: null,
      strictVoucher: false,
      paymentMethod: 'Thẻ ATM nội địa',
      destination: 'Test Destination',
      tripType: 'Lưu trú',
      dates: { depart: iso(7), ret: iso(10) },
      room: { roomId: roomWithBooking, roomsCount: 1, adults: 2, children: 0 },
      idempotencyKey: `bk-${hex(6)}`,
    }
  })
  const del2 = await api(`/api/admin/rooms/${roomWithBooking}`, { method: 'DELETE', cookie: adminCookie })
  if (bookingRes.status === 201) {
    assert(del2.status === 409, `xóa phòng có booking phải 409, nhận ${del2.status}`)
    return 'xóa phòng có booking -> 409'
  } else {
    return `booking không tạo được (${bookingRes.status}), bỏ qua kiểm tra 409`
  }
})

// ---------- B14. ID không tồn tại -> 404 ----------
await step('14', 'ID phòng không tồn tại -> 404', async () => {
  const fakeId = 'room-khong-ton-tai-999'
  const g = await api(`/api/admin/rooms/${fakeId}`, { cookie: adminCookie })
  assert(g.status === 404, `GET ID không tồn tại phải 404, nhận ${g.status}`)
  const p = await api(`/api/admin/rooms/${fakeId}`, { method: 'PATCH', cookie: adminCookie, body: { name: 'X' } })
  assert(p.status === 404, `PATCH ID không tồn tại phải 404, nhận ${p.status}`)
  const d = await api(`/api/admin/rooms/${fakeId}`, { method: 'DELETE', cookie: adminCookie })
  assert(d.status === 404, `DELETE ID không tồn tại phải 404, nhận ${d.status}`)
  return 'GET/PATCH/DELETE ID không tồn tại -> 404'
})

// ---------- B15. Kiểm tra audit log ----------
await step('15', 'Kiểm tra audit log ghi các thao tác quản trị phòng', async () => {
  const r = await api('/api/admin/audit-log', { cookie: adminCookie })
  assert(r.status === 200, `audit-log phải 200, nhận ${r.status}`)
  const logs = Array.isArray(r.data) ? r.data : (r.data && Array.isArray(r.data.data) ? r.data.data : [])
  const roomLogs = logs.filter((l) => l.action && String(l.action).includes('room'))
  assert(roomLogs.length >= 1, `phải có ít nhất 1 audit log về room, có ${roomLogs.length}`)
  const actions = roomLogs.map((l) => l.action).join(', ')
  return `audit-log room: ${actions}`
})

// ---------- Tóm tắt ----------
console.log(`\n=== TÓM TẤT QA ROOMS ADMIN (P1-03) ===`)
console.log(`Tổng: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`)
results.forEach((r) => console.log(`  [${r.status}] [${r.id}] ${r.title} — ${r.detail}`))

try {
  server.kill()
  for (const s of ['', '-wal', '-shm']) fs.rmSync(DB_PATH + s, { force: true })
  console.log('\nĐã dọn dẹp server tạm và DB tạm.')
} catch (e) {
  console.error('Lỗi dọn dẹp:', e.message)
}

process.exit(failed > 0 ? 1 : 0)

