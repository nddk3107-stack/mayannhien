// server/routes-admin.js — Toàn bộ API quản trị. Mọi route đều bắt buộc đăng nhập + role admin.
import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import ExcelJS from 'exceljs'
import {
  db, listFlights, listHotels, listPromotions, hotelOut, flightOut, promoOut, comboOut,
  roomOut,
  deleteSessionsOfUser, writeAuditLog, listAuditLog, listAuditLogsFiltered, listPaymentAttempts, listPaymentTransactions,
  listExtraServices, getExtraService, createExtraService, updateExtraService, deleteExtraService,
} from './db.js'
import { requireAdmin } from './auth.js'
import { broadcastBookingUpdated, broadcastCatalogUpdated, pushNotification } from './realtime.js'

export const adminRouter = Router()
adminRouter.use(requireAdmin)

const ok = (res, data = null, extra = {}) => res.json({ ok: true, data, ...extra })
const bad = (res, error, status = 400) => res.status(status).json({ error })
const txt = (v, max = 200, min = 1) => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s.length >= min && s.length <= max ? s : null
}
const int = (v, min, max) => {
  const n = Number(v)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}
const bool = (v) => (typeof v === 'boolean' ? v : v === 1 || v === '1' || v === 'true' ? true : v === 0 || v === '0' || v === 'false' ? false : null)
const newId = (prefix) => `${prefix}-${randomBytes(3).toString('hex')}`
const exists = (table, id) => !!db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(String(id))

/**
 * Ghi nhật ký thao tác quản trị. Mọi route ghi dữ liệu (POST/PATCH/DELETE) PHẢI
 * gọi hàm này -> audit-log luôn phản ánh đúng những gì admin đã làm.
 * `detail` chỉ chứa thông tin cần điều tra, KHÔNG chứa secret.
 */
const audit = (req, action, entityType, entityId, detail = '') =>
  writeAuditLog({
    actorId: req.session.user.id, actorEmail: req.session.user.email,
    action, entityType, entityId: String(entityId ?? ''), detail: String(detail), ip: req.ip,
  })

/* ------------------------------------------------------------------ stats */
adminRouter.get('/stats', (req, res) => {
  const byStatus = {}
  for (const r of db.prepare('SELECT status, COUNT(*) AS c, COALESCE(SUM(total),0) AS amount FROM bookings GROUP BY status').all())
    byStatus[r.status] = { count: r.c, amount: r.amount }

  const totalBookings = db.prepare('SELECT COUNT(*) AS c FROM bookings').get().c
  // Doanh thu CHỈ tính đơn server đã định giá đáng tin (legacy = 0).
  // Đơn nhập từ bản cũ không có dữ liệu giá -> loại khỏi doanh thu, tránh số bịa.
  const revenueRow = db.prepare(`SELECT COALESCE(SUM(total),0) AS s FROM bookings
                                 WHERE status IN ('Đã thanh toán','Đã xác nhận','checked_in','Đã check-in') AND legacy = 0`).get()
  const legacyBookings = db.prepare('SELECT COUNT(*) AS c FROM bookings WHERE legacy = 1').get().c
  // Doanh thu THẬT (P1-01): KHÔNG tin cột payment_status một cách mù quáng.
  // Một đơn chỉ được tính khi: payment_status='paid' AND có bằng chứng giao dịch
  // đã xác minh trong payment_attempts (status='paid' + trans_id khác rỗng).
  // Nhờ vậy admin (và cả dữ liệu import tay) KHÔNG thể làm tăng doanh thu thật.
  const realRevenueRow = db.prepare(`SELECT COALESCE(SUM(b.total),0) AS s, COUNT(*) AS c
                                     FROM bookings b
                                     WHERE b.payment_status = 'paid' AND b.legacy = 0
                                       AND EXISTS (
                                         SELECT 1 FROM payment_attempts pa
                                         WHERE pa.booking_code = b.code
                                           AND pa.status = 'paid'
                                           AND pa.trans_id IS NOT NULL AND pa.trans_id <> ''
                                       )`).get()
  const paidBookings = realRevenueRow.c
  // Số đơn bị đánh dấu 'paid' nhưng KHÔNG có bằng chứng -> không tính doanh thu (để điều tra).
  const unverifiedPaidBookings = db.prepare(`SELECT COUNT(*) AS c FROM bookings b
                                     WHERE b.payment_status = 'paid'
                                       AND NOT EXISTS (
                                         SELECT 1 FROM payment_attempts pa
                                         WHERE pa.booking_code = b.code
                                           AND pa.status = 'paid'
                                           AND pa.trans_id IS NOT NULL AND pa.trans_id <> ''
                                       )`).get().c
  const simulatedBookings = db.prepare("SELECT COUNT(*) AS c FROM bookings WHERE payment_status = 'simulated'").get().c
  const trend = []
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    const c = db.prepare(`SELECT COUNT(*) AS c FROM bookings WHERE substr(created_at,1,10) = ?`).get(day).c
    trend.push({ day, count: c })
  }

  ok(res, {
    totalBookings,
    byStatus,
    // Doanh thu tính từ các đơn đã xác nhận — phần lớn là thanh toán MÔ PHỎNG (demo),
    // KHÔNG phải tiền thật; cột payment_status luôn ghi rõ nguồn.
    revenue: revenueRow.s,
    // Doanh thu thật: CHỉ đơn đã thanh toán qua cổNG và có bằng chứng xác minh.
    realRevenue: realRevenueRow.s,
    paidBookings,
    unverifiedPaidBookings,
    simulatedBookings,
    legacyBookings,
    revenueNote: 'Tổng đơn đã xác nhận/chờ thanh toán; phần lớn là thanh toán mô phỏng (demo), không phải giao dịch thật. Đơn cũ không định giá được (legacy) đã loại khỏi doanh thu.',
    realRevenueNote: 'Doanh thu thật = tổng các đơn có payment_status = paid VÀ bằng chứng giao dịch đã xác minh trong payment_attempts (chữ ký IPN hợp lệ, có transId). Admin không thể tự đặt trạng thái này. Đơn mô phỏng, đơn chưa thanh toán và đơn paid không có bằng chứng đều KHÔNG được tính.',
    users: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
    admins: db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND is_active = 1").get().c,
    hotels: db.prepare('SELECT COUNT(*) AS c FROM hotels WHERE is_active = 1').get().c,
    flights: db.prepare('SELECT COUNT(*) AS c FROM flights WHERE is_active = 1').get().c,
    combos: db.prepare('SELECT COUNT(*) AS c FROM combos WHERE is_active = 1').get().c,
    promotions: db.prepare('SELECT COUNT(*) AS c FROM promotions WHERE is_active = 1').get().c,
    trend,
  })
})

