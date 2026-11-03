// server/db.js — Tầng dữ liệu SQLite (node:sqlite, có sẵn từ Node 22.5+, không cần dependency ngoài).
import { DatabaseSync } from 'node:sqlite'
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import { DEFAULT_FLIGHTS, DEFAULT_HOTELS, DEFAULT_PROMOTIONS, DEFAULT_COMBOS, DEFAULT_ROOMS } from './data.js'
import { ROOT } from './config.js'

// Đường dẫn DB: luôn resolve thành đường dẫn TUYỆT ĐỐI để không phụ thuộc thư mục
// làm việc hiện tại (quan trọng khi chạy dưới systemd với WorkingDirectory khác).
// Mặc định nằm trong <repo>/data/ — đây là ổ đĩa bền vững, KHÔNG phải /tmp.
export const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(ROOT, 'data', 'mayan.db')

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

export const db = new DatabaseSync(DB_PATH)

db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 10000;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name          TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash   TEXT NOT NULL UNIQUE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at   TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    last_seen_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS hotels (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    location    TEXT NOT NULL,
    rating      REAL NOT NULL DEFAULT 0,
    stars       INTEGER NOT NULL DEFAULT 3,
    price       INTEGER NOT NULL CHECK (price > 0),
    has_promo   INTEGER NOT NULL DEFAULT 0,
    image       TEXT NOT NULL DEFAULT '',
    perks       TEXT NOT NULL DEFAULT '[]',
    description TEXT NOT NULL DEFAULT '',
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS flights (
    id         TEXT PRIMARY KEY,
    airline    TEXT NOT NULL,
    logo       TEXT NOT NULL DEFAULT '',
    origin     TEXT NOT NULL,
    dest       TEXT NOT NULL,
    depart     TEXT NOT NULL,
    arrive     TEXT NOT NULL,
    duration   TEXT NOT NULL,
    price      INTEGER NOT NULL CHECK (price > 0),
    tag        TEXT NOT NULL DEFAULT '',
    has_promo  INTEGER NOT NULL DEFAULT 0,
    is_active  INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS combos (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    hotel_id       TEXT NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
    flight_id      TEXT NOT NULL REFERENCES flights(id) ON DELETE RESTRICT,
    saving         INTEGER NOT NULL DEFAULT 450000,
    price_override INTEGER,
    description    TEXT NOT NULL DEFAULT '',
    image          TEXT NOT NULL DEFAULT '',
    valid_from     TEXT,
    valid_to       TEXT,
    is_active      INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS promotions (
    id          TEXT PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE COLLATE NOCASE,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    applies_to  TEXT NOT NULL DEFAULT 'combo',
    rate        REAL NOT NULL CHECK (rate >= 0 AND rate <= 1),
    color       TEXT NOT NULL DEFAULT 'blue',
    active_from TEXT,
    active_to   TEXT,
    usage_limit INTEGER,
    used_count  INTEGER NOT NULL DEFAULT 0,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    code            TEXT NOT NULL UNIQUE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    service_type    TEXT NOT NULL CHECK (service_type IN ('flight','hotel','combo')),
    item_id         TEXT NOT NULL,
    title           TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'Đã xác nhận'
                    CHECK (status IN ('Đã tạo','Chờ thanh toán','Đã thanh toán','Đã xác nhận','Đã hủy')),
    payment_method  TEXT NOT NULL DEFAULT '',
    payment_status  TEXT NOT NULL DEFAULT 'simulated'
                    CHECK (payment_status IN ('pending','simulated','paid','refunded')),
    traveler_name   TEXT NOT NULL,
    traveler_phone  TEXT NOT NULL,
    traveler_email  TEXT NOT NULL,
    email           TEXT NOT NULL,
    passengers      INTEGER NOT NULL DEFAULT 1,
    promo_code      TEXT NOT NULL DEFAULT 'Không dùng',
    unit_price      INTEGER NOT NULL DEFAULT 0,
    discount        INTEGER NOT NULL DEFAULT 0,
    total           INTEGER NOT NULL DEFAULT 0,
    destination     TEXT NOT NULL DEFAULT '',
    trip_type       TEXT NOT NULL DEFAULT '',
    depart_date     TEXT,
    return_date     TEXT,
    idempotency_key TEXT,
    client_id       TEXT,
    legacy          INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (user_id, idempotency_key)
  );
  CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
`)

/* ------------------------------------------------- thanh toán & audit log */
// Bảng payment_attempts: MỖI lần thử thanh toán (MoMo) gắn với 1 booking.
// Bảng payment_transactions: lịch sử trạng thái giao dịch (đủ để điều tra lỗi,
// nhưng KHÔNG lưu dữ liệu nhạy cảm không cần thiết — không lưu CVV, không lưu card).
// Bảng audit_log: nhật ký thao tác quản trị và sự kiện thanh toán.
db.exec(`
  CREATE TABLE IF NOT EXISTS payment_attempts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_code  TEXT NOT NULL,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider      TEXT NOT NULL DEFAULT 'momo',
    order_id      TEXT NOT NULL UNIQUE,
    request_id    TEXT NOT NULL,
    amount        INTEGER NOT NULL,
    status        TEXT NOT NULL DEFAULT 'created'
                  CHECK (status IN ('created','redirected','paid','failed','expired')),
    trans_id      TEXT,
    env           TEXT NOT NULL DEFAULT 'sandbox',
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_pay_attempts_booking ON payment_attempts(booking_code);
  CREATE INDEX IF NOT EXISTS idx_pay_attempts_user ON payment_attempts(user_id);

  CREATE TABLE IF NOT EXISTS payment_transactions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id      TEXT NOT NULL,
    booking_code  TEXT,
    status        TEXT NOT NULL,
    amount        INTEGER,
    trans_id      TEXT,
    result_code   TEXT,
    source        TEXT NOT NULL DEFAULT 'ipn',
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_pay_tx_order ON payment_transactions(order_id);

  CREATE TABLE IF NOT EXISTS audit_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id      INTEGER,
    actor_email   TEXT NOT NULL DEFAULT '',
    action        TEXT NOT NULL,
    entity_type   TEXT NOT NULL DEFAULT '',
    entity_id     TEXT NOT NULL DEFAULT '',
    detail        TEXT NOT NULL DEFAULT '',
    ip            TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
`)

/* ---------------------------------------------------------------- rooms */
// Bảng phòng của khách sạn — thêm MỚI, không đụng dữ liệu cũ.
// Migration cho database đã chạy từ bản trước: thêm cột bằng ALTER TABLE an toàn.
function ensureColumn(table, column, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name)
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`)
}

db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id                TEXT PRIMARY KEY,
    hotel_id          TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    price             INTEGER NOT NULL CHECK (price > 0),
    bed_type          TEXT NOT NULL DEFAULT '',
    size_sqm          INTEGER,
    max_adults        INTEGER NOT NULL DEFAULT 2,
    max_children      INTEGER NOT NULL DEFAULT 0,
    amenities         TEXT NOT NULL DEFAULT '[]',
    images            TEXT NOT NULL DEFAULT '[]',
    breakfast         INTEGER NOT NULL DEFAULT 0,
    free_cancellation INTEGER NOT NULL DEFAULT 0,
    checkin_time      TEXT NOT NULL DEFAULT '14:00',
    checkout_time     TEXT NOT NULL DEFAULT '12:00',
    is_active         INTEGER NOT NULL DEFAULT 1,
    created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_rooms_hotel ON rooms(hotel_id, is_active);
`)

// Migration dữ liệu cũ (bỏ qua lỗi nếu cột đã tồn tại từ lần chạy trước).
try {
  // Đơn hàng: thông tin phòng đặt (chỉ khách sạn mới dùng; vé bay/combo để 0/'' rỗng).
  ensureColumn('bookings', 'room_id', 'TEXT')
  ensureColumn('bookings', 'room_name', 'TEXT')
  ensureColumn('bookings', 'nights', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('bookings', 'rooms_count', 'INTEGER NOT NULL DEFAULT 1')
  ensureColumn('bookings', 'adults', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('bookings', 'children', 'INTEGER NOT NULL DEFAULT 0')
  // Idempotency chống ghi trùng + cột đánh dấu đơn không định giá được (legacy).
  ensureColumn('bookings', 'idempotency_key', 'TEXT')
  ensureColumn('bookings', 'client_id', 'TEXT')
  ensureColumn('bookings', 'legacy', 'INTEGER NOT NULL DEFAULT 0')
  // Voucher: giá trị đơn tối thiểu để áp dụng mã (0 = không giới hạn).
  ensureColumn('promotions', 'min_order', 'INTEGER NOT NULL DEFAULT 0')

  // Users: cột số điện thoại (dùng cho đăng ký / liên hệ).
  try {
    const userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name)
    if (!userCols.includes('phone')) {
      db.exec(`ALTER TABLE users ADD COLUMN phone TEXT`)
    }
  } catch (err) {
    console.error('[db] migration thêm cột phone thất bại:', err.message)
  }
} catch (err) {
  console.error('[db] migration thêm cột thất bại:', err.message)
}

/* ---------------------------------------------------------------- password */
// scrypt (memory-hard KDF có sẵn của Node) — không thêm dependency, không để lộ secret ra frontend.
// Định dạng lưu: scrypt$N$r$p$saltBase64$hashBase64
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 }

export async function hashPassword(plain) {
  const salt = randomBytes(16)
  const derived = await new Promise((resolve, reject) => {
    scrypt(String(plain), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p },
      (err, buf) => (err ? reject(err) : resolve(buf)))
  })
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${derived.toString('base64')}`
}

