// server/routes-payment.js — API thanh toán (MoMo) cho người dùng + webhook IPN.
//
// NGUYÊN TẮC BẤT BUỘC (theo yêu cầu triển khai production):
//  1. Server tự lấy giá từ DB và tự tính tổng tiền — client không được gửi amount.
//  2. Mỗi lần thanh toán có orderId + requestId riêng, không trùng.
//  3. Lưu payment_attempts gắn với booking.
//  4. Chỉ backend ký request (secretKey không ra ngoài).
//  5. payUrl KHÔNG phải bằng chứng thanh toán.
//  6. IPN phải xác minh chữ ký + đối chiếu orderId / amount / partnerCode.
//  7. IPN lặp phải idempotent (chỉ xử lý nghiệp vụ 1 lần).
//  8. Không đánh dấu paid khi chữ ký sai, sai số tiền, đơn không tồn tại.
//  9. Không chuyển trạng thái booking trái đồ thị cho phép.
// 10. Giao dịch sandbox KHÔNG được tính vào doanh thu thật.
import { Router } from 'express'
import express from 'express'
import { db, getPaymentAttempt, updatePaymentAttempt, recordPaymentTransaction, listPaymentTransactions, writeAuditLog } from './db.js'
import { requireAuth, rateLimitMiddleware } from './auth.js'
import { createPayment, newOrderId, newRequestId, queryPayment, verifyIpn, MOMO_ENABLED, MOMO_LIVE_ENABLED, MOMO_CONFIG } from './momo.js'

export const paymentRouter = Router()

const bad = (res, error, status = 400) => res.status(status).json({ error })
const SERVICE_NAMES = { flight: 'Vé máy bay', hotel: 'Khách sạn', combo: 'Combo du lịch' }

// Số tiền tối thiểu MoMo chấp nhận (VND).
const MOMO_MIN_AMOUNT = 1000

/**
 * Cấu hình thanh toán mà frontend được biết (KHÔNG chứa secret).
 * - enabled: cổng thanh toán đã cấu hình đủ credential.
 * - live: đang ở chế độ TIỀN THẬT (production + allowLive). Khi false, mọi giao dịch
 *   là mô phỏng/sandbox và KHÔNG được coi là doanh thu thật.
 */
paymentRouter.get('/config', (req, res) => {
  res.json({
    enabled: MOMO_ENABLED,
    live: MOMO_LIVE_ENABLED,
    provider: 'momo',
    env: MOMO_CONFIG.env,
    currency: 'VND',
  })
})

/**
 * Tạo yêu cầu thanh toán cho MỘT đơn của chính người dùng.
 * Client KHÔNG được gửi amount — server lấy `total` từ database.
 */
paymentRouter.post('/create', requireAuth, rateLimitMiddleware('pay-create', { windowMs: 60_000, max: 10 }), async (req, res) => {
  if (!MOMO_ENABLED) {
    return bad(res, 'Cổng thanh toán chưa được cấu hình. Vui lòng liên hệ quản trị viên.', 503)
  }
  const userId = Number(req.session.user.id)
  const bookingCode = String(req.body?.bookingCode || '').trim()
  if (!bookingCode) return bad(res, 'Thiếu mã đơn hàng.')

  const booking = db.prepare('SELECT * FROM bookings WHERE code = ?').get(bookingCode)
  if (!booking) return bad(res, 'Không tìm thấy đơn hàng.', 404)
  // IDOR: chỉ chủ đơn mới tạo được phiên thanh toán cho đơn đó.
  if (Number(booking.user_id) !== userId) return bad(res, 'Không tìm thấy đơn hàng.', 404)
  if (booking.status === 'Đã hủy') return bad(res, 'Đơn hàng đã bị hủy, không thể thanh toán.', 409)
  if (booking.payment_status === 'paid') return bad(res, 'Đơn hàng đã được thanh toán.', 409)

  const amount = Number(booking.total) || 0
  if (amount < MOMO_MIN_AMOUNT) return bad(res, 'Số tiền đơn hàng không hợp lệ để thanh toán.', 409)

  // Đã có phiên thanh toán đang mở cho đơn này -> trả lại payUrl cũ (tránh tạo trùng).
  const pending = db.prepare(`SELECT * FROM payment_attempts
                               WHERE booking_code = ? AND status IN ('created','redirected')
                               ORDER BY id DESC LIMIT 1`).get(bookingCode)
  if (pending) {
    return res.json({
      ok: true,
      orderId: pending.order_id,
      amount: pending.amount,
      live: MOMO_LIVE_ENABLED,
      reused: true,
      message: 'Phiên thanh toán đang mở cho đơn này.',
    })
  }

  const orderId = newOrderId()
  const requestId = newRequestId()
  const orderInfo = `Thanh toán ${SERVICE_NAMES[booking.service_type] || 'đặt chỗ'} - ${booking.code}`

  // Ghi lần thử thanh toán TRƯỚC khi gọi cổng, để mọi request đều có dấu vết điều tra.
  db.prepare(`INSERT INTO payment_attempts
      (booking_code, user_id, provider, order_id, request_id, amount, status, env)
      VALUES (?,?,?,?,?,?,?,?)`)
    .run(bookingCode, userId, 'momo', orderId, requestId, amount, 'created', MOMO_CONFIG.env)

  const result = await createPayment({
    orderId,
    amount,
    orderInfo,
    returnUrl: MOMO_CONFIG.returnUrl,
    ipnUrl: MOMO_CONFIG.ipnUrl,
    extraData: bookingCode,
  })

  if (!result.ok) {
    db.prepare(`UPDATE payment_attempts SET status = 'failed',
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE order_id = ?`).run(orderId)
    recordPaymentTransaction({ orderId, bookingCode, status: 'failed', amount, source: 'create' })
    writeAuditLog({ actorId: userId, actorEmail: req.session.user.email, action: 'payment.create.failed', entityType: 'booking', entityId: bookingCode, ip: req.ip })
    return bad(res, result.error || 'Không tạo được phiên thanh toán.', 502)
  }

  db.prepare(`UPDATE payment_attempts SET status = 'redirected', request_id = ?,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE order_id = ?`).run(result.requestId, orderId)
  recordPaymentTransaction({ orderId, bookingCode, status: 'redirected', amount, source: 'create' })
  writeAuditLog({ actorId: userId, actorEmail: req.session.user.email, action: 'payment.create', entityType: 'booking', entityId: bookingCode, detail: `order=${orderId} env=${MOMO_CONFIG.env}`, ip: req.ip })

  res.json({
    ok: true,
    orderId,
    requestId: result.requestId,
    amount,
    payUrl: result.payUrl,
    live: MOMO_LIVE_ENABLED,
    env: MOMO_CONFIG.env,
  })
})


