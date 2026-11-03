// server/config.js — Nạp cấu hình môi trường + các hằng số bảo mật dùng chung.
// KHÔNG thêm dependency: đọc file .env bằng parser tối giản, không ghi log giá trị bí mật.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(here, '..')

/* ------------------------------------------------------------ .env loader */
// Parser .env tối giản: KEY=VALUE, bỏ qua comment (#) và dòng trống.
// Giá trị đã có trong process.env luôn được ưu tiên (biến môi trường thật thắng).
function parseEnvFile(text) {
  const out = {}
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const key = line.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    let value = line.slice(eq + 1).trim()
    // Bóc dấu nháy nếu có
    if ((value.startsWith('"') && value.endsWith('"') && value.length > 1)
      || (value.startsWith("'") && value.endsWith("'") && value.length > 1)) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

export function loadEnvFile(file = path.join(ROOT, '.env')) {
  if (!fs.existsSync(file)) return false
  try {
    const parsed = parseEnvFile(fs.readFileSync(file, 'utf8'))
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) process.env[key] = value
    }
    return true
  } catch (err) {
    // Không được phép để lỗi đọc .env làm sập server, nhưng phải báo rõ.
    console.error('[config] không đọc được .env:', err.message)
    return false
  }
}

loadEnvFile()

/* ----------------------------------------------------------- môi trường */
export const NODE_ENV = process.env.NODE_ENV || 'development'
export const IS_PRODUCTION = NODE_ENV === 'production'
export const PORT = Number(process.env.PORT) || 3001

// Tên miền được phép gọi API từ trình duyệt (dùng cho CORS).
// Rỗng => chỉ cho phép cùng origin (frontend + API sau chung reverse proxy) — mặc định an toàn.
export const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean)

// Số reverse proxy đứng trước app (nginx = 1). KHÔNG đặt `true` ở production:
// `trust proxy: true` khiến client tự giả mạo X-Forwarded-For -> vô hiệu hoá rate-limit.
export const TRUST_PROXY_HOPS = (() => {
  const n = Number(process.env.TRUST_PROXY_HOPS)
  if (Number.isInteger(n) && n >= 0 && n <= 10) return n
  return 0
})()

// Bắt buộc cookie phiên có cờ Secure khi chạy production (HTTPS).
export const FORCE_SECURE_COOKIES = IS_PRODUCTION || process.env.FORCE_SECURE_COOKIES === 'true'

// Bật các đường dẫn chỉ dành cho môi trường phát triển (nhập đơn cũ từ localStorage).
export const ALLOW_LEGACY_IMPORT = process.env.ALLOW_LEGACY_IMPORT === 'true'
  || (!IS_PRODUCTION && process.env.ALLOW_LEGACY_IMPORT !== 'false')

/* ------------------------------------------------------------------ MoMo */
// Trạng thái cổng thanh toán: 'disabled' | 'sandbox' | 'production'.
// Chỉ 'sandbox'/'production' khi CÓ đủ partnerCode + accessKey + secretKey.
export const MOMO_ENV = (process.env.MOMO_ENV || 'disabled').toLowerCase()
export const MOMO_CONFIG = {
  env: MOMO_ENV,
  partnerCode: process.env.MOMO_PARTNER_CODE || '',
  accessKey: process.env.MOMO_ACCESS_KEY || '',
  secretKey: process.env.MOMO_SECRET_KEY || '',
  // endpoint theo môi trường (theo tài liệu/SDK chính thức của MoMo)
  createUrl: process.env.MOMO_CREATE_URL
    || (MOMO_ENV === 'production'
      ? 'https://payment.momo.vn/v2/gateway/api/create'
      : 'https://test-payment.momo.vn/v2/gateway/api/create'),
  queryUrl: process.env.MOMO_QUERY_URL
    || (MOMO_ENV === 'production'
      ? 'https://payment.momo.vn/v2/gateway/api/query'
      : 'https://test-payment.momo.vn/v2/gateway/api/query'),
  returnUrl: process.env.MOMO_RETURN_URL || '',
  ipnUrl: process.env.MOMO_IPN_URL || '',
  // Cờ cho phép backend nhận tiền thật (mặc định tắt cho tới khi có credentials hợp lệ).
  allowLive: process.env.MOMO_ALLOW_LIVE === 'true',
}

/** Cổng thanh toán có dùng được không (đủ cấu hình + không phải 'disabled'). */
export const MOMO_ENABLED = MOMO_CONFIG.env !== 'disabled'
  && !!MOMO_CONFIG.partnerCode && !!MOMO_CONFIG.accessKey && !!MOMO_CONFIG.secretKey

/**
 * Thanh toán THẬT chỉ được bật khi: môi trường production của MoMo + cờ allowLive.
 * Sandbox KHÔNG BAO GIỜ được coi là tiền thật.
 */
export const MOMO_LIVE_ENABLED = MOMO_ENABLED
  && MOMO_CONFIG.env === 'production'
  && MOMO_CONFIG.allowLive === true
  && MOMO_CONFIG.returnUrl.startsWith('https://')
  && MOMO_CONFIG.ipnUrl.startsWith('https://')

/* ----------------------------------------------------------- tiện ích */
export const envBool = (v, fallback = false) => {
  if (v === undefined || v === null || v === '') return fallback
  return v === 'true' || v === '1' || v === true
}
