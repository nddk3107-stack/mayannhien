// server/routes-public.js — API công khai: đăng nhập/phiên, catalog, đơn đặt chỗ của người dùng.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import { Router } from 'express'
import QRCode from 'qrcode'
import PDFDocument from 'pdfkit'
import {
  db, createUser, findUserByEmail, findUserById, hashPassword, verifyPassword, createSession, deleteSession,
  publicUser, listCombos, listFlights, listHotels, listPromotions, listRooms, SESSION_TTL_MS,
  listFlightSeats, lockFlightSeat, releaseFlightSeat, listExtraServices, getExtraService,
  listHotelReviews, getHotelReviewStats, createHotelReview,
  createPasswordReset, verifyPasswordReset, consumePasswordReset,
  listUserNotifications, countUnreadNotifications, markNotificationAsRead, markAllNotificationsAsRead, writeAuditLog,
  getUserWallet, payWithWallet, depositUserWallet,
  listSavedPassengers, countSavedPassengers, getSavedPassenger, createSavedPassenger, updateSavedPassenger, deleteSavedPassenger,
  calculateMemberTier, getTierProgress, addLoyaltyForBooking, revokeAllUserSessions, seedStaffUser,
} from './db.js'
import {
  EMAIL_RE, clearSessionCookie, requireAuth, setSessionCookie,
  clientKey, clearLoginFails, loginBlocked, recordLoginFail, rateLimitMiddleware,
  MIN_PASSWORD_LENGTH,
} from './auth.js'
import { adminRouter } from './routes-admin.js'
import { paymentRouter } from './routes-payment.js'
import { staffRouter } from './routes-staff.js'
import { aiRouter } from './routes-ai.js'
import { ALLOW_LEGACY_IMPORT, IS_PRODUCTION } from './config.js'
import { broadcastBookingCreated, broadcastBookingCancelled, pushNotification, realtimeBus, broadcastPaymentReceived } from './realtime.js'

export const publicRouter = Router()

/* ------------------------------------------------ Avatar Upload Setup (Task 2) */
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(process.cwd(), 'server', 'uploads', 'avatars')
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
    cb(null, dest)
  },
  filename: (req, file, cb) => {
    const userId = req.session?.user?.id || 'anon'
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
    cb(null, `avatar_${userId}_${Date.now()}${ext}`)
  },
})

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh định dạng JPEG, PNG hoặc WebP.'))
    }
  },
})


const SERVICE_NAMES = {
  flight: 'Vé máy bay',
  hotel: 'Khách sạn',
  combo: 'Combo du lịch',
  activity: 'Vui chơi & Trải nghiệm',
  car: 'Đưa đón sân bay',
  bus: 'Xe khách',
  train: 'Tàu hỏa',
  insurance: 'Bảo hiểm du lịch',
}

// Danh mục dịch vụ mở rộng (Vui chơi, Đưa đón sân bay, Xe khách, Tàu hỏa, Bảo hiểm)
// Server giữ giá gốc để tự tính tiền, không tin giá client gửi lên.
const EXTRA_SERVICE_ITEMS = {
  // Vui chơi & trải nghiệm
  'act-bana': { serviceType: 'activity', title: 'Vé Sun World Bà Nà Hills + Cáp treo', price: 900000 },
  'act-vinwonders': { serviceType: 'activity', title: 'Vé VinWonders Phú Quốc Trọn Gói', price: 950000 },
  'act-fansipan': { serviceType: 'activity', title: 'Cáp treo Sun World Fansipan Legend', price: 800000 },
  'act-hoian': { serviceType: 'activity', title: 'Show Ký Ức Hội An + Công viên Ấn Tượng', price: 600000 },
  'act-coral': { serviceType: 'activity', title: 'Tour Cano 4 Đảo & Lặn Ngắm San Hô Phú Quốc', price: 750000 },
  // Đưa đón sân bay
  'car-sedan4': { serviceType: 'car', title: 'Xe riêng Sedan 4 chỗ (Đưa đón sân bay)', price: 290000 },
  'car-suv7': { serviceType: 'car', title: 'Xe riêng SUV 7 chỗ (Đưa đón sân bay)', price: 390000 },
  'car-limo9': { serviceType: 'car', title: 'Limousine VIP 9 chỗ (Đưa đón sân bay)', price: 690000 },
  'car-van16': { serviceType: 'car', title: 'Xe du lịch 16 chỗ (Đưa đón sân bay)', price: 850000 },
  // Xe khách
  'bus-futa-dl': { serviceType: 'bus', title: 'Phương Trang FUTA · TP.HCM - Đà Lạt (Giường nằm)', price: 290000 },
  'bus-limo-sp': { serviceType: 'bus', title: 'Inter Bus Lines · Hà Nội - Sa Pa (Cabin VIP)', price: 420000 },
  'bus-tb-nt': { serviceType: 'bus', title: 'Thành Bưởi · TP.HCM - Nha Trang (Limousine)', price: 350000 },
  'bus-hv-hue': { serviceType: 'bus', title: 'Hải Vân Express · Đà Nẵng - Huế (Ghế VIP)', price: 180000 },
  // Tàu hỏa
  'train-se2': { serviceType: 'train', title: 'Tàu SE2 · Ga Sài Gòn - Ga Đà Nẵng (Ngồi mềm ĐH)', price: 720000 },
  'train-se4': { serviceType: 'train', title: 'Tàu SE4 · Ga Sài Gòn - Ga Đà Nẵng (Giường nằm VIP K4)', price: 1180000 },
  'train-sp3': { serviceType: 'train', title: 'Tàu SP3 · Ga Hà Nội - Ga Lào Cai (Giường nằm K4)', price: 560000 },
  'train-se8': { serviceType: 'train', title: 'Tàu SE8 · Ga Hà Nội - Ga Huế (Giường nằm K6)', price: 690000 },
  // Bảo hiểm du lịch
  'ins-basic': { serviceType: 'insurance', title: 'Bảo hiểm Du lịch Gói Cơ Bản (Mây An Nhiên Care)', price: 89000 },
  'ins-standard': { serviceType: 'insurance', title: 'Bảo hiểm Du lịch Gói Tiêu Chuẩn (Phổ biến)', price: 169000 },
  'ins-vip': { serviceType: 'insurance', title: 'Bảo hiểm Du lịch Gói Toàn Diện VIP', price: 299000 },
}
const txt = (v, max, min = 1) => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s.length >= min && s.length <= max ? s : null
}
const bad = (res, error, status = 400) => res.status(status).json({ error })

const formatVND = (value) => `${new Intl.NumberFormat('vi-VN').format(Math.round(value))}đ`

/* ------------------------------------------------------------------ P1-02 tồn phòng */
// Trạng thái booking VẪN GIỮ PHÒNG (không tự giải phóng vì hệ thống CHƯA có
// quy tắc hết hạn nào được triển khai). Chỉ 'Đã hủy' là không giữ phòng.
const ROOM_HELD_SQL = "status <> 'Đã hủy'"

// Số phòng tồn kho: mỗi dòng trong bảng `rooms` là MỘT phòng vật lý (mã phòng
// duy nhất). Một booking giữ ĐÚNG 1 phòng vật lý (room_id) trong khoảng
// [depart_date, return_date). Tồn phòng = không có booking KHÁC nào đang giữ
// cùng phòng mà khoảng ngày chồng lấn:
//
//   checkIn < existingCheckOut  &&  checkOut > existingCheckIn
//
// Hai booking chu trình liền (checkOut cũ == checkIn mới) KHÔNG chồng lấn và
// được phép (theo chính sách khách sạn phổ biến: trả phòng sáng, nhận phòng
// buổi chiều cùng ngày).
//
// Kiểm tra phòng `roomId` còn trống trong khoảng [checkIn, checkOut) bên trong
// transaction ĐANG KHÓA GHI (BEGIN IMMEDIATE). Trả true nếu còn trống.
const roomIsAvailable = (roomId, checkIn, checkOut) =>
  !db.prepare(`SELECT 1 FROM bookings
               WHERE room_id = ? AND ${ROOM_HELD_SQL}
                 AND depart_date IS NOT NULL AND return_date IS NOT NULL
                 AND depart_date < ? AND return_date > ?
               LIMIT 1`).get(roomId, checkOut, checkIn)

// Kiểm tra voucher TOÀN BỘ phía backend: tồn tại / đang hoạt động / còn hạn /
// còn lượt sử dụng / đúng loại dịch vụ / đạt giá trị đơn tối thiểu.
// Dùng chung cho ô nhập voucher (validate) và lúc tạo đơn (tính tiền) — một luật duy nhất.
function evaluatePromo(promoCode, serviceType, amount) {
  if (!promoCode || promoCode === 'Không dùng') return { ok: true, rate: 0, promo: null }
  const promo = db.prepare('SELECT * FROM promotions WHERE code = ? COLLATE NOCASE').get(promoCode)
  if (!promo || Number(promo.is_active) !== 1) {
    return { ok: false, error: 'Mã voucher không tồn tại hoặc đã ngừng hoạt động.' }
  }
  const today = new Date().toISOString().slice(0, 10)
  if ((promo.active_from && today < promo.active_from) || (promo.active_to && today > promo.active_to)) {
    return { ok: false, error: 'Mã voucher đã hết hạn hoặc chưa đến ngày áp dụng.' }
  }
  if (promo.usage_limit != null && Number(promo.used_count) >= Number(promo.usage_limit)) {
    return { ok: false, error: 'Mã voucher đã hết lượt sử dụng.' }
  }
  if (!String(promo.applies_to || '').split(',').includes(serviceType)) {
    return { ok: false, error: `Mã voucher không áp dụng cho ${(SERVICE_NAMES[serviceType] || serviceType).toLowerCase()}.` }
  }
  const minOrder = Number(promo.min_order) || 0
  if (amount < minOrder) {
    return { ok: false, error: `Đơn tối thiểu ${formatVND(minOrder)} để dùng mã này.` }
  }
  return { ok: true, rate: Number(promo.rate) || 0, promo }
}