/* ------------------------------------------------------------- IPN webhook */
// IPN đến từ MoMo (server-to-server). Endpoint này:
//  - KHÔNG yêu cầu phiên đăng nhập (MoMo không có cookie của ta).
//  - Bắt buộc xác minh chữ ký HMAC trước khi bất kỳ thay đổi nào.
//  - MoMo gửi IPN qua HTTP POST. Theo SDK chính thức (php/PayMoMo/ipn_momo.php)
//    MoMo đọc IPN qua $_POST => Content-Type thực tế là
//    application/x-www-form-urlencoded. Route chấp nhận CỢ JSON và form-urlencoded
//    (express.json + express.urlencoded), nhưng VẪN BUỘC phải xác minh chữ ký,
//    mã đơn, số tiền, kết quả và attempt tương ứng trước khi đổi trạng thái.
export const momoIpnRouter = Router()

momoIpnRouter.post('/momo/ipn', express.json({ limit: '64kb' }), express.urlencoded({ limit: '64kb', extended: false }), async (req, res) => {
  // MoMo yêu cầu trả HTTP 200 cho mọi IPN đã nhận, kể cả khi bỏ qua nghiệp vụ,
  // để không gửi lặp. Lỗi nghiệp vụ chỉ ghi log, không ném.
  //
  // Vì vậy TOÀN BỘ logic bên dưới được bọc trong try/catch: bất kỳ lỗi nào
  // (SQLite bận, constraint, lỗi lập trình) cũng phải trả 200 + ghi log,
  // TUYỆT ĐỐI không trả 500 — vì 500 khiến MoMo gửi lại liên tục và có thể
  // khiến giao dịch thật bị treo. Lỗi ở đây KHÔNG được phép đánh dấu paid.
  try {
    await handleMomoIpn(req, res)
  } catch (err) {
    console.error('[momo-ipn] lỗi ngoài dự kiến khi xử lý IPN:', err?.message || err)
    if (!res.headersSent) return res.status(200).json({ ok: true, ignored: true, error: true })
    return undefined
  }
})

/**
 * Xử lý 1 IPN của MoMo. Luôn trả HTTP 200 (kể cả khi bỏ qua nghiệp vụ) vì
 * MoMo chỉ chấp nhận 200 và sẽ gửi lại IPN nếu nhận 4xx/5xx.
 */
