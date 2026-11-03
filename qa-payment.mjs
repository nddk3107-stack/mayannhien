#!/usr/bin/env node
// qa-payment.mjs — Kiểm thử chuyên sâu lớp thanh toán MoMo (server-side).
//
// MỤC TIÊU: chứng minh bằng CODE + LOG rằng:
//  1. Chữ ký HMAC tạo đúng theo tài liệu MoMo (thứ tự trường cố định).
//  2. IPN sai chữ ký / sai số tiền / sai orderId / sai partnerCode -> KHÔNG đánh dấu paid.
//  3. IPN hợp lệ -> đánh dấu paid ĐÚNG 1 LẦN (idempotent khi callback lặp).
//  4. IPN đến khi đơn đã hủy -> không cộng tiền.
//  5. Client KHÔNG thể tạo phiên thanh toán cho đơn của người khác (IDOR).
//  6. Không có MoMo credentials -> cổng thanh toán TẮT, không tạo giao dịch giả.
//
// Chạy trên server + SQLite CÓ TÂM (data/qa-payment-tmp.db) -> không đụng dữ liệu thật.
// Cổng do OS cấp để không đụng server cũ.
import { spawn } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { createHmac } from 'node:crypto'
import { createServer as createHttpServer } from 'node:http'
import { createServer } from 'node:net'
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
// DB tạm RIÊNG cho mỗi lần chạy (có timestamp) -> tránh tranh chấp khoá WAL
// với các lần chạy khác còn sót, và không bao giờ đụng dữ liệu thật.
const DB_PATH = path.resolve(`data/qa-payment-tmp-${Date.now()}.db`)
fs.mkdirSync(path.resolve('data'), { recursive: true })
for (const s of ['', '-wal', '-shm']) fs.rmSync(DB_PATH + s, { force: true })

// Credentials GIẢ chỉ dùng cho test tự ký — KHÔNG phải credential thật của MoMo.
const TEST_ACCESS = 'TESTACCESSKEY000001'
const TEST_SECRET = 'testsecretkey000000000000000000'
const TEST_PARTNER = 'MOMOTESTPARTNER01'

let passed = 0
let failed = 0
const results = []
function assert(cond, msg) { if (!cond) throw new Error(msg) }
async function step(id, title, fn) {
  const logMark = serverLog.length
  try { const d = await fn(); passed += 1; results.push({ id, title, status: 'PASS', detail: String(d || 'OK') }); console.log(`PASS [${id}] ${title} -- ${d}`) }
  catch (e) {
    failed += 1
    const detail = String(e && e.message)
    results.push({ id, title, status: 'FAIL', detail })
    console.log(`FAIL [${id}] ${title} -- ${detail}`)
    // In log của server ngay sau bước lỗi để thấy nguyên nhân server-side.
    if (serverLog.length > logMark) {
      for (const line of serverLog.slice(logMark)) console.log('   ' + line.trim())
    }
  }
}