export async function verifyPassword(plain, stored) {
  try {
    const [scheme, n, r, p, saltB64, hashB64] = String(stored || '').split('$')
    if (scheme !== 'scrypt') return false
    const salt = Buffer.from(saltB64, 'base64')
    const expected = Buffer.from(hashB64, 'base64')
    const derived = await new Promise((resolve, reject) => {
      scrypt(String(plain), salt, expected.length, { N: Number(n), r: Number(r), p: Number(p) },
        (err, buf) => (err ? reject(err) : resolve(buf)))
    })
    return derived.length === expected.length && timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ users */
export const findUserByEmail = (email) =>
  db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(String(email || '').trim())

export const findUserById = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(Number(id))

export function createUser({ email, name, passwordHash, role = 'user', phone = '' }) {
  const info = db
    .prepare('INSERT INTO users (email, name, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)')
    .run(String(email).trim(), String(name).trim(), passwordHash, role, String(phone || '').trim())
  return findUserById(Number(info.lastInsertRowid))
}

// Frontend KHÔNG BAO GIỜ nhận password_hash — chỉ các trường an toàn.
export const publicUser = (u) =>
  u && { id: u.id, email: u.email, name: u.name, role: u.role, isActive: !!u.is_active, createdAt: u.created_at }

/* --------------------------------------------------------------- sessions */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 ngày
const sha256 = (s) => createHash('sha256').update(s).digest('hex')

export function createSession(userId) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, last_seen_at) VALUES (?, ?, ?, ?)')
    .run(sha256(token), Number(userId), expiresAt, new Date().toISOString())
  return { token, expiresAt }
}

