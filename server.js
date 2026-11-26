// server.js — điểm vào backend Mây An Nhiên.
// Cấu trúc: server/config.js (cấu hình + .env), server/db.js (SQLite), server/auth.js (phiên & phân quyền),
// server/security.js (headers/CSP/CORS), server/momo.js (thanh toán),
// server/routes-public.js (API công khai), server/routes-admin.js (API quản trị).
import express from 'express'
import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'
import { ROOT, PORT, IS_PRODUCTION, TRUST_PROXY_HOPS } from './server/config.js'
import { seedCatalogIfEmpty, seedRooms, seedStaffUser } from './server/db.js'
import { csrfGuard, sessionMiddleware, sweepRateBuckets } from './server/auth.js'
import { securityHeaders, corsGuard } from './server/security.js'
import { publicRouter } from './server/routes-public.js'
import { momoIpnRouter, sepayWebhookRouter } from './server/routes-payment.js'
import { initRealtimeServer } from './server/realtime.js'

const app = express()
app.disable('x-powered-by')

// Chỉ tin X-Forwarded-For từ đúng số reverse proxy đã cấu hình.
// `true` (như bản cũ) khiến client tự giả mạo IP -> vô hiệu hoá rate-limit.
app.set('trust proxy', TRUST_PROXY_HOPS)

app.use(securityHeaders)
app.use(corsGuard)
app.use(express.json({ limit: '256kb' }))

// Webhook của MoMo & SePay: đăng ký TRƯỚC csrfGuard vì server-to-server,
// không gửi header X-Requested-With.
app.use('/api/webhook', momoIpnRouter)
app.use('/api/webhook', sepayWebhookRouter)
app.use('/api/payment/sepay/webhook', sepayWebhookRouter)

// Webhook của MoMo: nếu express.json() ném lỗi (payload JSON hỏng / quá lớn)
// thì MoMo coi là "chưa nhận được" và GỌI LẠI liên tục -> phải trả HTTP 200.
// Handler này phải đứng NGAY SAU router webhook và TRƯỚC error handler chung
// để bắt được lỗi từ middleware express.json toàn cục.
app.use('/api/webhook', (err, req, res, next) => {
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    console.warn('[momo-ipn] payload JSON không hợp lệ -> bỏ qua (trả 200).')
    return res.status(200).json({ ok: true, ignored: true })
  }
  if (err?.type === 'entity.too.large') {
    console.warn('[momo-ipn] payload quá lớn -> bỏ qua (trả 200).')
    return res.status(200).json({ ok: true, ignored: true })
  }
  return next(err)
})

// Chống CSRF (header X-Requested-With cho request mutating) + đọc phiên cookie HttpOnly.
app.use(csrfGuard)
app.use(sessionMiddleware)

// Dọn các bucket rate-limit đã hết hạn (không để bộ nhớ phình vô hạn).
const sweeper = setInterval(sweepRateBuckets, 5 * 60 * 1000)
sweeper.unref?.()

// Seed dữ liệu catalog mặc định khi database còn trống.
const seeded = seedCatalogIfEmpty()
if (seeded) console.log('[db] đã seed dữ liệu catalog mặc định vào SQLite')
// Đảm bảo mọi khách sạn đều có phòng (DB cũ + khách sạn admin tạo sau) — idempotent.
const seededRooms = seedRooms()
if (seededRooms) console.log(`[db] đã seed ${seededRooms} phòng`)
seedStaffUser()

// Thư mục lưu trữ upload tĩnh (Avatar người dùng...)
const uploadsDir = path.join(process.cwd(), 'server', 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
const avatarsDir = path.join(uploadsDir, 'avatars')
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true })
app.use('/uploads', express.static(uploadsDir))

// Mọi API công khai + /api/admin/* (bị chặn bởi requireAdmin trong routes-admin.js).
app.use('/api', publicRouter)

// Phục vụ bản build production (dist/) nếu có — dev dùng Vite ở cổng 5175.
const distDir = path.join(ROOT, 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(distDir, 'index.html'), (err) => (err ? next() : undefined))
  })
}

// 404 JSON cho mọi endpoint /api không tồn tại.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Không tìm thấy endpoint API.' })
})

// Error handler tập trung (Express yêu cầu đúng 4 tham số).
// KHÔNG trả stack trace / secret cho client — chỉ ghi log phía server.
app.use((err, req, res, _next) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Dữ liệu JSON không hợp lệ.' })
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Dữ liệu gửi lên quá lớn.' })
  }
  console.error('[api-error]', err?.message || err)
  res.status(500).json({ error: 'Lỗi máy chủ. Vui lòng thử lại.' })
})

const httpServer = http.createServer(app)
initRealtimeServer(httpServer, app)

httpServer.listen(PORT, () => {
  console.log(`Mây An Nhiên API chạy tại http://localhost:${PORT} (SQLite: data/mayan.db)`)
  console.log(`Real-Time WebSocket chạy tại ws://localhost:${PORT}/api/realtime/ws`)
  if (IS_PRODUCTION) console.log('[config] NODE_ENV=production — cần HTTPS + reverse proxy phía trước.')
})