/* --------------------------------------------------------------- bookings */
export function bookingOut(r) {
  return {
    id: r.id,
    code: r.code,
    ownerEmail: r.owner_email ?? r.email,
    serviceType: r.service_type,
    itemId: r.item_id,
    title: r.title,
    status: r.status,
    paymentStatus: r.payment_status,
    paymentMethod: r.payment_method,
    traveler: { name: r.traveler_name, phone: r.traveler_phone, email: r.traveler_email },
    passengers: r.passengers,
    promo: r.promo_code,
    unitPrice: r.unit_price,
    discount: r.discount,
    total: r.total,
    destination: r.destination,
    tripType: r.trip_type,
    dates: { depart: r.depart_date, ret: r.return_date },
    legacy: !!r.legacy,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

adminRouter.get('/bookings', (req, res) => {
  const q = txt(req.query.q, 120, 0)
  const status = txt(req.query.status, 30, 0)
  const page = int(req.query.page ?? 1, 1, 100000) ?? 1
  const limit = int(req.query.limit ?? 50, 1, 200) ?? 50

  const where = []
  const args = []
  if (q) {
    where.push('(b.code LIKE ? OR b.traveler_name LIKE ? OR b.email LIKE ? OR b.title LIKE ?)')
    args.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
  }
  if (status && status !== 'all') { where.push('b.status = ?'); args.push(status) }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const joins = 'FROM bookings b JOIN users u ON u.id = b.user_id'

  const total = db.prepare(`SELECT COUNT(*) AS c ${joins} ${whereSql}`).get(...args).c
  const rows = db.prepare(`SELECT b.*, u.email AS owner_email ${joins} ${whereSql}
                           ORDER BY b.id DESC LIMIT ? OFFSET ?`)
    .all(...args, limit, (page - 1) * limit)

  ok(res, { items: rows.map(bookingOut), total, page, limit })
})

// Chuyển trạng thái theo đồ thị cho phép — không nhảy lung tung, không bỏ qua bước.
const TRANSITIONS = {
  'Đã tạo': ['Chờ thanh toán', 'Đã xác nhận', 'Đã hủy'],
  'Chờ thanh toán': ['Đã thanh toán', 'Đã xác nhận', 'Đã hủy'],
  'Đã thanh toán': ['Đã xác nhận', 'Đã hủy'],
  'Đã xác nhận': ['Đã hủy'],
  'Đã hủy': [],
}
// P1-01: Admin KHÔNG BAO GIỜ được tự đặt trạng thái thanh toán 'paid'.
// 'paid' chỉ được đặt bởi luồng thanh toán server-side đã XÁC MINH (IPN MoMo hợp lệ).
// Admin vẫn có thể ghi nhận thủ công 'pending'/'simulated'/'refunded' nhưng BẮT BUỘC
// phải kèm lý do -> mọi thao tác đều bị ghi vào audit log.
// Admin chỉ được ghi nhận tay các trạng thái này ('paid' bị chặn tuyệt đối).
const MANUAL_PAYMENT_STATES = ['pending', 'simulated', 'refunded']
const PAYMENT_REASON_MIN = 10
const PAYMENT_REASON_MAX = 300

/** Đơn đã có bằng chứng thanh toán hợp lệ (payment_attempts.status='paid' + trans_id). */
const hasVerifiedPayment = (bookingCode) => !!db.prepare(
  `SELECT 1 FROM payment_attempts
    WHERE booking_code = ? AND status = 'paid' AND trans_id IS NOT NULL AND trans_id <> '' LIMIT 1`,
).get(String(bookingCode || ''))

adminRouter.patch('/bookings/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM bookings WHERE id = ?').get(Number(req.params.id))
  if (!row) return bad(res, 'Không tìm thấy đơn hàng.', 404)

  const nextStatus = txt(req.body?.status, 30, 1)
  const nextPayment = txt(req.body?.paymentStatus, 20, 0)
  if (!nextStatus && !nextPayment) return bad(res, 'Không có dữ liệu cập nhật.')

  // --- P1-01: chặn đặt 'paid' thủ công, KHÔNG có ngoại lệ nào cho admin ---
  if (nextPayment === 'paid') {
    writeAuditLog({
      actorId: req.session.user.id, actorEmail: req.session.user.email,
      action: 'admin.booking.payment_paid_rejected', entityType: 'booking', entityId: String(row.code),
      detail: 'Admin cố đặt paymentStatus=paid thủ công -> bị từ chối', ip: req.ip,
    })
    return bad(res, 'Không thể tự đặt trạng thái thanh toán "paid". Trạng thái này chỉ được hệ thống đặt sau khi cổng thanh toán xác minh giao dịch thành công.', 403)
  }
  if (nextPayment && nextPayment !== row.payment_status && !MANUAL_PAYMENT_STATES.includes(nextPayment))
    return bad(res, 'Trạng thái thanh toán không hợp lệ.', 409)

  // Thao tác ghi nhận thủ công (pending/simulated/refunded) BẮT BUỘC có lý do để điều tra.
  const paymentReason = txt(req.body?.paymentReason, PAYMENT_REASON_MAX, PAYMENT_REASON_MIN)
  const changingPayment = !!nextPayment && nextPayment !== row.payment_status
  if (changingPayment && !paymentReason) {
    return bad(res, `Thao tác đổi trạng thái thanh toán thủ công bắt buộc phải có lý do (${PAYMENT_REASON_MIN}-${PAYMENT_REASON_MAX} ký tự).`, 400)
  }

  if (nextStatus && nextStatus !== row.status) {
    if (!Object.hasOwn(TRANSITIONS, row.status)) return bad(res, 'Trạng thái hiện tại không hợp lệ.', 409)
    if (!TRANSITIONS[row.status].includes(nextStatus))
      return bad(res, `Không được chuyển từ "${row.status}" sang "${nextStatus}".`, 409)
    // 'Đã thanh toán' = đã thu tiền -> chỉ được đặt khi có bằng chứng thanh toán hợp lệ.
    if (nextStatus === 'Đã thanh toán' && !hasVerifiedPayment(row.code))
      return bad(res, 'Không thể chuyển sang "Đã thanh toán" khi đơn chưa có giao dịch thanh toán đã xác minh.', 409)
  }

  // P1-02: ghi trạng thái trong transaction khóa ghi; trước khi xác nhận (chuyển
  // sang trạng thái giữ phòng) một đơn khách sạn có phòng cụ thể, kiểm tra lại
  // trong khoá viết không có KHÁC booking nào đang giữ cùng phòng,
  // cùng khoảng ngày (trừ chính đơn này). Admin không thể xác nhận đơn làm
  // vượt tồn kho.
  try {
    db.exec('BEGIN IMMEDIATE')
    if (
      nextStatus && nextStatus !== row.status && nextStatus !== 'Đã hủy' &&
      row.service_type === 'hotel' && row.room_id && row.depart_date && row.return_date
    ) {
      const conflict = db.prepare(`SELECT 1 FROM bookings WHERE id <> ? AND room_id = ? AND status <> 'Đã hủy'
        AND depart_date IS NOT NULL AND return_date IS NOT NULL
        AND depart_date < ? AND return_date > ?
        LIMIT 1`).get(row.id, row.room_id, row.return_date, row.depart_date)
      if (conflict) {
        db.exec('ROLLBACK')
        writeAuditLog({
          actorId: req.session.user.id, actorEmail: req.session.user.email,
          action: 'admin.booking.confirm_rejected_inventory', entityType: 'booking', entityId: String(row.code),
          detail: `phòng ${row.room_id} ${row.depart_date}->${row.return_date} đã được giữ bởi đơn khác`, ip: req.ip,
        })
        return bad(res, 'Không xác nhận được đơn: phòng đã được đặt cho khoảng thời gian này.', 409)
      }
    }
    db.prepare(`UPDATE bookings SET status = ?, payment_status = ?,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
      .run(nextStatus || row.status, nextPayment || row.payment_status, row.id)
    db.exec('COMMIT')
  } catch (err) {
    try { db.exec('ROLLBACK') } catch { /* không có transaction để hoàn tác */ }
    throw err
  }

  writeAuditLog({
    actorId: req.session.user.id, actorEmail: req.session.user.email,
    action: changingPayment ? 'admin.booking.payment_manual' : 'admin.booking.update',
    entityType: 'booking', entityId: String(row.code),
    detail: `${row.status} -> ${nextStatus || row.status}; payment=${nextPayment || row.payment_status}`
      + (changingPayment ? `; reason=${paymentReason}` : ''),
    ip: req.ip,
  })

  const updated = db.prepare(`SELECT b.*, u.email AS owner_email FROM bookings b
                              JOIN users u ON u.id = b.user_id WHERE b.id = ?`).get(row.id)
  const result = bookingOut(updated)
  broadcastBookingUpdated(result)
  try {
    pushNotification(row.user_id, {
      title: 'Cập nhật trạng thái đơn hàng',
      message: `Đơn ${row.code} đã chuyển sang trạng thái "${nextStatus || row.status}".`,
      type: 'booking',
      link: '#/bookings',
    })
  } catch { }
  ok(res, result)
})

/* ----------------------------------------------------------------- hotels */
adminRouter.get('/hotels', (req, res) => ok(res, listHotels(true)))

function hotelPayload(b, cur) {
  const src = cur
    ? {
      name: b.name ?? cur.name, location: b.location ?? cur.location, rating: b.rating ?? cur.rating,
      stars: b.stars ?? cur.stars, price: b.price ?? cur.price, hasPromo: b.hasPromo ?? !!cur.has_promo,
      image: b.image ?? cur.image, perks: b.perks ?? JSON.parse(cur.perks || '[]'),
      description: b.description ?? cur.description, isActive: b.isActive ?? !!cur.is_active
    }
    : b
  const out = {
    name: txt(src.name, 120), location: txt(src.location, 120),
    rating: Number(src.rating), stars: int(src.stars, 1, 5), price: int(src.price, 10000, 100000000),
    hasPromo: bool(src.hasPromo), isActive: bool(src.isActive),
    image: txt(src.image ?? '', 800, 0) ?? '',
    description: txt(src.description ?? '', 600, 0) ?? '',
    perks: JSON.stringify(Array.isArray(src.perks) ? src.perks.filter((p) => txt(p, 60, 1)).slice(0, 8) : []),
  }
  if (!out.name || !out.location) return { error: 'Tên và địa điểm khách sạn là bắt buộc.' }
  if (!Number.isFinite(out.rating) || out.rating < 0 || out.rating > 10) return { error: 'Điểm đánh giá phải trong khoảng 0–10.' }
  if (out.stars == null || out.price == null || out.hasPromo == null || out.isActive == null)
    return { error: 'Dữ liệu không hợp lệ (số sao, giá hoặc trạng thái).' }
  return { value: out }
}

adminRouter.post('/hotels', (req, res) => {
  const r = hotelPayload(req.body || {})
  if (r.error) return bad(res, r.error)
  const id = newId('hotel')
  db.prepare(`INSERT INTO hotels (id, name, location, rating, stars, price, has_promo, image, perks, description, is_active)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, r.value.name, r.value.location, r.value.rating, r.value.stars, r.value.price,
      r.value.hasPromo ? 1 : 0, r.value.image, r.value.perks, r.value.description, r.value.isActive ? 1 : 0)
  audit(req, 'admin.hotel.create', 'hotel', id, `${r.value.name} @ ${r.value.location}`)
  res.status(201).json({ ok: true, data: hotelOut(db.prepare('SELECT * FROM hotels WHERE id = ?').get(id)) })
})

adminRouter.patch('/hotels/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM hotels WHERE id = ?').get(req.params.id)
  if (!cur) return bad(res, 'Không tìm thấy khách sạn.', 404)
  const r = hotelPayload(req.body || {}, cur)
  if (r.error) return bad(res, r.error)
  db.prepare(`UPDATE hotels SET name=?, location=?, rating=?, stars=?, price=?, has_promo=?, image=?, perks=?,
              description=?, is_active=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`)
    .run(r.value.name, r.value.location, r.value.rating, r.value.stars, r.value.price,
      r.value.hasPromo ? 1 : 0, r.value.image, r.value.perks, r.value.description, r.value.isActive ? 1 : 0, cur.id)
  audit(req, 'admin.hotel.update', 'hotel', cur.id, r.value.name)
  ok(res, hotelOut(db.prepare('SELECT * FROM hotels WHERE id = ?').get(cur.id)))
})

