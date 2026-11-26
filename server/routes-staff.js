// server/routes-staff.js — API vận hành Lễ tân (Quét QR Check-in & tra cứu).
import express from 'express'
import crypto from 'node:crypto'
import { db, writeAuditLog } from './db.js'
import { requireRole } from './auth.js'
import { broadcast, pushNotification } from './realtime.js'

export const staffRouter = express.Router()

// Chặn toàn bộ route lễ tân: chỉ cho phép role 'staff' hoặc 'admin'
staffRouter.use(requireRole('staff', 'admin'))

// POST /api/staff/checkin/verify — Quét & xác thực QR Check-in
staffRouter.post('/checkin/verify', (req, res) => {
  let data = req.body
  if (data?.qrData && typeof data.qrData === 'string') {
    try {
      data = JSON.parse(data.qrData)
    } catch {
      return res.status(400).json({ ok: false, error: 'Dữ liệu mã QR không đúng định dạng JSON.' })
    }
  } else if (data?.qrData && typeof data.qrData === 'object') {
    data = data.qrData
  }

  const passedSig = data?.sig || data?.signature
  const bookingCode = String(data?.code || data?.bookingCode || '').trim()
  const bookingId = Number(data?.bookingId || data?.id) || null

  if (!bookingCode && !bookingId) {
    return res.status(400).json({ ok: false, error: 'Thiếu mã đặt chỗ (booking code) hoặc ID đơn hàng.' })
  }

  // Nếu có chữ ký HMAC kèm theo, kiểm tra tính toàn vẹn chống giả mạo
  const secret = process.env.SESSION_SECRET || 'mayan-secret-key-2025'
  if (passedSig) {
    const { sig: _sig, signature: _signature, ...rest } = data
    const expectedFull = crypto.createHmac('sha256', secret).update(JSON.stringify(rest)).digest('hex')
    const isValid = (passedSig === expectedFull) || (passedSig === expectedFull.slice(0, 32))
    if (!isValid) {
      writeAuditLog({
        actorId: req.session.user.id,
        actorEmail: req.session.user.email,
        action: 'staff.checkin.tampered_qr_rejected',
        entityType: 'booking',
        entityId: String(bookingCode || bookingId),
        detail: 'Phát hiện mã QR bị can thiệp chữ ký HMAC',
        ip: req.ip,
      })
      return res.status(400).json({ ok: false, error: 'Chữ ký mã QR không hợp lệ hoặc đã bị chỉnh sửa.' })
    }
  }

  // Tra cứu đơn hàng từ SQLite
  let booking = null
  if (bookingCode) {
    booking = db.prepare('SELECT * FROM bookings WHERE code = ?').get(bookingCode)
  }
  if (!booking && bookingId) {
    booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId)
  }

  if (!booking) {
    return res.status(404).json({ ok: false, error: 'Không tìm thấy đơn đặt chỗ trên hệ thống.' })
  }

  // SQLite transaction BEGIN IMMEDIATE: bảo đảm nguyên tử & chống double check-in
  try {
    db.exec('BEGIN IMMEDIATE')
    const current = db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking.id)
    if (!current) {
      db.exec('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Không tìm thấy đơn đặt chỗ.' })
    }

    if (current.status === 'Đã hủy') {
      db.exec('ROLLBACK')
      return res.status(409).json({ ok: false, error: 'Đơn đặt chỗ đã bị hủy, không thể check-in.' })
    }

    if (current.status === 'checked_in') {
      db.exec('ROLLBACK')
      return res.status(409).json({
        ok: false,
        error: `Đơn này đã được check-in lúc ${current.checked_in_at || ''} bởi ${current.checked_in_by || 'nhân viên'}.`,
        alreadyCheckedIn: true,
        checkedInAt: current.checked_in_at,
        checkedInBy: current.checked_in_by,
      })
    }

    const isPaid = current.payment_status === 'paid' || current.payment_status === 'simulated' || current.status === 'Đã thanh toán' || current.status === 'Đã xác nhận'
    if (!isPaid) {
      db.exec('ROLLBACK')
      return res.status(409).json({ ok: false, error: 'Đơn đặt chỗ chưa được thanh toán hoặc xác nhận.' })
    }

    const nowIso = new Date().toISOString()
    const staffEmail = req.session.user.email || req.session.user.name || 'Lễ tân'
    db.prepare(`
      UPDATE bookings
      SET status = 'checked_in', checked_in_at = ?, checked_in_by = ?, updated_at = ?
      WHERE id = ?
    `).run(nowIso, staffEmail, nowIso, current.id)
    db.exec('COMMIT')

    writeAuditLog({
      actorId: req.session.user.id,
      actorEmail: req.session.user.email,
      action: 'staff.checkin.success',
      entityType: 'booking',
      entityId: String(current.code),
      detail: `Check-in thành công: khách ${current.traveler_name}, dịch vụ ${current.service_type}`,
      ip: req.ip,
    })

    broadcast('booking:checked_in', {
      bookingId: current.id,
      code: current.code,
      passenger: current.traveler_name,
      serviceType: current.service_type,
      checkedInAt: nowIso,
      checkedInBy: staffEmail,
    })

    pushNotification(current.user_id, {
      title: 'Check-in thành công! 🎉',
      message: `Thủ tục nhận chỗ cho đơn ${current.code} (${current.title}) đã hoàn tất. Chúc quý khách kỳ nghỉ tuyệt vời!`,
      type: 'booking',
      link: '#/bookings',
    })

    return res.json({
      ok: true,
      message: 'Check-in thành công!',
      booking: {
        id: current.id,
        code: current.code,
        title: current.title,
        travelerName: current.traveler_name,
        travelerPhone: current.traveler_phone,
        travelerEmail: current.traveler_email,
        serviceType: current.service_type,
        total: current.total,
        status: 'checked_in',
        checkedInAt: nowIso,
        checkedInBy: staffEmail,
        departDate: current.depart_date,
        returnDate: current.return_date,
        roomName: current.room_name,
        seatCode: current.seat_code,
      },
    })
  } catch (err) {
    try { db.exec('ROLLBACK') } catch { /* bỏ qua */ }
    console.error('[staff.checkin] Lỗi xác thực check-in:', err)
    return res.status(500).json({ ok: false, error: 'Lỗi máy chủ khi xử lý check-in.' })
  }
})

