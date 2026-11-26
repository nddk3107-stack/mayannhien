// server/routes-admin.js — Toàn bộ API quản trị. Mọi route đều bắt buộc đăng nhập + role admin.
import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import ExcelJS from 'exceljs'
import {
  db, listFlights, listHotels, listPromotions, hotelOut, flightOut, promoOut, comboOut,
  roomOut, seedFlightSeats, listFlightSeats, releaseFlightSeat, addLoyaltyForBooking,
  deleteSessionsOfUser, writeAuditLog, listAuditLog, listAuditLogsFiltered, listPaymentAttempts, listPaymentTransactions,
  listExtraServices, getExtraService, createExtraService, updateExtraService, deleteExtraService,
} from './db.js'
import os from 'node:os'
import { requireAdmin } from './auth.js'
import { broadcastBookingUpdated, broadcastCatalogUpdated, broadcastDashboardUpdate, pushNotification } from './realtime.js'

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

/* ------------------------------------------- Production Dashboard Overview */
function getDateRangeBounds(rangeKey = '30d') {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const fmt = (d) => d.toISOString().slice(0, 10)

  if (rangeKey === 'today') {
    const yest = new Date(now.getTime() - 86400000)
    return {
      range: 'today',
      fromDate: todayStr,
      toDate: todayStr,
      prevFromDate: fmt(yest),
      prevToDate: fmt(yest),
      chartDays: 1,
    }
  }
  if (rangeKey === '7d') {
    const start = new Date(now.getTime() - 6 * 86400000)
    const prevEnd = new Date(now.getTime() - 7 * 86400000)
    const prevStart = new Date(now.getTime() - 13 * 86400000)
    return {
      range: '7d',
      fromDate: fmt(start),
      toDate: todayStr,
      prevFromDate: fmt(prevStart),
      prevToDate: fmt(prevEnd),
      chartDays: 7,
    }
  }
  if (rangeKey === 'month') {
    const firstOfMonth = `${todayStr.slice(0, 7)}-01`
    const prevMonthEnd = new Date(new Date(`${firstOfMonth}T00:00:00Z`).getTime() - 86400000)
    const prevMonthStart = `${fmt(prevMonthEnd).slice(0, 7)}-01`
    const dayOfMonth = Math.max(now.getUTCDate(), 1)
    return {
      range: 'month',
      fromDate: firstOfMonth,
      toDate: todayStr,
      prevFromDate: prevMonthStart,
      prevToDate: fmt(prevMonthEnd),
      chartDays: dayOfMonth,
    }
  }
  if (rangeKey === 'all') {
    return {
      range: 'all',
      fromDate: null,
      toDate: null,
      prevFromDate: null,
      prevToDate: null,
      chartDays: 14,
    }
  }
  // Mặc định: 30d
  const start30 = new Date(now.getTime() - 29 * 86400000)
  const prevEnd30 = new Date(now.getTime() - 30 * 86400000)
  const prevStart30 = new Date(now.getTime() - 59 * 86400000)
  return {
    range: '30d',
    fromDate: fmt(start30),
    toDate: todayStr,
    prevFromDate: fmt(prevStart30),
    prevToDate: fmt(prevEnd30),
    chartDays: 30,
  }
}

function normalizeBookingStatusKey(dbStatus) {
  if (dbStatus === 'Đã tạo' || dbStatus === 'Chờ thanh toán') return 'pending'
  if (dbStatus === 'Đã xác nhận' || dbStatus === 'Đã thanh toán') return 'confirmed'
  if (dbStatus === 'checked_in' || dbStatus === 'Đã check-in') return 'checked_in'
  if (dbStatus === 'Hoàn tất' || dbStatus === 'completed') return 'completed'
  if (dbStatus === 'Đã hủy' || dbStatus === 'cancelled') return 'cancelled'
  return 'confirmed'
}

const BOOKING_STATUS_LABELS = {
  pending: 'Chờ thanh toán',
  confirmed: 'Đã xác nhận',
  checked_in: 'Đã check-in',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
}

function normalizePaymentStatusKey(dbPayment, dbStatus) {
  if (dbPayment === 'refunded') return 'refunded'
  if (dbPayment === 'refund_pending' || (dbStatus === 'Đã hủy' && dbPayment === 'paid')) return 'refund_pending'
  if (dbPayment === 'paid') return 'paid'
  return 'pending'
}

const PAYMENT_STATUS_LABELS = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  refund_pending: 'Chờ hoàn tiền',
  refunded: 'Đã hoàn tiền',
}

function computeFinancialsForPeriod(fromDate, toDate) {
  const dateClause = fromDate && toDate ? 'AND substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?' : ''
  const dateArgs = fromDate && toDate ? [fromDate, toDate] : []

  // Chỉ tính GMV & Discount trên các đơn hợp lệ đã thanh toán thật:
  // payment_status = 'paid' AND status IN ('Đã xác nhận', 'Đã thanh toán', 'checked_in', 'Hoàn tất') AND legacy = 0
  const validRow = db.prepare(`
    SELECT
      COUNT(*) AS orders_count,
      COALESCE(SUM(total + COALESCE(discount, 0)), 0) AS gmv,
      COALESCE(SUM(COALESCE(discount, 0)), 0) AS total_discount,
      COALESCE(SUM(total), 0) AS paid_total
    FROM bookings
    WHERE payment_status = 'paid'
      AND status IN ('Đã xác nhận', 'Đã thanh toán', 'checked_in', 'Hoàn tất')
      AND legacy = 0
      ${dateClause}
  `).get(...dateArgs) || { orders_count: 0, gmv: 0, total_discount: 0, paid_total: 0 }

  // Tổng tiền đã hoàn cho khách hủy (payment_status = 'refunded')
  const refundRow = db.prepare(`
    SELECT
      COUNT(*) AS refunded_count,
      COALESCE(SUM(total), 0) AS total_refund
    FROM bookings
    WHERE payment_status = 'refunded'
      AND legacy = 0
      ${dateClause}
  `).get(...dateArgs) || { refunded_count: 0, total_refund: 0 }

  const gmv = Number(validRow.gmv) || 0
  const total_discount = Number(validRow.total_discount) || 0
  const total_refund = Number(refundRow.total_refund) || 0
  // net_revenue = gmv - total_discount - total_refund
  const net_revenue = Math.max(gmv - total_discount - total_refund, 0)

  return {
    gmv,
    total_discount,
    total_refund,
    net_revenue,
    valid_orders_count: Number(validRow.orders_count) || 0,
    refunded_orders_count: Number(refundRow.refunded_count) || 0,
  }
}