export function findSessionUser(token) {
  if (!token) return null
  const row = db
    .prepare(`SELECT u.*, s.expires_at AS session_expires_at
              FROM sessions s JOIN users u ON u.id = s.user_id
              WHERE s.token_hash = ?`)
    .get(sha256(String(token)))
  if (!row) return null
  if (new Date(row.session_expires_at).getTime() < Date.now()) return null
  return { id: row.id, email: row.email, name: row.name, role: row.role, is_active: row.is_active, session_expires_at: row.session_expires_at }
}

export function touchSession(token) {
  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?')
    .run(new Date().toISOString(), sha256(String(token || '')))
}

export function deleteSession(token) {
  if (!token) return
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(String(token)))
}

// Khi admin tắt tài khoản: đăng xuất ngay mọi phiên đang hoạt động của user đó.
export function deleteSessionsOfUser(userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(Number(userId))
}



/* ------------------------------------------------------------ catalog map */
// DB dùng tên cột khác (origin/dest/description...) — map về đúng shape mà
// frontend hiện đang dùng để không phải đổi hàng chục chỗ trong UI.
export const hotelOut = (r) =>
  r && {
    id: r.id, name: r.name, location: r.location, rating: r.rating, stars: r.stars,
    price: r.price, hasPromo: !!r.has_promo, image: r.image,
    perks: JSON.parse(r.perks || '[]'), description: r.description, isActive: !!r.is_active,
  }

export const flightOut = (r) =>
  r && {
    id: r.id, airline: r.airline, logo: r.logo, from: r.origin, to: r.dest,
    depart: r.depart, arrive: r.arrive, duration: r.duration, price: r.price,
    tag: r.tag, hasPromo: !!r.has_promo, isActive: !!r.is_active,
  }

