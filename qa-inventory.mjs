#!/usr/bin/env node
// qa-inventory.mjs — Kiểm tra tồn phòng & chống overbooking (P1-02).
// Chạy trên server + SQLite CÓ TÂM (data/qa-inventory-tmp-<ts>.db), cổng OS cấp.
// Không đụng dữ liệu phát triển (data/mayan.db).
import { spawn } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { createHmac } from 'node:crypto'
import { createServer as createNetServer } from 'node:net'
import fs from 'node:fs'
import path from 'node:path'

const DB_PATH = path.resolve(`data/qa-inventory-tmp-${Date.now()}.db`)
process.env.DB_PATH = DB_PATH
fs.mkdirSync(path.resolve('data'), { recursive: true })
for (const f of fs.readdirSync(path.resolve('data'))) {
  if (/^qa-inventory-tmp-.*\.db(-wal|-shm)?$/.test(f)) {
    try { fs.rmSync(path.resolve('data', f), { force: true }) } catch { /* bỏ qua */ }
  }
}

const PORT = await new Promise((resolve, reject) => {
  const srv = createNetServer()
  srv.once('error', reject)
  srv.listen(0, '127.0.0.1', () => {
    const { port } = srv.address()
    srv.close(() => resolve(port))
  })
})
const BASE = `http://localhost:${PORT}`
const TEST_ACCESS = 'ACCESSTESTINV001'
const TEST_SECRET = 'testsecretkeyinventory00000000'
const TEST_PARTNER = 'MOMOINVTEST'

let passed = 0, failed = 0, assertions = 0
const results = []
function assert(cond, msg) { assertions += 1; if (!cond) throw new Error(msg) }
async function step(id, title, fn) {
  try { const d = await fn(); passed += 1; results.push({ id, title, status: 'PASS', detail: String(d || 'OK') }); console.log(`PASS [${id}] ${title} -- ${d}`) }
  catch (e) { failed += 1; const detail = String(e && e.message); results.push({ id, title, status: 'FAIL', detail }); console.log(`FAIL [${id}] ${title} -- ${detail}`) }
}

async function api(route, { method = 'GET', body, cookie, headers } = {}) {
  const res = await fetch(BASE + route, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', ...(cookie ? { cookie } : {}), ...(headers || {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let data = null; try { data = await res.json() } catch { data = null }
  return { status: res.status, data, headers: res.headers }
}
const cookieOf = (h) => { const list = typeof h.getSetCookie === 'function' ? h.getSetCookie() : [h.get('set-cookie')]; return String(list[0] || '').split(';')[0] }
const addDays = (d, n) => { const t = new Date(d); t.setDate(t.getDate() + n); return t.toISOString().slice(0, 10) }

console.log('=== QA INVENTORY — tồn phòng & chống overbooking (P1-02) ===')
console.log(`DB test: ${DB_PATH}`)

let userCookie = '', hotelId = '', roomId = '', anotherRoomId = ''
const server = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, DB_PATH, PORT: String(PORT), BOOKINGS_SCOPE: 'all',
    MOMO_ENV: 'sandbox', MOMO_PARTNER_CODE: TEST_PARTNER, MOMO_ACCESS_KEY: TEST_ACCESS,
    MOMO_SECRET_KEY: TEST_SECRET, MOMO_RETURN_URL: 'http://localhost/ret',
    MOMO_IPN_URL: `http://localhost:${PORT}/api/webhook/momo/ipn` },
  stdio: ['ignore', 'pipe', 'pipe'],
})
const serverLog = []
server.stdout.on('data', (d) => { serverLog.push('[srv] ' + d) })
server.stderr.on('data', (d) => { serverLog.push('[ERR] ' + d) })
process.on('exit', () => { try { server.kill() } catch { /* đã tắt */ } })

let ready = false
for (let i = 0; i < 60 && !ready; i += 1) {
  await new Promise((r) => setTimeout(r, 250))
  ready = await fetch(`${BASE}/api/health`).then((res) => res.ok).catch(() => false)
}
if (!ready) { console.log('FAIL: server tạm không lên'); server.kill(); process.exit(1) }
if (server.exitCode !== null) { console.log('FAIL: server tạm đã thoát, code=' + server.exitCode); process.exit(1) }