export function buildDashboardOverview(rangeParam = '30d') {
  const bounds = getDateRangeBounds(rangeParam)
  const todayStr = new Date().toISOString().slice(0, 10)

  // A. Khối Tài chính thực (Financial KPIs)
  const currentFin = computeFinancialsForPeriod(bounds.fromDate, bounds.toDate)
  let growth_percent = 0
  let prev_net_revenue = 0
  if (bounds.prevFromDate && bounds.prevToDate) {
    const prevFin = computeFinancialsForPeriod(bounds.prevFromDate, bounds.prevToDate)
    prev_net_revenue = prevFin.net_revenue
    if (prev_net_revenue > 0) {
      growth_percent = Math.round(((currentFin.net_revenue - prev_net_revenue) / prev_net_revenue) * 1000) / 10
    } else if (currentFin.net_revenue > 0) {
      growth_percent = 100
    }
  }

  // B. Khối Vận hành cần xử lý ngay (Actionable Ops)
  const pending_payment_count = db.prepare(`
    SELECT COUNT(*) AS c FROM bookings
    WHERE status IN ('Đã tạo', 'Chờ thanh toán')
       OR (payment_status = 'pending' AND status <> 'Đã hủy')
  `).get()?.c || 0

  const today_checkins_count = db.prepare(`
    SELECT COUNT(*) AS c FROM bookings
    WHERE status IN ('Đã xác nhận', 'Đã thanh toán')
      AND (depart_date = ? OR (depart_date IS NULL AND substr(created_at, 1, 10) = ?))
  `).get(todayStr, todayStr)?.c || 0

  const refund_pending_count = db.prepare(`
    SELECT COUNT(*) AS c FROM bookings
    WHERE payment_status = 'refund_pending'
       OR (status = 'Đã hủy' AND payment_status = 'paid')
  `).get()?.c || 0

  // Cảnh báo tồn kho thấp (Phòng còn <= 2 hoặc Chuyến bay còn <= 15 ghế)
  const low_inventory_alerts = []
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const activeRooms = db.prepare(`
    SELECT r.id, r.name, r.total_rooms, h.name AS hotel_name
    FROM rooms r JOIN hotels h ON h.id = r.hotel_id
    WHERE r.is_active = 1 AND h.is_active = 1
  `).all()
  for (const rm of activeRooms) {
    const totalRooms = Number(rm.total_rooms) || 5
    const booked = db.prepare(`
      SELECT COALESCE(SUM(COALESCE(rooms_count, 1)), 0) AS c
      FROM bookings
      WHERE room_id = ? AND status <> 'Đã hủy'
        AND ((depart_date IS NOT NULL AND return_date IS NOT NULL AND depart_date < ? AND return_date > ?)
             OR (depart_date IS NULL AND status IN ('Đã xác nhận', 'Đã thanh toán', 'checked_in')))
    `).get(rm.id, tomorrowStr, todayStr)?.c || 0
    const remaining = Math.max(totalRooms - Number(booked), 0)
    if (remaining <= 2) {
      low_inventory_alerts.push({
        id: rm.id,
        type: 'room',
        name: `${rm.name} (${rm.hotel_name})`,
        remaining,
        total: totalRooms,
      })
    }
  }

  const activeFlightsList = db.prepare('SELECT id, airline, flight_code, origin, dest, total_seats FROM flights WHERE is_active = 1').all()
  for (const fl of activeFlightsList) {
    const availSeats = db.prepare("SELECT COUNT(*) AS c FROM flight_seats WHERE flight_id = ? AND status = 'available'").get(fl.id)?.c ?? 72
    const totalSeats = Number(fl.total_seats) || 72
    if (availSeats <= 18) {
      low_inventory_alerts.push({
        id: fl.id,
        type: 'flight',
        name: `${fl.airline} (${fl.origin} → ${fl.dest})`,
        remaining: availSeats,
        total: totalSeats,
      })
    }
  }

  const hotelsCount = db.prepare('SELECT COUNT(*) AS c FROM hotels WHERE is_active = 1').get().c
  const roomsCount = db.prepare('SELECT COUNT(*) AS c FROM rooms WHERE is_active = 1').get().c
  const flightsCount = db.prepare('SELECT COUNT(*) AS c FROM flights WHERE is_active = 1').get().c
  const combosCount = db.prepare('SELECT COUNT(*) AS c FROM combos WHERE is_active = 1').get().c
  const promosCount = db.prepare('SELECT COUNT(*) AS c FROM promotions WHERE is_active = 1').get().c

  // C. Khối Biểu đồ & Phân bổ
  // 1. revenue_chart theo ngày
  const chartDays = Math.min(Math.max(bounds.chartDays || 14, 7), 31)
  const revenue_chart = []
  for (let i = chartDays - 1; i >= 0; i -= 1) {
    const dStr = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    const dayPaid = db.prepare(`
      SELECT
        COUNT(*) AS paid_orders,
        COALESCE(SUM(total), 0) AS paid_rev
      FROM bookings
      WHERE substr(created_at, 1, 10) = ?
        AND payment_status = 'paid'
        AND status IN ('Đã xác nhận', 'Đã thanh toán', 'checked_in', 'Hoàn tất')
        AND legacy = 0
    `).get(dStr) || { paid_orders: 0, paid_rev: 0 }

    const dayRefund = db.prepare(`
      SELECT COALESCE(SUM(total), 0) AS ref_sum
      FROM bookings
      WHERE substr(created_at, 1, 10) = ?
        AND payment_status = 'refunded'
        AND legacy = 0
    `).get(dStr)?.ref_sum || 0

    const dayAllOrders = db.prepare(`
      SELECT COUNT(*) AS c FROM bookings WHERE substr(created_at, 1, 10) = ? AND legacy = 0
    `).get(dStr)?.c || 0

    revenue_chart.push({
      date: dStr,
      label: dStr.slice(5), // MM-DD
      net_revenue: Math.max(Number(dayPaid.paid_rev || 0) - Number(dayRefund || 0), 0),
      orders_count: Number(dayAllOrders) || 0,
      paid_orders_count: Number(dayPaid.paid_orders) || 0,
    })
  }

  // 2. status_breakdown chuẩn 5 trạng thái (pending, confirmed, checked_in, completed, cancelled)
  const dateFilterSql = bounds.fromDate && bounds.toDate
    ? 'WHERE legacy = 0 AND substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?'
    : 'WHERE legacy = 0'
  const dateFilterArgs = bounds.fromDate && bounds.toDate ? [bounds.fromDate, bounds.toDate] : []

  const allPeriodRows = db.prepare(`
    SELECT status, payment_status, service_type, total, discount
    FROM bookings
    ${dateFilterSql}
  `).all(...dateFilterArgs)

  const statusBuckets = {
    pending: { key: 'pending', label: 'Chờ thanh toán', count: 0, amount: 0 },
    confirmed: { key: 'confirmed', label: 'Đã xác nhận', count: 0, amount: 0 },
    checked_in: { key: 'checked_in', label: 'Đã check-in', count: 0, amount: 0 },
    completed: { key: 'completed', label: 'Hoàn tất', count: 0, amount: 0 },
    cancelled: { key: 'cancelled', label: 'Đã hủy', count: 0, amount: 0 },
  }

  const serviceBuckets = {
    hotel: { key: 'hotel', label: 'Khách sạn', orders_count: 0, revenue: 0 },
    flight: { key: 'flight', label: 'Chuyến bay', orders_count: 0, revenue: 0 },
    combo: { key: 'combo', label: 'Combo du lịch', orders_count: 0, revenue: 0 },
  }

  for (const r of allPeriodRows) {
    const sKey = normalizeBookingStatusKey(r.status)
    if (statusBuckets[sKey]) {
      statusBuckets[sKey].count += 1
      statusBuckets[sKey].amount += Number(r.total) || 0
    }
    const isValidPaid = r.payment_status === 'paid' && ['confirmed', 'checked_in', 'completed'].includes(sKey)
    const svcKey = r.service_type === 'flight' ? 'flight' : r.service_type === 'combo' ? 'combo' : 'hotel'
    if (r.status !== 'Đã hủy') {
      serviceBuckets[svcKey].orders_count += 1
    }
    if (isValidPaid) {
      serviceBuckets[svcKey].revenue += Number(r.total) || 0
    }
  }

  const totalStatusCount = Math.max(allPeriodRows.length, 1)
  const status_breakdown = Object.values(statusBuckets).map((b) => ({
    ...b,
    percent: Math.round((b.count / totalStatusCount) * 1000) / 10,
  }))

  const totalServiceRev = Object.values(serviceBuckets).reduce((acc, s) => acc + s.revenue, 0)
  const service_breakdown = Object.values(serviceBuckets).map((s) => ({
    ...s,
    percent: totalServiceRev > 0 ? Math.round((s.revenue / totalServiceRev) * 1000) / 10 : 0,
  }))

  // 4. recent_bookings (8 đơn mới nhất từ SQLite)
  const recentRows = db.prepare(`
    SELECT b.*, u.email AS owner_email
    FROM bookings b JOIN users u ON u.id = b.user_id
    WHERE b.legacy = 0
    ORDER BY b.id DESC
    LIMIT 8
  `).all()

  const recent_bookings = recentRows.map((r) => {
    const bKey = normalizeBookingStatusKey(r.status)
    const pKey = normalizePaymentStatusKey(r.payment_status, r.status)
    return {
      ...bookingOut(r),
      bookingStatusKey: bKey,
      bookingStatusLabel: BOOKING_STATUS_LABELS[bKey] || r.status,
      paymentStatusKey: pKey,
      paymentStatusLabel: PAYMENT_STATUS_LABELS[pKey] || r.payment_status,
      subtotal: Number(r.total || 0) + Number(r.discount || 0),
    }
  })

  // D. Khối System Health
  const mem = process.memoryUsage()
  const system_health = {
    status: 'Live',
    uptimeSeconds: Math.round(process.uptime()),
    cpuCores: os.cpus().length,
    loadAvg: Number(os.loadavg()[0].toFixed(2)),
    heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
    rssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
  }

  return {
    range: bounds.range,
    fromDate: bounds.fromDate,
    toDate: bounds.toDate,
    financial: {
      ...currentFin,
      prev_net_revenue,
      growth_percent,
    },
    ops: {
      pending_payment_count,
      today_checkins_count,
      refund_pending_count,
      low_inventory_alerts,
      active_catalog: {
        hotels: hotelsCount,
        rooms: roomsCount,
        flights: flightsCount,
        combos: combosCount,
        promotions: promosCount,
        totalProducts: hotelsCount + flightsCount + combosCount,
      },
    },
    charts: {
      revenue_chart,
      status_breakdown,
      service_breakdown,
      recent_bookings,
    },
    system_health,
  }
}