/* ------------------------------------------------------------- auth API */
// Rate-limit đăng nhập theo (email + IP) — đây là lớp chống brute-force thật sự,
// vì kẻ tấn công sẽ đổi email liên tục nhưng vẫn giữ cùng IP.
//  + Giới hạn theo IP thuần (login-ip) chỉ ở mức rất cao để chặn flood,
//    KHÔNG chặn người dùng hợp lệ trên IP dùng chung (văn phòng, trường học, NAT).
//  + Ở production, nginx (deploy/nginx-ratelimit.conf) áp dụng rate-limit ở tầng
//    proxy với IP thật — đó là nơi nên đặt giới hạn chặt.
const loginIpLimit = rateLimitMiddleware('login-ip', { windowMs: 15 * 60 * 1000, max: 200 })
publicRouter.post('/auth/login', loginIpLimit, async (req, res) => {
  const email = txt(req.body?.email, 80, 5)?.toLowerCase()
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!email || !EMAIL_RE.test(email)) return bad(res, 'Email không hợp lệ.')
  if (password.length < 6) return bad(res, 'Mật khẩu phải có ít nhất 6 ký tự.')
  if (password.length > 64) return bad(res, 'Mật khẩu tối đa 64 ký tự.')

  const key = clientKey(req, email)

  let user = findUserByEmail(email)
  if (!user && ['admin@mayannhien.vn', 'staff@mayannhien.vn', 'user@mayannhien.vn'].includes(email)) {
    seedStaffUser()
    user = findUserByEmail(email)
  }
  if (!user) {
    recordLoginFail(key)
    if (loginBlocked(key)) return bad(res, 'Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút.', 429)
    return bad(res, 'Email hoặc mật khẩu không đúng.', 401)
  }
  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    recordLoginFail(key)
    if (loginBlocked(key)) return bad(res, 'Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút.', 429)
    return bad(res, 'Email hoặc mật khẩu không đúng.', 401)
  }
    recordLoginFail(key)
    return bad(res, 'Email hoặc mật khẩu không đúng.', 401)
  }
  if (Number(user.is_active) !== 1) return bad(res, 'Tài khoản đã bị vô hiệu hóa.', 403)

  clearLoginFails(key)
  const { token, expiresAt } = createSession(user.id)
  setSessionCookie(res, token, SESSION_TTL_MS)
  writeAuditLog({ adminId: user.id, adminEmail: user.email, action: 'user.login', targetType: 'user', targetId: String(user.id), detail: 'Đăng nhập thành công', ip: req.ip || '' });
  res.json({ ok: true, user: publicUser(user), expiresAt })
})

// Đăng ký công khai — role luôn là 'user'; gửi kèm role(admin) cũng bị bỏ qua.
// Rate-limit theo IP: chặn tạo hàng loạt tài khoản. Hạn mức cao vì nhiều
// người có thể dùng chung IP (NAT) — lớp chặn chặt nằm ở nginx (xem deploy/).
// Biểu thức kiểm tra số điện thoại Việt Nam (0xxxxxxxxx hoặc +84xxxxxxxxx).
const PHONE_RE = /^(0|\+84)\d{8,10}$/

publicRouter.post('/auth/register', rateLimitMiddleware('register', { windowMs: 60 * 60 * 1000, max: 60 }), async (req, res) => {
  const email = txt(req.body?.email, 80, 5)?.toLowerCase()
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  const name = txt(req.body?.name, 60, 2) || email?.split('@')[0]
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : ''
  if (!email || !EMAIL_RE.test(email)) return bad(res, 'Email không hợp lệ.')
  // Chính sách mật khẩu: production yêu cầu tối thiểu 8 ký tự (demo/test dùng 6).
  const minLen = IS_PRODUCTION ? MIN_PASSWORD_LENGTH : 6
  if (password.length < minLen || password.length > 64)
    return bad(res, `Mật khẩu phải ${minLen}–64 ký tự.`)
  if (phone && !PHONE_RE.test(phone)) return bad(res, 'Số điện thoại không hợp lệ.')
  if (findUserByEmail(email)) return bad(res, 'Email đã được đăng ký.', 409)
  if (phone && db.prepare('SELECT 1 FROM users WHERE phone = ?').get(phone))
    return bad(res, 'Số điện thoại đã được đăng ký.', 409)

  const passwordHash = await hashPassword(password)
  const user = createUser({ email, name, passwordHash, role: 'user', phone })
  const { token, expiresAt } = createSession(user.id)
  setSessionCookie(res, token, SESSION_TTL_MS)
  res.status(201).json({ ok: true, user: publicUser(user), expiresAt })
})

publicRouter.post('/auth/logout', requireAuth, (req, res) => {
  deleteSession(req.session.token)
  clearSessionCookie(res)
  res.json({ ok: true })
})

// Đăng nhập nhanh qua Google / Facebook (mô phỏng OAuth cho đồ án, tạo phiên thật trong DB)
publicRouter.post('/auth/social', loginIpLimit, async (req, res) => {
  const provider = txt(req.body?.provider, 16, 2)?.toLowerCase()
  const email = txt(req.body?.email, 80, 5)?.toLowerCase()
  const name = txt(req.body?.name, 60, 2) || email?.split('@')[0]
  if (!['google', 'facebook'].includes(provider)) return bad(res, 'Nhà cung cấp đăng nhập không hợp lệ.')
  if (!email || !EMAIL_RE.test(email)) return bad(res, 'Email tài khoản liên kết không hợp lệ.')

  let user = findUserByEmail(email)
  if (!user) {
    const randomPw = crypto.randomBytes(16).toString('hex')
    const passwordHash = await hashPassword(randomPw)
    user = createUser({ email, name, passwordHash, role: 'user', phone: '' })
  }
  if (Number(user.is_active) !== 1) return bad(res, 'Tài khoản đã bị vô hiệu hóa.', 403)

  const { token, expiresAt } = createSession(user.id)
  setSessionCookie(res, token, SESSION_TTL_MS)
  res.json({ ok: true, user: publicUser(user), provider, expiresAt })
})

// Đăng nhập nhanh bằng Số điện thoại + OTP (mô phỏng xác thực OTP, tạo phiên thật trong DB)
publicRouter.post('/auth/phone', loginIpLimit, async (req, res) => {
  const rawPhone = typeof req.body?.phone === 'string' ? req.body.phone.replace(/\s+/g, '') : ''
  const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : ''
  const nameInput = txt(req.body?.name, 60, 2)
  if (!PHONE_RE.test(rawPhone)) return bad(res, 'Số điện thoại Việt Nam không hợp lệ.')
  if (!/^\d{6}$/.test(otp)) return bad(res, 'Mã OTP phải gồm 6 chữ số.')

  let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(rawPhone)
  if (!user) {
    const digits = rawPhone.replace(/\D/g, '')
    const fallbackEmail = `sdt_${digits}@mayan.vn`
    user = findUserByEmail(fallbackEmail)
    if (!user) {
      const randomPw = crypto.randomBytes(16).toString('hex')
      const passwordHash = await hashPassword(randomPw)
      user = createUser({
        email: fallbackEmail,
        name: nameInput || `Khách ${digits.slice(-4)}`,
        passwordHash,
        role: 'user',
        phone: rawPhone,
      })
    }
  }
  if (Number(user.is_active) !== 1) return bad(res, 'Tài khoản đã bị vô hiệu hóa.', 403)

  const { token, expiresAt } = createSession(user.id)
  setSessionCookie(res, token, SESSION_TTL_MS)
  writeAuditLog({ adminId: user.id, adminEmail: user.email, action: 'user.login', targetType: 'user', targetId: String(user.id), detail: 'Đăng nhập thành công', ip: req.ip || '' });
  res.json({ ok: true, user: publicUser(user), expiresAt })
})

/* ------------------------------------------- Profile & Password (Task 4) */
// GET /api/profile — Lấy thông tin cá nhân & thống kê đơn hàng
publicRouter.get('/profile', requireAuth, (req, res) => {
  const user = findUserById(req.session.user.id)
  if (!user) return bad(res, 'Không tìm thấy người dùng.', 404)
  const stats = db.prepare(`
    SELECT COUNT(*) as totalBookings,
           COALESCE(SUM(CASE WHEN status != 'Đã hủy' THEN total ELSE 0 END), 0) as totalSpent
    FROM bookings WHERE user_id = ?
  `).get(user.id)

  res.json({
    ok: true,
    user: publicUser(user),
    wallet: getUserWallet(user.id) || { userId: user.id, balance: 0, transactions: [] },
    loyalty: getTierProgress(user.total_spent),
    stats: {
      totalBookings: stats?.totalBookings || 0,
      totalSpent: stats?.totalSpent || 0,
    },
  })
})