// "Xóa" = ngừng kinh doanh (giữ nguyên dữ liệu đơn hàng cũ). Chặn khi còn combo liên kết.
adminRouter.delete('/hotels/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM hotels WHERE id = ?').get(req.params.id)
  if (!cur) return bad(res, 'Không tìm thấy khách sạn.', 404)
  const refs = db.prepare('SELECT COUNT(*) AS c FROM combos WHERE hotel_id = ?').get(cur.id).c
  if (refs > 0) return bad(res, `Còn ${refs} combo liên kết khách sạn này. Hãy ngừng/hủy combo trước.`, 409)
  db.prepare("UPDATE hotels SET is_active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(cur.id)
  audit(req, 'admin.hotel.delete', 'hotel', cur.id, cur.name)
  ok(res, { id: cur.id, isActive: false })
})

/* ----------------------------------------------------------------- rooms */
// Mỗi dòng trong `rooms` là MỘT phòng vật lý (id duy nhất). Tồn kho = 1 phòng
// đó; booking giữ phòng qua cột `bookings.room_id` trong khoảng
// [depart_date, return_date). "Giảm tồn kho" = ngừng kinh doanh/xóa mềm
// phòng này -> từ chối nếu phòng đang được ít nhất 1 đơn (chưa hủy) giữ.
adminRouter.get('/rooms', (req, res) => {
  const q = txt(req.query.q, 120, 0)
  const hotelId = txt(req.query.hotelId, 64, 0) || undefined
  const isActive = bool(req.query.isActive) // null = không lọc theo trạng thái
  const page = int(req.query.page ?? 1, 1, 100000) ?? 1
  const limit = int(req.query.limit ?? 50, 1, 200) ?? 50

  const where = []
  const args = []
  if (q) {
    where.push('(r.name LIKE ? OR r.bed_type LIKE ?)')
    args.push(`%${q}%`, `%${q}%`)
  }
  if (hotelId) {
    where.push('r.hotel_id = ?')
    args.push(hotelId)
  }
  if (isActive !== null) {
    where.push('r.is_active = ?')
    args.push(isActive ? 1 : 0)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const total = db.prepare(`SELECT COUNT(*) AS c FROM rooms r ${whereSql}`).get(...args).c
  const rows = db.prepare(`SELECT r.*, h.name AS hotel_name FROM rooms r
                           JOIN hotels h ON h.id = r.hotel_id ${whereSql}
                           ORDER BY r.rowid DESC LIMIT ? OFFSET ?`)
    .all(...args, limit, (page - 1) * limit)

  ok(res, {
    items: rows.map((r) => ({ ...roomOut(r), hotelName: r.hotel_name })),
    total, page, limit,
  })
})

function roomPayload(b, cur) {
  const curCamel = cur ? roomOut(cur) : null
  const src = cur
    ? {
      name: b.name ?? curCamel.name, hotelId: b.hotelId ?? curCamel.hotelId,
      price: b.price ?? curCamel.price, bedType: b.bedType ?? curCamel.bedType,
      sizeSqm: b.sizeSqm ?? curCamel.sizeSqm, maxAdults: b.maxAdults ?? curCamel.maxAdults,
      maxChildren: b.maxChildren ?? curCamel.maxChildren,
      amenities: b.amenities ?? curCamel.amenities, images: b.images ?? curCamel.images,
      breakfast: b.breakfast ?? curCamel.breakfast,
      freeCancellation: b.freeCancellation ?? curCamel.freeCancellation,
      checkinTime: b.checkinTime ?? curCamel.checkinTime,
      checkoutTime: b.checkoutTime ?? curCamel.checkoutTime,
      isActive: b.isActive ?? curCamel.isActive,
    }
    : b

  const name = txt(src.name, 120)
  if (!name) return { error: 'Tên phòng là bắt buộc (1–120 ký tự).' }

  const hotelId = txt(src.hotelId, 64)
  if (!hotelId) return { error: 'Chọn khách sạn là bắt buộc.' }
  if (!exists('hotels', hotelId)) return { error: 'Khách sạn không tồn tại.' }

  const price = int(src.price, 10000, 1000000000)
  if (price == null) return { error: 'Giá phòng phải là số nguyên từ 10.000 đến 1.000.000.000 (₫).' }

  const bedType = txt(src.bedType, 60)
  if (!bedType) return { error: 'Loại giường là bắt buộc (1–60 ký tự).' }

  let sizeSqm = null
  if (src.sizeSqm !== undefined && src.sizeSqm !== '') {
    sizeSqm = int(src.sizeSqm, 1, 10000)
    if (sizeSqm == null) return { error: 'Kích thước phải là số nguyên dương (m2).' }
  }

  const maxAdults = int(src.maxAdults, 1, 50)
  if (maxAdults == null) return { error: 'Tối đa người lớn phải từ 1 đến 50.' }
  const maxChildren = int(src.maxChildren, 0, 50)
  if (maxChildren == null) return { error: 'Tối đa trẻ em phải từ 0 đến 50.' }

  if (src.amenities !== undefined && !Array.isArray(src.amenities))
    return { error: 'Tiện nghi phải là danh sách.' }
  const amenities = []
  for (const a of (src.amenities || [])) {
    const t = txt(a, 60, 1)
    if (!t) return { error: 'Tên tiện nghi không hợp lệ (1–60 ký tự).' }
    amenities.push(t)
  }
  if (amenities.length > 30) return { error: 'Tối đa 30 tiện nghi.' }

  if (src.images !== undefined && !Array.isArray(src.images))
    return { error: 'Ảnh phải là danh sách.' }
  const images = []
  for (const u of (src.images || [])) {
    const t = txt(u, 500, 1)
    if (!t) return { error: 'URL ảnh không hợp lệ.' }
    images.push(t)
  }
  if (images.length > 30) return { error: 'Tối đa 30 ảnh.' }

  const breakfast = bool(src.breakfast) ?? false
  const freeCancellation = bool(src.freeCancellation) ?? false

  const checkinTime = txt(src.checkinTime, 5, 0) || '14:00'
  if (!HHMM.test(checkinTime)) return { error: 'Giờ nhận phòng phải định dạng HH:MM.' }
  const checkoutTime = txt(src.checkoutTime, 5, 0) || '12:00'
  if (!HHMM.test(checkoutTime)) return { error: 'Giờ trả phòng phải định dạng HH:MM.' }

  const isActive = cur ? (bool(src.isActive) ?? cur.is_active === 1) : (bool(src.isActive) ?? true)

  // room ID KHÔNG được gửi trong body thay đổi — route param mới là nguồn thật.
  return {
    value: {
      name, hotelId, price, bedType, sizeSqm, maxAdults, maxChildren,
      amenities, images, breakfast, freeCancellation, checkinTime, checkoutTime, isActive
    },
  }
}

adminRouter.post('/rooms', (req, res) => {
  const r = roomPayload(req.body || {})
  if (r.error) return bad(res, r.error)
  const id = newId('room')
  db.prepare(`INSERT INTO rooms (id, hotel_id, name, price, bed_type, size_sqm,
      max_adults, max_children, amenities, images, breakfast, free_cancellation,
      checkin_time, checkout_time, is_active)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, r.value.hotelId, r.value.name, r.value.price, r.value.bedType, r.value.sizeSqm,
      r.value.maxAdults, r.value.maxChildren, JSON.stringify(r.value.amenities),
      JSON.stringify(r.value.images), r.value.breakfast ? 1 : 0,
      r.value.freeCancellation ? 1 : 0, r.value.checkinTime, r.value.checkoutTime,
      r.value.isActive ? 1 : 0)
  audit(req, 'admin.room.create', 'room', id,
    `${r.value.name} (${r.value.hotelId}) ${r.value.price}đ/đêm`)
  res.status(201).json({ ok: true, data: roomOut(db.prepare('SELECT * FROM rooms WHERE id = ?').get(id)) })
})

adminRouter.patch('/rooms/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id)
  if (!cur) return bad(res, 'Không tìm thấy phòng.', 404)
  const r = roomPayload(req.body || {}, cur)
  if (r.error) return bad(res, r.error)

  // Vô hiệu hóa phòng = giảm tồn kho 1 đơn vị -> từ chối nếu phòng đang được
  // ít nhất 1 đơn (chưa hủy) giữ trong bất kỳ khoảng thời gian nào.
  if (r.value.isActive === false && cur.is_active === 1) {
    const held = db.prepare(`SELECT COUNT(*) AS c FROM bookings
                             WHERE room_id = ? AND status <> 'Đã hủy'`)
      .get(cur.id).c
    if (held > 0) {
      writeAuditLog({
        actorId: req.session.user.id, actorEmail: req.session.user.email,
        action: 'admin.room.deactivate_rejected_inventory', entityType: 'room', entityId: cur.id,
        detail: `${cur.name} vẫn được ${held} đơn đang giữ`, ip: req.ip,
      })
      return bad(res, `Không ngừng kinh doanh phòng: phòng đang được ${held} đơn đặt giữ.`, 409)
    }
  }

  db.prepare(`UPDATE rooms SET hotel_id=?, name=?, price=?, bed_type=?, size_sqm=?, max_adults=?,
              max_children=?, amenities=?, images=?, breakfast=?, free_cancellation=?,
              checkin_time=?, checkout_time=?, is_active=?,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(r.value.hotelId, r.value.name, r.value.price, r.value.bedType, r.value.sizeSqm,
      r.value.maxAdults, r.value.maxChildren, JSON.stringify(r.value.amenities),
      JSON.stringify(r.value.images), r.value.breakfast ? 1 : 0,
      r.value.freeCancellation ? 1 : 0, r.value.checkinTime, r.value.checkoutTime,
      r.value.isActive ? 1 : 0, cur.id)
  audit(req, 'admin.room.update', 'room', cur.id,
    `${r.value.name} gia=${r.value.price} active=${r.value.isActive}`)
  ok(res, roomOut(db.prepare('SELECT * FROM rooms WHERE id = ?').get(cur.id)))
})

// "Xóa" = ngừng kinh doanh (soft delete, giữ nguyên booking cũ tham chiếu).
// Hard delete KHÔNG được hỗ trợ để không làm hỏng lịch sử đặt phòng.
adminRouter.delete('/rooms/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id)
  if (!cur) return bad(res, 'Không tìm thấy phòng.', 404)
  const held = db.prepare(`SELECT COUNT(*) AS c FROM bookings
                           WHERE room_id = ? AND status <> 'Đã hủy'`)
    .get(cur.id).c
  if (held > 0) {
    return bad(res, `Không ngừng/xóa phòng: đang có ${held} đơn giữ phòng này.`, 409)
  }
  db.prepare(`UPDATE rooms SET is_active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(cur.id)
  audit(req, 'admin.room.delete', 'room', cur.id, cur.name)
  ok(res, { id: cur.id, isActive: false })
})

/* ---------------------------------------------------------------- flights */
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

adminRouter.get('/flights', (req, res) => ok(res, listFlights(true)))

function flightPayload(b, cur) {
  const src = cur
    ? {
      airline: b.airline ?? cur.airline, logo: b.logo ?? cur.logo, from: b.from ?? cur.origin,
      to: b.to ?? cur.dest, depart: b.depart ?? cur.depart, arrive: b.arrive ?? cur.arrive,
      duration: b.duration ?? cur.duration, price: b.price ?? cur.price, tag: b.tag ?? cur.tag,
      hasPromo: b.hasPromo ?? !!cur.has_promo, isActive: b.isActive ?? !!cur.is_active
    }
    : b
  const out = {
    airline: txt(src.airline, 60), logo: txt(src.logo ?? '', 6, 0) ?? '',
    from: txt(src.from, 60), to: txt(src.to, 60),
    depart: txt(src.depart, 5, 5), arrive: txt(src.arrive, 5, 5),
    duration: txt(src.duration, 24), tag: txt(src.tag ?? '', 40, 0) ?? '',
    price: int(src.price, 10000, 100000000),
    hasPromo: bool(src.hasPromo), isActive: bool(src.isActive),
  }
  if (!out.airline || !out.from || !out.to) return { error: 'Hãng bay, sân bay đi và sân bay đến là bắt buộc.' }
  if (!HHMM.test(out.depart) || !HHMM.test(out.arrive)) return { error: 'Giờ khởi hành/hạ cánh phải dạng HH:MM.' }
  if (out.price == null || out.hasPromo == null || out.isActive == null || !out.duration)
    return { error: 'Dữ liệu chuyến bay không hợp lệ (thời lượng, giá hoặc trạng thái).' }
  return { value: out }
}

adminRouter.post('/flights', (req, res) => {
  const r = flightPayload(req.body || {})
  if (r.error) return bad(res, r.error)
  const id = newId('fl')
  db.prepare(`INSERT INTO flights (id, airline, logo, origin, dest, depart, arrive, duration, price, tag, has_promo, is_active)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, r.value.airline, r.value.logo, r.value.from, r.value.to, r.value.depart, r.value.arrive,
      r.value.duration, r.value.price, r.value.tag, r.value.hasPromo ? 1 : 0, r.value.isActive ? 1 : 0)
  audit(req, 'admin.flight.create', 'flight', id, `${r.value.airline} ${r.value.from}->${r.value.to}`)
  res.status(201).json({ ok: true, data: flightOut(db.prepare('SELECT * FROM flights WHERE id = ?').get(id)) })
})

adminRouter.patch('/flights/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM flights WHERE id = ?').get(req.params.id)
  if (!cur) return bad(res, 'Không tìm thấy chuyến bay.', 404)
  const r = flightPayload(req.body || {}, cur)
  if (r.error) return bad(res, r.error)
  db.prepare(`UPDATE flights SET airline=?, logo=?, origin=?, dest=?, depart=?, arrive=?, duration=?, price=?,
              tag=?, has_promo=?, is_active=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`)
    .run(r.value.airline, r.value.logo, r.value.from, r.value.to, r.value.depart, r.value.arrive,
      r.value.duration, r.value.price, r.value.tag, r.value.hasPromo ? 1 : 0, r.value.isActive ? 1 : 0, cur.id)
  audit(req, 'admin.flight.update', 'flight', cur.id, `${r.value.airline} ${r.value.from}->${r.value.to}`)
  ok(res, flightOut(db.prepare('SELECT * FROM flights WHERE id = ?').get(cur.id)))
})