adminRouter.get('/dashboard/overview', (req, res) => {
  const range = txt(req.query.range, 20, 0) || '30d'
  ok(res, buildDashboardOverview(range))
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
                                 WHERE status IN ('Đã thanh toán','Đã xác nhận','checked_in','Đã check-in','Hoàn tất') AND legacy = 0`).get()
  const legacyBookings = db.prepare('SELECT COUNT(*) AS c FROM bookings WHERE legacy = 1').get().c
  // Doanh thu THẬT (P1-01): KHÔNG tin cột payment_status một cách mù quáng.
  // Một đơn chỉ được tính khi: payment_status='paid' AND có bằng chứng giao dịch
  // đã xác minh trong payment_attempts (status='paid' + trans_id khác rỗng) hoặc thanh toán Ví/SePay.
  const realRevenueRow = db.prepare(`SELECT COALESCE(SUM(b.total),0) AS s, COUNT(*) AS c
                                     FROM bookings b
                                     WHERE b.payment_status = 'paid' AND b.legacy = 0 AND b.status <> 'Đã hủy'
                                       AND (
                                         b.payment_method IN ('wallet', 'sepay')
                                         OR EXISTS (
                                           SELECT 1 FROM payment_attempts pa
                                           WHERE pa.booking_code = b.code
                                             AND pa.status = 'paid'
                                             AND pa.trans_id IS NOT NULL AND pa.trans_id <> ''
                                         )
                                       )`).get()
  const paidBookings = realRevenueRow.c
  // Số đơn bị đánh dấu 'paid' nhưng KHÔNG có bằng chứng -> không tính doanh thu (để điều tra).
  const unverifiedPaidBookings = db.prepare(`SELECT COUNT(*) AS c FROM bookings b
                                     WHERE b.payment_status = 'paid'
                                       AND b.payment_method NOT IN ('wallet', 'sepay')
                                       AND NOT EXISTS (
                                         SELECT 1 FROM payment_attempts pa
                                         WHERE pa.booking_code = b.code
                                           AND pa.status = 'paid'
                                           AND pa.trans_id IS NOT NULL AND pa.trans_id <> ''
                                       )`).get().c
  const simulatedBookings = db.prepare("SELECT COUNT(*) AS c FROM bookings WHERE payment_status = 'simulated' AND status <> 'Đã hủy'").get().c
  const simulatedRevenue = Math.max(Number(revenueRow.s || 0) - Number(realRevenueRow.s || 0), 0)
  const trend = []
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    const c = db.prepare(`SELECT COUNT(*) AS c FROM bookings WHERE substr(created_at,1,10) = ?`).get(day).c
    trend.push({ day, count: c })
  }

  ok(res, {
    totalBookings,
    byStatus,
    revenue: revenueRow.s,
    realRevenue: realRevenueRow.s,
    simulatedRevenue,
    paidBookings,
    unverifiedPaidBookings,
    simulatedBookings,
    legacyBookings,
    revenueNote: 'Tổng doanh thu hợp lệ từ các đơn đã xác nhận, đã check-in và hoàn tất (đã loại trừ đơn hủy và đơn lỗi/legacy).',
    realRevenueNote: 'Doanh thu thực thu qua cổng thanh toán SePay VietQR, Ví Mây An Nhiên và MoMo IPN đã đối soát.',
    users: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
    admins: db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND is_active = 1").get().c,
    staffs: db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'staff' AND is_active = 1").get().c,
    hotels: db.prepare('SELECT COUNT(*) AS c FROM hotels WHERE is_active = 1').get().c,
    rooms: db.prepare('SELECT COUNT(*) AS c FROM rooms WHERE is_active = 1').get().c,
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
    userId: r.user_id,
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
    roomId: r.room_id || null,
    roomName: r.room_name || null,
    nights: r.nights || 0,
    roomsCount: r.rooms_count || 1,
    adults: r.adults || r.passengers || 1,
    children: r.children || 0,
    seatCode: r.seat_code || null,
    checkedInAt: r.checked_in_at || null,
    checkedInBy: r.checked_in_by || null,
    cancelReason: r.cancel_reason || '',
    internalNote: r.internal_note || '',
    completedAt: r.completed_at || null,
    legacy: !!r.legacy,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

adminRouter.get('/bookings', (req, res) => {
  const q = txt(req.query.q, 120, 0)
  const status = txt(req.query.status, 30, 0)
  const serviceType = txt(req.query.serviceType, 30, 0)
  const paymentStatus = txt(req.query.paymentStatus, 30, 0)
  const fromDate = txt(req.query.fromDate, 20, 0)
  const toDate = txt(req.query.toDate, 20, 0)
  const page = int(req.query.page ?? 1, 1, 100000) ?? 1
  const limit = int(req.query.limit ?? 50, 1, 200) ?? 50

  const where = []
  const args = []
  if (q) {
    where.push('(b.code LIKE ? OR b.traveler_name LIKE ? OR b.traveler_phone LIKE ? OR b.traveler_email LIKE ? OR b.email LIKE ? OR b.title LIKE ?)')
    args.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
  }
  if (status && status !== 'all') { where.push('b.status = ?'); args.push(status) }
  if (serviceType && serviceType !== 'all') { where.push('b.service_type = ?'); args.push(serviceType) }
  if (paymentStatus && paymentStatus !== 'all') { where.push('b.payment_status = ?'); args.push(paymentStatus) }
  if (fromDate) { where.push('substr(b.created_at, 1, 10) >= ?'); args.push(fromDate) }
  if (toDate) { where.push('substr(b.created_at, 1, 10) <= ?'); args.push(toDate) }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const joins = 'FROM bookings b JOIN users u ON u.id = b.user_id'

  const total = db.prepare(`SELECT COUNT(*) AS c ${joins} ${whereSql}`).get(...args).c
  const rows = db.prepare(`SELECT b.*, u.email AS owner_email ${joins} ${whereSql}
                           ORDER BY b.id DESC LIMIT ? OFFSET ?`)
    .all(...args, limit, (page - 1) * limit)

  ok(res, { items: rows.map(bookingOut), total, page, limit })
})

// Chuyển trạng thái theo đồ thị State Machine chặt chẽ:
// pending ('Đã tạo'/'Chờ thanh toán') -> confirmed ('Đã xác nhận') / cancelled ('Đã hủy')
// confirmed ('Đã xác nhận'/'Đã thanh toán') -> checked_in / completed ('Hoàn tất') / cancelled ('Đã hủy')
// checked_in -> completed ('Hoàn tất') / cancelled ('Đã hủy')
const TRANSITIONS = {
  'Đã tạo': ['Chờ thanh toán', 'Đã xác nhận', 'Đã hủy'],
  'Chờ thanh toán': ['Đã thanh toán', 'Đã xác nhận', 'Đã hủy'],
  'Đã thanh toán': ['Đã xác nhận', 'checked_in', 'Đã hủy'],
  'Đã xác nhận': ['checked_in', 'Hoàn tất', 'Đã hủy'],
  'checked_in': ['Hoàn tất', 'Đã hủy'],
  'Hoàn tất': [],
  'Đã hủy': [],
}
// P1-01: Admin KHÔNG BAO GIỜ được tự đặt trạng thái thanh toán 'paid'.
// 'paid' chỉ được đặt bởi luồng thanh toán server-side đã XÁC MINH (IPN MoMo hợp lệ).
// Admin vẫn có thể ghi nhận thủ công 'pending'/'simulated'/'refunded' nhưng BẮT BUỘC
// phải kèm lý do -> mọi thao tác đều bị ghi vào audit log.
// Admin chỉ được ghi nhận tay các trạng thái này ('paid' bị chặn tuyệt đối).
const MANUAL_PAYMENT_STATES = ['pending', 'simulated', 'refund_pending', 'refunded']
const PAYMENT_REASON_MIN = 5
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
  const hasInternalNote = req.body?.internalNote !== undefined
  const internalNote = hasInternalNote ? (txt(req.body.internalNote, 500, 0) ?? '') : row.internal_note
  const cancelReasonInput = txt(req.body?.cancelReason, 300, 0)

  if (!nextStatus && !nextPayment && !hasInternalNote) return bad(res, 'Không có dữ liệu cập nhật.')

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
    if (!Object.hasOwn(TRANSITIONS, row.status)) return bad(res, 'Trạng thái hiện tại không hợp lệ.', 400)
    if (!TRANSITIONS[row.status].includes(nextStatus))
      return bad(res, `Không được chuyển từ "${row.status}" sang "${nextStatus}".`, 400)
    if (nextStatus === 'Đã thanh toán' && !hasVerifiedPayment(row.code) && row.payment_status !== 'paid')
      return bad(res, 'Không thể chuyển sang "Đã thanh toán" khi đơn chưa có giao dịch thanh toán đã xác minh.', 409)
  }

  const finalStatus = nextStatus || row.status
  let finalPayment = nextPayment || row.payment_status
  // Khi đơn đã thanh toán bị hủy mà chưa chỉ định hoàn tiền ngay -> chuyển sang 'refund_pending' (Chờ hoàn tiền)
  if (finalStatus === 'Đã hủy' && row.payment_status === 'paid' && !nextPayment) {
    finalPayment = 'refund_pending'
  }
  const finalCancelReason = finalStatus === 'Đã hủy'
    ? (cancelReasonInput || paymentReason || row.cancel_reason || 'Hủy bởi quản trị viên')
    : (row.cancel_reason || null)
  const finalCheckedInAt = (finalStatus === 'checked_in' && !row.checked_in_at)
    ? new Date().toISOString()
    : row.checked_in_at
  const finalCheckedInBy = (finalStatus === 'checked_in' && !row.checked_in_by)
    ? req.session.user.email
    : row.checked_in_by
  const finalCompletedAt = (finalStatus === 'Hoàn tất' && !row.completed_at)
    ? new Date().toISOString()
    : row.completed_at

  let releasedSeat = null
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

    // Tự động hoàn lại ghế máy bay khi đơn chuyển sang Đã hủy hoặc hoàn tiền (refunded)
    if ((finalStatus === 'Đã hủy' || finalPayment === 'refunded') && row.seat_code) {
      const codes = String(row.seat_code).split(',').map((s) => s.trim()).filter(Boolean)
      for (const sc of codes) {
        db.prepare(`UPDATE flight_seats SET status = 'available', booking_id = NULL,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
                    WHERE flight_id = ? AND seat_code = ?`).run(row.item_id, sc)
      }
      releasedSeat = row.seat_code
    }

    db.prepare(`UPDATE bookings SET status = ?, payment_status = ?, cancel_reason = ?,
                internal_note = ?, checked_in_at = ?, checked_in_by = ?, completed_at = ?,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
      .run(finalStatus, finalPayment, finalCancelReason, internalNote, finalCheckedInAt, finalCheckedInBy, finalCompletedAt, row.id)
    db.exec('COMMIT')
  } catch (err) {
    try { db.exec('ROLLBACK') } catch { /* không có transaction để hoàn tác */ }
    throw err
  }

  // Tự động cộng điểm thưởng Loyalty khi đơn lần đầu chuyển từ Đã tạo/Chờ thanh toán sang Đã xác nhận / checked_in
  if (
    ['Đã tạo', 'Chờ thanh toán'].includes(row.status) &&
    ['Đã xác nhận', 'checked_in', 'Hoàn tất'].includes(finalStatus) &&
    row.total > 0
  ) {
    try { addLoyaltyForBooking(row.user_id, row.total) } catch { }
  }

  writeAuditLog({
    actorId: req.session.user.id, actorEmail: req.session.user.email,
    action: changingPayment ? 'admin.booking.payment_manual' : (hasInternalNote && !nextStatus ? 'admin.booking.note' : 'admin.booking.update'),
    entityType: 'booking', entityId: String(row.code),
    detail: `${row.status} -> ${finalStatus}; payment=${finalPayment}`
      + (changingPayment ? `; reason=${paymentReason}` : '')
      + (finalCancelReason && finalStatus === 'Đã hủy' ? `; cancelReason=${finalCancelReason}` : '')
      + (releasedSeat ? `; releasedSeat=${releasedSeat}` : '')
      + (hasInternalNote ? `; note=${internalNote}` : ''),
    ip: req.ip,
  })

  const updated = db.prepare(`SELECT b.*, u.email AS owner_email FROM bookings b
                              JOIN users u ON u.id = b.user_id WHERE b.id = ?`).get(row.id)
  const result = bookingOut(updated)
  broadcastBookingUpdated(result)
  broadcastDashboardUpdate('admin.booking.update')
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
      name: b.name ?? cur.name, location: b.location ?? cur.location, city: b.city ?? cur.city,
      lat: b.lat ?? cur.lat, lng: b.lng ?? cur.lng,
      rating: b.rating ?? cur.rating,
      stars: b.stars ?? cur.stars, price: b.price ?? cur.price, hasPromo: b.hasPromo ?? !!cur.has_promo,
      image: b.image ?? cur.image, perks: b.perks ?? JSON.parse(cur.perks || '[]'),
      description: b.description ?? cur.description, isActive: b.isActive ?? !!cur.is_active
    }
    : b
  const latVal = src.lat === '' || src.lat == null ? null : Number(src.lat)
  const lngVal = src.lng === '' || src.lng == null ? null : Number(src.lng)
  const out = {
    name: txt(src.name, 120), location: txt(src.location, 120),
    city: txt(src.city ?? src.location ?? '', 80, 0) ?? '',
    lat: Number.isFinite(latVal) ? latVal : null,
    lng: Number.isFinite(lngVal) ? lngVal : null,
    rating: Number(src.rating), stars: int(src.stars, 1, 5), price: int(src.price, 10000, 100000000),
    hasPromo: bool(src.hasPromo), isActive: bool(src.isActive),
    image: txt(src.image ?? '', 800, 0) ?? '',
    description: txt(src.description ?? '', 600, 0) ?? '',
    perks: JSON.stringify(Array.isArray(src.perks) ? src.perks.filter((p) => txt(p, 60, 1)).slice(0, 12) : []),
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
  db.prepare(`INSERT INTO hotels (id, name, location, city, lat, lng, rating, stars, price, has_promo, image, perks, description, is_active)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, r.value.name, r.value.location, r.value.city, r.value.lat, r.value.lng, r.value.rating, r.value.stars, r.value.price,
      r.value.hasPromo ? 1 : 0, r.value.image, r.value.perks, r.value.description, r.value.isActive ? 1 : 0)
  audit(req, 'admin.hotel.create', 'hotel', id, `${r.value.name} @ ${r.value.location}`)
  broadcastCatalogUpdated('hotel', 'created', { id })
  res.status(201).json({ ok: true, data: hotelOut(db.prepare('SELECT * FROM hotels WHERE id = ?').get(id)) })
})

adminRouter.patch('/hotels/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM hotels WHERE id = ?').get(req.params.id)
  if (!cur) return bad(res, 'Không tìm thấy khách sạn.', 404)
  const r = hotelPayload(req.body || {}, cur)
  if (r.error) return bad(res, r.error)
  db.prepare(`UPDATE hotels SET name=?, location=?, city=?, lat=?, lng=?, rating=?, stars=?, price=?, has_promo=?, image=?, perks=?,
              description=?, is_active=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`)
    .run(r.value.name, r.value.location, r.value.city, r.value.lat, r.value.lng, r.value.rating, r.value.stars, r.value.price,
      r.value.hasPromo ? 1 : 0, r.value.image, r.value.perks, r.value.description, r.value.isActive ? 1 : 0, cur.id)
  audit(req, 'admin.hotel.update', 'hotel', cur.id, r.value.name)
  broadcastCatalogUpdated('hotel', 'updated', { id: cur.id })
  ok(res, hotelOut(db.prepare('SELECT * FROM hotels WHERE id = ?').get(cur.id)))
})

// "Xóa" = ngừng kinh doanh / chuyển sang hidden (Soft Delete, giữ nguyên phòng và đơn hàng cũ).
adminRouter.delete('/hotels/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM hotels WHERE id = ?').get(req.params.id)
  if (!cur) return bad(res, 'Không tìm thấy khách sạn.', 404)
  const roomRefs = db.prepare('SELECT COUNT(*) AS c FROM rooms WHERE hotel_id = ?').get(cur.id).c
  const bookingRefs = db.prepare("SELECT COUNT(*) AS c FROM bookings WHERE item_id = ? AND service_type = 'hotel'").get(cur.id).c
  const comboRefs = db.prepare('SELECT COUNT(*) AS c FROM combos WHERE hotel_id = ?').get(cur.id).c
  db.prepare("UPDATE hotels SET is_active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(cur.id)
  const reason = `Đã chuyển sang trạng thái Ẩn (Hidden) để bảo toàn ${roomRefs} phòng, ${bookingRefs} đơn đặt và ${comboRefs} combo liên kết.`
  audit(req, 'admin.hotel.delete', 'hotel', cur.id, `${cur.name} (${reason})`)
  broadcastCatalogUpdated('hotel', 'deleted', { id: cur.id })
  ok(res, { id: cur.id, isActive: false, message: reason })
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

  const checkIn = txt(req.query.checkIn, 10, 0) || new Date().toISOString().slice(0, 10)
  const checkOut = txt(req.query.checkOut, 10, 0) || new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  ok(res, {
    items: rows.map((r) => {
      const base = roomOut(r)
      const bookedRow = db.prepare(`
        SELECT COALESCE(SUM(COALESCE(rooms_count, 1)), 0) AS c
        FROM bookings
        WHERE room_id = ? AND status <> 'Đã hủy'
          AND (
            (depart_date IS NOT NULL AND return_date IS NOT NULL AND depart_date < ? AND return_date > ?)
            OR (depart_date IS NULL AND status IN ('Đã xác nhận', 'Đã thanh toán', 'checked_in'))
          )
      `).get(r.id, checkOut, checkIn)
      const bookedCount = Number(bookedRow?.c) || 0
      const totalRooms = Number(base.totalRooms) || 5
      return {
        ...base,
        hotelName: r.hotel_name,
        totalRooms,
        bookedCount,
        availableCount: Math.max(totalRooms - bookedCount, 0),
        checkIn,
        checkOut,
      }
    }),
    total, page, limit, checkIn, checkOut,
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
      totalRooms: b.totalRooms ?? curCamel.totalRooms ?? 5,
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
  const totalRooms = int(src.totalRooms ?? 5, 1, 500) ?? 5

  // room ID KHÔNG được gửi trong body thay đổi — route param mới là nguồn thật.
  return {
    value: {
      name, hotelId, price, bedType, sizeSqm, maxAdults, maxChildren, totalRooms,
      amenities, images, breakfast, freeCancellation, checkinTime, checkoutTime, isActive
    },
  }
}

adminRouter.post('/rooms', (req, res) => {
  const r = roomPayload(req.body || {})
  if (r.error) return bad(res, r.error)
  const id = newId('room')
  db.prepare(`INSERT INTO rooms (id, hotel_id, name, price, bed_type, size_sqm,
      max_adults, max_children, total_rooms, amenities, images, breakfast, free_cancellation,
      checkin_time, checkout_time, is_active)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, r.value.hotelId, r.value.name, r.value.price, r.value.bedType, r.value.sizeSqm,
      r.value.maxAdults, r.value.maxChildren, r.value.totalRooms, JSON.stringify(r.value.amenities),
      JSON.stringify(r.value.images), r.value.breakfast ? 1 : 0,
      r.value.freeCancellation ? 1 : 0, r.value.checkinTime, r.value.checkoutTime,
      r.value.isActive ? 1 : 0)
  audit(req, 'admin.room.create', 'room', id,
    `${r.value.name} (${r.value.hotelId}) ${r.value.price}đ/đêm SL=${r.value.totalRooms}`)
  res.status(201).json({ ok: true, data: roomOut(db.prepare('SELECT * FROM rooms WHERE id = ?').get(id)) })
})