const testDb = new DatabaseSync(DB_PATH)
testDb.exec('PRAGMA busy_timeout = 10000;')
process.on('exit', () => { try { testDb.close() } catch { /* đã đóng */ } })

const countOverlapping = (roomId, checkIn, checkOut, excludeId = null) => {
  let sql = `SELECT COUNT(*) AS c FROM bookings WHERE room_id = ? AND status <> 'Đã hủy'
    AND depart_date IS NOT NULL AND return_date IS NOT NULL
    AND depart_date < ? AND return_date > ?`
  const args = [roomId, checkOut, checkIn]
  if (excludeId != null) { sql += ` AND id <> ?`; args.push(excludeId) }
  return testDb.prepare(sql).get(...args).c
}
const countOverlapPairs = () => testDb.prepare(`SELECT COUNT(*) AS c FROM bookings b1 JOIN bookings b2
  ON b1.id < b2.id AND b1.room_id = b2.room_id
  AND b1.status <> 'Đã hủy' AND b2.status <> 'Đã hủy'
  AND b1.depart_date IS NOT NULL AND b1.return_date IS NOT NULL
  AND b2.depart_date IS NOT NULL AND b2.return_date IS NOT NULL
  AND b1.depart_date < b2.return_date AND b1.return_date > b2.depart_date`).get().c


const base = new Date()
const checkIn = addDays(base, 10)
const checkOut = addDays(base, 12)
const rand = () => Math.floor(Math.random() * 1e9).toString().padStart(9, '0')