adminRouter.delete('/flights/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM flights WHERE id = ?').get(req.params.id)
  if (!cur) return bad(res, 'Không tìm thấy chuyến bay.', 404)
  const refs = db.prepare('SELECT COUNT(*) AS c FROM combos WHERE flight_id = ?').get(cur.id).c
  if (refs > 0) return bad(res, `Còn ${refs} combo liên kết chuyến bay này. Hãy ngừng/hủy combo trước.`, 409)
  db.prepare("UPDATE flights SET is_active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(cur.id)
  audit(req, 'admin.flight.delete', 'flight', cur.id, `${cur.airline} ${cur.origin}->${cur.dest}`)
  ok(res, { id: cur.id, isActive: false })
})

/* ----------------------------------------------------------------- combos */
adminRouter.get('/combos', (req, res) => {
  const rows = db.prepare('SELECT * FROM combos ORDER BY id').all()
  const items = rows
    .map((row) => comboOut(row,
      db.prepare('SELECT * FROM hotels WHERE id = ?').get(row.hotel_id),
      db.prepare('SELECT * FROM flights WHERE id = ?').get(row.flight_id)))
    .filter(Boolean)
  ok(res, items)
})

function comboPayload(b, cur) {
  const hotelId = txt(b.hotelId ?? cur?.hotel_id, 64)
  const flightId = txt(b.flightId ?? cur?.flight_id, 64)
  const name = txt(b.name ?? cur?.name, 140)
  const saving = int(b.saving ?? cur?.saving, 0, 20000000)
  const description = txt(b.description ?? cur?.description ?? '', 600, 0) ?? ''
  const image = txt(b.image ?? cur?.image ?? '', 800, 0) ?? ''
  const validFrom = b.validFrom === undefined ? (cur?.valid_from ?? null) : (b.validFrom || null)
  const validTo = b.validTo === undefined ? (cur?.valid_to ?? null) : (b.validTo || null)
  const priceOverride = b.priceOverride === undefined ? (cur?.price_override ?? null) : b.priceOverride
  const isActive = b.isActive === undefined ? !!cur?.is_active : bool(b.isActive)
  const DATE = /^\d{4}-\d{2}-\d{2}$/

  if (!name) return { error: 'Tên combo là bắt buộc.' }
  if (!hotelId || !exists('hotels', hotelId)) return { error: 'Combo phải liên kết tới một khách sạn hợp lệ.' }
  if (!flightId || !exists('flights', flightId)) return { error: 'Combo phải liên kết tới một chuyến bay hợp lệ.' }
  if (saving == null) return { error: 'Mức giảm phải là số nguyên ≥ 0.' }
  if (priceOverride != null && priceOverride !== '' && int(priceOverride, 10000, 100000000) == null)
    return { error: 'Giá ghi đè (nếu có) phải ≥ 10.000₫.' }
  if ((validFrom && !DATE.test(validFrom)) || (validTo && !DATE.test(validTo))) return { error: 'Ngày phải dạng YYYY-MM-DD.' }
  if (validFrom && validTo && validFrom > validTo) return { error: 'Ngày bắt đầu phải trước ngày kết thúc.' }
  if (isActive == null) return { error: 'Trạng thái combo không hợp lệ.' }
  return {
    value: {
      name, hotelId, flightId, saving, description, image, validFrom, validTo,
      priceOverride: priceOverride == null || priceOverride === '' ? null : Number(priceOverride),
      isActive,
    },
  }
}