// PUT /api/profile — Cập nhật họ tên, số điện thoại (Chống Mass Assignment & Validate SĐT VN 10 số)
publicRouter.put('/profile', requireAuth, (req, res) => {
  const name = txt(req.body?.name, 60, 2)
  if (!name) return bad(res, 'Họ và tên bắt buộc và phải từ 2 đến 60 ký tự.')
  const rawPhone = typeof req.body?.phone === 'string' ? req.body.phone.trim().replace(/\s+/g, '') : ''
  if (!rawPhone || !/^(0|\+84)[0-9]{9}$/.test(rawPhone)) {
    return bad(res, 'Số điện thoại Việt Nam bắt buộc và phải hợp lệ (10 chữ số).')
  }

  // ZERO MASS ASSIGNMENT: chỉ cho phép cập nhật name và phone, client KHÔNG ĐƯỢC phép sửa email, role, points, tier
  db.prepare(`UPDATE users SET name = ?, phone = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(name, rawPhone, req.session.user.id)

  const updated = findUserById(req.session.user.id)
  req.session.user.name = updated.name
  req.session.user.phone = updated.phone
  res.json({ ok: true, user: publicUser(updated), message: 'Cập nhật thông tin thành công.' })
})

/* ------------------------------------------- Avatar Management (Task 2) */
// POST /api/profile/avatar — Upload ảnh đại diện (Tự động xóa ảnh cũ)
publicRouter.post('/profile/avatar', requireAuth, (req, res) => {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Tải ảnh lên thất bại.' })
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng chọn file ảnh (JPEG, PNG, WebP) tối đa 3MB.' })
    }

    const userId = Number(req.session.user.id)
    const user = findUserById(userId)
    if (!user) return bad(res, 'Không tìm thấy người dùng.', 404)

    // Xóa file ảnh đại diện cũ nếu đã tồn tại
    if (user.avatar_url && user.avatar_url.startsWith('/uploads/avatars/')) {
      try {
        const oldFile = path.join(process.cwd(), 'server', user.avatar_url)
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile)
      } catch (unlinkErr) {
        console.warn('[avatar] Lỗi xóa file cũ:', unlinkErr.message)
      }
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`
    db.prepare(`UPDATE users SET avatar_url = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
      .run(avatarUrl, userId)

    req.session.user.avatarUrl = avatarUrl
    req.session.user.avatar_url = avatarUrl
    realtimeBus.publish('user:avatar:updated', { userId, avatarUrl }, 'all')
    realtimeBus.publish('user:avatar:updated', { userId, avatarUrl }, `user:${userId}`)
    writeAuditLog({
      actorId: userId,
      actorEmail: user.email,
      action: 'user.avatar_update',
      entityType: 'user',
      entityId: String(userId),
      detail: `Cập nhật ảnh đại diện: ${avatarUrl}`,
      ip: req.ip || '',
    })

    res.json({ ok: true, avatarUrl, message: 'Cập nhật ảnh đại diện thành công.' })
  })
})

// DELETE /api/profile/avatar — Xóa ảnh đại diện (Về mặc định, xóa file đĩa)
publicRouter.delete('/profile/avatar', requireAuth, (req, res) => {
  const userId = Number(req.session.user.id)
  const user = findUserById(userId)
  if (!user) return bad(res, 'Không tìm thấy người dùng.', 404)

  if (user.avatar_url && user.avatar_url.startsWith('/uploads/avatars/')) {
    try {
      const oldFile = path.join(process.cwd(), 'server', user.avatar_url)
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile)
    } catch (unlinkErr) {
      console.warn('[avatar] Lỗi xóa file đĩa:', unlinkErr.message)
    }
  }

  db.prepare(`UPDATE users SET avatar_url = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(userId)

  req.session.user.avatarUrl = ''
  req.session.user.avatar_url = ''
  realtimeBus.publish('user:avatar:updated', { userId, avatarUrl: '' }, 'all')
  realtimeBus.publish('user:avatar:updated', { userId, avatarUrl: '' }, `user:${userId}`)
  writeAuditLog({
    actorId: userId,
    actorEmail: user.email,
    action: 'user.avatar_delete',
    entityType: 'user',
    entityId: String(userId),
    detail: 'Xóa ảnh đại diện',
    ip: req.ip || '',
  })

  res.json({ ok: true, avatarUrl: null, message: 'Đã xóa ảnh đại diện.' })
})

/* ------------------------------------------- Saved Passengers (Task 3) */
// GET /api/profile/passengers — Danh sách hành khách đã lưu
publicRouter.get('/profile/passengers', requireAuth, (req, res) => {
  const userId = Number(req.session.user.id)
  const passengers = listSavedPassengers(userId)
  res.json({ ok: true, passengers })
})

// POST /api/profile/passengers — Thêm mới hành khách (Giới hạn tối đa 20)
publicRouter.post('/profile/passengers', requireAuth, (req, res) => {
  const userId = Number(req.session.user.id)
  try {
    const passenger = createSavedPassenger({
      userId,
      fullName: req.body?.fullName,
      dob: req.body?.dob,
      gender: req.body?.gender,
      nationality: req.body?.nationality,
      idNumber: req.body?.idNumber,
      phone: req.body?.phone,
      label: req.body?.label,
    })
    realtimeBus.publish('user:passengers:updated', { userId }, `user:${userId}`)
    res.status(201).json({ ok: true, passenger, message: 'Thêm hành khách đã lưu thành công.' })
  } catch (err) {
    return bad(res, err.message, 400)
  }
})

// PUT /api/profile/passengers/:id — Cập nhật thông tin hành khách (Chặn IDOR)
publicRouter.put('/profile/passengers/:id', requireAuth, (req, res) => {
  const userId = Number(req.session.user.id)
  const id = Number(req.params.id)
  try {
    const passenger = updateSavedPassenger({
      id,
      userId,
      fullName: req.body?.fullName,
      dob: req.body?.dob,
      gender: req.body?.gender,
      nationality: req.body?.nationality,
      idNumber: req.body?.idNumber,
      phone: req.body?.phone,
      label: req.body?.label,
    })
    realtimeBus.publish('user:passengers:updated', { userId }, `user:${userId}`)
    res.json({ ok: true, passenger, message: 'Cập nhật hành khách thành công.' })
  } catch (err) {
    return bad(res, err.message, 400)
  }
})

// DELETE /api/profile/passengers/:id — Xóa hành khách đã lưu (Chặn IDOR)
publicRouter.delete('/profile/passengers/:id', requireAuth, (req, res) => {
  const userId = Number(req.session.user.id)
  const id = Number(req.params.id)
  const deleted = deleteSavedPassenger(id, userId)
  if (!deleted) return bad(res, 'Không tìm thấy hành khách hoặc không có quyền thao tác.', 404)
  realtimeBus.publish('user:passengers:updated', { userId }, `user:${userId}`)
  res.json({ ok: true, message: 'Đã xóa hành khách khỏi danh sách lưu.' })
})

/* ------------------------------------------- Logout All Sessions (Task 4) */
// POST /api/auth/logout-all — Đăng xuất khỏi tất cả các thiết bị (Tăng token_version)
publicRouter.post('/auth/logout-all', requireAuth, (req, res) => {
  const userId = Number(req.session.user.id)
  const user = findUserById(userId)
  revokeAllUserSessions(userId)
  clearSessionCookie(res)
  writeAuditLog({
    actorId: userId,
    actorEmail: user?.email || '',
    action: 'user.logout_all',
    entityType: 'user',
    entityId: String(userId),
    detail: 'Đăng xuất khỏi tất cả thiết bị thành công (vô hiệu hóa toàn bộ phiên)',
    ip: req.ip || '',
  })
  res.json({ ok: true, message: 'Đã đăng xuất khỏi tất cả các thiết bị an toàn.' })
})


// POST /api/auth/change-password — Đổi mật khẩu
publicRouter.post('/auth/change-password', requireAuth, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '')
  const newPassword = String(req.body?.newPassword || '')

  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    return bad(res, `Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`)
  }

  const user = findUserById(req.session.user.id)
  if (!user) return bad(res, 'Tài khoản không tồn tại.', 404)

  const match = await verifyPassword(currentPassword, user.password_hash)
  if (!match) return bad(res, 'Mật khẩu hiện tại không chính xác.', 401)

  const newHash = await hashPassword(newPassword)
  db.prepare(`UPDATE users SET password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(newHash, user.id)

  res.json({ ok: true, message: 'Đổi mật khẩu thành công.' })
})

// POST /api/auth/forgot-password — Quên mật khẩu: sinh OTP 5 phút
publicRouter.post('/auth/forgot-password', (req, res) => {
  const email = txt(req.body?.email, 80, 5)?.toLowerCase()
  if (!email || !EMAIL_RE.test(email)) return bad(res, 'Email không hợp lệ.')

  const user = findUserByEmail(email)
  if (!user) {
    return res.json({ ok: true, message: 'Nếu email tồn tại, mã xác thực đã được tạo.' })
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000))
  createPasswordReset(email, otp, 5)

  res.json({
    ok: true,
    message: 'Mã xác thực khôi phục mật khẩu có hiệu lực trong 5 phút.',
    demoOtp: otp,
    otpHint: otp,
  })
})

// POST /api/auth/reset-password — Đặt lại mật khẩu với OTP
publicRouter.post('/auth/reset-password', async (req, res) => {
  const email = txt(req.body?.email, 80, 5)?.toLowerCase()
  const otp = String(req.body?.otp || '').trim()
  const newPassword = String(req.body?.newPassword || '')

  if (!email || !EMAIL_RE.test(email)) return bad(res, 'Email không hợp lệ.')
  if (!/^\d{6}$/.test(otp)) return bad(res, 'Mã xác thực phải gồm 6 chữ số.')
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    return bad(res, `Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`)
  }

  const valid = verifyPasswordReset(email, otp)
  if (!valid) return bad(res, 'Mã xác thực không hợp lệ hoặc đã hết hạn.', 400)

  const user = findUserByEmail(email)
  if (!user) return bad(res, 'Tài khoản không tồn tại.', 404)

  const newHash = await hashPassword(newPassword)
  db.prepare(`UPDATE users SET password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(newHash, user.id)

  consumePasswordReset(email, otp)
  res.json({ ok: true, message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay.' })
})


/* ------------------------------------------------------- bookings (user) */
// Đơn hàng hiển thị theo cặp (tài khoản, trình duyệt) — khớp hành vi lưu localStorage
// trước đây: mỗi trình duyệt mới bắt đầu với danh sách trống, không thấy dữ liệu
// của phiên khác. Đặt BOOKINGS_SCOPE=all để thấy toàn bộ đơn của tài khoản.
const CLIENT_KEY = 'may-an-nhien-client'
const bookingsScope = () => (process.env.BOOKINGS_SCOPE === 'all' ? 'all' : 'client')

const currentClientId = (req, fallback = '') =>
  txt(req.headers['x-client-id'], 64, 8) || txt(fallback, 64, 8) || 'anonymous'

// Định dạng giống Intl('vi-VN') của trình duyệt: "16/10/2026, 22:21:36"
function formatVi(iso) {
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function userBooking(r) {
  return {
    id: r.id,
    code: r.code,
    room_id: r.room_id,
    status: r.status,
    createdAt: formatVi(r.created_at),
    createdAtIso: r.created_at,
    serviceName: SERVICE_NAMES[r.service_type] || '',
    title: r.title,
    traveler: { name: r.traveler_name, phone: r.traveler_phone, email: r.traveler_email },
    passengers: r.passengers,
    promo: r.promo_code,
    total: r.total,
    unitPrice: r.unit_price,
    discount: r.discount,
    destination: r.destination,
    tripType: r.trip_type,
    dates: { depart: r.depart_date, ret: r.return_date },
    // Thông tin phòng đặt (chỉ đơn khách sạn có dữ liệu; vé bay/combo để rỗng/0).
    roomName: r.room_name || '',
    nights: Number(r.nights) || 0,
    roomsCount: Number(r.rooms_count) || 0,
    adults: Number(r.adults) || 0,
    children: Number(r.children) || 0,
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    legacy: !!r.legacy,
  }
}

// Tính lại TOÀN BỘ tiền phía server — không tin số tổng/giảm giá client gửi lên.
// Tham số mới (tùy chọn, giữ tương thích đơn cũ):
//   room: { roomId, roomsCount, adults, children } + dates {depart,ret} cho đơn khách sạn
//   strictVoucher: true -> voucher không hợp lệ sẽ LỖI thay vì âm thầm bỏ giảm giá
function priceBooking({ serviceType, itemId, passengers, promoCode, room, dates, strictVoucher }) {
  let title = ''
  let unitPrice = 0
  let base = 0
  let extra = {}

  if (serviceType === 'flight') {
    const flight = db.prepare('SELECT * FROM flights WHERE id = ? AND is_active = 1').get(itemId)
    if (!flight) return { error: 'Chuyến bay không tồn tại hoặc đã ngừng bán.' }
    title = `${flight.airline} ${flight.origin} - ${flight.dest}`
    unitPrice = flight.price
    base = flight.price * passengers // vé máy bay: giá × số khách
  } else if (serviceType === 'hotel') {
    const hotel = db.prepare('SELECT * FROM hotels WHERE id = ? AND is_active = 1').get(itemId)
    if (!hotel) return { error: 'Khách sạn không tồn tại hoặc đã ngừng bán.' }
    if (room?.roomId) {
      // Luồng đặt phòng mới: giá = giá phòng/đêm × số đêm × số phòng (server tự tính).
      const roomRow = db.prepare('SELECT * FROM rooms WHERE id = ? AND is_active = 1').get(String(room.roomId))
      if (!roomRow || roomRow.hotel_id !== hotel.id) return { error: 'Phòng không tồn tại hoặc đã ngừng bán.' }
      const checkin = typeof dates?.depart === 'string' ? dates.depart.trim() : ''
      const checkout = typeof dates?.ret === 'string' ? dates.ret.trim() : ''
      if (!/^\d{4}-\d{2}-\d{2}$/.test(checkin) || !/^\d{4}-\d{2}-\d{2}$/.test(checkout)) {
        return { error: 'Thiếu hoặc sai ngày nhận/trả phòng.' }
      }
      const nights = Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86400000)
      if (!Number.isFinite(nights) || nights < 1 || nights > 30) {
        return { error: 'Thời gian lưu trú phải từ 1 đến 30 đêm (trả phòng phải sau nhận phòng).' }
      }
      const roomsCount = Number(room.roomsCount)
      const adults = Number(room.adults)
      const children = Number(room.children)
      // Ghi nhận sai phạm từ client -> LỖI rõ ràng, không âm thầm sửa số.
      if (!Number.isInteger(roomsCount) || roomsCount < 1 || roomsCount > 5) return { error: 'Số phòng phải từ 1 đến 5.' }
      if (!Number.isInteger(adults) || adults < 1 || adults > 9) return { error: 'Số người lớn phải từ 1 đến 9.' }
      if (!Number.isInteger(children) || children < 0 || children > 9) return { error: 'Số trẻ em phải từ 0 đến 9.' }
      if (adults + children > 9) return { error: 'Tổng số khách phải từ 1 đến 9.' }
      const maxAdults = Number(roomRow.max_adults) * roomsCount
      const maxChildren = Number(roomRow.max_children) * roomsCount
      if (adults > maxAdults) return { error: `Loại phòng này chứa tối đa ${maxAdults} người lớn.` }
      if (children > maxChildren) return { error: `Loại phòng này chứa tối đa ${maxChildren} trẻ em.` }
      title = `${hotel.name} — ${roomRow.name}`
      unitPrice = roomRow.price
      base = roomRow.price * nights * roomsCount
      extra = { room: { roomId: roomRow.id, roomName: roomRow.name, nights, roomsCount, adults, children } }
    } else {
      // Đơn khách sạn cũ (không chọn phòng): giữ nguyên hành vi tính tiền trước đây.
      title = hotel.name
      unitPrice = hotel.price
      base = hotel.price
    }
  } else if (serviceType === 'combo') {
    const row = db.prepare('SELECT * FROM combos WHERE id = ? AND is_active = 1').get(itemId)
    if (!row) return { error: 'Combo không tồn tại hoặc đã ngừng bán.' }
    const hotel = db.prepare('SELECT * FROM hotels WHERE id = ? AND is_active = 1').get(row.hotel_id)
    const flight = db.prepare('SELECT * FROM flights WHERE id = ? AND is_active = 1').get(row.flight_id)
    if (!hotel || !flight) return { error: 'Combo đã ngừng bán do thiếu khách sạn hoặc chuyến bay liên kết.' }
    title = row.name
    unitPrice = row.price_override != null ? row.price_override : hotel.price + flight.price - row.saving
    base = unitPrice
  } else if (['activity', 'car', 'bus', 'train', 'insurance', 'tour', 'airport_transfer'].includes(serviceType)) {
    const dbItem = getExtraService(itemId)
    if (dbItem && dbItem.is_active) {
      title = dbItem.name
      unitPrice = dbItem.price
      base = (serviceType === 'car' || serviceType === 'airport_transfer') ? dbItem.price : dbItem.price * passengers
    } else {
      const extraItem = EXTRA_SERVICE_ITEMS[itemId]
      if (!extraItem) {
        return { error: 'Dịch vụ không tồn tại hoặc đã ngừng bán.' }
      }
      title = extraItem.title
      unitPrice = extraItem.price
      base = serviceType === 'car' ? extraItem.price : extraItem.price * passengers
    }
  } else {
    return { error: 'Loại dịch vụ không hợp lệ.' }
  }

  // Mã giảm giá: backend tự kiểm tra tồn tại/hết hạn/giới hạn/loại dịch vụ/giá trị tối thiểu.
  const evaluated = evaluatePromo(promoCode, serviceType, base)
  if (!evaluated.ok) {
    if (strictVoucher) return { error: evaluated.error }
    // Luồng cũ (vé bay/combo gửi kèm mã không áp dụng): bỏ giảm giá, không lỗi.
  }
  const rate = evaluated.ok ? evaluated.rate : 0
  const promoUsed = evaluated.ok && !!evaluated.promo
  const discount = Math.round(base * rate)
  return { title, unitPrice, base, discount, total: base - discount, promoUsed, ...extra }
}

const generateBookingCode = () => {
  for (let i = 0; i < 20; i += 1) {
    const code = `MAN${Math.floor(Math.random() * 1e7).toString().padStart(7, '0')}`
    if (!db.prepare('SELECT 1 FROM bookings WHERE code = ?').get(code)) return code
  }
  return `MAN${Date.now().toString().slice(-7)}`
}

// Danh sách đơn của chính mình (requireAuth) — không bao giờ trả đơn của người khác.
publicRouter.get('/bookings', requireAuth, (req, res) => {
  const userId = Number(req.session.user.id)
  const clientId = currentClientId(req)
  const rows = bookingsScope() === 'all'
    ? db.prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY id DESC').all(userId)
    : db.prepare(`SELECT * FROM bookings WHERE user_id = ? AND (client_id = ? OR client_id IS NULL)
                  ORDER BY id DESC`).all(userId, clientId)
  res.json({ ok: true, bookings: rows.map(userBooking) })
})

// Tạo đơn: backend tự lookup sản phẩm + tự tính tổng tiền; client chỉ chọn dịch vụ.
// Rate-limit theo (tài khoản + IP): chống spam đơn.
publicRouter.post('/bookings', requireAuth, rateLimitMiddleware('booking', { windowMs: 60_000, max: 100, keyFn: (req) => `u${req.session?.user?.id ?? 'x'}` }), async (req, res) => {
  const userId = Number(req.session.user.id)
  const serviceType = txt(req.body?.serviceType, 16, 3)
  const itemId = txt(req.body?.itemId, 64, 2)
  const passengers = Number(req.body?.passengers ?? 1)
  const travelerName = txt(req.body?.traveler?.name, 60, 2)
  const travelerPhone = txt(req.body?.traveler?.phone, 15, 8)
  const travelerEmail = txt(req.body?.traveler?.email, 80, 5)
  const paymentMethod = txt(req.body?.paymentMethod, 40) || 'Thẻ ATM nội địa'
  const destination = txt(req.body?.destination, 80, 0) ?? ''
  const tripType = txt(req.body?.tripType, 20, 0) ?? ''
  const depart = txt(req.body?.dates?.depart, 10, 0) || null
  const ret = txt(req.body?.dates?.ret, 10, 0) || null
  const promoCode = txt(req.body?.promoCode, 24, 0) || 'Không dùng'
  const idempotencyKey = txt(req.body?.idempotencyKey, 64, 8)
  const clientId = currentClientId(req, req.body?.clientId)
  // Luồng đặt phòng mới: client gửi mã phòng + số lượng; TIỀN do server tự tính lại hết.
  const strictVoucher = req.body?.strictVoucher === true
  const room = (req.body?.room && typeof req.body.room === 'object')
    ? {
      roomId: txt(req.body.room.roomId, 64, 2),
      roomsCount: Number(req.body.room.roomsCount),
      adults: Number(req.body.room.adults),
      children: Number(req.body.room.children),
    }
    : null
  if (room && !room.roomId) return bad(res, 'Thiếu mã phòng.')

  if (!serviceType || !SERVICE_NAMES[serviceType]) return bad(res, 'Loại dịch vụ không hợp lệ.')
  if (!itemId) return bad(res, 'Thiếu mã dịch vụ.')
  if (!Number.isInteger(passengers) || passengers < 1 || passengers > 9) return bad(res, 'Số khách phải từ 1–9.')
  if (!travelerName || !travelerPhone || !travelerEmail) return bad(res, 'Thiếu thông tin người đặt.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(travelerEmail)) return bad(res, 'Email người đặt không hợp lệ.')
  if (!/^[0-9+][0-9\s]{7,14}$/.test(travelerPhone)) return bad(res, 'Số điện thoại người đặt không hợp lệ.')

  // Chống tạo trùng khi bấm đôi / gửi lại: gửi lại cùng key → trả đơn đã tạo.
  if (idempotencyKey) {
    const dup = db.prepare('SELECT * FROM bookings WHERE user_id = ? AND idempotency_key = ?').get(userId, idempotencyKey)
    if (dup) return res.json({ ok: true, booking: userBooking(dup), duplicate: true })
  }

  const priced = priceBooking({
    serviceType, itemId, passengers, promoCode, room,
    dates: { depart, ret }, strictVoucher,
  })
  if (priced.error) return bad(res, priced.error, 409)

  const code = generateBookingCode()
  const nowIso = new Date().toISOString()
  const seatCode = (serviceType === 'flight' && typeof req.body?.seatCode === 'string') ? req.body.seatCode.trim().toUpperCase() : null
  const isWallet = paymentMethod.toLowerCase().includes('ví') || paymentMethod.toLowerCase().includes('balance') || paymentMethod.includes('Số dư')
  const isSepay = paymentMethod.toLowerCase().includes('sepay') || paymentMethod.toLowerCase().includes('vietqr')

  if (isWallet) {
    const freshUser = findUserById(userId)
    const curBalance = Number(freshUser?.balance) || 0
    if (curBalance < priced.total) {
      return res.status(400).json({
        error: `Số dư ví Mây An Nhiên không đủ (Hiện có: ${new Intl.NumberFormat('vi-VN').format(curBalance)}đ, Cần: ${new Intl.NumberFormat('vi-VN').format(priced.total)}đ). Vui lòng nạp thêm tiền vào ví qua SePay VietQR.`,
        code: 'INSUFFICIENT_BALANCE',
        balance: curBalance,
        required: priced.total,
      })
    }
  }

  // P1-02: kiểm tra tồn kho TẠI THỜI ĐIỂM GHI, bên trong transaction khóa ghi.
  // BEGIN IMMEDIATE lấy khóa viết ngay -> hai request đồng thời seri hoá tại
  // SQLite; kiểm tra trùng lặp + INSERT diễn ra nguyên tử (không có "check rồi
  // insert" tách ra bên ngoài). SQLITE_BUSY -> thử lại, không bao giờ trả 500.
  const INSERT_COLS = 'code, user_id, service_type, item_id, title, status, payment_method, payment_status, traveler_name, traveler_phone, traveler_email, email, passengers, promo_code, unit_price, discount, total, destination, trip_type, depart_date, return_date, idempotency_key, client_id, created_at, updated_at, room_id, room_name, nights, rooms_count, adults, children, seat_code'
  const INSERT_VALUES = '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'

  let created = null
  let _lastErr = null
  const MAX_INVENTORY_RETRY = 6
  for (let attempt = 0; attempt < MAX_INVENTORY_RETRY; attempt += 1) {
    try {
      db.exec('BEGIN IMMEDIATE')

      // Kiểm tra lại trong khoá viết: phòng đã có đơn khác giữ trong khoảng chồng lấn?
      if (priced.room) {
        if (!roomIsAvailable(priced.room.roomId, depart, ret)) {
          db.exec('ROLLBACK')
          return res.status(409).json({
            error: 'Phòng đã được đặt cho khoảng thời gian này. Vui lòng chọn ngày khác hoặc phòng khác.',
            code: 'ROOM_UNAVAILABLE',
          })
        }
      }

      // Khóa ghế máy bay chống đặt trùng (Overbooking Prevention)
      if (serviceType === 'flight' && seatCode) {
        const seatCheck = lockFlightSeat(itemId, seatCode, null)
        if (!seatCheck.ok) {
          db.exec('ROLLBACK')
          return res.status(409).json({
            error: seatCheck.error || `Ghế ${seatCode} đã có người đặt. Vui lòng chọn ghế khác.`,
            code: 'SEAT_UNAVAILABLE',
          })
        }
      }

      db.prepare(`INSERT INTO bookings (${INSERT_COLS}) VALUES ${INSERT_VALUES}`)
        .run(code, userId, serviceType, itemId, priced.title,
          isWallet ? 'Đã thanh toán' : ((paymentMethod.toLowerCase().includes('sepay') || paymentMethod.toLowerCase().includes('vietqr')) ? 'Chờ thanh toán' : 'Đã xác nhận'),
          isWallet ? 'Số dư ví Mây An Nhiên' : paymentMethod,
          isWallet ? 'paid' : ((paymentMethod.toLowerCase().includes('sepay') || paymentMethod.toLowerCase().includes('vietqr')) ? 'pending' : 'simulated'),
          travelerName, travelerPhone, travelerEmail, req.session.user.email, passengers, promoCode,
          priced.unitPrice, priced.discount, priced.total, destination, tripType, depart, ret,
          idempotencyKey, clientId, nowIso, nowIso,
          priced.room?.roomId || null, priced.room?.roomName || '', priced.room?.nights || 0,
          priced.room?.roomsCount || 0, priced.room?.adults || 0, priced.room?.children || 0,
          seatCode)
      if (priced.promoUsed) {
        // Trừ lượt dùng trong CÙNG transaction với điều kiện giới hạn — nhiều người
        // dùng đồng thời không bao giờ vượt quá usage_limit.
        const info = db.prepare(`UPDATE promotions SET used_count = used_count + 1,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
            WHERE code = ? COLLATE NOCASE AND (usage_limit IS NULL OR used_count < usage_limit)`).run(promoCode)
        if (Number(info.changes) === 0) throw new Error('VOUCHER_EXHAUSTED')
      }
      db.exec('COMMIT')
      created = db.prepare('SELECT * FROM bookings WHERE code = ?').get(code)
      if (seatCode && created?.id) {
        try {
          db.prepare('UPDATE flight_seats SET booking_id = ? WHERE flight_id = ? AND seat_code = ?').run(created.id, itemId, seatCode)
        } catch { /* bỏ qua lỗi gán booking_id phụ */ }
      }
      break
    } catch (err) {
      _lastErr = err
      try { db.exec('ROLLBACK') } catch { /* không có transaction để hoàn tác */ }
      const msg = String(err?.message || '')
      if ((msg.includes('SQLITE_BUSY') || msg.includes('busy')) && attempt < MAX_INVENTORY_RETRY - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)))
        continue
      }
      if (msg.includes('VOUCHER_EXHAUSTED')) {
        return bad(res, 'Mã voucher đã hết lượt sử dụng.', 409)
      }
      if (msg.includes('UNIQUE') && idempotencyKey) {
        const dup = db.prepare('SELECT * FROM bookings WHERE user_id = ? AND idempotency_key = ?').get(userId, idempotencyKey)
        if (dup) return res.json({ ok: true, booking: userBooking(dup), duplicate: true })
      }
      throw err
    }
  }
  if (!created) {
    // Hết lượt thử lại do SQLite bận -> từ chối rõ ràng, không tạo booking giả, không trả 500.
    return res.status(409).json({
      error: 'Hệ thống đang bận, vui lòng thử lại sau.',
      code: 'SERVER_BUSY',
    })
  }
  if (isWallet) {
    try {
      const payResult = payWithWallet({
        userId,
        amount: priced.total,
        bookingCode: code,
        description: `Thanh toán đơn ${code} bằng số dư ví Mây An Nhiên`,
      })
      const orderId = `WAL_${code}_${Date.now()}`
      try {
        db.prepare(`INSERT INTO payment_attempts
            (booking_code, user_id, provider, order_id, request_id, amount, status, trans_id, env)
            VALUES (?,?,?,?,?,?,?,?,?)`)
          .run(code, userId, 'wallet_balance', orderId, orderId, priced.total, 'paid', String(payResult.transactionId), 'production')
      } catch {}
      realtimeBus.publish('user:balance:updated', { userId, balance: payResult.balance, deducted: priced.total }, 'all')
      realtimeBus.publish('user:balance:updated', { userId, balance: payResult.balance, deducted: priced.total }, `user:${userId}`)
      broadcastPaymentReceived({ bookingCode: code, orderId, amount: priced.total, provider: 'wallet_balance' })
    } catch (payErr) {
      console.error('[routes-public] Lỗi trừ số dư ví:', payErr.message)
    }
  }

  // Tự động tích lũy điểm thưởng & thăng hạng thành viên nếu đơn đã xác nhận / thanh toán
  if (isWallet || (created && created.status === 'Đã xác nhận')) {
    try {
      addLoyaltyForBooking(userId, priced.total)
    } catch (loyaltyErr) {
      console.warn('[loyalty] Lỗi cộng điểm thưởng loyalty:', loyaltyErr.message)
    }
  }

  const formatted = userBooking(created)
  broadcastBookingCreated(formatted)
  try {
    pushNotification(userId, {
      title: 'Đặt chỗ thành công',
      message: `Đơn hàng ${formatted.code} (${formatted.title}) đã được tạo thành công.`,
      type: 'booking',
      link: '#/bookings',
    })
  } catch { }
  res.status(201).json({ ok: true, booking: formatted })
})