export const promoOut = (r) =>
  r && {
    id: r.id, code: r.code, title: r.code, desc: r.description, description: r.description,
    color: r.color, rate: r.rate, appliesTo: String(r.applies_to || '').split(',').filter(Boolean),
    usageLimit: r.usage_limit, usedCount: r.used_count, activeFrom: r.active_from,
    activeTo: r.active_to, isActive: !!r.is_active, minOrder: Number(r.min_order) || 0,
  }

// Combo: giá = khách sạn + chuyến bay − mức giảm (hoặc giá ghi đè của admin).
export function comboOut(row, hotelRow, flightRow) {
  if (!row || !hotelRow || !flightRow) return null
  const price = row.price_override != null
    ? row.price_override
    : hotelRow.price + flightRow.price - row.saving
  return {
    id: row.id, name: row.name, saving: row.saving, price,
    hotelId: row.hotel_id, flightId: row.flight_id, description: row.description,
    validFrom: row.valid_from, validTo: row.valid_to, isActive: !!row.is_active,
    hasPromo: !!hotelRow.has_promo,
    // Các trường thừa kế từ khách sạn để trang Combo dùng lại HotelCard:
    location: hotelRow.location, rating: hotelRow.rating, stars: hotelRow.stars,
    image: row.image || hotelRow.image, perks: JSON.parse(hotelRow.perks || '[]'),
  }
}

export function listHotels(includeInactive = false) {
  const sql = includeInactive
    ? 'SELECT * FROM hotels ORDER BY rowid'
    : 'SELECT * FROM hotels WHERE is_active = 1 ORDER BY rowid'
  return db.prepare(sql).all().map(hotelOut)
}

export function listFlights(includeInactive = false) {
  const sql = includeInactive
    ? 'SELECT * FROM flights ORDER BY rowid'
    : 'SELECT * FROM flights WHERE is_active = 1 ORDER BY rowid'
  return db.prepare(sql).all().map(flightOut)
}

// Combo chỉ hiển thị khi CẢ combo, khách sạn lẫn chuyến bay đang còn kinh doanh.
export function listCombos(includeInactive = false) {
  const sql = includeInactive
    ? 'SELECT * FROM combos ORDER BY rowid'
    : `SELECT c.* FROM combos c
       JOIN hotels h ON h.id = c.hotel_id
       JOIN flights f ON f.id = c.flight_id
       WHERE c.is_active = 1 AND h.is_active = 1 AND f.is_active = 1
       ORDER BY c.rowid`
  return db.prepare(sql).all()
    .map((row) => comboOut(row,
      db.prepare('SELECT * FROM hotels WHERE id = ?').get(row.hotel_id),
      db.prepare('SELECT * FROM flights WHERE id = ?').get(row.flight_id)))
    .filter(Boolean)
}


export const listPromotions = (includeInactive = false) => {
  const sql = includeInactive
    ? 'SELECT * FROM promotions ORDER BY rowid'
    : 'SELECT * FROM promotions WHERE is_active = 1 ORDER BY rowid'
  return db.prepare(sql).all().map(promoOut)
}

/* ---------------------------------------------------------------- rooms */
export const roomOut = (r) =>
  r && {
    id: r.id, hotelId: r.hotel_id, name: r.name, price: r.price,
    bedType: r.bed_type, sizeSqm: r.size_sqm, maxAdults: r.max_adults,
    maxChildren: r.max_children, amenities: JSON.parse(r.amenities || '[]'),
    images: JSON.parse(r.images || '[]'), breakfast: !!r.breakfast,
    freeCancellation: !!r.free_cancellation, checkinTime: r.checkin_time,
    checkoutTime: r.checkout_time, isActive: !!r.is_active,
  }

export function listRooms(includeInactive = false) {
  const sql = includeInactive
    ? 'SELECT * FROM rooms ORDER BY rowid'
    : 'SELECT * FROM rooms WHERE is_active = 1 ORDER BY rowid'
  return db.prepare(sql).all().map(roomOut)
}

export const roomsForHotel = (hotelId) =>
  db.prepare('SELECT * FROM rooms WHERE hotel_id = ? AND is_active = 1 ORDER BY rowid')
    .all(String(hotelId)).map(roomOut)