const comboRowView = (row) => comboOut(row,
  db.prepare('SELECT * FROM hotels WHERE id = ?').get(row.hotel_id),
  db.prepare('SELECT * FROM flights WHERE id = ?').get(row.flight_id))

adminRouter.post('/combos', (req, res) => {
  const r = comboPayload(req.body || {})
  if (r.error) return bad(res, r.error)
  const id = newId('combo')
  db.prepare(`INSERT INTO combos (id, name, hotel_id, flight_id, saving, price_override, description, image, valid_from, valid_to, is_active)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, r.value.name, r.value.hotelId, r.value.flightId, r.value.saving, r.value.priceOverride,
      r.value.description, r.value.image, r.value.validFrom, r.value.validTo, r.value.isActive ? 1 : 0)
  audit(req, 'admin.combo.create', 'combo', id, r.value.name)
  res.status(201).json({ ok: true, data: comboRowView(db.prepare('SELECT * FROM combos WHERE id = ?').get(id)) })
})

adminRouter.patch('/combos/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM combos WHERE id = ?').get(req.params.id)
  if (!cur) return bad(res, 'Không tìm thấy combo.', 404)
  const r = comboPayload(req.body || {}, cur)
  if (r.error) return bad(res, r.error)
  db.prepare(`UPDATE combos SET name=?, hotel_id=?, flight_id=?, saving=?, price_override=?, description=?, image=?,
              valid_from=?, valid_to=?, is_active=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`)
    .run(r.value.name, r.value.hotelId, r.value.flightId, r.value.saving, r.value.priceOverride,
      r.value.description, r.value.image, r.value.validFrom, r.value.validTo, r.value.isActive ? 1 : 0, cur.id)
  audit(req, 'admin.combo.update', 'combo', cur.id, r.value.name)
  ok(res, comboRowView(db.prepare('SELECT * FROM combos WHERE id = ?').get(cur.id)))
})

adminRouter.delete('/combos/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM combos WHERE id = ?').get(req.params.id)
  if (!cur) return bad(res, 'Không tìm thấy combo.', 404)
  db.prepare("UPDATE combos SET is_active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(cur.id)
  audit(req, 'admin.combo.delete', 'combo', cur.id, cur.name)
  ok(res, { id: cur.id, isActive: false })
})

/* ------------------------------------------------------------ promotions */
const COLORS = ['blue', 'orange', 'green', 'purple', 'red']
const SERVICES = ['flight', 'hotel', 'combo']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

adminRouter.get('/promotions', (req, res) => ok(res, listPromotions(true)))

function promoPayload(b, cur) {
  const code = txt(b.code ?? cur?.code, 24, 3)?.toUpperCase()
  const description = txt(b.description ?? cur?.description ?? '', 200, 0) ?? ''
  const rate = Number(b.rate ?? cur?.rate)
  const color = txt(b.color ?? cur?.color, 10) || 'blue'
  const appliesTo = (Array.isArray(b.appliesTo) ? b.appliesTo : String(b.applies_to ?? cur?.applies_to ?? '').split(','))
    .map((s) => String(s).trim()).filter(Boolean)
  const activeFrom = b.activeFrom === undefined ? (cur?.active_from ?? null) : (b.activeFrom || null)
  const activeTo = b.activeTo === undefined ? (cur?.active_to ?? null) : (b.activeTo || null)
  const usageLimit = b.usageLimit === undefined ? (cur?.usage_limit ?? null) : b.usageLimit
  // min_order: mức đơn tối thiểu để voucher có hiệu lực (0 = không giới hạn).
  const minOrder = b.minOrder === undefined ? (cur?.min_order ?? 0) : b.minOrder
  const isActive = b.isActive === undefined ? !!cur?.is_active : bool(b.isActive)

  if (!code || !/^[A-Z0-9]{3,24}$/.test(code)) return { error: 'Mã khuyến mãi phải 3–24 ký tự (A–Z, 0–9).' }
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) return { error: 'Tỷ lệ giảm phải trong khoảng 0–1 (vd: 0.12 = 12%).' }
  if (!appliesTo.length || !appliesTo.every((s) => SERVICES.includes(s)))
    return { error: `Áp dụng phải là tập con của [${SERVICES.join(', ')}].` }
  if (!COLORS.includes(color)) return { error: `Màu phải là một trong: ${COLORS.join(', ')}.` }
  if ((activeFrom && !DATE_RE.test(activeFrom)) || (activeTo && !DATE_RE.test(activeTo)))
    return { error: 'Ngày phải dạng YYYY-MM-DD.' }
  if (activeFrom && activeTo && activeFrom > activeTo) return { error: 'Ngày bắt đầu phải trước ngày kết thúc.' }
  if (usageLimit != null && usageLimit !== '' && int(usageLimit, 1, 1000000) == null)
    return { error: 'Giới hạn sử dụng phải là số nguyên ≥ 1 (để trống = không giới hạn).' }
  if (minOrder == null || !Number.isInteger(Number(minOrder)) || Number(minOrder) < 0 || Number(minOrder) > 100000000)
    return { error: 'Mức đơn tối thiểu phải là số nguyên từ 0 đến 100.000.000 (0 = không yêu cầu).' }
  if (isActive == null) return { error: 'Trạng thái khuyến mãi không hợp lệ.' }

  const dup = db.prepare('SELECT id FROM promotions WHERE code = ? COLLATE NOCASE').get(code)
  if (dup && dup.id !== cur?.id) return { error: `Mã "${code}" đã tồn tại.`, conflict: true }
  return {
    value: {
      code, description, rate, color, appliesTo: appliesTo.join(','), activeFrom, activeTo,
      usageLimit: usageLimit == null || usageLimit === '' ? null : Number(usageLimit),
      minOrder: Number(minOrder), isActive,
    },
  }
}

adminRouter.post('/promotions', (req, res) => {
  const r = promoPayload(req.body || {})
  if (r.error) return bad(res, r.error, r.conflict ? 409 : 400)
  const id = newId('promo')
  db.prepare(`INSERT INTO promotions (id, code, title, description, applies_to, rate, color, active_from, active_to, usage_limit, min_order, is_active)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, r.value.code, r.value.code, r.value.description, r.value.appliesTo, r.value.rate, r.value.color,
      r.value.activeFrom, r.value.activeTo, r.value.usageLimit, r.value.minOrder, r.value.isActive ? 1 : 0)
  audit(req, 'admin.promotion.create', 'promotion', id, `${r.value.code} rate=${r.value.rate} minOrder=${r.value.minOrder}`)
  res.status(201).json({ ok: true, data: promoOut(db.prepare('SELECT * FROM promotions WHERE id = ?').get(id)) })
})