const bookHotel = (over = {}) => api('/api/bookings', {
  method: 'POST', cookie: userCookie,
  body: {
    serviceType: 'hotel', itemId: hotelId,
    room: { roomId, roomsCount: 1, adults: 1, children: 0 },
    dates: { depart: checkIn, ret: checkOut },
    traveler: { name: 'Nguyễn Văn A', phone: '0912345678', email: 'inv-user@mayan.test' },
    paymentMethod: 'Tiền mặt', idempotencyKey: `inv-${rand()}`, ...over,
  },
})
const steps = [
  { id: 'T0', title: 'Đăng nhập user + load catalog trên DB tạm', fn: async () => {
    const r = await api('/api/auth/login', { method: 'POST', body: { email: 'inv-user@mayan.test', password: 'InvUser123!' } })
    assert(r.status === 200 && r.data.ok, 'login fail: ' + JSON.stringify(r.data))
    userCookie = cookieOf(r.headers)
    globalThis.__userId = Number(r.data.user.id)
    const catalog = (await api('/api/catalog')).data
    const hotelRooms = (catalog.rooms || []).filter((x) => x.hotelId === (catalog.hotels || [])[0].id)
    assert(catalog.hotels && catalog.hotels.length >= 1 && hotelRooms.length >= 2, 'Cần khách sạn mẫu >=2 phòng')
    hotelId = (catalog.hotels || [])[0].id
    roomId = hotelRooms[0].id
    anotherRoomId = hotelRooms[1].id
    return `có user + phòng mẫu ${roomId}`
  } },
  { id: 'R1', title: 'Đặt phòng còn trống -> 201, phòng được ghi giữ', fn: async () => {
    const r = await bookHotel()
    assert(r.status === 201, 'phải 201, got ' + r.status + ': ' + JSON.stringify(r.data))
    assert(r.data.booking.room_id === roomId, 'room_id phải ghi đúng')
    assert(r.data.booking.dates.depart === checkIn && r.data.booking.dates.ret === checkOut, 'ngày phải ghi đúng')
    assert(r.data.booking.status === 'Đã xác nhận', 'trạng thái phải Đã xác nhận')
    assert(Number(r.data.booking.total) > 0, 'tổng tiền phải > 0 (server tự tính)')
    assert(countOverlapping(roomId, checkIn, checkOut) === 1, 'CSDL phải có 1 booking giữ phòng')
    globalThis.__r1Code = r.data.booking.code
    return `đơn ${globalThis.__r1Code} giữ ${roomId} ${checkIn}->${checkOut}`
  } },
  { id: 'R2', title: 'Cùng phòng, ngày chồng lấn -> 409 ROOM_UNAVAILABLE, không overbooking', fn: async () => {
    const r = await bookHotel({ dates: { depart: addDays(checkIn, 1), ret: checkOut }, idempotencyKey: `inv-r2-${rand()}` })
    assert(r.status === 409, 'chồng lấn phải 409, got ' + r.status + ': ' + JSON.stringify(r.data))
    assert(r.data.code === 'ROOM_UNAVAILABLE', 'mã lỗi phải ROOM_UNAVAILABLE, got ' + JSON.stringify(r.data.code))
    assert(countOverlapping(roomId, checkIn, checkOut) === 1, 'vẫn chỉ 1 booking giữ phòng')
    return 'từ chối đặt chồng lấn, tồn kho không sai'
  } },
  { id: 'R3', title: 'Trả phòng cũ = nhận phòng mới (chu trình liền) -> được phép', fn: async () => {
    const r = await bookHotel({ dates: { depart: checkOut, ret: addDays(checkOut, 2) }, idempotencyKey: `inv-r3-${rand()}` })
    assert(r.status === 201, 'chu trình liền phải 201, got ' + r.status + ': ' + JSON.stringify(r.data))
    return 'check-out == check-in kế tiếp được phép'
  } },
  { id: 'R4', title: 'Nhận phòng == hoặc sau trả phòng -> từ chối', fn: async () => {
    const r1 = await bookHotel({ dates: { depart: checkIn, ret: checkIn }, idempotencyKey: `inv-r4a-${rand()}` })
    assert(r1.status === 409, 'check-in == check-out phải 409, got ' + r1.status)
    const r2 = await bookHotel({ dates: { depart: addDays(checkOut, 1), ret: checkOut }, idempotencyKey: `inv-r4b-${rand()}` })
    assert(r2.status === 409, 'check-in sau check-out phải 409, got ' + r2.status)
    return 'ngày không hợp lệ bị từ chối ở backend'
  } },

  { id: 'R5', title: 'Đặt lại đúng ngày của phòng đã giữ -> hết tồn kho, từ chối', fn: async () => {
    const r = await bookHotel({ idempotencyKey: `inv-r5-${rand()}` })
    assert(r.status === 409, 'đặt trùng ngày phòng đã giữ phải 409, got ' + r.status)
    assert(countOverlapping(roomId, checkIn, checkOut) === 1, 'tồn kho 1 phòng vật lý không bị vượt')
    return 'hết tồn kho (1 phòng/1 ngày) được cưỡng chế'
  } },
  { id: 'R6', title: 'Hủy booking giải phóng phòng đúng 1 lần, đặt lại được', fn: async () => {
    const r = await api(`/api/bookings/${encodeURIComponent(globalThis.__r1Code)}/cancel`, { method: 'PATCH', cookie: userCookie })
    assert(r.status === 200, 'hủy phải 200, got ' + r.status + ': ' + JSON.stringify(r.data))
    assert(r.data.booking.status === 'Đã hủy', 'trạng thái phải Đã hủy')
    assert(countOverlapping(roomId, checkIn, checkOut) === 0, 'phòng phải được giải phóng (0 booking giữ)')
    const r2 = await bookHotel({ idempotencyKey: `inv-r6-${rand()}` })
    assert(r2.status === 201, 'sau khi hủy, đặt lại phải 201, got ' + r2.status)
    assert(countOverlapping(roomId, checkIn, checkOut) === 1, 'sau đặt lại phải lại có 1 booking giữ phòng')
    globalThis.__r6Code = r2.data.booking.code
    return 'hủy giải phóng 1 lần, phòng có thể đặt lại'
  } },
  { id: 'R7', title: 'Hủy lặp lại không giải phóng hai lần', fn: async () => {
    // __r1Code đã bị hủy ở R6 -> hủy lại phải 409, không giải phóng thêm phòng.
    const r = await api(`/api/bookings/${encodeURIComponent(globalThis.__r1Code)}/cancel`, { method: 'PATCH', cookie: userCookie })
    assert(r.status === 409, 'hủy đơn đã hủy phải 409, got ' + r.status)
    assert(countOverlapping(roomId, checkIn, checkOut) === 1, 'không được giải phóng thêm (vẫn 1 booking = __r6Code giữ)')
    return 'hủy đơn đã hủy không giải phóng thêm phòng'
  } },
  { id: 'R8', title: 'Đơn chờ thanh toán vẫn giữ phòng (chưa có quy tắc hết hạn tự động)', fn: async () => {
    const r = await bookHotel({ dates: { depart: addDays(checkOut, 2), ret: addDays(checkOut, 4) }, idempotencyKey: `inv-r8-${rand()}` })
    assert(r.status === 201, 'tạo đơn chờ phải 201, got ' + r.status)
    const codeR8 = r.data.booking.code
    testDb.prepare(`UPDATE bookings SET status = 'Chờ thanh toán' WHERE code = ?`).run(codeR8)
    const r2 = await bookHotel({ dates: { depart: addDays(checkOut, 2), ret: addDays(checkOut, 4) }, idempotencyKey: `inv-r8b-${rand()}` })
    assert(r2.status === 409, 'đơn chờ vẫn giữ phòng => chồng lấn phải 409, got ' + r2.status)
    assert(countOverlapping(roomId, addDays(checkOut, 2), addDays(checkOut, 4)) === 1, 'chờ thanh toán không tự giải phóng phòng')
    return 'đơn chờ vẫn giữ phòng (chưa có quy tắc hết hạn tự động)'
  } },
  { id: 'R9', title: '10 request đồng thời tranh phòng cuối cùng -> chỉ 1 booking thành công', fn: async () => {
    const dates = { depart: addDays(checkOut, 6), ret: addDays(checkOut, 8) }
    const requests = Array.from({ length: 10 }, (_, i) =>
      api('/api/bookings', {
        method: 'POST', cookie: userCookie,
        body: { serviceType: 'hotel', itemId: hotelId, room: { roomId: anotherRoomId, roomsCount: 1, adults: 1, children: 0 }, dates, traveler: { name: 'Concurrent', phone: '0900000000', email: 'inv-user@mayan.test' }, paymentMethod: 'Tiền mặt', idempotencyKey: `inv-r9-${i}-${rand()}` },
      }))
    const responses = await Promise.all(requests)
    const okCount = responses.filter((x) => x.status === 201).length
    const refuseCount = responses.filter((x) => x.status === 409 && x.data.code === 'ROOM_UNAVAILABLE').length
    assert(okCount === 1, `phải đúng 1 booking thành công, got ${okCount}: ${JSON.stringify(responses.map((x) => x.status))}`)
    assert(refuseCount === 9, `phải từ chối 9 request, got ${refuseCount}`)
    assert(countOverlapping(anotherRoomId, dates.depart, dates.ret) === 1, 'CSDL chỉ duy nhất 1 booking giữ phòng')
    return `${okCount} thành công, ${refuseCount} bị từ chối, không overbooking`
  } },

  { id: 'R10', title: 'Không tồn tại hai booking cùng phòng vật lý chồng lấn (toàn bảng)', fn: async () => {
    assert(countOverlapPairs() === 0, `không được có cặp booking xung đột, got ${countOverlapPairs()}`)
    return 'toàn bộ CSDL không có overbooking'
  } },
  { id: 'R11', title: 'room ID giả mạo / số phòng giả từ frontend không vượt qua backend', fn: async () => {
    const r1 = await bookHotel({ room: { roomId: 'room-khong-ton-tai', roomsCount: 1, adults: 1, children: 0 }, idempotencyKey: `inv-r11a-${rand()}` })
    assert(r1.status === 409, 'room giả phải 409, got ' + r1.status)
    const r2 = await bookHotel({ room: { roomId, roomsCount: 9, adults: 1, children: 0 }, idempotencyKey: `inv-r11b-${rand()}` })
    assert(r2.status === 409, 'roomsCount=9 phải 409, got ' + r2.status)
    const otherHotelRoom = ((await api('/api/catalog')).data.rooms || []).find((x) => x.hotelId !== hotelId && x.id !== roomId)
    assert(otherHotelRoom, 'cần phòng của khách sạn khác')
    const r3 = await bookHotel({ room: { roomId: otherHotelRoom.id, roomsCount: 1, adults: 1, children: 0 }, idempotencyKey: `inv-r11c-${rand()}` })
    assert(r3.status === 409, 'phòng khác khách sạn phải 409, got ' + r3.status)
    return 'dữ liệu giả mạo từ frontend đều bị từ chối'
  } },
  { id: 'R12', title: 'IPN đến trễ cho đơn đã hủy -> bỏ qua, phòng vẫn được giải phóng', fn: async () => {
    const r = await bookHotel({ dates: { depart: addDays(checkOut, 10), ret: addDays(checkOut, 12) }, idempotencyKey: `inv-r12-${rand()}` })
    assert(r.status === 201, 'tạo đơn R12 phải 201, got ' + r.status)
    const bookingR12 = r.data.booking
    testDb.prepare(`INSERT INTO payment_attempts (booking_code, user_id, provider, order_id, request_id, amount, status, env, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(bookingR12.code, Number(globalThis.__userId), 'momo', 'ORD-INV-R12', 'REQ-INV-R12', Number(bookingR12.total), 'created', 'sandbox', new Date().toISOString(), new Date().toISOString())
    const cancel = await api(`/api/bookings/${encodeURIComponent(bookingR12.code)}/cancel`, { method: 'PATCH', cookie: userCookie })
    assert(cancel.status === 200, 'hủy R12 phải 200')
    const ipnFields = {
      partnerCode: TEST_PARTNER, accessKey: TEST_ACCESS, orderId: 'ORD-INV-R12', requestId: 'REQ-INV-R12',
      amount: String(bookingR12.total), transId: 'TRANS-INV-R12', resultCode: '0', message: 'Success',
      responseTime: new Date().toISOString(), orderInfo: 'test', orderType: 'captureWallet', payType: 'MoMo', extraData: '',
    }
    const raw = [`accessKey=${TEST_ACCESS}`, `amount=${ipnFields.amount}`, `extraData=${ipnFields.extraData}`,
      `message=${ipnFields.message}`, `orderId=${ipnFields.orderId}`, `orderInfo=${ipnFields.orderInfo}`,
      `orderType=${ipnFields.orderType}`, `partnerCode=${TEST_PARTNER}`, `payType=${ipnFields.payType}`,
      `requestId=${ipnFields.requestId}`, `responseTime=${ipnFields.responseTime}`, `resultCode=${ipnFields.resultCode}`,
      `transId=${ipnFields.transId}`].join('&')
    ipnFields.signature = createHmac('sha256', TEST_SECRET).update(raw).digest('hex')
    const ipnRes = await fetch(`${BASE}/api/webhook/momo/ipn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'fetch' },
      body: new URLSearchParams(ipnFields).toString(),
    })
    assert(ipnRes.status === 200, 'IPN phải trả 200, got ' + ipnRes.status)
    const ipnJson = await ipnRes.json()
    assert(ipnJson.ignored === true, 'IPN đơn đã hủy phải bị bỏ qua')
    const after = testDb.prepare(`SELECT status, payment_status FROM bookings WHERE code = ?`).get(bookingR12.code)
    assert(after.status === 'Đã hủy' && after.payment_status !== 'paid', 'đơn đã hủy không được hồi sinh thành paid')
    const r2 = await bookHotel({ dates: { depart: addDays(checkOut, 10), ret: addDays(checkOut, 12) }, idempotencyKey: `inv-r12b-${rand()}` })
    assert(r2.status === 201, 'sau đơn hủy + IPN bỏ qua, phòng phải đặt lại được 201')
    return 'IPN đến trễ cho đơn hủy không chiếm lại phòng'
  } },

  { id: 'R13', title: 'Admin không xác nhận đơn làm vượt tồn kho (guard tồn kho ở quản trị)', fn: async () => {
    const { createUser, hashPassword } = await import('./server/db.js')
    try { await createUser({ email: 'inv-admin@mayan.test', name: 'Admin Inventory', passwordHash: await hashPassword('InvAdmin123!'), role: 'admin' }) } catch { /* đã tồn tại */ }
    const ra = await api('/api/auth/login', { method: 'POST', body: { email: 'inv-admin@mayan.test', password: 'InvAdmin123!' } })
    assert(ra.status === 200 && ra.data.ok, 'admin login fail: ' + JSON.stringify(ra.data))
    const adminCookie = cookieOf(ra.headers)

    const rE = await bookHotel({ dates: { depart: addDays(checkOut, 14), ret: addDays(checkOut, 16) }, idempotencyKey: `inv-r13e-${rand()}` })
    assert(rE.status === 201, 'đơn E phải 201, got ' + rE.status)

    const codeF = `INV-F-LEGACY-${rand()}`
    testDb.prepare(`INSERT INTO bookings (code, user_id, service_type, item_id, title, status, traveler_name, traveler_phone, traveler_email, email, depart_date, return_date, room_id, room_name, legacy)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(codeF, Number(globalThis.__userId), 'hotel', hotelId, 'Đơn legacy xung đột', 'Đã tạo',
        'Khach Legacy', '0900000000', 'legacy@test', 'legacy@test',
        addDays(checkOut, 14), addDays(checkOut, 16), roomId, 'Phong legacy', 1)
    const fRow = testDb.prepare('SELECT id, status FROM bookings WHERE code = ?').get(codeF)
    assert(fRow, 'phải chèn đơn F')

    const rF = await api(`/api/admin/bookings/${fRow.id}`, { method: 'PATCH', cookie: adminCookie, body: { status: 'Đã xác nhận' } })
    assert(rF.status === 409, 'admin xác nhận đơn vượt tồn kho phải 409, got ' + rF.status)
    const fAgain = testDb.prepare('SELECT status FROM bookings WHERE id = ?').get(fRow.id)
    assert(fAgain.status === 'Đã tạo', 'đơn F vẫn chưa được xác nhận')

    const rG = await bookHotel({ room: { roomId: anotherRoomId, roomsCount: 1, adults: 1, children: 0 }, dates: { depart: addDays(checkOut, 14), ret: addDays(checkOut, 16) }, idempotencyKey: `inv-r13g-${rand()}` })
    assert(rG.status === 201, 'đơn G phải 201')
    const rG2 = await api(`/api/admin/bookings/${rG.data.booking.id}`, { method: 'PATCH', cookie: adminCookie, body: { status: 'Đã hủy' } })
    assert(rG2.status === 200, 'admin hủy đơn không xung đột phải 200')
    return 'admin bị chặn xác nhận vượt tồn kho, vẫn thao tác được đơn không xung đột'
  } },
  { id: 'R14', title: 'Tra phòng còn trống phản ánh đúng ngày khách chọn', fn: async () => {
    const held = (await api(`/api/rooms/available?hotelId=${encodeURIComponent(hotelId)}&checkIn=${checkIn}&checkOut=${checkOut}`))
    assert(held.status === 200, 'tra phòng phải 200')
    assert(held.data.ok === true && Array.isArray(held.data.rooms), 'phải trả danh sách phòng')
    assert(!held.data.rooms.some((x) => x.id === roomId), `phòng ${roomId} đang giữ ${checkIn}->${checkOut} không được hiện còn trống`)
    assert(held.data.rooms.every((x) => x.available === true), 'mỗi phòng trả về phải available=true')
    const free = (await api(`/api/rooms/available?hotelId=${encodeURIComponent(hotelId)}&checkIn=${addDays(checkOut, 6)}&checkOut=${addDays(checkOut, 8)}`))
    assert(free.status === 200, 'tra phòng khác ngày phải 200')
    assert(free.data.rooms.some((x) => x.id === roomId), `phòng ${roomId} phải còn trống cho khoảng không chồng lấn`)
    return `khoảng giữ (${checkIn}->${checkOut}) trừ phòng đã giữ; khoảng khác có phòng`
  } },
]

for await (const s of steps) {
  await step(s.id, s.title, s.fn)
}

const summary = { module: 'INVENTORY', total: passed + failed, passed, failed, assertions, results }
fs.mkdirSync(path.resolve('qa-evidence/final'), { recursive: true })
fs.writeFileSync(path.resolve('qa-evidence/final/inventory-results.json'), JSON.stringify(summary, null, 2))

try { server.kill() } catch { /* đã tắt */ }
try { testDb.close() } catch { /* đã đóng */ }
for (const f of fs.readdirSync(path.resolve('data'))) {
  if (/^qa-inventory-tmp-.*\.db(-wal|-shm)?$/.test(f)) {
    try { fs.rmSync(path.resolve('data', f), { force: true }) } catch { /* bỏ qua */ }
  }
}
console.log(`TONG: ${summary.total} | PASS: ${summary.passed} | FAIL: ${summary.failed} | assertions: ${summary.assertions}`)
process.exit(failed > 0 ? 1 : 0)