// Khách sạn admin tạo sau này chưa có phòng -> sinh 2 phòng mặc định từ giá khách sạn.
// Tiện nghi 2 loại phòng KHÁC NHAU; bữa sáng/hủy lấy từ perks của khách sạn (dữ liệu nguồn).
function generateDefaultRooms(hotel) {
  const base = Math.max(Number(hotel.price) || 1000000, 100000)
  let perks = []
  try { perks = JSON.parse(hotel.perks || '[]') } catch { perks = [] }
  const breakfast = perks.some((p) => /ăn sáng/i.test(p)) ? 1 : 0
  const freeCancel = perks.some((p) => /hủy/i.test(p)) ? 1 : 0
  return [
    {
      id: `room-${hotel.id}-std`, hotelId: hotel.id,
      name: 'Phòng Tiêu chuẩn', price: base,
      bedType: 'Giường queen', sizeSqm: 24, maxAdults: 2, maxChildren: 1,
      breakfast, freeCancellation: freeCancel, checkinTime: '14:00', checkoutTime: '12:00',
      amenities: ['Điều hòa', 'TV màn hình phẳng', 'Vòi hoa sen', 'Khăn tắm', 'Wi-Fi miễn phí', 'Bàn làm việc'],
      images: [],
    },
    {
      id: `room-${hotel.id}-dlx`, hotelId: hotel.id,
      name: 'Phòng Cao cấp', price: Math.round((base * 1.45) / 10000) * 10000,
      bedType: 'Giường king', sizeSqm: 36, maxAdults: 3, maxChildren: 2,
      breakfast, freeCancellation: freeCancel, checkinTime: '14:00', checkoutTime: '12:00',
      amenities: ['Giường king', 'Bồn tắm', 'Minibar', 'Két sắt', 'Máy sấy tóc', 'Wi-Fi miễn phí', 'Ấm đun nước'],
      images: [],
    },
  ]
}

// Seed phòng cho mọi khách sạn chưa có (DB cũ + khách sạn admin tạo sau) — idempotent.
export function seedRooms() {
  const hotels = db.prepare('SELECT * FROM hotels').all()
  const insert = db.prepare(`INSERT INTO rooms (id, hotel_id, name, price, bed_type, size_sqm,
      max_adults, max_children, amenities, images, breakfast, free_cancellation, checkin_time, checkout_time)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  let inserted = 0
  db.exec('BEGIN')
  try {
    for (const hotel of hotels) {
      if (db.prepare('SELECT 1 FROM rooms WHERE hotel_id = ?').get(hotel.id)) continue
      const rows = DEFAULT_ROOMS.filter((room) => room.hotelId === hotel.id)
      const list = rows.length ? rows : generateDefaultRooms(hotel)
      for (const room of list) {
        insert.run(room.id, hotel.id, room.name, room.price, room.bedType, room.sizeSqm ?? null,
          room.maxAdults, room.maxChildren, JSON.stringify(room.amenities), JSON.stringify(room.images),
          room.breakfast ? 1 : 0, room.freeCancellation ? 1 : 0, room.checkinTime, room.checkoutTime)
        inserted += 1
      }
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return inserted
}

/* ------------------------------------------------------------------ seed */
const countRows = (table) => db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c

// Seed dữ liệu mặc định MỘT LẦN khi DB mới tạo; admin đã xóa thì không seed lại.
export function seedCatalogIfEmpty() {
  db.exec("CREATE TABLE IF NOT EXISTS seed_meta (key TEXT PRIMARY KEY, value TEXT)")
  if (db.prepare("SELECT value FROM seed_meta WHERE key = 'catalog'").get()) return false

  db.exec('BEGIN')
  try {
    if (countRows('hotels') === 0) {
      const st = db.prepare(`INSERT INTO hotels (id, name, location, rating, stars, price, has_promo, image, perks, description)
                             VALUES (?,?,?,?,?,?,?,?,?,?)`)
      for (const h of DEFAULT_HOTELS)
        st.run(h.id, h.name, h.location, h.rating, h.stars, h.price, h.hasPromo ? 1 : 0, h.image,
          JSON.stringify(h.perks), h.description)
    }
    if (countRows('flights') === 0) {
      const st = db.prepare(`INSERT INTO flights (id, airline, logo, origin, dest, depart, arrive, duration, price, tag, has_promo)
                             VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      for (const f of DEFAULT_FLIGHTS)
        st.run(f.id, f.airline, f.logo, f.from, f.to, f.depart, f.arrive, f.duration, f.price, f.tag, f.hasPromo ? 1 : 0)
    }
    if (countRows('promotions') === 0) {
      const st = db.prepare(`INSERT INTO promotions (id, code, title, description, applies_to, rate, color, usage_limit)
                             VALUES (?,?,?,?,?,?,?,?)`)
      for (const p of DEFAULT_PROMOTIONS)
        st.run(p.id, p.code, p.code, p.description, p.appliesTo.join(','), p.rate, p.color, p.usageLimit)
    }
    if (countRows('combos') === 0) {
      const st = db.prepare(`INSERT INTO combos (id, name, hotel_id, flight_id, saving, price_override, description, image)
                             VALUES (?,?,?,?,?,?,?,?)`)
      for (const c of DEFAULT_COMBOS)
        st.run(c.id, c.name, c.hotelId, c.flightId, c.saving, c.priceOverride, c.description, c.image)
    }
    db.prepare("INSERT OR REPLACE INTO seed_meta (key, value) VALUES ('catalog', ?)").run(new Date().toISOString())
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return true
}