adminRouter.patch('/promotions/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM promotions WHERE id = ?').get(req.params.id)
  if (!cur) return bad(res, 'Không tìm thấy khuyến mãi.', 404)
  const r = promoPayload(req.body || {}, cur)
  if (r.error) return bad(res, r.error, r.conflict ? 409 : 400)
  db.prepare(`UPDATE promotions SET code=?, title=?, description=?, applies_to=?, rate=?, color=?, active_from=?, active_to=?,
              usage_limit=?, min_order=?, is_active=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`)
    .run(r.value.code, r.value.code, r.value.description, r.value.appliesTo, r.value.rate, r.value.color,
      r.value.activeFrom, r.value.activeTo, r.value.usageLimit, r.value.minOrder, r.value.isActive ? 1 : 0, cur.id)
  audit(req, 'admin.promotion.update', 'promotion', cur.id, `${r.value.code} rate=${r.value.rate} minOrder=${r.value.minOrder}`)
  ok(res, promoOut(db.prepare('SELECT * FROM promotions WHERE id = ?').get(cur.id)))
})

adminRouter.delete('/promotions/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM promotions WHERE id = ?').get(req.params.id)
  if (!cur) return bad(res, 'Không tìm thấy khuyến mãi.', 404)
  db.prepare("UPDATE promotions SET is_active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(cur.id)
  audit(req, 'admin.promotion.delete', 'promotion', cur.id, cur.code)
  ok(res, { id: cur.id, isActive: false })
})

/* ------------------------------------------------------- audit & payments */
// Nhật ký thao tác quản trị + sự kiện thanh toán (KHÔNG chứa secret).
adminRouter.get('/audit-log', (req, res) => {
  const limit = int(req.query.limit ?? 100, 1, 500) ?? 100
  ok(res, listAuditLog(limit))
})

// Màn hình truy vết nhật ký hoạt động (Audit Log Viewer) có phân trang & lọc nâng cao
adminRouter.get('/audit-logs', (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1)
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100)
  const action = txt(req.query.action, 100, 0)
  const actor = txt(req.query.actor, 100, 0)
  const fromDate = txt(req.query.from_date, 20, 0)
  const toDate = txt(req.query.to_date, 20, 0)
  const result = listAuditLogsFiltered({ page, limit, action, actor, fromDate, toDate })
  ok(res, result)
})

