// qa-voucher.mjs — Kiểm thử LUẬT VOUCHER phía backend bằng API thật.
// Server + SQLite chạy CÓ TÂM (DB tạm trong data/) -> không đụng dữ liệu dự án.
// Bao phủ: hợp lệ / mã sai / hết hạn / sai loại dịch vụ / thiếu giá trị tối thiểu /
// hết lượt / client sửa tiền / sức chứa phòng / idempotency.
import { spawn } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { createServer } from 'node:net'
import fs from 'node:fs'
import path from 'node:path'

// Cổng TRỐNG do OS cấp — tránh đụng server cũ còn sót từ lần chạy trước.
const PORT = await new Promise((resolve, reject) => {
  const srv = createServer()
  srv.once('error', reject)
  srv.listen(0, '127.0.0.1', () => {
    const { port } = srv.address()
    srv.close(() => resolve(port))
  })
})
const BASE = `http://localhost:${PORT}`
const DB_PATH = path.resolve('data/qa-voucher-tmp.db')
const OUT = path.resolve('qa-evidence/final')
fs.mkdirSync(OUT, { recursive: true })
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(DB_PATH + suffix, { force: true })

let passed = 0
let failed = 0
const results = []

function assert(cond, msg) { if (!cond) throw new Error(msg) }
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

const iso = (offsetDays) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10)
const DATES = { depart: iso(7), ret: iso(10) } // 3 đêm (cùng logic frontend)

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

function bookingBody(overrides = {}) {
  return {
    serviceType: 'hotel',
    itemId: 'hotel-1',
    passengers: 2,
    traveler: { name: 'Tester Voucher', phone: '0912345678', email: 'voucherapi@mayan.test' },
    promoCode: null,
    strictVoucher: false,
    paymentMethod: 'Thẻ ATM nội địa',
    destination: 'Biển Mỹ Khê, Đà Nẵng',
    tripType: 'Lưu trú',
    dates: DATES,
    room: { roomId: 'room-hotel-1-1', roomsCount: 1, adults: 2, children: 0 },
    idempotencyKey: `vk-${Math.random().toString(36).slice(2, 12)}`,
    ...overrides,
  }
}

console.log('=== QA VOUCHER (API) — Mây An Nhiên ===')

// 1. Khởi động server tạm với DB tạm
const server = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, DB_PATH: DB_PATH, PORT: String(PORT) },
  stdio: 'ignore',
})
process.on('exit', () => { try { server.kill() } catch { /* đã tắt */ } })

// Chờ server sẵn sàng
let ready = false
for (let i = 0; i < 40 && !ready; i += 1) {
  await new Promise((r) => setTimeout(r, 250))
  ready = await fetch(`${BASE}/api/health`).then((r) => r.ok).catch(() => false)
}
if (!ready) {
  console.log('FAIL: server tạm không khởi động được')
  server.kill()
  process.exit(1)
}
if (server.exitCode !== null) {
  console.log('FAIL: server tạm đã thoát ngay, code=' + server.exitCode)
  process.exit(1)
}
console.log('server tạm sẵn sàng tại cổng ' + PORT)

// 2. Seed voucher kiểm thử vào DB tạm (server đang mở WAL -> kết nối thứ 2 OK)
const seed = new DatabaseSync(DB_PATH)
seed.exec(`INSERT OR REPLACE INTO promotions
  (id, code, title, description, applies_to, rate, color, active_from, active_to, usage_limit, used_count, min_order, is_active) VALUES
  ('t1','HETHAN','HETHAN','Voucher đã hết hạn','hotel',0.10,'red','2024-01-01','2020-01-01',NULL,0,0,1),
  ('t2','HETLUOT','HETLUOT','Voucher đã hết lượt','hotel',0.10,'red',NULL,NULL,1,1,0,1),
  ('t3','TOITHIEU','TOITHIEU','Đơn tối thiểu 10.000.000đ','hotel',0.20,'blue',NULL,NULL,NULL,0,10000000,1),
  ('t4','GIOIHAN','GIOIHAN','Giới hạn 2 lượt sử dụng','hotel',0.10,'green',NULL,NULL,2,1,0,1)`)
