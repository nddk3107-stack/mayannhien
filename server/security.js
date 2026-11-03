// server/security.js — Security headers, CSP và CORS theo cấu hình thực tế.
// Không thêm dependency (helmet) để giữ bản cài tối giản: các header dưới đây
// đủ cho một website React tĩnh + API JSON, và kiểm soát chính xác hơn.
import { ALLOWED_ORIGINS, IS_PRODUCTION } from './config.js'

/* ------------------------------------------------------------ CSP */
// CSP chặn: script nội tuyến không có nonce, frame bên ngoài, nguồn script lạ.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  // Vite build dùng module script ngoài -> không cần 'unsafe-inline' cho script.
  "script-src 'self'",
  // CSS inline trong <style> của React + style attributes -> cần 'unsafe-inline' cho style.
  "style-src 'self' 'unsafe-inline'",
  // Ảnh từ CDN bên ngoài (ảnh khách sạn/đại lý) và data: avatar.
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  // Kết nối tới API cùng origin; nếu tách domain thì thêm vào connect-src.
  "connect-src 'self'",
  "media-src 'self' https:",
  'upgrade-insecure-requests',
].join('; ')

/**
 * Gắn security headers vào mọi response.
 */
export function securityHeaders(req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff')
  res.set('X-Frame-Options', 'DENY')
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()')
  res.set('Cross-Origin-Opener-Policy', 'same-origin')
  res.set('Cross-Origin-Resource-Policy', 'same-origin')
  res.set('Content-Security-Policy', CSP_DIRECTIVES)
  // HSTS chỉ có ý nghĩa qua HTTPS -> chỉ bật ở production.
  if (IS_PRODUCTION) {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  next()
}

/**
 * CORS theo danh sách domain thực tế.
 * - Nếu ALLOWED_ORIGINS rỗng => KHÔNG gửi header CORS nào (chỉ same-origin hoạt động).
 * - Origin không nằm trong danh sách => chặn (không wildcard).
 */
export function corsGuard(req, res, next) {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.includes(String(origin).replace(/\/+$/, ''))) {
    res.set('Access-Control-Allow-Origin', origin)
    res.set('Access-Control-Allow-Credentials', 'true')
    res.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
    res.set('Access-Control-Allow-Headers', 'Content-Type,X-Requested-With,X-Client-Id')
    res.set('Access-Control-Max-Age', '600')
    res.set('Vary', 'Origin')
  }
  if (req.method === 'OPTIONS') {
    // Preflight: trả 204 nếu origin hợp lệ, 403 nếu không.
    const allowed = !origin || ALLOWED_ORIGINS.includes(String(origin).replace(/\/+$/, ''))
    return res.status(allowed ? 204 : 403).end()
  }
  next()
}