// Xuất báo cáo doanh thu ra file Excel (.xlsx) với 2 sheet chi tiết & trực quan
adminRouter.get('/reports/revenue/export', async (req, res) => {
  try {
    const fromDate = txt(req.query.from_date, 20, 0)
    const toDate = txt(req.query.to_date, 20, 0)
    const serviceType = txt(req.query.service_type, 30, 0)

    const where = ["b.status <> 'Đã hủy'"]
    const args = []
    if (fromDate) { where.push("substr(b.created_at, 1, 10) >= ?"); args.push(fromDate) }
    if (toDate) { where.push("substr(b.created_at, 1, 10) <= ?"); args.push(toDate) }
    if (serviceType && serviceType !== 'all') { where.push("b.service_type = ?"); args.push(serviceType) }
    const whereSql = `WHERE ${where.join(' AND ')}`

    const rows = db.prepare(`
      SELECT b.*, u.email AS owner_email
      FROM bookings b
      JOIN users u ON u.id = b.user_id
      ${whereSql}
      ORDER BY b.id DESC
    `).all(...args)

    const SERVICE_LABELS = {
      flight: 'Vé máy bay',
      hotel: 'Khách sạn',
      combo: 'Combo du lịch',
      activity: 'Vui chơi & Trải nghiệm',
      car: 'Đưa đón sân bay',
      bus: 'Xe khách',
      train: 'Tàu hỏa',
      insurance: 'Bảo hiểm du lịch',
    }

    const totalRevenue = rows.reduce((acc, r) => acc + (r.legacy === 0 ? Number(r.total || 0) : 0), 0)
    const paidRevenue = rows.filter((r) => r.payment_status === 'paid').reduce((acc, r) => acc + Number(r.total || 0), 0)
    const confirmedCount = rows.filter((r) => r.status === 'Đã xác nhận' || r.status === 'Đã thanh toán').length

    const serviceStats = {}
    for (const r of rows) {
      const type = r.service_type || 'other'
      if (!serviceStats[type]) serviceStats[type] = { count: 0, revenue: 0 }
      serviceStats[type].count += 1
      if (r.legacy === 0) serviceStats[type].revenue += Number(r.total || 0)
    }

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Mây An Nhiên System'
    workbook.created = new Date()

    // ===== SHEET 1: TỔNG QUAN =====
    const sheetOverview = workbook.addWorksheet('Tổng quan doanh thu', {
      views: [{ showGridLines: true }],
    })

    // Tiêu đề
    sheetOverview.mergeCells('A1:E1')
    const titleCell = sheetOverview.getCell('A1')
    titleCell.value = 'BÁO CÁO TỔNG QUAN DOANH THU & GIAO DỊCH'
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } }
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
    sheetOverview.getRow(1).height = 40

    // Metadata
    sheetOverview.getCell('A3').value = 'Hệ thống:'
    sheetOverview.getCell('B3').value = 'Mây An Nhiên · Nền tảng Du lịch & Lưu trú'
    sheetOverview.getCell('A4').value = 'Ngày xuất báo cáo:'
    sheetOverview.getCell('B4').value = new Date().toLocaleString('vi-VN')
    sheetOverview.getCell('A5').value = 'Người xuất:'
    sheetOverview.getCell('B5').value = req.session.user.email
    sheetOverview.getCell('A6').value = 'Bộ lọc áp dụng:'
    sheetOverview.getCell('B6').value = `Từ ngày: ${fromDate || 'Tất cả'} | Đến ngày: ${toDate || 'Hiện tại'} | Dịch vụ: ${serviceType ? (SERVICE_LABELS[serviceType] || serviceType) : 'Tất cả'}`

    for (let r = 3; r <= 6; r++) {
      sheetOverview.getCell(`A${r}`).font = { name: 'Arial', bold: true, color: { argb: 'FF475569' } }
      sheetOverview.getCell(`B${r}`).font = { name: 'Arial', color: { argb: 'FF0F172A' } }
    }

    // Bảng chỉ số KPI tổng hợp
    sheetOverview.getCell('A8').value = 'CHỈ SỐ TỔNG HỢP'
    sheetOverview.getCell('B8').value = 'GIÁ TRỊ'
    sheetOverview.getRow(8).height = 25
    sheetOverview.getCell('A8').font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } }
    sheetOverview.getCell('B8').font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } }
    sheetOverview.getCell('A8').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
    sheetOverview.getCell('B8').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }

    const kpis = [
      ['Tổng số đơn đặt chỗ hợp lệ (không tính đơn hủy)', rows.length, 'number'],
      ['Tổng số đơn đã thanh toán / xác nhận', confirmedCount, 'number'],
      ['Tổng doanh thu ghi nhận (VND)', totalRevenue, 'currency'],
      ['Doanh thu thật đã thanh toán cổng MoMo (VND)', paidRevenue, 'currency'],
    ]

    kpis.forEach((kpi, idx) => {
      const rowNum = 9 + idx
      sheetOverview.getCell(`A${rowNum}`).value = kpi[0]
      sheetOverview.getCell(`B${rowNum}`).value = kpi[1]
      sheetOverview.getCell(`A${rowNum}`).font = { name: 'Arial' }
      sheetOverview.getCell(`B${rowNum}`).font = { name: 'Arial', bold: true }
      if (kpi[2] === 'currency') {
        sheetOverview.getCell(`B${rowNum}`).numFmt = '#,##0 "₫"'
      }
      sheetOverview.getRow(rowNum).height = 22
    })

    // Phân bổ theo loại dịch vụ
    sheetOverview.getCell('A15').value = 'PHÂN BỔ DOANH THU THEO LOẠI DỊCH VỤ'
    sheetOverview.getCell('A15').font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FF0F766E' } }

    const sHeaderRow = sheetOverview.getRow(16)
    sHeaderRow.values = ['Mã dịch vụ', 'Tên dịch vụ', 'Số lượng đơn', 'Doanh thu (VND)', 'Tỷ trọng']
    sHeaderRow.height = 24
    sHeaderRow.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } }
    sHeaderRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })

    let sRowNum = 17
    Object.entries(serviceStats).forEach(([type, stat]) => {
      const pct = totalRevenue > 0 ? (stat.revenue / totalRevenue) : 0
      const row = sheetOverview.getRow(sRowNum)
      row.values = [
        type,
        SERVICE_LABELS[type] || type,
        stat.count,
        stat.revenue,
        pct,
      ]
      row.font = { name: 'Arial' }
      sheetOverview.getCell(`D${sRowNum}`).numFmt = '#,##0 "₫"'
      sheetOverview.getCell(`E${sRowNum}`).numFmt = '0.0%'
      row.height = 20
      sRowNum += 1
    })

    sheetOverview.getColumn(1).width = 45
    sheetOverview.getColumn(2).width = 30
    sheetOverview.getColumn(3).width = 16
    sheetOverview.getColumn(4).width = 22
    sheetOverview.getColumn(5).width = 14

    // ===== SHEET 2: CHI TIẾT GIAO DỊCH =====
    const sheetDetails = workbook.addWorksheet('Chi tiết giao dịch', {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
    })

    sheetDetails.columns = [
      { header: 'Mã đơn', key: 'code', width: 14 },
      { header: 'Thời gian đặt', key: 'createdAt', width: 20 },
      { header: 'Họ tên khách hàng', key: 'name', width: 22 },
      { header: 'Số điện thoại', key: 'phone', width: 15 },
      { header: 'Email liên hệ', key: 'email', width: 26 },
      { header: 'Loại dịch vụ', key: 'serviceType', width: 18 },
      { header: 'Tên dịch vụ / Sản phẩm', key: 'title', width: 34 },
      { header: 'Khách', key: 'passengers', width: 8 },
      { header: 'Trạng thái đơn', key: 'status', width: 16 },
      { header: 'Thanh toán', key: 'paymentStatus', width: 20 },
      { header: 'Phương thức', key: 'paymentMethod', width: 16 },
      { header: 'Voucher', key: 'promo', width: 14 },
      { header: 'Tổng tiền (VND)', key: 'total', width: 18 },
    ]

    const dHeaderRow = sheetDetails.getRow(1)
    dHeaderRow.height = 28
    dHeaderRow.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } }
    dHeaderRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      }
    })

    rows.forEach((b) => {
      const row = sheetDetails.addRow({
        code: b.code,
        createdAt: b.created_at ? new Date(b.created_at).toLocaleString('vi-VN') : '',
        name: b.traveler_name,
        phone: b.traveler_phone,
        email: b.traveler_email || b.owner_email || b.email,
        serviceType: SERVICE_LABELS[b.service_type] || b.service_type,
        title: b.title,
        passengers: b.passengers,
        status: b.status,
        paymentStatus: b.payment_status === 'paid' ? 'Đã thanh toán (MoMo)' : b.payment_status === 'simulated' ? 'Mô phỏng (Demo)' : 'Chưa thanh toán',
        paymentMethod: b.payment_method || (b.payment_status === 'paid' ? 'momo' : 'manual'),
        promo: b.promo_code || '—',
        total: b.total,
      })

      row.font = { name: 'Arial', size: 10 }
      row.height = 20
      const totalCell = row.getCell('total')
      totalCell.numFmt = '#,##0 "₫"'
      totalCell.font = { name: 'Arial', size: 10, bold: true }
    })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="MayAnNhien-BaoCaoDoanhThu-${new Date().toISOString().slice(0, 10)}.xlsx"`)

    await workbook.xlsx.write(res)
    res.end()
  } catch (err) {
    console.error('[reports] Xuất báo cáo Excel thất bại:', err)
    if (!res.headersSent) bad(res, 'Không thể xuất file Excel. Vui lòng thử lại sau.', 500)
  }
})

// Lịch sử giao dịch thanh toán của 1 đơn — phục vụ đối soát.
adminRouter.get('/bookings/:code/payments', (req, res) => {
  const code = String(req.params.code || '')
  const booking = db.prepare('SELECT code FROM bookings WHERE code = ?').get(code)
  if (!booking) return bad(res, 'Không tìm thấy đơn hàng.', 404)
  const attempts = listPaymentAttempts(code)
  const transactions = attempts.flatMap((a) =>
    listPaymentTransactions(a.order_id).map((t) => ({ ...t, orderId: a.order_id })))
  ok(res, { attempts, transactions })
})

/* ----------------------------------------------------------------- users */
adminRouter.get('/users', (req, res) => {
  const rows = db.prepare(`SELECT u.id, u.email, u.name, u.role, u.is_active, u.created_at,
                           (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id) AS booking_count
                           FROM users u ORDER BY u.created_at DESC, u.id DESC`).all()
  ok(res, rows.map((r) => ({
    id: r.id, email: r.email, name: r.name, role: r.role, isActive: !!r.is_active,
    createdAt: r.created_at, bookingCount: r.booking_count,
  })))
})

// Chỉ bật/tắt hoạt động. KHÔNG cho đổi role qua API này (chặn leo thang đặc quyền).
adminRouter.patch('/users/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id))
  if (!cur) return bad(res, 'Không tìm thấy người dùng.', 404)
  if (req.body?.role !== undefined) return bad(res, 'Không thể thay đổi vai trò qua API quản trị.')
  const isActive = bool(req.body?.isActive)
  if (isActive == null) return bad(res, 'Trạng thái hoạt động không hợp lệ.')
  if (Number(req.session.user.id) === cur.id && !isActive)
    return bad(res, 'Không thể tự vô hiệu hóa tài khoản của chính mình.', 409)

  db.prepare(`UPDATE users SET is_active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(isActive ? 1 : 0, cur.id)
  if (!isActive) deleteSessionsOfUser(cur.id) // đá mọi phiên đang hoạt động của tài khoản đó
  writeAuditLog({
    actorId: req.session.user.id, actorEmail: req.session.user.email,
    action: 'admin.user.toggle', entityType: 'user', entityId: String(cur.id),
    detail: `${cur.email} -> isActive=${isActive}`, ip: req.ip,
  })
  ok(res, {
    id: cur.id, email: cur.email, name: cur.name, role: cur.role, isActive,
    createdAt: cur.created_at,
    bookingCount: db.prepare('SELECT COUNT(*) AS c FROM bookings WHERE user_id = ?').get(cur.id).c,
  })
})