seed.close()

// 3. Các case kiểm tra
await step('1', 'Server tạm + catalog.rooms có dữ liệu phòng', async () => {
  const health = await api('/api/health')
  assert(health.status === 200 && health.data.status === 'ok', 'health lỗi')
  const catalog = await api('/api/catalog')
  assert(Array.isArray(catalog.data.rooms) && catalog.data.rooms.length >= 7, 'catalog.rooms thiếu phòng seed')
  return `health ok; ${catalog.data.rooms.length} phòng`
})

await step('2', 'Voucher hợp lệ SALECUOITUAN (hotel) -> giảm đúng', async () => {
  const res = await api('/api/promos/validate', { method: 'POST', body: { code: 'SALECUOITUAN', serviceType: 'hotel', amount: 5550000 } })
  assert(res.status === 200 && res.data.ok, 'validate phải thành công: ' + JSON.stringify(res.data))
  assert(res.data.discount === 666000, `discount phải 666000, got ${res.data.discount}`)
  assert(res.data.total === 4884000, `total phải 4884000, got ${res.data.total}`)
  return '5.550.000 - 12% = 666.000 -> 4.884.000'
})

await step('3', 'Mã không tồn tại -> 400 + thông báo rõ', async () => {
  const res = await api('/api/promos/validate', { method: 'POST', body: { code: 'MAKHONGTONTAI', serviceType: 'hotel', amount: 5550000 } })
  assert(res.status === 400, `status phải 400, got ${res.status}`)
  assert(String(res.data.error).includes('không tồn tại'), 'sai thông báo: ' + res.data.error)
  return res.data.error
})

await step('4', 'Voucher hết hạn (HETHAN) -> 400', async () => {
  const res = await api('/api/promos/validate', { method: 'POST', body: { code: 'HETHAN', serviceType: 'hotel', amount: 5550000 } })
  assert(res.status === 400, `status phải 400, got ${res.status}`)
  assert(String(res.data.error).includes('hết hạn'), 'sai thông báo: ' + res.data.error)
  return res.data.error
})

await step('5', 'Sai loại dịch vụ (BAYNGAY cho hotel) -> 400; flight vẫn OK', async () => {
  const res = await api('/api/promos/validate', { method: 'POST', body: { code: 'BAYNGAY', serviceType: 'hotel', amount: 5550000 } })
  assert(res.status === 400, `status phải 400, got ${res.status}`)
  assert(String(res.data.error).includes('không áp dụng cho khách sạn'), 'sai thông báo: ' + res.data.error)
  const ok = await api('/api/promos/validate', { method: 'POST', body: { code: 'BAYNGAY', serviceType: 'flight', amount: 2580000 } })
  assert(ok.status === 200, 'BAYNGAY phải hợp lệ cho flight: ' + JSON.stringify(ok.data))
  return 'hotel bị từ chối; flight vẫn hợp lệ'
})

await step('6', 'Thiếu giá trị đơn tối thiểu (TOITHIEU) -> 400; đủ thì OK', async () => {
  const low = await api('/api/promos/validate', { method: 'POST', body: { code: 'TOITHIEU', serviceType: 'hotel', amount: 1850000 } })
  assert(low.status === 400, `đơn 1.850.000 phải bị chặn, got ${low.status}`)
  assert(String(low.data.error).includes('Đơn tối thiểu'), 'sai thông báo: ' + low.data.error)
  const high = await api('/api/promos/validate', { method: 'POST', body: { code: 'TOITHIEU', serviceType: 'hotel', amount: 12000000 } })
  assert(high.status === 200 && high.data.discount === 2400000, 'đơn 12 triệu phải giảm 2.400.000: ' + JSON.stringify(high.data))
  return '1.850.000 bị chặn; 12.000.000 -> giảm 2.400.000'
})

