// server/db.js — Tầng dữ liệu SQLite (node:sqlite, có sẵn từ Node 22.5+, không cần dependency ngoài).
import { DatabaseSync } from 'node:sqlite'
import { createHash, randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import { DEFAULT_FLIGHTS, DEFAULT_HOTELS, DEFAULT_PROMOTIONS, DEFAULT_COMBOS, DEFAULT_ROOMS, DEFAULT_EXTRA_SERVICES, DEFAULT_REVIEWS } from './data.js'
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
    role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','staff','admin')),
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
    service_type    TEXT NOT NULL CHECK (service_type IN ('flight','hotel','combo','activity','car','bus','train','insurance')),
    item_id         TEXT NOT NULL,
    title           TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'Đã xác nhận'
                    CHECK (status IN ('Đã tạo','Chờ thanh toán','Đã thanh toán','Đã xác nhận','Đã hủy','checked_in')),
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

  /* ---------------------------------------------------- Task 1: tables */
  CREATE TABLE IF NOT EXISTS flight_seats (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    flight_id   TEXT NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
    seat_code   TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','locked','booked')),
    booking_id  INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE(flight_id, seat_code)
  );
  CREATE INDEX IF NOT EXISTS idx_flight_seats_lookup ON flight_seats(flight_id, status);

  CREATE TABLE IF NOT EXISTS extra_services (
    id            TEXT PRIMARY KEY,
    category      TEXT NOT NULL CHECK (category IN ('tour','airport_transfer','bus','train','insurance','activity','car')),
    name          TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    price         INTEGER NOT NULL CHECK (price >= 0),
    metadata_json TEXT NOT NULL DEFAULT '{}',
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_extra_services_cat ON extra_services(category, is_active);

  CREATE TABLE IF NOT EXISTS reviews (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    hotel_id    TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_name   TEXT NOT NULL DEFAULT '',
    type        TEXT NOT NULL DEFAULT 'review' CHECK (type IN ('review','feedback')),
    category    TEXT NOT NULL DEFAULT '',
    rating      INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment     TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_reviews_hotel ON reviews(hotel_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS password_resets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    otp         TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    used        INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_pw_resets ON password_resets(email, used);

  CREATE TABLE IF NOT EXISTS notifications (
    id          TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'system' CHECK (type IN ('payment','booking','system','promo')),
    is_read     INTEGER NOT NULL DEFAULT 0,
    link        TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
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
  ensureColumn('bookings', 'seat_code', 'TEXT')
  ensureColumn('bookings', 'checked_in_at', 'TEXT')
  ensureColumn('bookings', 'checked_in_by', 'TEXT')
  // Idempotency chống ghi trùng + cột đánh dấu đơn không định giá được (legacy).
  ensureColumn('bookings', 'idempotency_key', 'TEXT')
  ensureColumn('bookings', 'client_id', 'TEXT')
  ensureColumn('bookings', 'legacy', 'INTEGER NOT NULL DEFAULT 0')
  // Voucher: giá trị đơn tối thiểu để áp dụng mã (0 = không giới hạn).
  ensureColumn('promotions', 'min_order', 'INTEGER NOT NULL DEFAULT 0')
  // Khách sạn: tọa độ GPS và tên thành phố phục vụ định vị vị trí trực tiếp
  ensureColumn('hotels', 'lat', 'REAL')
  ensureColumn('hotels', 'lng', 'REAL')
  ensureColumn('hotels', 'city', 'TEXT')
  try {
    for (const h of DEFAULT_HOTELS) {
      if (h.lat != null && h.lng != null) {
        db.prepare('UPDATE hotels SET lat = ?, lng = ?, city = ? WHERE id = ? AND (lat IS NULL OR lat = 0)').run(h.lat, h.lng, h.city || '', h.id)
      }
    }
  } catch { /* bỏ qua */ }

  // Users: cột số điện thoại, số dư, avatar, loyalty, tier, token_version
  try {
    const userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name)
    if (!userCols.includes('phone')) {
      db.exec(`ALTER TABLE users ADD COLUMN phone TEXT`)
    }
    if (!userCols.includes('balance')) {
      db.exec(`ALTER TABLE users ADD COLUMN balance INTEGER NOT NULL DEFAULT 0`)
    }
    if (!userCols.includes('avatar_url')) {
      db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT`)
    }
    if (!userCols.includes('loyalty_points')) {
      db.exec(`ALTER TABLE users ADD COLUMN loyalty_points INTEGER NOT NULL DEFAULT 0`)
    }
    if (!userCols.includes('total_spent')) {
      db.exec(`ALTER TABLE users ADD COLUMN total_spent INTEGER NOT NULL DEFAULT 0`)
    }
    if (!userCols.includes('member_tier')) {
      db.exec(`ALTER TABLE users ADD COLUMN member_tier TEXT NOT NULL DEFAULT 'Thành viên'`)
    }
    if (!userCols.includes('token_version')) {
      db.exec(`ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1`)
    }
  } catch (err) {
    console.error('[db] migration thêm cột users thất bại:', err.message)
  }

  // Bảng saved_passengers (Hành khách đã lưu)
  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_passengers (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      full_name    TEXT NOT NULL,
      dob          TEXT,
      gender       TEXT CHECK (gender IN ('male', 'female', 'other') OR gender IS NULL),
      nationality  TEXT DEFAULT 'Việt Nam',
      id_number    TEXT,
      phone        TEXT,
      label        TEXT,
      created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_saved_passengers_user ON saved_passengers(user_id);
  `)

  // Bảng ví và lịch sử nạp/trừ tiền ví người dùng
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type           TEXT NOT NULL CHECK (type IN ('deposit', 'payment', 'refund')),
      amount         INTEGER NOT NULL,
      balance_after  INTEGER NOT NULL,
      order_id       TEXT,
      booking_code   TEXT,
      reference_code TEXT,
      description    TEXT,
      created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_wallet_user ON wallet_transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_wallet_ref ON wallet_transactions(reference_code);
  `)
  // Mở rộng CHECK constraint role trên bảng users cũ để hỗ trợ staff.
  try {
    const userSchemaRow = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get()
    if (userSchemaRow?.sql && !userSchemaRow.sql.includes("'staff'")) {
      const existingUserCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name)
      const userColList = existingUserCols.join(', ')
      db.exec('PRAGMA foreign_keys = OFF')
      db.exec('BEGIN')
      db.exec(`
        CREATE TABLE users_v3 (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
          name          TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','staff','admin')),
          is_active     INTEGER NOT NULL DEFAULT 1,
          created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          phone         TEXT
        );
        INSERT INTO users_v3 (${userColList}) SELECT ${userColList} FROM users;
        DROP TABLE users;
        ALTER TABLE users_v3 RENAME TO users;
      `)
      db.exec('COMMIT')
      db.exec('PRAGMA foreign_keys = ON')
    }
  } catch (err) {
    try { db.exec('ROLLBACK') } catch { /* bỏ qua */ }
    try { db.exec('PRAGMA foreign_keys = ON') } catch { /* bỏ qua */ }
    console.error('[db] migration users role staff thất bại:', err.message)
  }
  // Mở rộng CHECK constraint service_type và status trên bảng bookings cũ để hỗ trợ checked_in.
  try {
    const schemaRow = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='bookings'").get()
    if (schemaRow?.sql && (!schemaRow.sql.includes("'activity'") || !schemaRow.sql.includes("'checked_in'"))) {
      const existingCols = db.prepare('PRAGMA table_info(bookings)').all().map((c) => c.name)
      const colList = existingCols.join(', ')
      db.exec('PRAGMA foreign_keys = OFF')
      db.exec('BEGIN')
      db.exec(`
        CREATE TABLE bookings_v3 (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          code            TEXT NOT NULL UNIQUE,
          user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          service_type    TEXT NOT NULL CHECK (service_type IN ('flight','hotel','combo','activity','car','bus','train','insurance')),
          item_id         TEXT NOT NULL,
          title           TEXT NOT NULL,
          status          TEXT NOT NULL DEFAULT 'Đã xác nhận'
                          CHECK (status IN ('Đã tạo','Chờ thanh toán','Đã thanh toán','Đã xác nhận','Đã hủy','checked_in')),
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
          room_id         TEXT,
          room_name       TEXT,
          nights          INTEGER NOT NULL DEFAULT 0,
          rooms_count     INTEGER NOT NULL DEFAULT 1,
          adults          INTEGER NOT NULL DEFAULT 0,
          children        INTEGER NOT NULL DEFAULT 0,
          seat_code       TEXT,
          checked_in_at   TEXT,
          checked_in_by   TEXT,
          UNIQUE (user_id, idempotency_key)
        );
        INSERT INTO bookings_v3 (${colList}) SELECT ${colList} FROM bookings;
        DROP TABLE bookings;
        ALTER TABLE bookings_v3 RENAME TO bookings;
        CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
      `)
      db.exec('COMMIT')
      db.exec('PRAGMA foreign_keys = ON')
    }
  } catch (err) {
    try { db.exec('ROLLBACK') } catch { /* bỏ qua */ }
    try { db.exec('PRAGMA foreign_keys = ON') } catch { /* bỏ qua */ }
    console.error('[db] migration mở rộng bookings status/service_type thất bại:', err.message)
  }
} catch (err) {
  console.error('[db] migration thêm cột thất bại:', err.message)
}

/* ---------------------------------------------------------------- password */
// scrypt (memory-hard KDF có sẵn của Node) — không thêm dependency, không để lộ secret ra frontend.
// Định dạng lưu: scrypt$N$r$p$saltBase64$hashBase64
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 }

export function hashPasswordSync(plain) {
  const salt = randomBytes(16)
  const derived = scryptSync(String(plain), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p })
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${derived.toString('base64')}`
}

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
  u && {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    phone: u.phone || '',
    balance: Number(u.balance) || 0,
    avatarUrl: u.avatar_url || '',
    loyaltyPoints: Number(u.loyalty_points) || 0,
    totalSpent: Number(u.total_spent) || 0,
    memberTier: u.member_tier || 'Thành viên',
    tokenVersion: Number(u.token_version) || 1,
    isActive: !!u.is_active,
    createdAt: u.created_at,
  }

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
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    phone: row.phone || '',
    balance: Number(row.balance) || 0,
    avatarUrl: row.avatar_url || '',
    loyaltyPoints: Number(row.loyalty_points) || 0,
    totalSpent: Number(row.total_spent) || 0,
    memberTier: row.member_tier || 'Thành viên',
    tokenVersion: Number(row.token_version) || 1,
    is_active: row.is_active,
    session_expires_at: row.session_expires_at,
  }
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
    lat: r.lat ?? null, lng: r.lng ?? null, city: r.city ?? null,
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

/* -------------------------------------------------- Task 1: Seeds & APIs */
export function seedFlightSeats() {
  const flights = db.prepare('SELECT id FROM flights').all()
  const occupiedDefault = new Set(['1A', '1B', '2C', '3D', '4A', '5E', '6F', '7B', '8C', '9D', '10A'])
  const insert = db.prepare(`INSERT OR IGNORE INTO flight_seats (flight_id, seat_code, status) VALUES (?,?,?)`)
  let inserted = 0
  db.exec('BEGIN')
  try {
    for (const f of flights) {
      for (let row = 1; row <= 12; row += 1) {
        for (const col of ['A', 'B', 'C', 'D', 'E', 'F']) {
          const seatCode = `${row}${col}`
          const status = occupiedDefault.has(seatCode) ? 'booked' : 'available'
          const res = insert.run(f.id, seatCode, status)
          if (res.changes > 0) inserted += 1
        }
      }
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return inserted
}

export function seedExtraServices() {
  if (countRows('extra_services') > 0) return 0
  const insert = db.prepare(`INSERT OR IGNORE INTO extra_services (id, category, name, description, price, metadata_json) VALUES (?,?,?,?,?,?)`)
  let inserted = 0
  db.exec('BEGIN')
  try {
    for (const item of DEFAULT_EXTRA_SERVICES) {
      const res = insert.run(item.id, item.category, item.name, item.description, item.price, JSON.stringify(item.metadata || {}))
      if (res.changes > 0) inserted += 1
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return inserted
}

export function seedReviews() {
  if (countRows('reviews') > 0) return 0
  const user = db.prepare('SELECT id FROM users LIMIT 1').get()
  const userId = user ? user.id : 1
  const insert = db.prepare(`INSERT INTO reviews (hotel_id, user_id, user_name, type, category, rating, comment) VALUES (?,?,?,?,?,?,?)`)
  let inserted = 0
  db.exec('BEGIN')
  try {
    for (const rev of DEFAULT_REVIEWS) {
      insert.run(rev.hotelId, userId, rev.userName, rev.type, rev.category || '', rev.rating, rev.comment)
      inserted += 1
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return inserted
}

export function listFlightSeats(flightId) {
  return db.prepare('SELECT flight_id, seat_code, status, booking_id FROM flight_seats WHERE flight_id = ? ORDER BY id ASC').all(flightId)
}

export function lockFlightSeat(flightId, seatCode, bookingId = null) {
  const seat = db.prepare('SELECT * FROM flight_seats WHERE flight_id = ? AND seat_code = ?').get(flightId, seatCode)
  if (!seat) return { ok: false, error: 'Ghế không tồn tại trên chuyến bay này' }
  if (seat.status !== 'available') return { ok: false, error: 'Ghế ' + seatCode + ' đã có người đặt hoặc đang giữ' }
  const res = db.prepare(`UPDATE flight_seats SET status = 'booked', booking_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE flight_id = ? AND seat_code = ? AND status = 'available'`).run(bookingId, flightId, seatCode)
  return { ok: res.changes > 0 }
}

export function releaseFlightSeat(flightId, seatCode) {
  const res = db.prepare(`UPDATE flight_seats SET status = 'available', booking_id = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE flight_id = ? AND seat_code = ?`).run(flightId, seatCode)
  return res.changes > 0
}

export function listExtraServices(category = null) {
  if (category) {
    const norm = category.toLowerCase()
    return db.prepare('SELECT * FROM extra_services WHERE (category = ? OR category = ?) AND is_active = 1 ORDER BY price ASC')
      .all(norm, norm === 'tour' ? 'activity' : norm === 'airport_transfer' ? 'car' : norm)
  }
  return db.prepare('SELECT * FROM extra_services WHERE is_active = 1 ORDER BY category, price ASC').all()
}

export function getExtraService(id) {
  return db.prepare('SELECT * FROM extra_services WHERE id = ?').get(id)
}

export function createExtraService({ id, category, name, description = '', price, metadata = {}, isActive = 1 }) {
  db.prepare(`INSERT INTO extra_services (id, category, name, description, price, metadata_json, is_active)
              VALUES (?,?,?,?,?,?,?)`)
    .run(id, category, name, description, price, JSON.stringify(metadata || {}), isActive ? 1 : 0)
  return getExtraService(id)
}

export function updateExtraService(id, { category, name, description, price, metadata, isActive }) {
  const cur = getExtraService(id)
  if (!cur) return null
  const nextCat = category ?? cur.category
  const nextName = name ?? cur.name
  const nextDesc = description ?? cur.description
  const nextPrice = price ?? cur.price
  const nextMeta = metadata ? JSON.stringify(metadata) : cur.metadata_json
  const nextActive = isActive !== undefined ? (isActive ? 1 : 0) : cur.is_active

  db.prepare(`UPDATE extra_services SET category = ?, name = ?, description = ?, price = ?, metadata_json = ?, is_active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(nextCat, nextName, nextDesc, nextPrice, nextMeta, nextActive, id)
  return getExtraService(id)
}

export function deleteExtraService(id) {
  const res = db.prepare(`UPDATE extra_services SET is_active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(id)
  return res.changes > 0
}

export function listHotelReviews(hotelId) {
  return db.prepare(`
    SELECT r.id, r.hotel_id, r.user_id, r.user_name, r.type, r.category, r.rating, r.comment, r.created_at,
           u.avatar_url
    FROM reviews r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.hotel_id = ?
    ORDER BY r.created_at DESC, r.id DESC
  `).all(hotelId)
}

export function getHotelReviewStats(hotelId) {
  const stats = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(AVG(rating), 0) as avgRating
    FROM reviews
    WHERE hotel_id = ? AND type = 'review'
  `).get(hotelId)
  return {
    reviewCount: stats?.count || 0,
    avgRating: Number((stats?.avgRating || 0).toFixed(1)),
  }
}

export function createHotelReview({ hotelId, userId, userName, type = 'review', category = '', rating = 5, comment = '' }) {
  const cleanRating = Math.min(Math.max(Number(rating) || 5, 1), 5)
  const cleanType = ['review', 'feedback'].includes(type) ? type : 'review'
  const res = db.prepare(`
    INSERT INTO reviews (hotel_id, user_id, user_name, type, category, rating, comment)
    VALUES (?,?,?,?,?,?,?)
  `).run(hotelId, Number(userId), String(userName || 'Khách hàng'), cleanType, String(category || ''), cleanRating, String(comment || ''))

  const stats = getHotelReviewStats(hotelId)
  if (stats.avgRating > 0) {
      db.prepare(`UPDATE hotels SET rating = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(stats.avgRating, hotelId)
  }
  return db.prepare('SELECT * FROM reviews WHERE id = ?').get(res.lastInsertRowid)
}

export function createPasswordReset(email, otp, ttlMinutes = 5) {
  const user = findUserByEmail(email)
  if (!user) return null
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString()
  db.prepare(`UPDATE password_resets SET used = 1 WHERE email = ? AND used = 0`).run(email)
  const res = db.prepare(`INSERT INTO password_resets (user_id, email, otp, expires_at) VALUES (?,?,?,?)`)
    .run(user.id, email, otp, expiresAt)
  return { id: res.lastInsertRowid, email, expiresAt }
}

export function verifyPasswordReset(email, otp) {
  const row = db.prepare(`
    SELECT * FROM password_resets 
    WHERE email = ? AND otp = ? AND used = 0 AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')
    ORDER BY id DESC LIMIT 1
  `).get(email, otp)
  return row || null
}

export function consumePasswordReset(email, otp) {
  const row = verifyPasswordReset(email, otp)
  if (!row) return false
  db.prepare(`UPDATE password_resets SET used = 1 WHERE id = ?`).run(row.id)
  return true
}

/* ------------------------------------------------ notifications & audit APIs */
export function createNotification({ userId, title, message, type = 'system', link = '' }) {
  const id = `notif-${randomBytes(6).toString('hex')}`
  const validTypes = ['payment', 'booking', 'system', 'promo']
  const cleanType = validTypes.includes(type) ? type : 'system'
  db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, type, is_read, link)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `).run(id, Number(userId), String(title), String(message), cleanType, String(link || ''))
  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(id)
}

export function listUserNotifications(userId, limit = 50) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100)
  return db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(Number(userId), safeLimit)
}

export function countUnreadNotifications(userId) {
  const row = db.prepare(`
    SELECT COUNT(*) AS c FROM notifications
    WHERE user_id = ? AND is_read = 0
  `).get(Number(userId))
  return row?.c || 0
}

export function markNotificationAsRead(id, userId) {
  const res = db.prepare(`
    UPDATE notifications SET is_read = 1
    WHERE id = ? AND user_id = ?
  `).run(String(id), Number(userId))
  return res.changes > 0
}

export function markAllNotificationsAsRead(userId) {
  const res = db.prepare(`
    UPDATE notifications SET is_read = 1
    WHERE user_id = ? AND is_read = 0
  `).run(Number(userId))
  return res.changes > 0
}

export function listAuditLogsFiltered({ page = 1, limit = 20, action = null, actor = null, fromDate = null, toDate = null }) {
  const safePage = Math.max(Number(page) || 1, 1)
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100)
  const where = []
  const args = []

  if (action && action.trim()) {
    where.push('action LIKE ?')
    args.push(`%${action.trim()}%`)
  }
  if (actor && actor.trim()) {
    where.push('(actor_email LIKE ? OR CAST(actor_id AS TEXT) LIKE ?)')
    args.push(`%${actor.trim()}%`, `%${actor.trim()}%`)
  }
  if (fromDate && fromDate.trim()) {
    where.push('substr(created_at, 1, 10) >= ?')
    args.push(fromDate.trim())
  }
  if (toDate && toDate.trim()) {
    where.push('substr(created_at, 1, 10) <= ?')
    args.push(toDate.trim())
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const total = db.prepare(`SELECT COUNT(*) AS c FROM audit_log ${whereSql}`).get(...args)?.c || 0
  const items = db.prepare(`
    SELECT id, actor_id, actor_email, action, entity_type, entity_id, detail, ip, created_at
    FROM audit_log
    ${whereSql}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(...args, safeLimit, (safePage - 1) * safeLimit)

  return { items, total, page: safePage, limit: safeLimit }
}

/* ------------------------------------------------------------- Wallet (Ví số dư) */

export function getUserWallet(userId) {
  const user = db.prepare('SELECT id, email, name, balance FROM users WHERE id = ?').get(userId)
  if (!user) return null
  const transactions = db.prepare(`SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 50`).all(userId)
  return {
    userId: user.id,
    balance: Number(user.balance) || 0,
    transactions,
  }
}

export function depositUserWallet({ userId, amount, referenceCode = '', description = '', source = 'deposit' }) {
  const depositAmount = Math.min(Math.max(Number(amount) || 0, 0), 10_000_000_000)
  if (depositAmount <= 0) throw new Error('Số tiền nạp phải lớn hơn 0.')

  // Kiểm tra trùng lặp referenceCode (nếu có)
  if (referenceCode) {
    const existing = db.prepare('SELECT * FROM wallet_transactions WHERE user_id = ? AND reference_code = ?').get(userId, referenceCode)
    if (existing) {
      const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId)
      return { ok: true, duplicate: true, balance: Number(user.balance) || 0, transactionId: existing.id }
    }
  }

  db.exec('BEGIN')
  try {
    const user = db.prepare('SELECT id, balance FROM users WHERE id = ?').get(userId)
    if (!user) throw new Error('Không tìm thấy người dùng.')

    const newBalance = (Number(user.balance) || 0) + depositAmount
    db.prepare(`UPDATE users SET balance = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(newBalance, userId)

    const res = db.prepare(`
      INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_code, description)
      VALUES (?, 'deposit', ?, ?, ?, ?)
    `).run(userId, depositAmount, newBalance, String(referenceCode || ''), String(description || `Nạp tiền qua SePay VietQR (${source})`))

    db.exec('COMMIT')
    return { ok: true, balance: newBalance, added: depositAmount, transactionId: res.lastInsertRowid }
  } catch (err) {
    try { db.exec('ROLLBACK') } catch {}
    throw err
  }
}

export function payWithWallet({ userId, amount, bookingCode, description = '' }) {
  const payAmount = Number(amount) || 0
  if (payAmount <= 0) throw new Error('Số tiền thanh toán phải lớn hơn 0.')

  db.exec('BEGIN')
  try {
    const user = db.prepare('SELECT id, balance FROM users WHERE id = ?').get(userId)
    if (!user) throw new Error('Không tìm thấy người dùng.')

    const currentBalance = Number(user.balance) || 0
    if (currentBalance < payAmount) {
      throw new Error(`Số dư ví không đủ (hiện có: ${currentBalance}đ, cần: ${payAmount}đ). Vui lòng nạp thêm tiền.`)
    }

    const newBalance = currentBalance - payAmount
    db.prepare(`UPDATE users SET balance = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(newBalance, userId)

    const res = db.prepare(`
      INSERT INTO wallet_transactions (user_id, type, amount, balance_after, booking_code, description)
      VALUES (?, 'payment', ?, ?, ?, ?)
    `).run(userId, -payAmount, newBalance, String(bookingCode || ''), String(description || `Thanh toán đơn ${bookingCode} bằng số dư ví`))

    db.exec('COMMIT')
    return { ok: true, balance: newBalance, deducted: payAmount, transactionId: res.lastInsertRowid }
  } catch (err) {
    try { db.exec('ROLLBACK') } catch {}
    throw err
  }
}

/* --------------------------------------------------- Saved Passengers (Hành khách đã lưu) */
export function listSavedPassengers(userId) {
  return db.prepare('SELECT * FROM saved_passengers WHERE user_id = ? ORDER BY id DESC').all(Number(userId))
}

export function countSavedPassengers(userId) {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM saved_passengers WHERE user_id = ?').get(Number(userId))
  return Number(row?.cnt) || 0
}

export function getSavedPassenger(id, userId) {
  return db.prepare('SELECT * FROM saved_passengers WHERE id = ? AND user_id = ?').get(Number(id), Number(userId))
}

export function createSavedPassenger({ userId, fullName, dob = null, gender = null, nationality = 'Việt Nam', idNumber = null, phone = null, label = 'Bản thân' }) {
  const count = countSavedPassengers(userId)
  if (count >= 20) throw new Error('Đã đạt giới hạn tối đa 20 hành khách đã lưu.')

  const trimmedName = String(fullName || '').trim()
  if (trimmedName.length < 2) throw new Error('Họ và tên hành khách phải có ít nhất 2 ký tự.')

  const res = db.prepare(`
    INSERT INTO saved_passengers (user_id, full_name, dob, gender, nationality, id_number, phone, label)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    Number(userId),
    trimmedName,
    dob ? String(dob).trim() : null,
    gender && ['male', 'female', 'other'].includes(gender) ? gender : null,
    nationality ? String(nationality).trim() : 'Việt Nam',
    idNumber ? String(idNumber).trim() : null,
    phone ? String(phone).trim() : null,
    label ? String(label).trim() : 'Bản thân'
  )
  return getSavedPassenger(res.lastInsertRowid, userId)
}

export function updateSavedPassenger({ id, userId, fullName, dob, gender, nationality, idNumber, phone, label }) {
  const existing = getSavedPassenger(id, userId)
  if (!existing) throw new Error('Không tìm thấy thông tin hành khách.')

  const trimmedName = String(fullName || '').trim()
  if (trimmedName.length < 2) throw new Error('Họ và tên hành khách phải có ít nhất 2 ký tự.')

  db.prepare(`
    UPDATE saved_passengers
    SET full_name = ?, dob = ?, gender = ?, nationality = ?, id_number = ?, phone = ?, label = ?
    WHERE id = ? AND user_id = ?
  `).run(
    trimmedName,
    dob ? String(dob).trim() : null,
    gender && ['male', 'female', 'other'].includes(gender) ? gender : null,
    nationality ? String(nationality).trim() : 'Việt Nam',
    idNumber ? String(idNumber).trim() : null,
    phone ? String(phone).trim() : null,
    label ? String(label).trim() : 'Bản thân',
    Number(id),
    Number(userId)
  )
  return getSavedPassenger(id, userId)
}

export function deleteSavedPassenger(id, userId) {
  const res = db.prepare('DELETE FROM saved_passengers WHERE id = ? AND user_id = ?').run(Number(id), Number(userId))
  return Number(res.changes) > 0
}

/* ------------------------------------------------ Loyalty Points & Tier (Hạng thành viên) */
export function calculateMemberTier(totalSpent) {
  const spent = Number(totalSpent) || 0
  if (spent >= 30_000_000) return 'Kim Cương'
  if (spent >= 15_000_000) return 'Vàng'
  if (spent >= 5_000_000) return 'Bạc'
  return 'Thành viên'
}

export function getTierProgress(totalSpent) {
  const spent = Number(totalSpent) || 0
  const tier = calculateMemberTier(spent)
  let nextTier = 'Bạc'
  let nextThreshold = 5_000_000
  let prevThreshold = 0

  if (tier === 'Bạc') {
    nextTier = 'Vàng'
    prevThreshold = 5_000_000
    nextThreshold = 15_000_000
  } else if (tier === 'Vàng') {
    nextTier = 'Kim Cương'
    prevThreshold = 15_000_000
    nextThreshold = 30_000_000
  } else if (tier === 'Kim Cương') {
    nextTier = null
    prevThreshold = 30_000_000
    nextThreshold = 30_000_000
  }

  const range = Math.max(nextThreshold - prevThreshold, 1)
  const currentInRange = Math.max(spent - prevThreshold, 0)
  const percent = nextTier ? Math.min(Math.round((currentInRange / range) * 100), 100) : 100
  const needed = nextTier ? Math.max(nextThreshold - spent, 0) : 0

  return {
    tier,
    nextTier,
    currentSpent: spent,
    totalSpent: spent,
    prevThreshold,
    nextThreshold,
    percent,
    progressPct: percent,
    needed,
  }
}

export function addLoyaltyForBooking(userId, bookingTotal) {
  const total = Number(bookingTotal) || 0
  if (total <= 0) return null

  const pointsToAdd = Math.round(total * 0.01) // 1% giá trị đơn hàng

  db.exec('BEGIN')
  try {
    const user = db.prepare('SELECT id, loyalty_points, total_spent, member_tier FROM users WHERE id = ?').get(Number(userId))
    if (!user) throw new Error('Không tìm thấy người dùng để cộng điểm.')

    const oldTier = user.member_tier || 'Thành viên'
    const newTotalSpent = (Number(user.total_spent) || 0) + total
    const newPoints = (Number(user.loyalty_points) || 0) + pointsToAdd
    const newTier = calculateMemberTier(newTotalSpent)

    db.prepare(`
      UPDATE users
      SET loyalty_points = ?, total_spent = ?, member_tier = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?
    `).run(newPoints, newTotalSpent, newTier, Number(userId))

    db.exec('COMMIT')
    return {
      pointsAdded: pointsToAdd,
      newPoints,
      newTotalSpent,
      oldTier,
      newTier,
      tierUpgraded: oldTier !== newTier,
    }
  } catch (err) {
    try { db.exec('ROLLBACK') } catch {}
    console.error('[loyalty] Lỗi cộng điểm thưởng:', err.message)
    return null
  }
}

/* ------------------------------------------------ Security: Revoke All Sessions */
export function revokeAllUserSessions(userId) {
  db.exec('BEGIN')
  try {
    db.prepare("UPDATE users SET token_version = token_version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(Number(userId))
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(Number(userId))
    db.exec('COMMIT')
    return true
  } catch (err) {
    try { db.exec('ROLLBACK') } catch {}
    throw err
  }
}

// Khởi chạy seed 3 tài khoản phân quyền chuẩn (Admin, Staff, Khách hàng) — an toàn & idempotent
export function seedStaffUser() {
  const defaultAccounts = [
    {
      email: 'admin@mayannhien.vn',
      name: 'Quản trị viên Mây An Nhiên',
      password: 'Admin@123',
      role: 'admin',
      phone: '0901234567',
      balance: 20_000_000,
      loyaltyPoints: 350_000,
      totalSpent: 35_000_000,
      memberTier: 'Kim Cương',
    },
    {
      email: 'staff@mayannhien.vn',
      name: 'Lễ tân Mây An Nhiên',
      password: 'Staff@123',
      role: 'staff',
      phone: '0902345678',
      balance: 5_000_000,
      loyaltyPoints: 50_000,
      totalSpent: 5_000_000,
      memberTier: 'Bạc',
    },
    {
      email: 'user@mayannhien.vn',
      name: 'Khách hàng Mây An Nhiên',
      password: 'User@123',
      role: 'user',
      phone: '0903456789',
      balance: 10_000_000,
      loyaltyPoints: 150_000,
      totalSpent: 15_000_000,
      memberTier: 'Vàng',
    },
  ]

  for (const acc of defaultAccounts) {
    const existing = db.prepare('SELECT id, role FROM users WHERE email = ? COLLATE NOCASE').get(acc.email)
    const pwHash = hashPasswordSync(acc.password)
    if (!existing) {
      db.prepare(`
        INSERT INTO users (email, name, password_hash, role, phone, balance, loyalty_points, total_spent, member_tier, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        acc.email,
        acc.name,
        pwHash,
        acc.role,
        acc.phone,
        acc.balance,
        acc.loyaltyPoints,
        acc.totalSpent,
        acc.memberTier
      )
    } else {
      db.prepare(`
        UPDATE users
        SET role = ?, password_hash = ?, is_active = 1,
            balance = CASE WHEN balance < ? THEN ? ELSE balance END
        WHERE id = ?
      `).run(acc.role, pwHash, acc.balance, acc.balance, existing.id)
    }
  }
}

try {
  seedFlightSeats()
  seedExtraServices()
  seedReviews()
  seedStaffUser()
} catch {
  // Bỏ qua lỗi nếu bảng chưa sẵn sàng trong mock/test runner
}