// GET /api/staff/checkin/recent — Danh sách check-in trong ngày hôm nay
staffRouter.get('/checkin/recent', (req, res) => {
  const today = new Date().toISOString().slice(0, 10)
  const rows = db.prepare(`
    SELECT id, code, traveler_name, traveler_phone, service_type, title, total, status,
           checked_in_at, checked_in_by, room_name, seat_code
    FROM bookings
    WHERE status = 'checked_in' AND substr(checked_in_at, 1, 10) = ?
    ORDER BY checked_in_at DESC LIMIT 50
  `).all(today)
  res.json({
    ok: true,
    checkins: rows.map((r) => ({
      id: r.id,
      code: r.code,
      travelerName: r.traveler_name,
      travelerPhone: r.traveler_phone,
      serviceType: r.service_type,
      title: r.title,
      total: r.total,
      status: r.status,
      checkedInAt: r.checked_in_at,
      checkedInBy: r.checked_in_by,
      roomName: r.room_name,
      seatCode: r.seat_code,
    })),
  })
})

// GET /api/staff/bookings — Tra cứu nhanh đơn hàng phục vụ lễ tân
staffRouter.get('/bookings', (req, res) => {
  const q = String(req.query.q || '').trim()
  let rows = []
  if (q) {
    rows = db.prepare(`
      SELECT id, code, traveler_name, traveler_phone, traveler_email, service_type, title, total,
             status, payment_status, checked_in_at, checked_in_by, depart_date, return_date, room_name, seat_code
      FROM bookings
      WHERE code LIKE ? OR traveler_name LIKE ? OR traveler_phone LIKE ?
      ORDER BY id DESC LIMIT 30
    `).all(`%${q}%`, `%${q}%`, `%${q}%`)
  } else {
    rows = db.prepare(`
      SELECT id, code, traveler_name, traveler_phone, traveler_email, service_type, title, total,
             status, payment_status, checked_in_at, checked_in_by, depart_date, return_date, room_name, seat_code
      FROM bookings
      ORDER BY id DESC LIMIT 30
    `).all()
  }
  res.json({
    ok: true,
    bookings: rows.map((r) => ({
      id: r.id,
      code: r.code,
      travelerName: r.traveler_name,
      travelerPhone: r.traveler_phone,
      travelerEmail: r.traveler_email,
      serviceType: r.service_type,
      title: r.title,
      total: r.total,
      status: r.status,
      paymentStatus: r.payment_status,
      checkedInAt: r.checked_in_at,
      checkedInBy: r.checked_in_by,
      departDate: r.depart_date,
      returnDate: r.return_date,
      roomName: r.room_name,
      seatCode: r.seat_code,
    })),
  })
})