// Admin thay đổi vai trò người dùng (user | staff | admin)
adminRouter.patch('/users/:id/role', (req, res) => {
  const cur = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id))
  if (!cur) return bad(res, 'Không tìm thấy người dùng.', 404)
  const role = req.body?.role
  if (!['user', 'staff', 'admin'].includes(role)) {
    return bad(res, 'Vai trò không hợp lệ (chỉ chấp nhận user, staff, admin).')
  }
  if (Number(req.session.user.id) === cur.id && role !== 'admin') {
    return bad(res, 'Không thể tự hạ quyền quản trị viên của chính mình.', 409)
  }

  db.prepare(`UPDATE users SET role = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(role, cur.id)

  writeAuditLog({
    actorId: req.session.user.id,
    actorEmail: req.session.user.email,
    action: 'admin.user.change_role',
    entityType: 'user',
    entityId: String(cur.id),
    detail: `Đổi vai trò người dùng ${cur.email} từ ${cur.role} sang ${role}`,
    ip: req.ip,
  })

  ok(res, {
    id: cur.id,
    email: cur.email,
    name: cur.name,
    role,
    isActive: !!cur.is_active,
    createdAt: cur.created_at,
    bookingCount: db.prepare('SELECT COUNT(*) AS c FROM bookings WHERE user_id = ?').get(cur.id).c,
  })
})

/* ---------------------------------------------------- extra-services (Admin) */
adminRouter.get('/extra-services', (req, res) => {
  const category = req.query.category ? String(req.query.category).trim() : null
  const rows = listExtraServices(category)
  ok(res, rows.map((r) => ({
    ...r,
    isActive: !!r.is_active,
    metadata: typeof r.metadata_json === 'string' ? JSON.parse(r.metadata_json || '{}') : (r.metadata_json || {}),
  })))
})

adminRouter.post('/extra-services', (req, res) => {
  const category = txt(req.body?.category, 30, 2)
  const name = txt(req.body?.name, 120, 2)
  const price = int(req.body?.price, 0, 1e9)
  if (!category || !name || price == null) return bad(res, 'Thiếu thông tin dịch vụ mở rộng (category, name, price).')

  const id = req.body?.id ? String(req.body.id).trim() : newId(category.slice(0, 3))
  const description = txt(req.body?.description, 500, 0) || ''
  const metadata = typeof req.body?.metadata === 'object' ? req.body.metadata : {}

  const created = createExtraService({ id, category, name, description, price, metadata })
  audit(req, 'admin.extra_service.create', 'extra_service', id, `${name} (${price}đ)`)
  broadcastCatalogUpdated('extra_service', 'created', created)
  res.status(201).json({ ok: true, data: created })
})

adminRouter.patch('/extra-services/:id', (req, res) => {
  const id = String(req.params.id)
  const cur = getExtraService(id)
  if (!cur) return bad(res, 'Dịch vụ không tồn tại.', 404)

  const updated = updateExtraService(id, {
    category: req.body?.category ? txt(req.body.category, 30, 2) : undefined,
    name: req.body?.name ? txt(req.body.name, 120, 2) : undefined,
    description: req.body?.description !== undefined ? txt(req.body.description, 500, 0) : undefined,
    price: req.body?.price !== undefined ? int(req.body.price, 0, 1e9) : undefined,
    metadata: typeof req.body?.metadata === 'object' ? req.body.metadata : undefined,
    isActive: req.body?.isActive !== undefined ? bool(req.body.isActive) : undefined,
  })
  audit(req, 'admin.extra_service.update', 'extra_service', id, `Updated`)
  broadcastCatalogUpdated('extra_service', 'updated', updated)
  ok(res, updated)
})

adminRouter.delete('/extra-services/:id', (req, res) => {
  const id = String(req.params.id)
  const cur = getExtraService(id)
  if (!cur) return bad(res, 'Dịch vụ không tồn tại.', 404)

  deleteExtraService(id)
  audit(req, 'admin.extra_service.delete', 'extra_service', id, `Soft deleted`)
  broadcastCatalogUpdated('extra_service', 'deleted', { id })
  ok(res, { id, deleted: true })
})