await step('7', 'Hết lượt sử dụng (HETLUOT) -> 400', async () => {
  const res = await api('/api/promos/validate', { method: 'POST', body: { code: 'HETLUOT', serviceType: 'hotel', amount: 5550000 } })
  assert(res.status === 400, `status phải 400, got ${res.status}`)
  assert(String(res.data.error).includes('hết lượt'), 'sai thông báo: ' + res.data.error)
  return res.data.error
})

let cookie = ''
await step('8', 'Đăng nhập API để tạo đơn kiểm thử', async () => {
  // Đăng ký trước khi đăng nhập (DB tạm không có sẵn user này)
  await api('/api/auth/register', { method: 'POST', body: { email: 'voucherapi@mayan.test', password: 'secret123', name: 'Voucher API' } }).catch(() => {})
  const res = await api('/api/auth/login', { method: 'POST', body: { email: 'voucherapi@mayan.test', password: 'secret123' } })
  assert(res.status === 200 && res.data.ok, 'login thất bại: ' + JSON.stringify(res.data))
  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [res.headers.get('set-cookie')]
  cookie = String(setCookies[0] || '').split(';')[0]
  assert(cookie.includes('may_an_nhien_sid'), 'thiếu cookie phiên')
  return 'đăng nhập ok (tự tạo tài khoản demo), cookie phiên nhận được'
})

await step('9', 'Client gian lận TỔNG TIỀN -> server tự tính lại đúng', async () => {
  const res = await api('/api/bookings', {
    method: 'POST',
    cookie,
    body: bookingBody({
      promoCode: 'SALECUOITUAN',
      strictVoucher: true,
      // client cố gửi tổng tiền/giảm giá giả — server PHẢI bỏ qua
      total: 1,
      discount: 999999999,
      unitPrice: 1,
    }),
  })
  assert(res.status === 201, `status phải 201, got ${res.status}: ${JSON.stringify(res.data)}`)
  const b = res.data.booking
  assert(b.unitPrice === 1850000, `unitPrice phải 1850000, got ${b.unitPrice}`)
  assert(b.nights === 3 && b.roomsCount === 1, `nights/rooms sai: ${b.nights}/${b.roomsCount}`)
  assert(b.discount === 666000, `discount phải do server tính = 666000, got ${b.discount}`)
  assert(b.total === 4884000, `total phải 4884000 (không tin client), got ${b.total}`)
  assert(String(b.roomName).includes('Deluxe'), 'thiếu roomName: ' + b.roomName)
  assert(String(b.title).includes('Marina Bay'), 'title thiếu tên khách sạn')
  return `server trả total=4.884.000 (bỏ qua total=1); ${b.roomName} x3 dem`
})

await step('10', 'Gian lận phòng/ngày bi LOI ro (khong an tham sua)', async () => {
  const badDates = await api('/api/bookings', { method: 'POST', cookie, body: bookingBody({ dates: { depart: iso(10), ret: iso(7) } }) })
  assert(badDates.status === 409 && String(badDates.data.error).includes('lưu trú'), 'ngay tra < nhan phai 409: ' + JSON.stringify(badDates.data))
  const badRooms = await api('/api/bookings', { method: 'POST', cookie, body: bookingBody({ room: { roomId: 'room-hotel-1-1', roomsCount: 99, adults: 2, children: 0 } }) })
  assert(badRooms.status === 409 && String(badRooms.data.error).includes('Số phòng'), 'roomsCount=99 phai 409: ' + JSON.stringify(badRooms.data))
  const badAdults = await api('/api/bookings', { method: 'POST', cookie, body: bookingBody({ room: { roomId: 'room-hotel-1-1', roomsCount: 1, adults: 99, children: 0 } }) })
  assert(badAdults.status === 409 && String(badAdults.data.error).includes('người lớn'), 'adults=99 phai 409: ' + JSON.stringify(badAdults.data))
  return 'ngay sai / 99 phong / 99 nguoi lon deu bi 409'
})

