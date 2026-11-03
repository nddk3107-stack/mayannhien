#!/usr/bin/env node
// scripts/backup-db.mjs — Sao lưu SQLite an toàn + kiểm tra khôi phục.
//
// VÌ SAO KHÔNG DÙNG `cp mayan.db backup.db`:
//   SQLite ở chế độ WAL có thể đang ghi -> copy thẳng file .db có thể tạo
//   bản sao không nhất quán. Script này dùng cơ chế backup chính thức của
//   SQLite (VACUUM INTO) -> tạo file .db hoàn chỉnh, nhất quán, tại thời điểm copy.
//
// Cách dùng:
//   npm run backup                     # sao lưu vào thư mục backup/
//   npm run backup -- --out /var/backups/mayan
//   npm run backup:restore-test        # sao lưu RỒI khôi phục thử vào file tạm để xác minh
//
// Tự động hoá (cron/systemd timer) — ví dụ crontab:
//   0 2 * * * cd /var/www/mayan && /usr/bin/node scripts/backup-db.mjs >> /var/log/mayan-backup.log 2>&1
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DB_PATH = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(ROOT, 'data', 'mayan.db')

const arg = (name, fallback = '') => {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const has = (name) => process.argv.includes('--' + name)

const OUT_DIR = path.resolve(arg('out', path.join(ROOT, 'backup')))
const KEEP = Number(arg('keep', '14'))
const VERIFY = has('verify-restore')

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const target = path.join(OUT_DIR, `mayan-${stamp()}.db`)

if (!fs.existsSync(DB_PATH)) {
  console.error(`[backup] KHÔNG tìm thấy database: ${DB_PATH}`)
  process.exit(1)
}
fs.mkdirSync(OUT_DIR, { recursive: true })

// --- 1) Tạo bản sao nhất quán bằng VACUUM INTO (API chính thức của SQLite) ---
const db = new DatabaseSync(DB_PATH, { readOnly: true })
try {
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`)
} catch (err) {
  console.error('[backup] VACUUM INTO thất bại:', err.message)
  process.exit(1)
} finally {
  db.close()
}
const size = fs.statSync(target).size
console.log(`[backup] Đã sao lưu: ${target} (${(size / 1024).toFixed(1)} KB)`)

// --- 2) Kiểm tra file backup mở được và có bảng chính ---
function verify(file) {
  const check = new DatabaseSync(file, { readOnly: true })
  try {
    const users = check.prepare('SELECT COUNT(*) AS c FROM users').get().c
    const bookings = check.prepare('SELECT COUNT(*) AS c FROM bookings').get().c
    const integrity = check.prepare('PRAGMA integrity_check').get()
    const ok = Object.values(integrity)[0] === 'ok'
    return { ok, users, bookings, integrity: Object.values(integrity)[0] }
  } finally {
    check.close()
  }
}

let result
try {
  result = verify(target)
} catch (err) {
  console.error('[backup] File backup KHÔNG đọc được:', err.message)
  process.exit(1)
}
if (!result.ok) {
  console.error(`[backup] integrity_check thất bại: ${result.integrity}`)
  process.exit(1)
}
console.log(`[backup] integrity_check OK — users=${result.users}, bookings=${result.bookings}`)

// --- 3) Kiểm tra khôi phục thật (copy file backup -> DB tạm -> đọc dữ liệu) ---
if (VERIFY) {
  const restoreTo = path.join(OUT_DIR, `restore-test-${Date.now()}.db`)
  fs.copyFileSync(target, restoreTo)
  let restored
  try {
    restored = verify(restoreTo)
  } catch (err) {
    console.error('[backup] KHÔI PHỤC THỬ THẤT BẠI:', err.message)
    fs.rmSync(restoreTo, { force: true })
    process.exit(1)
  }
  if (!restored.ok) {
    console.error('[backup] Bản khôi phục không hợp lệ.')
    fs.rmSync(restoreTo, { force: true })
    process.exit(1)
  }
  console.log(`[backup] KHÔI PHỤC THỬ THÀNH CÔNG — users=${restored.users}, bookings=${restored.bookings}`)
  fs.rmSync(restoreTo, { force: true })
}

// --- 4) Dọn bản sao cũ, giữ lại KEEP bản mới nhất ---
const files = fs.readdirSync(OUT_DIR)
  .filter((f) => /^mayan-.*\.db$/.test(f))
  .map((f) => path.join(OUT_DIR, f))
  .sort()
  .reverse()
const expired = files.slice(KEEP)
for (const file of expired) {
  try { fs.rmSync(file, { force: true }); console.log(`[backup] Đã xoá bản sao cũ: ${path.basename(file)}`) } catch { /* bỏ qua */ }
}
console.log(`[backup] Giữ lại ${Math.min(KEEP, files.length)} bản sao gần nhất trong ${OUT_DIR}`)
console.log('[backup] HOÀN TẤT')