async function handleMomoIpn(req, res) {
  const body = req.body || {}

  // Content-Type không được hỗ trợ (không JSON và không form-urlencoded)
  // hoặc body rỗng -> MoMo coi là "chưa nhận được" -> phải trả 200, không xử lý.
  // Ghi log có cấu trúc (event=...) để monitoring, KHÔNG ghi secret/nhạy cảm.
  const ct = String(req.headers['content-type'] || '')
  const isJson = ct.includes('application/json')
  const isForm = ct.includes('application/x-www-form-urlencoded')
  if (!isJson && !isForm) {
    console.warn('[momo-ipn] event=unsupported_content_type Content-Type không được hỗ trợ/body rỗng -> bỏ qua (trả 200). ct=', ct, 'ip=', req.ip)
    return res.status(200).json({ ok: true, ignored: true })
  }

  if (!MOMO_ENABLED) {
    console.warn('[momo-ipn] event=gateway_not_configured nhận IPN nhưng cổng thanh toán chưa cấu hình -> bỏ qua.')
    return res.status(200).json({ ok: true, ignored: true })
  }

  // 1) Xác minh chữ ký. Sai chữ ký -> KHÔNG đổi trạng thái gì cả.
  const check = verifyIpn(body)
  if (!check.valid) {
    console.warn('[momo-ipn] event=ipn_invalid bỏ qua IPN không hợp lệ:', check.reason, 'ip=', req.ip)
    recordPaymentTransaction({ orderId: body?.orderId || '', status: 'invalid_signature', amount: Number(body?.amount) || null, resultCode: body?.resultCode, source: 'ipn' })
    writeAuditLog({ action: 'payment.ipn.invalid', entityType: 'momo_ipn', entityId: String(body?.orderId || ''), detail: check.reason, ip: req.ip })
    return res.status(200).json({ ok: true, ignored: true })
  }

  const ipn = check.data
  const orderId = String(ipn.orderId || '')
  const amount = Number(ipn.amount) || 0
  const resultCode = String(ipn.resultCode || '')

  // 2) Tìm lần thử thanh toán theo orderId.
  const attempt = getPaymentAttempt(orderId)
  if (!attempt) {
    console.warn('[momo-ipn] event=ipn_unknown_order không tìm thấy payment_attempt cho orderId:', orderId, 'ip=', req.ip)
    recordPaymentTransaction({ orderId, status: 'unknown_order', amount, resultCode, source: 'ipn' })
    writeAuditLog({ action: 'payment.ipn.unknown_order', entityType: 'momo_ipn', entityId: orderId, ip: req.ip })
    return res.status(200).json({ ok: true, ignored: true })
  }

  // 2b) Chống replay: requestId trong IPN phải khớp attempt đã lưu cho orderId này.
  // Ngăn kẻ tấn công gửi IPN với cùng orderId nhưng requestId khác (gửi từ một phiên thanh toán khác).
  if (String(ipn.requestId || '') !== String(attempt.request_id || '')) {
    console.warn('[momo-ipn] event=ipn_request_id_mismatch requestId không khớp attempt đã lưu:', orderId, 'ip=', req.ip)
    recordPaymentTransaction({ orderId, bookingCode: attempt.booking_code, status: 'request_id_mismatch', amount, resultCode, source: 'ipn' })
    writeAuditLog({ action: 'payment.ipn.request_id_mismatch', entityType: 'booking', entityId: attempt.booking_code, detail: `order=${orderId}`, ip: req.ip })
    return res.status(200).json({ ok: true, ignored: true })
  }

  const booking = db.prepare('SELECT * FROM bookings WHERE code = ?').get(attempt.booking_code)
  if (!booking) {
    recordPaymentTransaction({ orderId, bookingCode: attempt.booking_code, status: 'unknown_booking', amount, resultCode, source: 'ipn' })
    return res.status(200).json({ ok: true, ignored: true })
  }

  // 3) Đối chiếu SỐ TIỀN. Sai số tiền -> không đánh dấu paid.
  if (amount !== Number(attempt.amount) || amount !== Number(booking.total)) {
    console.warn('[momo-ipn] event=ipn_amount_mismatch sai số tiền cho orderId:', orderId, 'ip=', req.ip)
    recordPaymentTransaction({ orderId, bookingCode: attempt.booking_code, status: 'amount_mismatch', amount, resultCode, source: 'ipn' })
    writeAuditLog({ action: 'payment.ipn.amount_mismatch', entityType: 'booking', entityId: attempt.booking_code, detail: `order=${orderId}`, ip: req.ip })
    return res.status(200).json({ ok: true, ignored: true })
  }

  // 4) Idempotency: nếu đơn đã 'paid' -> trả 200, KHÔNG cộng tiền/đổi trạng thái lần nữa.
  if (booking.payment_status === 'paid') {
    console.log('[momo-ipn] event=ipn_duplicate đơn đã paid trước đó, bỏ qua IPN lặp. orderId=', orderId, 'ip=', req.ip)
    recordPaymentTransaction({ orderId, bookingCode: attempt.booking_code, status: 'duplicate', amount, transId: ipn.transId, resultCode, source: 'ipn' })
    return res.status(200).json({ ok: true, duplicate: true })
  }

  // 5) Chỉ resultCode = 0 mới là thanh toán thành công.
  if (resultCode !== '0') {
    updatePaymentAttempt(orderId, { status: 'failed' })
    recordPaymentTransaction({ orderId, bookingCode: attempt.booking_code, status: 'failed', amount, transId: ipn.transId, resultCode, source: 'ipn' })
    writeAuditLog({ action: 'payment.ipn.failed', entityType: 'booking', entityId: attempt.booking_code, detail: `resultCode=${resultCode}`, ip: req.ip })
    return res.status(200).json({ ok: true, failed: true })
  }

  // 6) Đồ thị trạng thái: đơn đã hủy thì KHÔNG được tự động thành paid.
  if (booking.status === 'Đã hủy') {
    recordPaymentTransaction({ orderId, bookingCode: attempt.booking_code, status: 'cancelled_booking', amount, transId: ipn.transId, resultCode, source: 'ipn' })
    writeAuditLog({ action: 'payment.ipn.cancelled_booking', entityType: 'booking', entityId: attempt.booking_code, ip: req.ip })
    return res.status(200).json({ ok: true, ignored: true })
  }


  // 7) Ghi nhận thanh toán — thực hiện TRONG MỘT TRANSACTION.
  try {
    db.exec('BEGIN')
    db.prepare(`UPDATE bookings SET payment_status = 'paid', status = 'Đã thanh toán',
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(booking.id)
    db.prepare(`UPDATE payment_attempts SET status = 'paid', trans_id = ?,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE order_id = ?`).run(ipn.transId || null, orderId)
    recordPaymentTransaction({ orderId, bookingCode: attempt.booking_code, status: 'paid', amount, transId: ipn.transId, resultCode, source: 'ipn' })
    writeAuditLog({ actorId: attempt.user_id, action: 'payment.paid', entityType: 'booking', entityId: attempt.booking_code, detail: `order=${orderId} transId=${ipn.transId || ''}`, ip: req.ip })
    db.exec('COMMIT')
  } catch (err) {
    try { db.exec('ROLLBACK') } catch { /* không có transaction để hoàn tác */ }
    console.error('[momo-ipn] event=ipn_paid_error lỗi khi ghi nhận thanh toán:', err.message, 'ip=', req.ip)
    return res.status(200).json({ ok: true, ignored: true })
  }

  console.log('[momo-ipn] event=ipn_paid đơn chuyển sang paid. orderId=', orderId, 'transId=', ipn.transId || '', 'ip=', req.ip)
  return res.status(200).json({ ok: true })
}

/* --------------------------------------------- trạng thái thanh toán của đơn */
// Người dùng xem trạng thái thanh toán của chính đơn của mình.
// KHÔNG dùng endpoint này để xác nhận thanh toán — nó chỉ hiển thị trạng thái
// đã được server ghi nhận qua IPN/query.
paymentRouter.get('/booking/:code', requireAuth, (req, res) => {
  const userId = Number(req.session.user.id)
  const code = String(req.params.code || '')
  const booking = db.prepare('SELECT * FROM bookings WHERE code = ? AND user_id = ?').get(code, userId)
  if (!booking) return bad(res, 'Không tìm thấy đơn hàng.', 404)

  const attempts = db.prepare(`SELECT order_id, request_id, amount, status, trans_id, env, created_at, updated_at
                               FROM payment_attempts WHERE booking_code = ? ORDER BY id DESC`).all(code)
  res.json({
    ok: true,
    booking: {
      code: booking.code,
      status: booking.status,
      paymentStatus: booking.payment_status,
      total: booking.total,
    },
    attempts,
  })
})

/**
 * Đối soát: hỏi trực tiếp MoMo về trạng thái giao dịch của orderId.
 * Dùng khi IPN bị lỡ hoặc cần xác minh thủ công — module momo.js đã xác minh
 * chữ ký phản hồi trước khi trả kết quả.
 */
paymentRouter.post('/query', requireAuth, rateLimitMiddleware('pay-query', { windowMs: 60_000, max: 10 }), async (req, res) => {
  const userId = Number(req.session.user.id)
  const orderId = String(req.body?.orderId || '').trim()
  if (!orderId) return bad(res, 'Thiếu mã giao dịch (orderId).')
  const attempt = getPaymentAttempt(orderId)
  if (!attempt) return bad(res, 'Không tìm thấy giao dịch.', 404)
  if (Number(attempt.user_id) !== userId) return bad(res, 'Không tìm thấy giao dịch.', 404)

  const result = await queryPayment(orderId)
  if (!result.ok) return bad(res, result.error || 'Không truy vấn được giao dịch.', 502)

  const history = listPaymentTransactions(orderId)
  res.json({
    ok: true,
    orderId,
    paid: result.paid === true,
    transId: result.transId || null,
    amount: result.amount || attempt.amount,
    env: attempt.env,
    live: MOMO_LIVE_ENABLED,
    history,
  })
})