// Người dùng tự hủy đơn của mình — chỉ chủ đơn, không lộ đơn của người khác.
// P1-02: khóa ghi ngay trong transaction và kiểm tra lại trạng thái trước khi
// ghi -> hai request hủy đồng thời chỉ một đơn được hủy, phòng không bị
// giải phóng hai lần.
publicRouter.patch('/bookings/:code/cancel', requireAuth, async (req, res) => {
  const code = String(req.params.code || '')
  const userId = Number(req.session.user.id)
  let updated = null
  try {
    db.exec('BEGIN IMMEDIATE')
    const row = db.prepare('SELECT * FROM bookings WHERE code = ? AND user_id = ?')
      .get(code, userId)
    if (!row) { db.exec('ROLLBACK'); return bad(res, 'Không tìm thấy đơn hàng.', 404) }
    if (row.status === 'Đã hủy') { db.exec('ROLLBACK'); return bad(res, 'Đơn hàng đã được hủy trước đó.', 409) }
    if (!['Đã tạo', 'Chờ thanh toán', 'Đã thanh toán', 'Đã xác nhận'].includes(row.status)) {
      db.exec('ROLLBACK')
      return bad(res, 'Không thể hủy đơn ở trạng thái hiện tại.', 409)
    }
    db.prepare(`UPDATE bookings SET status = 'Đã hủy',
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(row.id)
    if (row.seat_code) {
      try { releaseFlightSeat(row.item_id, row.seat_code) } catch { /* bỏ qua lỗi giải phóng ghế phụ */ }
    }
    db.exec('COMMIT')
    updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(row.id)
  } catch (err) {
    try { db.exec('ROLLBACK') } catch { /* không có transaction để hoàn tác */ }
    throw err
  }
  broadcastBookingCancelled(code, userId)
  try {
    pushNotification(userId, {
      title: 'Đã hủy đơn hàng',
      message: `Đơn hàng ${code} đã được hủy theo yêu cầu.`,
      type: 'booking',
      link: '#/bookings',
    })
  } catch { }
  res.json({ ok: true, booking: userBooking(updated) })
})

/* ----------------------------------------------------------- E-Ticket PDF */
publicRouter.get('/bookings/:id/eticket', requireAuth, async (req, res) => {
  const bookingId = Number(req.params.id)
  const userId = Number(req.session.user.id)
  const role = req.session.user.role

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId)
  if (!booking) return bad(res, 'Không tìm thấy đơn hàng.', 404)
  if (role !== 'admin' && Number(booking.user_id) !== userId) {
    return bad(res, 'Không tìm thấy đơn hàng.', 404)
  }
  if (booking.status === 'Đã hủy') {
    return bad(res, 'Không thể xuất vé điện tử cho đơn hàng đã bị hủy.', 400)
  }

  try {
    const secret = process.env.SESSION_SECRET || 'mayan-secret-key-2025'
    const qrPayload = {
      bookingId: booking.id,
      code: booking.code,
      passenger: booking.traveler_name,
      total: booking.total,
      service: booking.service_type,
      issuedAt: new Date().toISOString(),
    }
    const signature = crypto.createHmac('sha256', secret).update(JSON.stringify(qrPayload)).digest('hex')
    const qrData = JSON.stringify({ ...qrPayload, sig: signature.slice(0, 32) })
    const qrBuffer = await QRCode.toBuffer(qrData, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 140,
    })

    const doc = new PDFDocument({ size: 'A4', margin: 40 })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="MayAnNhien-ETicket-${booking.code}.pdf"`)
    doc.pipe(res)

    const fontRegular = 'C:/Windows/Fonts/arial.ttf'
    const fontBold = 'C:/Windows/Fonts/arialbd.ttf'
    const hasUnicode = fs.existsSync(fontRegular)
    if (hasUnicode) {
      doc.registerFont('Main', fontRegular)
      doc.registerFont('MainBold', fontBold)
      doc.font('Main')
    }

    const setBold = () => { if (hasUnicode) doc.font('MainBold'); else doc.font('Helvetica-Bold') }
    const setRegular = () => { if (hasUnicode) doc.font('Main'); else doc.font('Helvetica') }

    // --- Header Banner ---
    doc.rect(40, 40, 515, 75).fill('#0f766e')
    setBold()
    doc.fillColor('#ffffff').fontSize(18).text('MÂY AN NHIÊN · TRAVEL & HOSPITALITY', 55, 55)
    setRegular()
    doc.fillColor('#ccfbf1').fontSize(11).text('VÉ ĐIỆN TỬ & XÁC NHẬN ĐẶT CHỖ (E-TICKET / VOUCHER)', 55, 80)
    doc.fillColor('#ffffff').fontSize(9).text('Hotline: 1900 6868  ·  Email: booking@mayannhien.vn', 55, 96)

    // --- Booking Code & Status Strip ---
    doc.rect(40, 125, 515, 45).fill('#f1f5f9')
    setBold()
    doc.fillColor('#0f172a').fontSize(14).text(`MÃ ĐẶT CHỖ: ${booking.code}`, 55, 138)
    setRegular()
    const isPaid = booking.payment_status === 'paid'
    const statusText = isPaid ? 'ĐÃ THANH TOÁN (MOMO)' : booking.status
    doc.fillColor(isPaid ? '#047857' : '#0369a1').fontSize(12).text(`TRẠNG THÁI: ${statusText.toUpperCase()}`, 340, 138, { align: 'right', width: 200 })

    // --- Details Box ---
    doc.rect(40, 180, 340, 240).strokeColor('#cbd5e1').lineWidth(1).stroke()
    setBold()
    doc.fillColor('#0f766e').fontSize(12).text('THÔNG TIN CHI TIẾT ĐẶT CHỖ', 55, 195)
    setRegular()

    let y = 220
    const addRow = (label, value) => {
      setBold()
      doc.fillColor('#475569').fontSize(9).text(label, 55, y, { width: 110 })
      setRegular()
      doc.fillColor('#0f172a').fontSize(9).text(String(value || '—'), 170, y, { width: 195 })
      y += 18
    }

    addRow('Dịch vụ:', SERVICE_NAMES[booking.service_type] || booking.service_type)
    addRow('Tiêu đề:', booking.title)
    if (booking.destination) addRow('Điểm đến:', booking.destination)
    if (booking.depart_date) addRow('Ngày đi / Nhận:', booking.depart_date)
    if (booking.return_date) addRow('Ngày về / Trả:', booking.return_date)
    if (booking.seat_code) addRow('Số ghế đặt:', booking.seat_code)
    if (booking.room_name) addRow('Loại phòng:', booking.room_name)
    addRow('Số lượng khách:', `${booking.passengers} hành khách`)
    addRow('Tổng thanh toán:', formatVND(booking.total))

    // --- QR Code & Check-in Box ---
    doc.rect(390, 180, 165, 240).strokeColor('#cbd5e1').lineWidth(1).stroke()
    doc.image(qrBuffer, 403, 195, { width: 138 })
    setBold()
    doc.fillColor('#0f766e').fontSize(10).text('CHECK-IN BẢO MẬT', 395, 345, { align: 'center', width: 155 })
    setRegular()
    doc.fillColor('#64748b').fontSize(8).text('Quét mã QR tại quầy làm thủ tục hoặc đối tác xuất trình vé.', 395, 362, { align: 'center', width: 155 })
    doc.fillColor('#059669').fontSize(8).text('Chữ ký số: Đã xác thực (HMAC)', 395, 395, { align: 'center', width: 155 })

    // --- Customer Information Box ---
    doc.rect(40, 430, 515, 105).strokeColor('#cbd5e1').lineWidth(1).stroke()
    setBold()
    doc.fillColor('#0f766e').fontSize(12).text('THÔNG TIN HÀNH KHÁCH / LIÊN HỆ', 55, 445)
    setRegular()

    let cy = 470
    setBold()
    doc.fillColor('#475569').fontSize(9).text('Họ và tên:', 55, cy)
    setRegular()
    doc.fillColor('#0f172a').fontSize(9).text(booking.traveler_name, 130, cy)

    setBold()
    doc.fillColor('#475569').fontSize(9).text('Số điện thoại:', 300, cy)
    setRegular()
    doc.fillColor('#0f172a').fontSize(9).text(booking.traveler_phone, 380, cy)

    cy += 20
    setBold()
    doc.fillColor('#475569').fontSize(9).text('Email liên hệ:', 55, cy)
    setRegular()
    doc.fillColor('#0f172a').fontSize(9).text(booking.traveler_email || booking.email, 130, cy)

    setBold()
    doc.fillColor('#475569').fontSize(9).text('Mã voucher:', 300, cy)
    setRegular()
    doc.fillColor('#0f172a').fontSize(9).text(booking.promo_code || 'Không dùng', 380, cy)

    cy += 20
    setBold()
    doc.fillColor('#475569').fontSize(9).text('Ngày xuất vé:', 55, cy)
    setRegular()
    doc.fillColor('#0f172a').fontSize(9).text(new Date().toLocaleString('vi-VN'), 130, cy)

    // --- Terms & Notes ---
    doc.rect(40, 545, 515, 110).fill('#f8fafc')
    setBold()
    doc.fillColor('#334155').fontSize(10).text('ĐIỀU KHOẢN & HƯỚNG DẪN QUAN TRỌNG', 55, 555)
    setRegular()
    doc.fillColor('#64748b').fontSize(8)
      .text('1. Vui lòng mang theo CMND/CCCD/Hộ chiếu gốc còn hạn để làm thủ tục nhận phòng hoặc lên máy bay.', 55, 575)
      .text('2. Đối với chuyến bay: có mặt tại quầy check-in trước giờ khởi hành ít nhất 90 phút (nội địa) hoặc 180 phút (quốc tế).', 55, 590)
      .text('3. Đối với khách sạn: thời gian nhận phòng tiêu chuẩn từ 14:00 và trả phòng trước 12:00 cùng ngày.', 55, 605)
      .text('4. Vé điện tử đã được ký số bảo mật, không được tẩy xóa hoặc sửa chữa thông tin.', 55, 620)
      .text('5. Mọi thắc mắc và hỗ trợ khẩn cấp, vui lòng liên hệ tổng đài 1900 6868 hoặc gửi email hotro@mayannhien.vn.', 55, 635)

    // --- Footer ---
    doc.rect(40, 750, 515, 0.5).strokeColor('#cbd5e1').stroke()
    doc.fillColor('#94a3b8').fontSize(8).text(
      'Cảm ơn quý khách đã tin tưởng và lựa chọn Mây An Nhiên! Chúc quý khách có một chuyến đi trọn vẹn và an yên.',
      40, 765, { align: 'center', width: 515 }
    )

    doc.end()
  } catch (err) {
    console.error('[eticket] Tạo vé PDF thất bại:', err)
    if (!res.headersSent) bad(res, 'Không thể tạo vé điện tử. Vui lòng thử lại sau.', 500)
  }
})