adminRouter.patch('/rooms/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id)
  if (!cur) return bad(res, 'Không tìm thấy phòng.', 404)
  const r = roomPayload(req.body || {}, cur)
  if (r.error) return bad(res, r.error)

  // Vô hiệu hóa phòng = giảm tồn kho -> từ chối nếu phòng đang được
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
              max_children=?, total_rooms=?, amenities=?, images=?, breakfast=?, free_cancellation=?,
              checkin_time=?, checkout_time=?, is_active=?,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(r.value.hotelId, r.value.name, r.value.price, r.value.bedType, r.value.sizeSqm,
      r.value.maxAdults, r.value.maxChildren, r.value.totalRooms, JSON.stringify(r.value.amenities),
      JSON.stringify(r.value.images), r.value.breakfast ? 1 : 0,
      r.value.freeCancellation ? 1 : 0, r.value.checkinTime, r.value.checkoutTime,
      r.value.isActive ? 1 : 0, cur.id)
  audit(req, 'admin.room.update', 'room', cur.id,
    `${r.value.name} gia=${r.value.price} SL=${r.value.totalRooms} active=${r.value.isActive}`)
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
const FLIGHT_STATUSES = ['scheduled', 'boarding', 'departed', 'cancelled']

adminRouter.get('/flights', (req, res) => ok(res, listFlights(true)))

function flightPayload(b, cur) {
  const src = cur
    ? {
      flightCode: b.flightCode ?? cur.flight_code,
      airline: b.airline ?? cur.airline, logo: b.logo ?? cur.logo, from: b.from ?? cur.origin,
      to: b.to ?? cur.dest, depart: b.depart ?? cur.depart, arrive: b.arrive ?? cur.arrive,
      duration: b.duration ?? cur.duration, price: b.price ?? cur.price,
      businessPrice: b.businessPrice ?? cur.business_price,
      totalSeats: b.totalSeats ?? cur.total_seats ?? 72,
      flightStatus: b.flightStatus ?? cur.flight_status ?? 'scheduled',
      cutoffHours: b.cutoffHours ?? cur.cutoff_hours ?? 2,
      tag: b.tag ?? cur.tag,
      hasPromo: b.hasPromo ?? !!cur.has_promo, isActive: b.isActive ?? !!cur.is_active
    }
    : b
  const priceNum = int(src.price, 10000, 100000000)
  const bizPrice = src.businessPrice != null && src.businessPrice !== ''
    ? int(src.businessPrice, 10000, 200000000)
    : (priceNum ? Math.round(priceNum * 1.8) : null)
  const fStatus = FLIGHT_STATUSES.includes(src.flightStatus) ? src.flightStatus : 'scheduled'
  const out = {
    flightCode: txt(src.flightCode ?? '', 24, 0) || null,
    airline: txt(src.airline, 60), logo: txt(src.logo ?? '', 6, 0) ?? '',
    from: txt(src.from, 60), to: txt(src.to, 60),
    depart: txt(src.depart, 5, 5), arrive: txt(src.arrive, 5, 5),
    duration: txt(src.duration, 24), tag: txt(src.tag ?? '', 40, 0) ?? '',
    price: priceNum,
    businessPrice: bizPrice,
    totalSeats: int(src.totalSeats ?? 72, 12, 600) ?? 72,
    flightStatus: fStatus,
    cutoffHours: int(src.cutoffHours ?? 2, 0, 48) ?? 2,
    hasPromo: bool(src.hasPromo),
    isActive: fStatus === 'cancelled' ? false : bool(src.isActive),
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
  const fCode = r.value.flightCode || `${r.value.logo || 'VN'}-${id.slice(-3).toUpperCase()}`
  db.prepare(`INSERT INTO flights (id, flight_code, airline, logo, origin, dest, depart, arrive, duration, price, business_price, total_seats, flight_status, cutoff_hours, tag, has_promo, is_active)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, fCode, r.value.airline, r.value.logo, r.value.from, r.value.to, r.value.depart, r.value.arrive,
      r.value.duration, r.value.price, r.value.businessPrice, r.value.totalSeats, r.value.flightStatus, r.value.cutoffHours,
      r.value.tag, r.value.hasPromo ? 1 : 0, r.value.isActive ? 1 : 0)
  try { seedFlightSeats() } catch { }
  audit(req, 'admin.flight.create', 'flight', id, `${r.value.airline} (${fCode}) ${r.value.from}->${r.value.to}`)
  broadcastCatalogUpdated('flight', 'created', { id })
  res.status(201).json({ ok: true, data: flightOut(db.prepare('SELECT * FROM flights WHERE id = ?').get(id)) })
})

adminRouter.patch('/flights/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM flights WHERE id = ?').get(req.params.id)
  if (!cur) return bad(res, 'Không tìm thấy chuyến bay.', 404)
  const r = flightPayload(req.body || {}, cur)
  if (r.error) return bad(res, r.error)
  db.prepare(`UPDATE flights SET flight_code=?, airline=?, logo=?, origin=?, dest=?, depart=?, arrive=?, duration=?, price=?,
              business_price=?, total_seats=?, flight_status=?, cutoff_hours=?, tag=?, has_promo=?, is_active=?,
              updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`)
    .run(r.value.flightCode || cur.flight_code, r.value.airline, r.value.logo, r.value.from, r.value.to, r.value.depart, r.value.arrive,
      r.value.duration, r.value.price, r.value.businessPrice, r.value.totalSeats, r.value.flightStatus, r.value.cutoffHours,
      r.value.tag, r.value.hasPromo ? 1 : 0, r.value.isActive ? 1 : 0, cur.id)
  audit(req, 'admin.flight.update', 'flight', cur.id, `${r.value.airline} ${r.value.from}->${r.value.to} status=${r.value.flightStatus}`)
  broadcastCatalogUpdated('flight', 'updated', { id: cur.id })
  ok(res, flightOut(db.prepare('SELECT * FROM flights WHERE id = ?').get(cur.id)))
})

adminRouter.delete('/flights/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM flights WHERE id = ?').get(req.params.id)
  if (!cur) return bad(res, 'Không tìm thấy chuyến bay.', 404)
  const comboRefs = db.prepare('SELECT COUNT(*) AS c FROM combos WHERE flight_id = ?').get(cur.id).c
  const bookingRefs = db.prepare("SELECT COUNT(*) AS c FROM bookings WHERE item_id = ? AND service_type = 'flight'").get(cur.id).c
  db.prepare("UPDATE flights SET is_active = 0, flight_status = 'cancelled', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(cur.id)
  const msg = `Đã chuyển chuyến bay sang Ngừng bán (Cancelled) để bảo toàn ${bookingRefs} đơn đặt và ${comboRefs} combo liên kết.`
  audit(req, 'admin.flight.delete', 'flight', cur.id, `${cur.airline} ${cur.origin}->${cur.dest} (${msg})`)
  broadcastCatalogUpdated('flight', 'deleted', { id: cur.id })
  ok(res, { id: cur.id, isActive: false, message: msg })
})

// Quản lý sơ đồ ghế (flight_seats) cho từng chuyến bay
adminRouter.get('/flights/:id/seats', (req, res) => {
  const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(req.params.id)
  if (!flight) return bad(res, 'Không tìm thấy chuyến bay.', 404)
  let seats = listFlightSeats(flight.id)
  if (!seats.length) {
    try { seedFlightSeats() } catch { }
    seats = listFlightSeats(flight.id)
  }
  ok(res, { flight: flightOut(flight), seats })
})

adminRouter.patch('/flights/:id/seats/:seatCode', (req, res) => {
  const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(req.params.id)
  if (!flight) return bad(res, 'Không tìm thấy chuyến bay.', 404)
  const seatCode = String(req.params.seatCode || '').toUpperCase().trim()
  const seat = db.prepare('SELECT * FROM flight_seats WHERE flight_id = ? AND seat_code = ?').get(flight.id, seatCode)
  if (!seat) return bad(res, 'Không tìm thấy mã ghế trên chuyến bay này.', 404)

  const nextStatus = req.body?.status === 'available' ? 'available' : req.body?.status === 'booked' ? 'booked' : (seat.status === 'available' ? 'booked' : 'available')
  db.prepare(`UPDATE flight_seats SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE flight_id = ? AND seat_code = ?`)
    .run(nextStatus, flight.id, seatCode)
  audit(req, 'admin.flight.seat_toggle', 'flight_seat', `${flight.id}:${seatCode}`, `${seat.status} -> ${nextStatus}`)
  ok(res, { flightId: flight.id, seatCode, status: nextStatus })
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
  const roomId = txt(b.roomId ?? cur?.room_id ?? '', 64, 0) || null
  const flightId = txt(b.flightId ?? cur?.flight_id, 64)
  const name = txt(b.name ?? cur?.name, 140)
  const saving = int(b.saving ?? cur?.saving, 0, 20000000)
  const maxSlots = int(b.maxSlots ?? cur?.max_slots ?? 20, 1, 10000) ?? 20
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
      name, hotelId, roomId, flightId, saving, maxSlots, description, image, validFrom, validTo,
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
  db.prepare(`INSERT INTO combos (id, name, hotel_id, room_id, flight_id, saving, max_slots, price_override, description, image, valid_from, valid_to, is_active)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, r.value.name, r.value.hotelId, r.value.roomId, r.value.flightId, r.value.saving, r.value.maxSlots, r.value.priceOverride,
      r.value.description, r.value.image, r.value.validFrom, r.value.validTo, r.value.isActive ? 1 : 0)
  audit(req, 'admin.combo.create', 'combo', id, r.value.name)
  broadcastCatalogUpdated('combo', 'created', { id })
  res.status(201).json({ ok: true, data: comboRowView(db.prepare('SELECT * FROM combos WHERE id = ?').get(id)) })
})

adminRouter.patch('/combos/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM combos WHERE id = ?').get(req.params.id)
  if (!cur) return bad(res, 'Không tìm thấy combo.', 404)
  const r = comboPayload(req.body || {}, cur)
  if (r.error) return bad(res, r.error)
  db.prepare(`UPDATE combos SET name=?, hotel_id=?, room_id=?, flight_id=?, saving=?, max_slots=?, price_override=?, description=?, image=?,
              valid_from=?, valid_to=?, is_active=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`)
    .run(r.value.name, r.value.hotelId, r.value.roomId, r.value.flightId, r.value.saving, r.value.maxSlots, r.value.priceOverride,
      r.value.description, r.value.image, r.value.validFrom, r.value.validTo, r.value.isActive ? 1 : 0, cur.id)
  audit(req, 'admin.combo.update', 'combo', cur.id, r.value.name)
  broadcastCatalogUpdated('combo', 'updated', { id: cur.id })
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
const SERVICES = ['all', 'flight', 'hotel', 'combo']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

adminRouter.get('/promotions', (req, res) => ok(res, listPromotions(true)))

function promoPayload(b, cur) {
  const code = txt(b.code ?? cur?.code, 24, 3)?.toUpperCase()
  const title = txt(b.title ?? cur?.title ?? code ?? '', 120, 0) || code
  const description = txt(b.description ?? cur?.description ?? '', 200, 0) ?? ''
  const discountType = (b.discountType ?? cur?.discount_type) === 'fixed' ? 'fixed' : 'percent'
  const rate = Number(b.rate ?? cur?.rate ?? 0)
  const maxDiscountRaw = b.maxDiscount === undefined ? (cur?.max_discount ?? null) : b.maxDiscount
  const maxDiscount = maxDiscountRaw == null || maxDiscountRaw === '' ? null : int(maxDiscountRaw, 0, 100000000)
  const perUserLimit = int(b.perUserLimit ?? cur?.per_user_limit ?? 1, 1, 1000) ?? 1
  const color = txt(b.color ?? cur?.color, 10) || 'blue'
  let appliesTo = (Array.isArray(b.appliesTo) ? b.appliesTo : String(b.applies_to ?? cur?.applies_to ?? '').split(','))
    .map((s) => String(s).trim()).filter(Boolean)
  if (appliesTo.includes('all')) appliesTo = ['flight', 'hotel', 'combo']
  const activeFrom = b.activeFrom === undefined ? (cur?.active_from ?? null) : (b.activeFrom || null)
  const activeTo = b.activeTo === undefined ? (cur?.active_to ?? null) : (b.activeTo || null)
  const usageLimit = b.usageLimit === undefined ? (cur?.usage_limit ?? null) : b.usageLimit
  // min_order: mức đơn tối thiểu để voucher có hiệu lực (0 = không giới hạn).
  const minOrder = b.minOrder === undefined ? (cur?.min_order ?? 0) : b.minOrder
  const isActive = b.isActive === undefined ? !!cur?.is_active : bool(b.isActive)

  if (!code || !/^[A-Z0-9]{3,24}$/.test(code)) return { error: 'Mã khuyến mãi phải 3–24 ký tự (A–Z, 0–9).' }
  if (!Number.isFinite(rate) || rate < 0 || (discountType === 'percent' && rate > 1))
    return { error: 'Tỷ lệ giảm phải trong khoảng 0–1 (vd: 0.12 = 12%).' }
  if (!appliesTo.length || !appliesTo.every((s) => SERVICES.includes(s)))
    return { error: `Áp dụng phải là tập con của [flight, hotel, combo].` }
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
      code, title, description, discountType, rate, maxDiscount, perUserLimit, color,
      appliesTo: appliesTo.join(','), activeFrom, activeTo,
      usageLimit: usageLimit == null || usageLimit === '' ? null : Number(usageLimit),
      minOrder: Number(minOrder), isActive,
    },
  }
}