await step('11', 'strictVoucher: voucher het hieu luc luc dat -> 409 (khong giam len)', async () => {
  const res = await api('/api/bookings', { method: 'POST', cookie, body: bookingBody({ promoCode: 'HETLUOT', strictVoucher: true }) })
  assert(res.status === 409, `phai 409, got ${res.status}`)
  assert(String(res.data.error).includes('hết lượt'), 'sai thong bao: ' + res.data.error)
  return res.data.error
})

await step('12', 'Gioi han luot GIOIHAN (1/2 con lai): don 1 duoc, don 2 bi chan', async () => {
  // Dùng phòng/ngày KHÁC với bước [9] để không bị chặn do hết phòng trước khi kiểm tra giới hạn lượt voucher.
  // room-hotel-1-1 (1.850.000/đêm x 3 đêm = 5.550.000) -> 10% = 555.000.
  const first = await api('/api/bookings', { method: 'POST', cookie, body: bookingBody({
    promoCode: 'GIOIHAN', strictVoucher: true,
    dates: { depart: iso(14), ret: iso(17) },
    room: { roomId: 'room-hotel-1-1', roomsCount: 1, adults: 2, children: 0 },
  }) })
  assert(first.status === 201, `don 1 phai 201, got ${first.status}: ${JSON.stringify(first.data)}`)
  assert(first.data.booking.discount === 555000, `giam 10% phai 555000, got ${first.data.booking.discount}`)
  const second = await api('/api/bookings', { method: 'POST', cookie, body: bookingBody({
    promoCode: 'GIOIHAN', strictVoucher: true,
    dates: { depart: iso(14), ret: iso(17) },
    room: { roomId: 'room-hotel-1-1', roomsCount: 1, adults: 2, children: 0 },
  }) })
  assert(second.status === 409 && String(second.data.error).includes('hết lượt'), 'don 2 phai 409: ' + JSON.stringify(second.data))
  return 'luot 2/2 xong -> don ke bi chan (khong vuot gioi han)'
})

await step('13', 'Idempotency: gui lai cung key -> khong tao trung', async () => {
  // Dùng phòng/ngày KHÁC với bước [9] và [12] để chắc chắn đơn đầu thành công trước khi kiểm tra gửi lặp.
  const body = bookingBody({
    promoCode: 'SALECUOITUAN', strictVoucher: true,
    dates: { depart: iso(21), ret: iso(24) },
    room: { roomId: 'room-hotel-1-3', roomsCount: 1, adults: 2, children: 0 },
  })
  const first = await api('/api/bookings', { method: 'POST', cookie, body })
  assert(first.status === 201, 'don dau phai 201: ' + JSON.stringify(first.data))
  const replay = await api('/api/bookings', { method: 'POST', cookie, body })
  assert(replay.status === 200 && replay.data.duplicate === true, 'gui lai phai duplicate: ' + JSON.stringify(replay.data))
  assert(replay.data.booking.code === first.data.booking.code, 'ma don khi replay phai trung')
  return `gui lai -> duplicate, giu nguyen ma ${first.data.booking.code}`
})

await step('14', 'API khong ton tai -> 404 JSON', async () => {
  const res = await api('/api/khong-ton-tai')
  assert(res.status === 404 && String(res.data.error).includes('Không tìm thấy'), '404 JSON sai: ' + JSON.stringify(res.data))
  return '404 JSON dung'
})

const summary = { module: 'VOUCHER', total: passed + failed, passed, failed, results }
fs.writeFileSync(path.resolve('qa-evidence/final/voucher-results.json'), JSON.stringify(summary, null, 2))
server.kill()
console.log(`\nTONG: ${summary.total} | PASS: ${passed} | FAIL: ${failed}`)
process.exit(failed > 0 ? 1 : 0)