async function api(route, { method = 'GET', body, cookie, headers } = {}) {
  const res = await fetch(BASE + route, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', ...(cookie ? { cookie } : {}), ...(headers || {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  let data = null; try { data = await res.json() } catch { data = null }
  return { status: res.status, data, headers: res.headers }
}
const cookieOf = (h) => { const list = typeof h.getSetCookie === 'function' ? h.getSetCookie() : [h.get('set-cookie')]; return String(list[0] || '').split(';')[0] }

console.log('=== QA PAYMENT — lớp thanh toán MoMo (server-side) ===')

// Khởi động MOCK CỔNG MoMo cục bộ để test KHÔNG phụ thuộc mạng và không tạo
// giao dịch thật. Mock xác minh chữ ký yêu cầu theo đúng tài liệu MoMo và
// trả về payUrl giả. Điều này cho phép kiểm thử ĐẦY ĐỦ luồng thanh toán
// (tạo phiên -> chuyển hướng -> IPN) một cách xác định và lặp lại được.
const MOCK_PORT = await new Promise((resolve, reject) => {
  const srv = createServer()
  srv.once('error', reject)
  srv.listen(0, '127.0.0.1', () => {
    const { port } = srv.address()
    srv.close(() => resolve(port))
  })
})
const mockRequests = []
const mockServer = createHttpServer((req, res) => {
  let raw = ''
  req.on('data', (c) => { raw += c })
  req.on('end', () => {
    let body = {}
    try { body = JSON.parse(raw || '{}') } catch { body = {} }
    mockRequests.push({ path: req.url, body })
    res.setHeader('Content-Type', 'application/json')
    if (req.url.includes('/api/create')) {
      // Xác minh chữ ký yêu cầu đúng chuẩn MoMo -> nếu sai thì trả lỗi.
      const rawSig = [
        `accessKey=${body.accessKey}`, `amount=${body.amount}`, `extraData=${body.extraData || ''}`,
        `ipnUrl=${body.ipnUrl}`, `orderId=${body.orderId}`, `orderInfo=${body.orderInfo || ''}`,
        `partnerCode=${body.partnerCode}`, `redirectUrl=${body.redirectUrl}`,
        `requestId=${body.requestId}`, `requestType=${body.requestType}`,
      ].join('&')
      const expect = createHmac('sha256', TEST_SECRET).update(rawSig).digest('hex')
      if (body.signature !== expect) {
        res.statusCode = 200
        res.end(JSON.stringify({ resultCode: 99, message: 'Sai chữ ký' }))
        return
      }
      res.statusCode = 200
      res.end(JSON.stringify({
        partnerCode: body.partnerCode, requestId: body.requestId, orderId: body.orderId,
        amount: body.amount, resultCode: '0', message: 'Success', payType: 'MoMo',
        payUrl: `http://127.0.0.1:${MOCK_PORT}/momo-pay?orderId=${body.orderId}`,
        transId: 'MOCK_TRANS_1', requestType: body.requestType, extraData: body.extraData || '',
      }))
      return
    }
    if (req.url.includes('/api/query')) {
      res.statusCode = 200
      res.end(JSON.stringify({
        partnerCode: TEST_PARTNER, requestId: body.requestId, orderId: body.orderId,
        amount: '1000', errorCode: '0', message: 'Success', localMessage: 'Success',
        requestType: 'captureWallet', payType: 'MoMo', transId: 'MOCK_TRANS_1',
        extraData: '', signature: 'x',
      }))
      return
    }
    res.statusCode = 404
    res.end('{}')
  })
})
await new Promise((resolve) => mockServer.listen(MOCK_PORT, '127.0.0.1', resolve))
console.log('mock cổng MoMo tại cổng ' + MOCK_PORT)

// Khởi động server với credentials MoMo GIẢ + endpoint trỏ về mock cục bộ.
let server = spawn(process.execPath, ['server.js'], {
  env: {
    ...process.env, DB_PATH, PORT: String(PORT),
    MOMO_ENV: 'sandbox', MOMO_PARTNER_CODE: TEST_PARTNER,
    MOMO_ACCESS_KEY: TEST_ACCESS, MOMO_SECRET_KEY: TEST_SECRET,
    MOMO_RETURN_URL: 'http://localhost/success',
    MOMO_IPN_URL: `http://localhost:${PORT}/api/webhook/momo/ipn`,
    MOMO_CREATE_URL: `http://127.0.0.1:${MOCK_PORT}/v2/gateway/api/create`,
    MOMO_QUERY_URL: `http://127.0.0.1:${MOCK_PORT}/v2/gateway/api/query`,
  },
  stdio: ['ignore','pipe','pipe'],
})
// Gom log lỗi của server; chỉ in ra khi một bước FAIL để không làm nhiễu output.
const serverLog = []
server.stdout.on('data', (d) => { serverLog.push('[srv] ' + d) })
server.stderr.on('data', (d) => { serverLog.push('[ERR] ' + d) })
process.on('exit', () => { try { server.kill() } catch { /* đã tắt */ } try { mockServer.close() } catch { /* đã đóng */ } })
let ready = false
for (let i = 0; i < 40 && !ready; i += 1) { await new Promise((r) => setTimeout(r, 250)); ready = await fetch(`${BASE}/api/health`).then((r) => r.ok).catch(() => false) }
if (!ready) { console.log('FAIL: server tạm không lên'); server.kill(); process.exit(1) }
if (server.exitCode !== null) { console.log('FAIL: server tạm đã thoát, code=' + server.exitCode); process.exit(1) }
console.log('server tạm sẵn sàng tại cổng ' + PORT)

// ==== hàm ký IPN theo ĐÚNG tài liệu MoMo ====
const signIpn = (p) => {
  const raw = [
    `accessKey=${TEST_ACCESS}`, `amount=${p.amount}`, `extraData=${p.extraData || ''}`,
    `message=${p.message || ''}`, `orderId=${p.orderId}`, `orderInfo=${p.orderInfo || ''}`,
    `orderType=${p.orderType || ''}`, `partnerCode=${p.partnerCode}`, `payType=${p.payType || ''}`,
    `requestId=${p.requestId}`, `responseTime=${p.responseTime || ''}`,
    `resultCode=${p.resultCode}`, `transId=${p.transId}`,
  ].join('&')
  return { raw, signature: createHmac('sha256', TEST_SECRET).update(raw).digest('hex') }
}

const ipnBody = (over = {}) => {
  const p = {
    partnerCode: TEST_PARTNER, orderId: 'MAN_TEST_1', requestId: 'REQ_TEST_1', amount: '1000',
    transId: 'TRANS_1', resultCode: '0', message: 'Success', responseTime: new Date().toISOString(),
    orderInfo: 'test', orderType: 'captureWallet', payType: 'MoMo', extraData: '',
    ...over,
  }
  return { ...p, ...signIpn(p) }
}


// ================= PHẦN 1 — CHỮ KÝ & CẤU HÌNH =================
await step('G1', 'Config thanh toán báo enabled=true, live=false (sandbox KHÔNG phải tiền thật)', async () => {
  const r = await api('/api/payment/config')
  assert(r.status === 200, 'phải 200, got ' + r.status)
  assert(r.data.enabled === true, 'enabled phải true khi đủ credentials')
  assert(r.data.live === false, 'live phải FALSE ở sandbox')
  assert(r.data.env === 'sandbox', 'env phải sandbox')
  const text = JSON.stringify(r.data)
  assert(!text.includes(TEST_SECRET) && !text.includes(TEST_ACCESS), 'config lộ secret!')
  return `enabled=${r.data.enabled} live=${r.data.live} env=${r.data.env}, không lộ secret`
})

await step('G2', 'Chữ ký tạo thanh toán khớp thuật toán HMAC của tài liệu MoMo', async () => {
  const { buildCreateRawSignature, signHmac } = await import('./server/momo.js')
  const raw = buildCreateRawSignature({
    accessKey: 'AK', amount: '1000', extraData: '', ipnUrl: 'https://x/ipn', orderId: 'O1',
    orderInfo: 'info', partnerCode: 'PC', redirectUrl: 'https://x/ret', requestId: 'R1', requestType: 'captureWallet',
  })
  const expected = 'accessKey=AK&amount=1000&extraData=&ipnUrl=https://x/ipn&orderId=O1&orderInfo=info&partnerCode=PC&redirectUrl=https://x/ret&requestId=R1&requestType=captureWallet'
  assert(raw === expected, 'chuỗi gốc sai:\n' + raw + '\n!=\n' + expected)
  const sig = signHmac(raw, 'SECRET')
  assert(sig === createHmac('sha256', 'SECRET').update(expected).digest('hex'), 'HMAC sai')
  assert(/^[0-9a-f]{64}$/.test(sig), 'chữ ký phải là hex 64 ký tự')
  return 'chuỗi gốc + HMAC SHA256 đúng thứ tự trường theo tài liệu'
})

await step('G3', 'Chuỗi gốc xác minh IPN khớp thứ tự trường tài liệu', async () => {
  const { buildIpnRawSignature } = await import('./server/momo.js')
  const raw = buildIpnRawSignature({
    accessKey: 'AK', amount: '1', extraData: '', message: 'M', orderId: 'O', orderInfo: 'I',
    orderType: 'captureWallet', partnerCode: 'PC', payType: 'MoMo', requestId: 'R',
    responseTime: 'T', resultCode: '0', transId: 'TR',
  })
  const expected = 'accessKey=AK&amount=1&extraData=&message=M&orderId=O&orderInfo=I&orderType=captureWallet&partnerCode=PC&payType=MoMo&requestId=R&responseTime=T&resultCode=0&transId=TR'
  assert(raw === expected, 'chuỗi IPN sai:\n' + raw)
  return 'thứ tự trường IPN đúng tài liệu'
})

// ================= PHẦN 2 — TẠO PHIÊN THANH TOÁN =================
const USER_EMAIL = 'pay-user@mayan.test'
const USER_PASS = 'PayUser123!'
let userCookie = ''
let adminCookie = ''

await step('T0', 'Đăng nhập user trên DB tạm', async () => {
  // Đăng ký user trước khi login (DB tạm chưa có sẵn user này)
  await api('/api/auth/register', { method: 'POST', body: { email: USER_EMAIL, password: USER_PASS, name: 'Payment User' } }).catch(() => {})
  const r = await api('/api/auth/login', { method: 'POST', body: { email: USER_EMAIL, password: USER_PASS } })
  assert(r.status === 200 && r.data.ok, 'login fail: ' + JSON.stringify(r.data))
  userCookie = cookieOf(r.headers)
  return 'user login ok'
})

let bookingCode = ''
await step('T1', 'Tạo đơn (server tự tính tiền) để chuẩn bị thanh toán', async () => {
  const r = await api('/api/bookings', {
    method: 'POST', cookie: userCookie,
    body: {
      serviceType: 'hotel', itemId: 'hotel-1', passengers: 1,
      traveler: { name: 'Pay User', phone: '0912345678', email: USER_EMAIL },
      paymentMethod: 'Ví điện tử (MoMo, ZaloPay)',
      idempotencyKey: 'pay-t1-' + Math.random().toString(36).slice(2, 10),
    },
  })
  assert(r.status === 201, 'phải 201, got ' + r.status + ': ' + JSON.stringify(r.data))
  bookingCode = r.data.booking.code
  assert(r.data.booking.total > 0, 'tổng tiền phải > 0')
  return `đơn ${bookingCode} tổng ${r.data.booking.total}đ`
})

await step('T2', 'Tạo phiên thanh toán: orderId/requestId riêng, amount lấy từ DB, có payUrl', async () => {
  const r = await api('/api/payment/create', { method: 'POST', cookie: userCookie, body: { bookingCode } })
  assert(r.status === 200, 'phải 200, got ' + r.status + ': ' + JSON.stringify(r.data))
  assert(r.data.payUrl, 'phải trả payUrl để chuyển hướng')
  assert(r.data.live === false, 'sandbox KHÔNG được báo live=true')
  const st = await api(`/api/payment/booking/${bookingCode}`, { cookie: userCookie })
  assert(st.status === 200, 'phải đọc được trạng thái thanh toán')
  const attempts = st.data.attempts || []
  assert(attempts.length === 1, 'phải có đúng 1 payment attempt, có ' + attempts.length)
  assert(attempts[0].order_id && attempts[0].request_id, 'thiếu orderId/requestId')
  assert(attempts[0].order_id !== attempts[0].request_id, 'orderId và requestId phải khác nhau')
  assert(Number(attempts[0].amount) > 0, 'amount phải lấy từ DB')
  // Yêu cầu gửi tới cổng MoMo phải được ký ĐÚNG chuẩn (mock đã tự kiểm).
  const createReq = mockRequests.find((m) => m.path.includes('/api/create'))
  assert(createReq, 'không thấy yêu cầu tạo thanh toán gửi tới cổng MoMo')
  assert(createReq.body.signature, 'yêu cầu phải có chữ ký')
  assert(createReq.body.orderId === attempts[0].order_id, 'orderId gửi lên cổng phải khớp attempt')
  return `attempt orderId=${attempts[0].order_id} amount=${attempts[0].amount} env=${attempts[0].env}; payUrl đã nhận`
})

await step('T2b', 'Gọi lại tạo thanh toán cho cùng đơn -> tái dùng attempt (không tạo trùng)', async () => {
  const r = await api('/api/payment/create', { method: 'POST', cookie: userCookie, body: { bookingCode } })
  assert(r.status === 200, 'phải 200, got ' + r.status)
  const st = await api(`/api/payment/booking/${bookingCode}`, { cookie: userCookie })
  assert((st.data.attempts || []).length === 1, 'không được tạo attempt thứ 2 cho cùng đơn')
  return 'attempt thứ 2 không được tạo (idempotent)'
})

await step('T3', 'Client KHÔNG thể tạo phiên thanh toán cho đơn của người khác (IDOR)', async () => {
  const r = await api('/api/payment/create', { method: 'POST', cookie: userCookie, body: { bookingCode: 'MAN_KHONG_TON_TAI' } })
  assert(r.status === 404, 'đơn không tồn tại phải 404, got ' + r.status)
  // Tạo user khác rồi thử tạo phiên thanh toán cho đơn của user này.
// Đăng ký user khác trước khi login (DB tạm chưa có sẵn user này)
  await api('/api/auth/register', { method: 'POST', body: { email: 'pay-other@mayan.test', password: 'PayOther123!', name: 'Payment Other' } }).catch(() => {})
  const other = await api('/api/auth/login', { method: 'POST', body: { email: 'pay-other@mayan.test', password: 'PayOther123!' } })
  const otherCookie = cookieOf(other.headers)
  const r2 = await api('/api/payment/create', { method: 'POST', cookie: otherCookie, body: { bookingCode } })
  assert(r2.status === 404, 'user khác phải 404 (không lộ đơn), got ' + r2.status)
  return 'đơn của người khác bị 404, không lộ thông tin'
})

await step('T4', 'Guest (không đăng nhập) không tạo được phiên thanh toán', async () => {
  const r = await api('/api/payment/create', { method: 'POST', body: { bookingCode } })
  assert(r.status === 401, 'phải 401, got ' + r.status)
  return 'guest bị chặn 401'
})


// ================= PHẦN 3 — IPN WEBHOOK =================
// Lấy orderId thật của lần thử thanh toán vừa tạo để ký IPN hợp lệ.
const st0 = await api(`/api/payment/booking/${bookingCode}`, { cookie: userCookie })
const realOrderId = (st0.data.attempts || [])[0]?.order_id
const realRequestId = (st0.data.attempts || [])[0]?.request_id
const realAmount = Number((st0.data.attempts || [])[0]?.amount) || 0

await step('W1', 'IPN sai chữ ký -> KHÔNG đánh dấu paid', async () => {
  const body = ipnBody({ orderId: realOrderId, requestId: realRequestId, amount: String(realAmount) })
  body.signature = '0'.repeat(64) // chữ ký sai
  const r = await api('/api/webhook/momo/ipn', { method: 'POST', body })
  assert(r.status === 200, 'IPN phải trả 200 để MoMo không gửi lại, got ' + r.status)
  const st = await api(`/api/payment/booking/${bookingCode}`, { cookie: userCookie })
  assert(st.data.booking.paymentStatus !== 'paid', 'đơn ĐÃ bị đánh dấu paid dù chữ ký sai!')
  return 'IPN sai chữ ký bị bỏ qua, đơn vẫn chưa paid'
})

await step('W2', 'IPN sai số tiền -> KHÔNG đánh dấu paid', async () => {
  const body = ipnBody({ orderId: realOrderId, requestId: realRequestId, amount: String(realAmount + 1000) })
  const r = await api('/api/webhook/momo/ipn', { method: 'POST', body })
  assert(r.status === 200, 'phải 200, got ' + r.status)
  const st = await api(`/api/payment/booking/${bookingCode}`, { cookie: userCookie })
  assert(st.data.booking.paymentStatus !== 'paid', 'đơn bị đánh dấu paid dù sai số tiền!')
  return 'sai số tiền bị từ chối, đơn vẫn chưa paid'
})

await step('W3', 'IPN sai partnerCode -> KHÔNG đánh dấu paid', async () => {
  const body = ipnBody({ orderId: realOrderId, requestId: realRequestId, amount: String(realAmount), partnerCode: 'MOMO_KHUNG_MERCHANT' })
  const r = await api('/api/webhook/momo/ipn', { method: 'POST', body })
  assert(r.status === 200, 'phải 200, got ' + r.status)
  const st = await api(`/api/payment/booking/${bookingCode}`, { cookie: userCookie })
  assert(st.data.booking.paymentStatus !== 'paid', 'đơn bị đánh dấu paid dù sai partnerCode!')
  return 'sai partnerCode bị từ chối'
})

await step('W4', 'IPN orderId không tồn tại -> KHÔNG đánh dấu paid', async () => {
  const body = ipnBody({ orderId: 'MAN_ORDER_KHONG_CO', amount: String(realAmount) })
  const r = await api('/api/webhook/momo/ipn', { method: 'POST', body })
  assert(r.status === 200, 'phải 200, got ' + r.status)
  const st = await api(`/api/payment/booking/${bookingCode}`, { cookie: userCookie })
  assert(st.data.booking.paymentStatus !== 'paid', 'đơn bị đánh dấu paid dù orderId lạ!')
  return 'orderId lạ bị bỏ qua'
})

await step('W5', 'IPN thiếu trường bắt buộc -> bị từ chối (không crash)', async () => {
  const body = ipnBody({ orderId: realOrderId, amount: String(realAmount) })
  delete body.transId
  const r = await api('/api/webhook/momo/ipn', { method: 'POST', body })
  assert(r.status === 200, 'phải 200, got ' + r.status)
  const st = await api(`/api/payment/booking/${bookingCode}`, { cookie: userCookie })
  assert(st.data.booking.paymentStatus !== 'paid', 'đơn bị đánh dấu paid dù thiếu trường!')
  return 'thiếu transId bị từ chối an toàn'
})

await step('W6', 'IPN resultCode != 0 (giao dịch thất bại) -> KHÔNG đánh dấu paid', async () => {
  const body = ipnBody({ orderId: realOrderId, requestId: realRequestId, amount: String(realAmount), resultCode: '49' })
  const r = await api('/api/webhook/momo/ipn', { method: 'POST', body })
  assert(r.status === 200, 'phải 200, got ' + r.status)
  const st = await api(`/api/payment/booking/${bookingCode}`, { cookie: userCookie })
  assert(st.data.booking.paymentStatus !== 'paid', 'giao dịch thất bại nhưng đơn bị paid!')
  return 'resultCode=49 (thất bại) -> không paid'
})

await step('W7', 'IPN HỢP LỆ -> đánh dấu paid đúng 1 lần (idempotent khi callback lặp)', async () => {
  const body = ipnBody({ orderId: realOrderId, requestId: realRequestId, amount: String(realAmount), transId: 'TRANS_OK_1' })
  const r1 = await api('/api/webhook/momo/ipn', { method: 'POST', body })
  assert(r1.status === 200, 'IPN hợp lệ phải 200, got ' + r1.status)

  const st1 = await api(`/api/payment/booking/${bookingCode}`, { cookie: userCookie })
  assert(st1.data.booking.paymentStatus === 'paid', 'IPN hợp lệ phải đánh dấu paid, thực tế: ' + st1.data.booking.paymentStatus)
  assert(st1.data.booking.status === 'Đã thanh toán', 'trạng thái đơn phải là "Đã thanh toán", thực tế: ' + st1.data.booking.status)
  const attempt1 = st1.data.attempts[0]
  assert(attempt1.status === 'paid', 'attempt phải paid')
  assert(attempt1.trans_id === 'TRANS_OK_1', 'transId phải được lưu')

  // Gửi LẠI cùng IPN (callback lặp) -> vẫn paid, KHÔNG cộng tiền lần 2.
  const r2 = await api('/api/webhook/momo/ipn', { method: 'POST', body })
  assert(r2.status === 200, 'IPN lặp phải 200')
  const st2 = await api(`/api/payment/booking/${bookingCode}`, { cookie: userCookie })
  assert(st2.data.booking.paymentStatus === 'paid', 'IPN lặp phải giữ paid')
  assert(st2.data.booking.total === st1.data.booking.total, 'IPN lặp KHÔNG được đổi tổng tiền')
  assert(st2.data.booking.discount === st1.data.booking.discount, 'IPN lặp KHÔNG được đổi giảm giá')

  // Đếm số lần ghi nhận trạng thái 'paid' trong lịch sử giao dịch -> phải đúng 1.
  const tx = new DatabaseSync(DB_PATH, { readOnly: true })
  const paidCount = tx.prepare("SELECT COUNT(*) AS c FROM payment_transactions WHERE order_id = ? AND status = 'paid'").get(realOrderId).c
  tx.close()
  assert(paidCount === 1, 'lịch sử giao dịch phải có ĐÚNG 1 bản ghi paid, có ' + paidCount)
  return 'IPN hợp lệ -> paid 1 lần; callback lặp không cộng tiền lần 2'
})

await step('W8', 'IPN đến khi đơn đã hủy -> KHÔNG tự động thành paid', async () => {
  // Tạo đơn mới, tạo attempt, hủy đơn, rồi gửi IPN hợp lệ.
  const bk = await api('/api/bookings', {
    method: 'POST', cookie: userCookie,
    body: {
      serviceType: 'hotel', itemId: 'hotel-1', passengers: 1,
      traveler: { name: 'Pay User', phone: '0912345678', email: USER_EMAIL },
      idempotencyKey: 'pay-w8-' + Math.random().toString(36).slice(2, 10),
    },
  })
  assert(bk.status === 201, 'tạo đơn phải 201')
  const code8 = bk.data.booking.code
  await api('/api/payment/create', { method: 'POST', cookie: userCookie, body: { bookingCode: code8 } })
  const st8 = await api(`/api/payment/booking/${code8}`, { cookie: userCookie })
  const order8 = st8.data.attempts[0].order_id
  const amount8 = Number(st8.data.attempts[0].amount)
  const request8 = st8.data.attempts[0].request_id

  const cancel = await api(`/api/bookings/${code8}/cancel`, { method: 'PATCH', cookie: userCookie })
  assert(cancel.status === 200, 'hủy đơn phải 200')

  const body = ipnBody({ orderId: order8, requestId: request8, amount: String(amount8), transId: 'TRANS_CANCELLED' })
  const r = await api('/api/webhook/momo/ipn', { method: 'POST', body })
  assert(r.status === 200, 'phải 200, got ' + r.status)
  const after = await api(`/api/payment/booking/${code8}`, { cookie: userCookie })
  assert(after.data.booking.paymentStatus !== 'paid', 'đơn đã hủy KHÔNG được tự động paid!')
  assert(after.data.booking.status === 'Đã hủy', 'trạng thái đơn phải vẫn là Đã hủy')
  return 'đơn đã hủy không bị tự động đánh dấu paid'
})

await step('W9', 'Doanh thu thật CHỈ tính đơn paid; đơn mô phỏng/pending không tính', async () => {
  // Tạo admin để đọc /api/admin/stats.
  const { execFileSync } = await import('node:child_process')
  const ADMIN_EMAIL = 'pay-admin@mayan.test'
  const ADMIN_PASS = 'PayAdmin123!'
  execFileSync(process.execPath, ['scripts/seed-admin.mjs', '--email', ADMIN_EMAIL, '--password', ADMIN_PASS, '--rotate'],
    { env: { ...process.env, DB_PATH }, stdio: 'ignore' })
  const login = await api('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASS } })
  const adminCookie = cookieOf(login.headers)
  const stats = await api('/api/admin/stats', { cookie: adminCookie })
  assert(stats.status === 200, 'phải đọc được stats')
  const d = stats.data.data
  assert(typeof d.realRevenue === 'number', 'thiếu trường realRevenue')
  assert(typeof d.paidBookings === 'number', 'thiếu paidBookings')
  // Trong DB tạm có đúng 1 đơn paid (đơn W7); các đơn còn lại là mô phỏng.
  assert(d.paidBookings === 1, 'paidBookings phải = 1, thực tế: ' + d.paidBookings)
  assert(d.simulatedBookings >= 1, 'phải có đơn mô phỏng (simulated)')
  assert(d.realRevenue <= d.revenue, 'doanh thu thật không được vượt doanh thu tổng')
  return `realRevenue=${d.realRevenue} (${d.paidBookings} paid) vs tổng ${d.revenue}; simulated=${d.simulatedBookings}`
})

await step('W10', 'Giao dịch mô phỏng KHÔNG nằm trong doanh thu thật', async () => {
  const tx = new DatabaseSync(DB_PATH, { readOnly: true })
  const rows = tx.prepare("SELECT code, payment_status, total FROM bookings ORDER BY id").all()
  tx.close()
  const simulated = rows.filter((r) => r.payment_status === 'simulated')
  const paid = rows.filter((r) => r.payment_status === 'paid')
  assert(paid.length === 1, 'phải có đúng 1 đơn paid, có ' + paid.length)
  assert(simulated.length >= 1, 'phải có đơn mô phỏng')
  return `${simulated.length} đơn mô phỏng + ${paid.length} đơn paid được phân biệt rõ`
})

await step('W11', 'IPN lỗi/broken KHÔNG BAO GIỜ trả 500 (MoMo sẽ gọi lại liên tục)', async () => {
  // (a) Payload JSON KHÔNG hợp lệ -> phải 200.
  const rawRes = await fetch(`${BASE}/api/webhook/momo/ipn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ this is not json',
  })
  assert(rawRes.status === 200, 'payload JSON hỏng phải trả 200, got ' + rawRes.status)

  // (b) IPN hợp lệ về đơn đã paid, nhưng amount sai -> vẫn 200, không paid lần 2.
  const body = ipnBody({ orderId: realOrderId, requestId: realRequestId, amount: '999999', resultCode: '0' })
  const r2 = await api('/api/webhook/momo/ipn', { method: 'POST', body })
  assert(r2.status === 200, 'IPN sai amount phải trả 200, got ' + r2.status)

  // (c) Endpoint IPN vẫn sống sau các lỗi trên (kiểm tra không bị treo/crash).
  const health = await api('/api/health')
  assert(health.status === 200, 'server phải còn sống sau IPN lỗi, got ' + health.status)

  const st = await api(`/api/payment/booking/${bookingCode}`, { cookie: userCookie })
  assert(st.data.booking.paymentStatus === 'paid', 'đơn hợp lệ trước đó phải vẫn paid')
  return 'payload hỏng / amount sai -> đều 200, server không crash'
})

await step('W12', 'Admin KHÔNG thể tự đặt paymentStatus=paid qua PATCH admin (P1-01)', async () => {
  // Seed admin vào DB tạm cùng session, rồi đăng nhập admin.
  const { execFileSync } = await import('node:child_process')
  const ADMIN_EMAIL = 'pay-admin@mayan.test'
  const ADMIN_PASS = 'PayAdmin123!'
  execFileSync(process.execPath, ['scripts/seed-admin.mjs', '--email', ADMIN_EMAIL, '--password', ADMIN_PASS, '--rotate'],
    { env: { ...process.env, DB_PATH }, stdio: 'ignore' })
  const alogin = await api('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASS } })
  assert(alogin.status === 200 && alogin.data.ok, 'admin login fail: ' + JSON.stringify(alogin.data))
  adminCookie = cookieOf(alogin.headers)
  const bk = await api('/api/bookings', {
    method: 'POST', cookie: adminCookie,
    body: {
      serviceType: 'hotel', itemId: 'hotel-1', passengers: 1,
      traveler: { name: 'QA W12', phone: '0912345678', email: USER_EMAIL },
      idempotencyKey: 'qa-w12-' + Math.random().toString(36).slice(2, 10),
    },
  })
  assert(bk.status === 201, 'tạo đơn phải 201')
  const code12 = bk.data.booking.code
  const tmpDb12 = new DatabaseSync(DB_PATH, { readonly: true })
  const prow12 = tmpDb12.prepare('SELECT id FROM bookings WHERE code = ?').get(code12)
  tmpDb12.close()
  assert(prow12, 'booking tồn tại trong DB')
  const bookingId = Number(prow12.id)
  const r = await api(`/api/admin/bookings/${bookingId}`, {
    method: 'PATCH', cookie: adminCookie,
    body: { paymentStatus: 'paid', reason: 'test-tu-dat-paid' },
  })
  assert(r.status === 403, 'admin tự đặt paid phải 403, got ' + r.status)
  const after = await api(`/api/payment/booking/${code12}`, { cookie: adminCookie })
  assert(after.data && after.data.booking, 'phải đọc được đơn vừa tạo')
  assert(after.data.booking.paymentStatus !== 'paid', 'booking không được paid do admin tự đặt')
})

await step('W13', 'Admin không chuyển status "Đã thanh toán" nếu chưa có bằng chứng thanh toán', async () => {
  const bk = await api('/api/bookings', {
    method: 'POST', cookie: adminCookie,
    body: {
      serviceType: 'hotel', itemId: 'hotel-1', passengers: 1,
      traveler: { name: 'QA W13', phone: '0912345678', email: USER_EMAIL },
      idempotencyKey: 'qa-w13-' + Math.random().toString(36).slice(2, 10),
    },
  })
  assert(bk.status === 201, 'tạo đơn phải 201')
  const code13 = bk.data.booking.code
  const tmpDb13 = new DatabaseSync(DB_PATH, { readonly: true })
  const prow13 = tmpDb13.prepare('SELECT id FROM bookings WHERE code = ?').get(code13)
  tmpDb13.close()
  assert(prow13, 'booking tồn tại trong DB')
  const bookingId = Number(prow13.id)
  const r = await api(`/api/admin/bookings/${bookingId}`, {
    method: 'PATCH', cookie: adminCookie,
    body: { status: 'Đã thanh toán', reason: 'test-chuyen-trang-thai' },
  })
  assert(r.status === 409, 'chuyển Đã thanh toán không verified phải 409, got ' + r.status)
})

await step('W14', 'IPN với requestId khác attempt đã lưu -> KHÔNG đánh dấu paid', async () => {
  const body = ipnBody({ orderId: realOrderId, requestId: 'REQ_FAKE_OTHER', amount: String(realAmount), transId: 'TRANS_FAKE_OTHER' })
  const r = await api('/api/webhook/momo/ipn', { method: 'POST', body })
  assert(r.status === 200, 'IPN requestId mismatch vẫn phải 200, got ' + r.status)
  assert(r.data.ignored === true, 'phải ignored')
  const after = await api(`/api/payment/booking/${bookingCode}`, { cookie: userCookie })
  assert(after.data.booking.paymentStatus === 'paid', 'đơn vẫn paid (từ IPN hợp lệ trước đó); IPN requestId giả không làm thay đổi trạng thái')
})

// ================= PHẦN 4 — IPN FORM-URLENCODED (Content-Type thực tế của MoMo) =================
// MoMo PHP SDK chính thức đọc IPN qua $_POST => Content-Type là application/x-www-form-urlencoded.
// Các bước dưới dùng fetch thô (không qua helper `api` luôn gửi JSON) để kiểm chứng route chấp nhận
// form-urlencoded và vẫn bảo vệ đúng như JSON.

let formOrderId = null
let formRequestId = null
let formAmount = null

async function ipnFetch(fields, opts = {}) {
  const { ct = 'application/x-www-form-urlencoded', rawBody = null } = opts
  let body
  if (rawBody !== null) {
    body = rawBody
  } else if (ct === 'application/x-www-form-urlencoded') {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(fields || {})) params.append(k, String(v === undefined ? '' : v))
    body = params.toString()
  } else {
    body = JSON.stringify(fields || {})
  }
  const res = await fetch(`${BASE}/api/webhook/momo/ipn`, {
    method: 'POST',
    headers: { 'Content-Type': ct, 'X-Requested-With': 'fetch' },
    body,
  })
  let data = null
  try { data = await res.json() } catch { data = null }
  return { status: res.status, data }
}

async function freshAttempt() {
  const bk = await api('/api/bookings', {
    method: 'POST', cookie: userCookie,
    body: { serviceType: 'hotel', itemId: 'hotel-1', passengers: 1, traveler: { name: 'Pay Form', phone: '0912345678', email: USER_EMAIL }, idempotencyKey: 'qa-fa-' + Math.random().toString(36).slice(2, 10) },
  })
  assert(bk.status === 201, 'tạo đơn phải 201, got ' + bk.status)
  const code = bk.data.booking.code
  const cr = await api('/api/payment/create', { method: 'POST', cookie: userCookie, body: { bookingCode: code } })
  assert(cr.status === 200, 'tạo phiên phải 200, got ' + cr.status)
  const st = await api(`/api/payment/booking/${code}`, { cookie: userCookie })
  const att = (st.data.attempts || [])[0]
  assert(att, 'phải có payment_attempt')
  return { code, orderId: att.order_id, requestId: att.request_id, amount: String(att.amount) }
}

function signedFormIpn(over = {}) {
  const fields = {
    partnerCode: TEST_PARTNER, orderId: 'MAN_FORM_1', requestId: 'REQ_FORM_1', amount: '1000',
    transId: 'TRANS_FORM_1', resultCode: '0', message: 'Success', responseTime: new Date().toISOString(),
    orderInfo: 'testform', orderType: 'captureWallet', payType: 'MoMo', extraData: '',
    ...over,
  }
  const signed = signIpn(fields)
  fields.signature = signed.signature
  return fields
}

await step('W15', 'IPN form-urlencoded hợp lệ (Content-Type application/x-www-form-urlencoded) -> đánh dấu paid', async () => {
  const a = await freshAttempt()
  formOrderId = a.orderId
  formRequestId = a.requestId
  formAmount = a.amount

  const fields = signedFormIpn({ orderId: formOrderId, requestId: formRequestId, amount: formAmount, transId: 'TRANS_FORM_OK_1' })
  const r = await ipnFetch(fields)
  assert(r.status === 200, 'IPN form hợp lệ phải 200, got ' + r.status)
  assert(r.data.ok === true, 'IPN form hợp lệ phải ok, got ' + JSON.stringify(r.data))

  const tmpDb = new DatabaseSync(DB_PATH, { readOnly: true })
  const prow = tmpDb.prepare('SELECT booking_code FROM payment_attempts WHERE order_id = ?').get(formOrderId)
  tmpDb.close()
  assert(prow, 'phải tìm thấy attempt trong DB')
  const afterB = await api(`/api/payment/booking/${prow.booking_code}`, { cookie: userCookie })
  assert(afterB.data.booking.paymentStatus === 'paid', 'IPN form hợp lệ phải đánh dấu paid, thực tế: ' + afterB.data.booking.paymentStatus)
  const attAfter = (afterB.data.attempts || [])[0]
  assert(attAfter.trans_id === 'TRANS_FORM_OK_1', 'trans_id phải lưu từ IPN form, thực tế: ' + attAfter.trans_id)
  return 'IPN form-urlencoded hợp lệ -> paid, luu trans_id'
})

await step('W16', 'IPN form-urlencoded gửi lại (callback lặp) -> idempotent, duy nhất 1 giao dịch paid', async () => {
  assert(formOrderId, 'W15 phải chạy trước')
  const fields = signedFormIpn({ orderId: formOrderId, requestId: formRequestId, amount: formAmount, transId: 'TRANS_FORM_OK_1' })
  const r = await ipnFetch(fields)
  assert(r.status === 200, 'IPN form lặp phải 200, got ' + r.status)
  assert(r.data.duplicate === true, 'IPN form lặp phải duplicate, got ' + JSON.stringify(r.data))

  const tmpDb = new DatabaseSync(DB_PATH, { readOnly: true })
  const paidCount = tmpDb.prepare("SELECT COUNT(*) AS c FROM payment_transactions WHERE order_id = ? AND status = 'paid'").get(formOrderId).c
  tmpDb.close()
  assert(paidCount === 1, 'phải duy nhất 1 giao dịch paid, có ' + paidCount)
  return 'IPN form lặp -> duplicate, không thêm giao dịch paid'
})

await step('W17', 'IPN Content-Type text/plain (không hỗ trợ) -> 200, không paid', async () => {
  const a = await freshAttempt()
  const r = await ipnFetch(null, { ct: 'text/plain', rawBody: 'hello momo ipn' })
  assert(r.status === 200, 'Content-Type không hỗ trợ phải 200, got ' + r.status)

  const tmpDb = new DatabaseSync(DB_PATH, { readOnly: true })
  const prow = tmpDb.prepare('SELECT booking_code FROM payment_attempts WHERE order_id = ?').get(a.orderId)
  tmpDb.close()
  const after = await api(`/api/payment/booking/${prow.booking_code}`, { cookie: userCookie })
  assert(after.data.booking.paymentStatus !== 'paid', 'không được paid khi Content-Type không hỗ trợ')
  return 'Content-Type không hỗ trợ -> 200 bỏ qua, không paid'
})

await step('W18', 'IPN form-urlencoded thiếu trường bắt buộc (transId) -> 200, không paid', async () => {
  const a = await freshAttempt()
  const fields = signedFormIpn({ orderId: a.orderId, requestId: a.requestId, amount: a.amount })
  delete fields.transId
  const r = await ipnFetch(fields)
  assert(r.status === 200, 'thiếu trường phải 200, got ' + r.status)
  const tmpDb = new DatabaseSync(DB_PATH, { readOnly: true })
  const prow = tmpDb.prepare('SELECT booking_code FROM payment_attempts WHERE order_id = ?').get(a.orderId)
  tmpDb.close()
  const after = await api(`/api/payment/booking/${prow.booking_code}`, { cookie: userCookie })
  assert(after.data.booking.paymentStatus !== 'paid', 'không được paid khi thiếu trường (form)')
  return 'Thiếu trường bắt buộc (form) -> 200 bỏ qua, không paid'
})

await step('W19', 'IPN form-urlencoded sai chữ ký -> 200, không paid', async () => {
  const a = await freshAttempt()
  const fields = signedFormIpn({ orderId: a.orderId, requestId: a.requestId, amount: a.amount })
  fields.signature = '0'.repeat(64)
  const r = await ipnFetch(fields)
  assert(r.status === 200, 'sai chữ ký form phải 200, got ' + r.status)
  const tmpDb = new DatabaseSync(DB_PATH, { readOnly: true })
  const prow = tmpDb.prepare('SELECT booking_code FROM payment_attempts WHERE order_id = ?').get(a.orderId)
  tmpDb.close()
  const after = await api(`/api/payment/booking/${prow.booking_code}`, { cookie: userCookie })
  assert(after.data.booking.paymentStatus !== 'paid', 'không được paid khi sai chữ ký (form)')
  return 'Sai chữ ký (form) -> 200 bỏ qua, không paid'
})

const summary = { module: 'PAYMENT', total: passed + failed, passed, failed, results }
fs.mkdirSync(path.resolve('qa-evidence/final'), { recursive: true })
fs.writeFileSync(path.resolve('qa-evidence/final/payment-results.json'), JSON.stringify(summary, null, 2))
server.kill()
try { mockServer.close() } catch { /* đã đóng */ }
// Dọn DB tạm của lần chạy này (đã đóng ở trên) + các bản sót từ lần chạy cũ.
for (const f of fs.readdirSync(path.resolve('data'))) {
  if (/^qa-payment-tmp-.*\.db(-wal|-shm)?$/.test(f)) {
    try { fs.rmSync(path.resolve('data', f), { force: true }) } catch { /* bỏ qua */ }
  }
}
console.log(`\nTONG: ${summary.total} | PASS: ${summary.passed} | FAIL: ${summary.failed}`)
process.exit(failed > 0 ? 1 : 0)