/* ----------------------------------------------------- payment & audit API */
// Ghi nhật ký hành động — KHÔNG ghi secret, mật khẩu, accessKey hay secretKey.
export function writeAuditLog({ actorId = null, actorEmail = '', action, entityType = '', entityId = '', detail = '', ip = '' }) {
  try {
    db.prepare(`INSERT INTO audit_log (actor_id, actor_email, action, entity_type, entity_id, detail, ip)
                VALUES (?,?,?,?,?,?,?)`)
      .run(actorId, String(actorEmail || ''), String(action), String(entityType), String(entityId),
        String(detail).slice(0, 500), String(ip).slice(0, 64))
  } catch (err) {
    // Audit log KHÔNG được làm hỏng luồng nghiệp vụ chính.
    console.error('[audit] ghi log thất bại:', err.message)
  }
}

// Tạo lần thử thanh toán (mỗi lần có orderId/requestId riêng, không trùng).
export function createPaymentAttempt({ bookingCode, userId, orderId, requestId, amount, env }) {
  db.prepare(`INSERT INTO payment_attempts (booking_code, user_id, provider, order_id, request_id, amount, status, env)
              VALUES (?,?,?,?,?,?,?,?)`)
    .run(bookingCode, Number(userId), 'momo', orderId, requestId, Number(amount), 'created', env)
  return db.prepare('SELECT * FROM payment_attempts WHERE order_id = ?').get(orderId)
}

export const getPaymentAttempt = (orderId) =>
  db.prepare('SELECT * FROM payment_attempts WHERE order_id = ?').get(String(orderId || ''))

export const listPaymentAttempts = (bookingCode) =>
  db.prepare('SELECT * FROM payment_attempts WHERE booking_code = ? ORDER BY id DESC').all(String(bookingCode || ''))

export function updatePaymentAttempt(orderId, { status, transId } = {}) {
  const cur = getPaymentAttempt(orderId)
  if (!cur) return null
  const nextStatus = status || cur.status
  const nextTrans = transId === undefined ? cur.trans_id : transId
  db.prepare(`UPDATE payment_attempts SET status = ?, trans_id = ?,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE order_id = ?`)
    .run(nextStatus, nextTrans, orderId)
  return getPaymentAttempt(orderId)
}

// Lịch sử trạng thái giao dịch — dùng để điều tra, KHÔNG chứa dữ liệu nhạy cảm.
export function recordPaymentTransaction({ orderId, bookingCode, status, amount, transId, resultCode, source = 'ipn' }) {
  try {
    db.prepare(`INSERT INTO payment_transactions (order_id, booking_code, status, amount, trans_id, result_code, source)
                VALUES (?,?,?,?,?,?,?)`)
      .run(String(orderId || ''), bookingCode ? String(bookingCode) : null, String(status),
        amount == null ? null : Number(amount), transId ? String(transId) : null,
        resultCode == null ? null : String(resultCode), String(source))
  } catch (err) {
    console.error('[payment] ghi lịch sử giao dịch thất bại:', err.message)
  }
}

export const listPaymentTransactions = (orderId) =>
  db.prepare('SELECT * FROM payment_transactions WHERE order_id = ? ORDER BY id ASC').all(String(orderId || ''))

export const listAuditLog = (limit = 100) =>
  db.prepare(`SELECT id, actor_id, actor_email, action, entity_type, entity_id, detail, ip, created_at
              FROM audit_log ORDER BY id DESC LIMIT ?`).all(Math.min(Math.max(Number(limit) || 100, 1), 500))