adminRouter.post('/promotions', (req, res) => {
  const r = promoPayload(req.body || {})
  if (r.error) return bad(res, r.error, r.conflict ? 409 : 400)
  const id = newId('promo')
  db.prepare(`INSERT INTO promotions (id, code, title, description, discount_type, max_discount, per_user_limit, applies_to, rate, color, active_from, active_to, usage_limit, min_order, is_active)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, r.value.code, r.value.title, r.value.description, r.value.discountType, r.value.maxDiscount, r.value.perUserLimit,
      r.value.appliesTo, r.value.rate, r.value.color,
      r.value.activeFrom, r.value.activeTo, r.value.usageLimit, r.value.minOrder, r.value.isActive ? 1 : 0)
  audit(req, 'admin.promotion.create', 'promotion', id, `${r.value.code} (${r.value.discountType}) rate=${r.value.rate} minOrder=${r.value.minOrder}`)
  broadcastCatalogUpdated('promotion', 'created', { id })
  res.status(201).json({ ok: true, data: promoOut(db.prepare('SELECT * FROM promotions WHERE id = ?').get(id)) })
})

adminRouter.patch('/promotions/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM promotions WHERE id = ?').get(req.params.id)
  if (!cur) return bad(res, 'Không tìm thấy khuyến mãi.', 404)
  const r = promoPayload(req.body || {}, cur)
  if (r.error) return bad(res, r.error, r.conflict ? 409 : 400)
  db.prepare(`UPDATE promotions SET code=?, title=?, description=?, discount_type=?, max_discount=?, per_user_limit=?, applies_to=?, rate=?, color=?, active_from=?, active_to=?,
              usage_limit=?, min_order=?, is_active=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`)
    .run(r.value.code, r.value.title, r.value.description, r.value.discountType, r.value.maxDiscount, r.value.perUserLimit,
      r.value.appliesTo, r.value.rate, r.value.color,
      r.value.activeFrom, r.value.activeTo, r.value.usageLimit, r.value.minOrder, r.value.isActive ? 1 : 0, cur.id)
  audit(req, 'admin.promotion.update', 'promotion', cur.id, `${r.value.code} rate=${r.value.rate} minOrder=${r.value.minOrder}`)
  broadcastCatalogUpdated('promotion', 'updated', { id: cur.id })
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
    const rangeParam = txt(req.query.range, 20, 0)
    const rangeBounds = rangeParam ? getDateRangeBounds(rangeParam) : null
    const fromDate = txt(req.query.from_date, 20, 0) || rangeBounds?.fromDate || null
    const toDate = txt(req.query.to_date, 20, 0) || rangeBounds?.toDate || null
    const serviceType = txt(req.query.service_type, 30, 0)

    const where = ['b.legacy = 0']
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

    const validPaidRows = rows.filter(
      (r) => r.payment_status === 'paid' && ['Đã xác nhận', 'Đã thanh toán', 'checked_in', 'Hoàn tất'].includes(r.status)
    )
    const gmv = validPaidRows.reduce((acc, r) => acc + Number(r.total || 0) + Number(r.discount || 0), 0)
    const totalDiscount = validPaidRows.reduce((acc, r) => acc + Number(r.discount || 0), 0)
    const totalRefund = rows.filter((r) => r.payment_status === 'refunded').reduce((acc, r) => acc + Number(r.total || 0), 0)
    const netRevenue = Math.max(gmv - totalDiscount - totalRefund, 0)
    const confirmedCount = validPaidRows.length

    const serviceStats = {}
    for (const r of validPaidRows) {
      const type = r.service_type || 'other'
      if (!serviceStats[type]) serviceStats[type] = { count: 0, revenue: 0 }
      serviceStats[type].count += 1
      serviceStats[type].revenue += Number(r.total || 0)
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
    titleCell.value = 'BÁO CÁO TỔNG QUAN DOANH THU & ĐỐI SOÁT GIAO DỊCH'
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
    sheetOverview.getCell('A8').value = 'CHỈ SỐ TÀI CHÍNH THỰC (PRODUCTION)'
    sheetOverview.getCell('B8').value = 'GIÁ TRỊ'
    sheetOverview.getRow(8).height = 25
    sheetOverview.getCell('A8').font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } }
    sheetOverview.getCell('B8').font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } }
    sheetOverview.getCell('A8').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
    sheetOverview.getCell('B8').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }

    const kpis = [
      ['Tổng số đơn trong kỳ', rows.length, 'number'],
      ['Số đơn hợp lệ đã thanh toán & xác nhận', confirmedCount, 'number'],
      ['Tổng giá trị đơn gốc (GMV)', gmv, 'currency'],
      ['Tổng chiết khấu / Voucher (Total Discount)', totalDiscount, 'currency'],
      ['Tổng tiền hoàn trả khách hủy (Total Refund)', totalRefund, 'currency'],
      ['Doanh thu thực nhận (Net Revenue)', netRevenue, 'currency'],
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
    sheetOverview.getCell('A16').value = 'PHÂN BỔ DOANH THU THỰC THEO LOẠI DỊCH VỤ'
    sheetOverview.getCell('A16').font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FF0F766E' } }

    const sHeaderRow = sheetOverview.getRow(17)
    sHeaderRow.values = ['Mã dịch vụ', 'Tên dịch vụ', 'Số lượng đơn', 'Doanh thu thực (VND)', 'Tỷ trọng']
    sHeaderRow.height = 24
    sHeaderRow.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } }
    sHeaderRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })

    let sRowNum = 18
    const totalServiceRev = Math.max(Object.values(serviceStats).reduce((a, b) => a + b.revenue, 0), 1)
    Object.entries(serviceStats).forEach(([type, stat]) => {
      const pct = stat.revenue / totalServiceRev
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
        paymentStatus: b.payment_status === 'paid' ? 'Đã thanh toán' : b.payment_status === 'refunded' ? 'Đã hoàn tiền' : b.payment_status === 'refund_pending' ? 'Chờ hoàn tiền' : 'Chờ thanh toán',
        paymentMethod: b.payment_method || 'Chuyển khoản / Ví',
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
  const rows = db.prepare(`SELECT u.id, u.email, u.name, u.phone, u.role, u.balance, u.loyalty_points, u.total_spent, u.member_tier, u.is_active, u.created_at,
                           (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id) AS booking_count
                           FROM users u ORDER BY u.created_at DESC, u.id DESC`).all()
  ok(res, rows.map((r) => ({
    id: r.id, email: r.email, name: r.name, phone: r.phone || '', role: r.role,
    balance: Number(r.balance) || 0,
    loyaltyPoints: Number(r.loyalty_points) || 0,
    totalSpent: Number(r.total_spent) || 0,
    memberTier: r.member_tier || 'Thành viên',
    isActive: !!r.is_active,
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






