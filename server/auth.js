// server/auth.js — xác thực phiên (cookie HttpOnly), phân quyền, rate-limit đăng nhập, chống CSRF.
import { deleteSession, findSessionUser, touchSession } from './db.js'
import { FORCE_SECURE_COOKIES } from './config.js'

export const SESSION_COOKIE = 'may_an_nhien_sid'
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
// Mật khẩu tối thiểu 8 ký tự ở production (demo dùng 6 để test tự động vẫn chạy).
export const MIN_PASSWORD_LENGTH = 8

export function parseCookies(req) {
  const raw = req.headers.cookie || ''
  const out = {}
  for (const part of raw.split(';')) {
    const i = part.indexOf('=')
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

export function setSessionCookie(res, token, maxAgeMs) {
  const attrs = [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${Math.floor(maxAgeMs / 1000)}`]
  // Cờ Secure BẮT BUỘC ở production (HTTPS). Ngoài ra tự bật khi request đi qua HTTPS.
  if (FORCE_SECURE_COOKIES || res.req?.secure) attrs.push('Secure')
  res.append('Set-Cookie', attrs.join('; '))
}

export function clearSessionCookie(res) {
  const attrs = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (FORCE_SECURE_COOKIES || res.req?.secure) attrs.push('Secure')
  res.append('Set-Cookie', attrs.join('; '))
}

// Gắn req.session = { token, user } nếu phiên hợp lệ.
// Tài khoản bị admin vô hiệu: xoá luôn phiên cũ → request tiếp theo bị chặn (403).
export function sessionMiddleware(req, res, next) {
  const token = parseCookies(req)[SESSION_COOKIE]
  req.session = null
  req.accountDisabled = false
  if (token) {
    const user = findSessionUser(token)
    if (user) {
      if (Number(user.is_active) !== 1) {
        deleteSession(token)
        req.accountDisabled = true
        clearSessionCookie(res)
      } else {
        req.session = { token, user }
        touchSession(token)
      }
    }
  }
  next()
}

export function requireAuth(req, res, next) {
  if (req.session?.user) return next()
  if (req.accountDisabled) return res.status(403).json({ error: 'Tài khoản đã bị vô hiệu hóa.' })
  return res.status(401).json({ error: 'Chưa đăng nhập.' })
}

export function requireAdmin(req, res, next) {
  if (req.accountDisabled) return res.status(403).json({ error: 'Tài khoản đã bị vô hiệu hóa.' })
  if (!req.session?.user) return res.status(401).json({ error: 'Chưa đăng nhập.' })
  if (req.session.user.role !== 'admin') return res.status(403).json({ error: 'Chỉ quản trị viên mới được thực hiện thao tác này.' })
  next()
}

// Chống CSRF: mọi request mutating phải kèm header tuỳ chỉnh (form cross-site không thể đặt được).
// Cookie SameSite=Lax là lớp bảo vệ thứ hai.
export function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  if (req.headers['x-requested-with'] === 'fetch') return next()
  return res.status(403).json({ error: 'CSRF: thiếu header X-Requested-With.' })
}

/* ------------------------------------------------------------ rate limit */
// 5 lần sai mật khẩu / 15 phút cho mỗi (email + IP) → khoá tạm, trả 429 chung chung.
const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILS = 5
const attempts = new Map()
export const _loginAttempts = attempts // cho test kiểm tra được

export function clientKey(req, email) {
  const ip = req.ip || req.socket?.remoteAddress || '?'
  return `${String(email).toLowerCase()}|${ip}`
}

export function loginBlocked(key) {
  const a = attempts.get(key)
  if (!a) return false
  if (Date.now() - a.first > WINDOW_MS) { attempts.delete(key); return false }
  return a.lockedUntil > Date.now()
}

export function recordLoginFail(key) {
  const a = attempts.get(key) || { count: 0, first: Date.now(), lockedUntil: 0 }
  if (Date.now() - a.first > WINDOW_MS) { a.count = 0; a.first = Date.now() }
  a.count += 1
  if (a.count >= MAX_FAILS) a.lockedUntil = Date.now() + WINDOW_MS
  attempts.set(key, a)
  return a.count
}

export function clearLoginFails(key) { attempts.delete(key) }

/* --------------------------------------------------- rate limit tổng quát */
// Bộ giới hạn theo cửa sổ trượt, dùng cho các API nhạy cảm (đăng ký, xác thực voucher,
// tạo đơn, thanh toán). Key thường là <route>:<ip> hoặc <route>:<email>:<ip>.
// Bộ nhớ trong RAM: đủ dùng cho 1 tiến trình Node; khi chạy nhiều instance hãy
// đặt rate-limit ở tầng reverse proxy (nginx) — đã đề cập trong PRODUCTION_READINESS.md.
const buckets = new Map()
export const _rateBuckets = buckets // cho test kiểm tra được

/**
 * @returns {{allowed:boolean, remaining:number, retryAfter:number}}
 */
export function rateLimit(key, { windowMs = 60_000, max = 30 } = {}) {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || now - b.start >= windowMs) {
    buckets.set(key, { start: now, count: 1 })
    return { allowed: true, remaining: max - 1, retryAfter: 0 }
  }
  b.count += 1
  if (b.count > max) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((b.start + windowMs - now) / 1000) }
  }
  return { allowed: true, remaining: max - b.count, retryAfter: 0 }
}

/** Dọn các bucket đã hết hạn để bộ nhớ không phình vô hạn. */
export function sweepRateBuckets() {
  const now = Date.now()
  for (const [key, b] of buckets) {
    if (now - b.start >= 15 * 60 * 1000) buckets.delete(key)
  }
  for (const [key, a] of attempts) {
    if (now - a.first > WINDOW_MS) attempts.delete(key)
  }
}

/** Middleware sẵn dùng: giới hạn theo IP (+ tuỳ chọn thêm định danh định danh theo body). */
export function rateLimitMiddleware(name, { windowMs = 60_000, max = 30, keyFn } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'
    const key = `${name}:${keyFn ? keyFn(req) : ip}`
    const result = rateLimit(key, { windowMs, max })
    res.set('X-RateLimit-Limit', String(max))
    res.set('X-RateLimit-Remaining', String(Math.max(result.remaining, 0)))
    if (!result.allowed) {
      res.set('Retry-After', String(result.retryAfter))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.' })
    }
    return next()
  }
}