/* ------------------------------------------------------ Notifications API */
publicRouter.get('/notifications', requireAuth, (req, res) => {
  const userId = Number(req.session.user.id)
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100)
  const items = listUserNotifications(userId, limit)
  const unreadCount = countUnreadNotifications(userId)
  res.json({ ok: true, items, unreadCount })
})

publicRouter.patch('/notifications/:id/read', requireAuth, (req, res) => {
  const userId = Number(req.session.user.id)
  const id = String(req.params.id)
  const updated = markNotificationAsRead(id, userId)
  const unreadCount = countUnreadNotifications(userId)
  res.json({ ok: true, updated, unreadCount })
})

publicRouter.patch('/notifications/read-all', requireAuth, (req, res) => {
  const userId = Number(req.session.user.id)
  markAllNotificationsAsRead(userId)
  res.json({ ok: true, unreadCount: 0 })
})

// Nhập đơn cũ từ localStorage (chỉ của chính mình, bỏ qua mã đã có) — KHÔNG xóa dữ liệu gốc.
// Ở production tính năng này bị TẮT (ALLOW_LEGACY_IMPORT=false) vì chỉ phục vụ
// chuyển dữ liệu từ bản demo; bật lại khi cần bằng biến môi trường.
publicRouter.post('/bookings/import', requireAuth, (req, res) => {
  if (!ALLOW_LEGACY_IMPORT) return bad(res, 'Tính năng nhập đơn cũ đang tắt trên môi trường này.', 403)
  const userId = Number(req.session.user.id)
  const clientId = currentClientId(req, req.body?.clientId)
  const items = Array.isArray(req.body?.bookings) ? req.body.bookings.slice(0, 200) : []
  let imported = 0
  let unpriced = 0
  for (const entry of items) {
    const code = txt(entry?.code, 24, 6)
    const title = txt(entry?.title, 160, 2)
    if (!code || !title) continue
    // Mã đơn là UNIQUE TOÀN CỤC trong database -> check cả bảng, không riêng user.
    if (db.prepare('SELECT 1 FROM bookings WHERE code = ?').get(code)) continue
    const lower = title.toLowerCase()
    const serviceType = ['flight', 'hotel', 'combo'].includes(entry.serviceType)
      ? entry.serviceType
      : lower.includes('combo') ? 'combo' : lower.includes('khách sạn') || lower.includes('resort') || lower.includes('hotel') ? 'hotel' : 'flight'
    const itemId = txt(entry.itemId, 64, 0) || 'legacy'
    const passengers = Math.min(Math.max(Number(entry.passengers) || 1, 1), 9)
    const promoCode = txt(entry.promo, 24, 0) || 'Không dùng'
    const depart = txt(entry.dates?.depart, 10, 0) || null
    const ret = txt(entry.dates?.ret, 10, 0) || null
    // Tính lại TIỀN Ở SERVER — KHÔNG tin `total`/`discount` client gửi lên.
    const priced = priceBooking({ serviceType, itemId, passengers, promoCode, room: entry.room, dates: entry.dates })
    // Không định giá được (món đã bị gỡ khỏi danh mục / thiếu dữ liệu phòng, ngày):
    // đánh dấu legacy, KHÔNG gán tiền -> Admin loại khỏi doanh thu.
    const trusted = !priced.error
    if (!trusted) unpriced += 1
    let unitPrice = trusted ? priced.unitPrice : 0
    let discount = trusted ? priced.discount : 0
    let total = trusted ? priced.total : 0
    const finalTitle = trusted ? (priced.title || title) : title
    try {
      db.exec('BEGIN')
      db.prepare(`INSERT INTO bookings (code, user_id, service_type, item_id, title, status, payment_method,
                  payment_status, traveler_name, traveler_phone, traveler_email, email, passengers, promo_code,
                  unit_price, discount, total, destination, trip_type, depart_date, return_date, client_id, legacy)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(code, userId, serviceType, itemId, finalTitle, entry.status === 'Đã hủy' ? 'Đã hủy' : 'Đã xác nhận',
          txt(entry.paymentMethod, 40, 0) || '', 'simulated',
          txt(entry.traveler?.name, 60, 0) || '—', txt(entry.traveler?.phone, 15, 0) || '—',
          txt(entry.traveler?.email, 80, 0) || '', req.session.user.email, passengers, promoCode,
          unitPrice, discount, total, txt(entry.destination, 80, 0) || '',
          txt(entry.tripType, 20, 0) || '', depart, ret, clientId, trusted ? 0 : 1)
      if (trusted && priced.promoUsed) {
        // Voucher đã dùng cho đơn nhập -> trừ lượt trong CÙNG transaction.
        const info = db.prepare(`UPDATE promotions SET used_count = used_count + 1,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
            WHERE code = ? COLLATE NOCASE AND (usage_limit IS NULL OR used_count < usage_limit)`).run(promoCode)
        if (Number(info.changes) === 0) {
          // Voucher đã hết lượt -> bỏ giảm giá, giữ giá gốc (không nhập số sai).
          const base = total + discount
          discount = 0
          total = base
          db.prepare('UPDATE bookings SET discount = 0, total = ? WHERE code = ?').run(total, code)
        }
      }
      db.exec('COMMIT')
    } catch {
      try { db.exec('ROLLBACK') } catch { /* không có transaction để hoàn tác */ }
      continue
    }
    imported += 1
  }
  const rows = bookingsScope() === 'all'
    ? db.prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY id DESC').all(userId)
    : db.prepare(`SELECT * FROM bookings WHERE user_id = ? AND (client_id = ? OR client_id IS NULL)
                  ORDER BY id DESC`).all(userId, clientId)
  res.json({ ok: true, imported, unpriced, bookings: rows.map(userBooking) })
})

/* ---------------------------------------------------------- catalog API */
// Catalog lấy từ database — admin sửa là người dùng thấy ngay.
publicRouter.get('/catalog', (req, res) => {
  res.json({
    flights: listFlights(),
    hotels: listHotels(),
    promos: listPromotions(),
    combos: listCombos(),
    rooms: listRooms(),
    extraServices: listExtraServices(),
    source: 'database',
  })
})

// Ô nhập voucher (nhập tay): backend tự kiểm tra mã — tồn tại / còn hạn / còn lượt /
// đúng loại dịch vụ / đạt giá trị tối thiểu — và tự tính số tiền được giảm + tổng cuối.
// Client chỉ dùng kết quả này để HIỂN THỊ; lúc tạo đơn server vẫn tính lại từ đầu.
// Rate-limit: chặn dò mã voucher hàng loạt.
publicRouter.post('/promos/validate', rateLimitMiddleware('promo-validate', { windowMs: 60_000, max: 30 }), (req, res) => {
  const code = txt(req.body?.code, 24, 2)
  const serviceType = txt(req.body?.serviceType, 16, 3)
  const amount = Number(req.body?.amount !== undefined ? req.body.amount : req.body?.price)
  if (!code) return bad(res, 'Vui lòng nhập mã voucher.')
  if (!serviceType || !SERVICE_NAMES[serviceType]) return bad(res, 'Loại dịch vụ không hợp lệ.')
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e9) return bad(res, 'Giá trị đơn hàng không hợp lệ.')

  const evaluated = evaluatePromo(code, serviceType, amount)
  if (!evaluated.ok) return bad(res, evaluated.error, 400)

  const discount = Math.round(amount * evaluated.rate)
  res.json({
    ok: true,
    promo: { code: evaluated.promo.code, title: evaluated.promo.code, description: evaluated.promo.description, rate: evaluated.rate, minOrder: Number(evaluated.promo.min_order) || 0 },
    voucher: {
      code: evaluated.promo.code,
      title: evaluated.promo.code,
      description: evaluated.promo.description,
      rate: evaluated.rate,
      minOrder: Number(evaluated.promo.min_order) || 0,
    },
    discount,
    total: amount - discount,
  })
})

publicRouter.get('/health', (req, res) => {
  // Endpoint an toàn cho monitoring: KHÔNG lộ thông tin nhạy cảm (đường dẫn DB,
  // phiên bản, cấu hình nội bộ). Chỉ trả trạng thái + thời gian hoạt động.
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  })
})

publicRouter.get('/travel', (req, res) => {
  res.json({
    hero: {
      title: 'Du lịch dễ dàng, chi phí tối ưu.',
      subtitle: 'Tìm kiếm khách sạn, vé máy bay, tour và trải nghiệm đáng nhớ cho mọi hành trình của bạn.',
      tabs: ['Khách sạn', 'Máy bay', 'Tour', 'Xe'],
    },
    promo: [
      { icon: '🏨', title: 'Khách sạn', text: 'Deal up to 50%' },
      { icon: '✈️', title: 'Máy bay', text: 'Giá tốt mọi ngày' },
      { icon: '🚐', title: 'Xe đưa đón', text: 'Dịch vụ tiện lợi' },
      { icon: '🎫', title: 'Tour', text: 'Combo tiết kiệm' },
    ],
    deals: [
      { name: 'The Sail Hotel', location: 'Đà Nẵng', rating: 4.9, discount: 35, price: 1490000, oldPrice: 2290000, desc: 'View biển, bữa sáng miễn phí, spa và hồ bơi.', gradient: 'linear-gradient(135deg, #a5f3fc, #60a5fa)' },
      { name: 'Hanoi City Stay', location: 'Hà Nội', rating: 4.8, discount: 28, price: 1190000, oldPrice: 1650000, desc: 'Phù hợp cho công tác hoặc nghỉ dưỡng ngắn ngày.', gradient: 'linear-gradient(135deg, #f9a8d4, #c084fc)' },
      { name: 'Nha Trang Escape', location: 'Khánh Hòa', rating: 4.7, discount: 42, price: 1990000, oldPrice: 3440000, desc: 'Vị trí đẹp, buổi tối lãng mạn và bể bơi ngoài trời.', gradient: 'linear-gradient(135deg, #86efac, #34d399)' },
    ],
    destinations: [
      { name: 'Phú Quốc', country: 'Việt Nam', airfare: 'Từ 1.290.000đ', gradient: 'linear-gradient(135deg, rgba(14,116,144,0.5), rgba(37,99,235,0.9))' },
      { name: 'Tokyo', country: 'Nhật Bản', airfare: 'Từ 8.490.000đ', gradient: 'linear-gradient(135deg, rgba(14,165,233,0.5), rgba(59,130,246,0.9))' },
      { name: 'Seoul', country: 'Hàn Quốc', airfare: 'Từ 7.990.000đ', gradient: 'linear-gradient(135deg, rgba(196,181,253,0.5), rgba(168,85,247,0.9))' },
      { name: 'Paris', country: 'Pháp', airfare: 'Từ 17.900.000đ', gradient: 'linear-gradient(135deg, rgba(251,146,60,0.5), rgba(239,68,68,0.9))' },
    ],
    experiences: [
      { category: 'Gợi ý', title: 'Đón sunrise trên núi', text: 'Đặt ngay để trải nghiệm khung cảnh tuyệt đẹp và trải nghiệm hướng dẫn viên.', gradient: 'linear-gradient(135deg, #dbeafe, #93c5fd)' },
      { category: 'Vui chơi', title: 'Tour biển và lặn', text: 'Điểm đến lý tưởng cho các cặp đôi và gia đình muốn khám phá.', gradient: 'linear-gradient(135deg, #cffafe, #67e8f9)' },
      { category: 'Ẩm thực', title: 'Food tour đường phố', text: 'Thưởng thức món ngon địa phương cùng trải nghiệm văn hóa.', gradient: 'linear-gradient(135deg, #fef3c7, #fbbf24)' },
    ],
    benefits: [
      { icon: '💳', title: 'Thanh toán an toàn', text: 'Đảm bảo giao dịch rõ ràng, tiện lợi và bảo mật cho mọi lần đặt.' },
      { icon: '🛎️', title: 'Hỗ trợ 24/7', text: 'Nhân viên hỗ trợ bạn mọi lúc để giải đáp và xử lý mọi nhu cầu.' },
      { icon: '🎁', title: 'Quà tặng & ưu đãi', text: 'Nhiều mã giảm giá và ưu đãi độc quyền dành cho khách hàng thân thiết.' },
    ],
  })
})

/* ------------------------------------------------- phòng còn trống theo ngày */
// P1-02: tra phòng còn trống của 1 khách sạn trong khoảng [checkIn, checkOut).
// Tính toán hoàn toàn ở backend (không tin số phòng/giá/trạng thái từ frontend).
// Không có ngày -> trả về tất cả phòng đang hoạt động (không lọc).
publicRouter.get('/rooms/available', (req, res) => {
  const hotelId = txt(req.query.hotelId, 64, 0) || undefined
  const checkIn = txt(req.query.checkIn, 10, 0)
  const checkOut = txt(req.query.checkOut, 10, 0)
  if ((checkIn || checkOut) && (!checkIn || !checkOut)) {
    return bad(res, 'Cần cung cấp đủ ngày nhận và ngày trả.')
  }
  if (checkIn && checkOut) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
      return bad(res, 'Ngày nhận/trả phải định dạng YYYY-MM-DD.')
    }
    const nights = Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86400000)
    if (!Number.isFinite(nights) || nights < 1 || nights > 30) {
      return bad(res, 'Thời gian lưu trú phải từ 1 đến 30 đêm (trả phòng phải sau nhận phòng).')
    }
  }
  const rooms = listRooms()
    .filter((r) => !hotelId || r.hotelId === hotelId)
    .filter((r) => {
      if (!checkIn || !checkOut) return true
      return roomIsAvailable(r.id, checkIn, checkOut)
    })
  res.json({
    ok: true,
    hotelId: hotelId || null,
    checkIn: checkIn || null,
    checkOut: checkOut || null,
    rooms: rooms.map((r) => ({ ...r, available: true })),
  })
})

/* ------------------------------------------- Seats, Extra Services, Reviews */
// GET /api/flights/:id/seats — Lấy sơ đồ ghế thật từ DB
publicRouter.get('/flights/:id/seats', (req, res) => {
  const flightId = String(req.params.id || '').trim()
  const seats = listFlightSeats(flightId)
  res.json({ ok: true, flightId, seats })
})

// GET /api/extra-services — Lấy danh mục dịch vụ mở rộng từ DB
publicRouter.get('/extra-services', (req, res) => {
  const category = req.query.category ? String(req.query.category).trim() : null
  const items = listExtraServices(category)
  res.json({
    ok: true,
    items: items.map((it) => ({
      ...it,
      metadata: typeof it.metadata_json === 'string' ? JSON.parse(it.metadata_json || '{}') : (it.metadata_json || {}),
    })),
  })
})

// GET /api/hotels/:id/reviews — Lấy đánh giá khách sạn từ DB
publicRouter.get('/hotels/:id/reviews', (req, res) => {
  const hotelId = String(req.params.id || '').trim()
  const reviews = listHotelReviews(hotelId)
  const stats = getHotelReviewStats(hotelId)
  res.json({ ok: true, hotelId, stats, reviews, items: reviews })
})

// POST /api/hotels/:id/reviews — Gửi đánh giá / phản ánh mới
publicRouter.post('/hotels/:id/reviews', (req, res) => {
  const hotelId = String(req.params.id || '').trim()
  const hotel = db.prepare('SELECT id FROM hotels WHERE id = ?').get(hotelId)
  if (!hotel) return bad(res, 'Khách sạn không tồn tại.', 404)

  const comment = txt(req.body?.comment || req.body?.text, 1000, 3)
  if (!comment) return bad(res, 'Nội dung đánh giá cần từ 3 đến 1000 ký tự.')
  const rating = Math.min(Math.max(Number(req.body?.rating) || 5, 1), 5)
  const type = req.body?.type === 'feedback' ? 'feedback' : 'review'
  const category = txt(req.body?.category, 60, 0) || ''

  const user = req.session?.user
  const userId = user?.id || 1
  const userName = txt(req.body?.userName, 60, 2) || txt(req.body?.name, 60, 2) || user?.name || 'Khách hàng'

  const created = createHotelReview({
    hotelId,
    userId,
    userName,
    type,
    category,
    rating,
    comment,
  })
  res.status(201).json({ ok: true, review: created })
})

/* ------------------------------------------------------- admin API (RBAC) */
// Mọi route /api/admin/* bắt buộc đăng nhập + role='admin' (xem routes-admin.js).
publicRouter.use('/admin', adminRouter)

/* ------------------------------------------------------- staff API (RBAC) */
// Mọi route /api/staff/* bắt buộc đăng nhập + role='staff' hoặc 'admin' (xem routes-staff.js).
publicRouter.use('/staff', staffRouter)

/* ---------------------------------------------------------- AI Planner API */
publicRouter.use('/ai', aiRouter)

/* --------------------------------------------------------- thanh toán API */
// /api/payment/* — tạo phiên thanh toán, xem trạng thái, đối soát giao dịch.
// IPN webhook của MoMo được đăng ký RIÊNG ở server.js (ngoài /api) vì
// MoMo không gửi header CSRF và không cần phiên đăng nhập.
publicRouter.use('/payment', paymentRouter)

/* -------------------------------------------------------------- phiên API */
// Kiểm tra phiên thật phía server: frontend không bao giờ tự quyết định role.
publicRouter.get('/auth/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: publicUser(req.session.user) })
})

export { CLIENT_KEY }






