# BÁO CÁO: Nơi lưu trữ dữ liệu của Mây An Nhiên

**Ngày kiểm tra:** 2026-10-21
**Phạm vi:** Toàn bộ cơ chế lưu trữ dữ liệu (backend, frontend, triển khai, backup)
**Nguyên tắc:** Chỉ ĐỌC. Không sửa, không xoá, không migrate bất kỳ dữ liệu nào.
**Xác minh sau khảo sát:** `PRAGMA integrity_check` → `ok`; `users=103`, `bookings=175` (không đổi).

---

## 1. Tóm tắt điều hành

| # | Kết luận |
|---|---|
| 1 | Toàn bộ dữ liệu nghiệp vụ nằm trong **một file SQLite duy nhất**: `data/mayan.db`. |
| 2 | DB **không** dùng thư mục `migrations/` — toàn bộ schema + migration nằm trong `server/db.js`. |
| 3 | Frontend **không** giữ dữ liệu nghiệp vụ; localStorage/sessionStorage chỉ chứa dữ liệu tạm hoặc bản sao. |
| 4 | **`data/` nằm trong `.gitignore`** → DB không được commit, cũng **không được deploy** qua `git pull`. |
| 5 | Rủi ro lớn nhất khi lên VPS: `deploy.sh` đặt DB ở `/var/lib/mayan/mayan.db` (đúng) nhưng **không có cron backup** và **không copy backup ra ngoài VPS**. |
| 6 | ⚠️ DB hiện tại chứa **100% dữ liệu test** (`@mayan.test`) — không có dữ liệu khách hàng thật nào để mất. |

---

## 2. Đường dẫn tuyệt đối thực tế của file database

### 2.1. Cơ chế xác định đường dẫn

Nguồn: `server/db.js:9-18`

```js
// Đường dẫn DB: luôn resolve thành đường dẫn TUYỆT ĐỐI để không phụ thuộc thư mục
// làm việc hiện tại (quan trọng khi chạy dưới systemd với WorkingDirectory khác).
// Mặc định nằm trong <repo>/data/ — đây là ổ đĩa bền vững, KHÔNG phải /tmp.
export const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(ROOT, 'data', 'mayan.db')

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

export const db = new DatabaseSync(DB_PATH)
```

`ROOT` được định nghĩa tại `server/config.js:7-8`:

```js
const here = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(here, '..')
```

### 2.2. Đường dẫn thực tế khi chạy trên máy dev (hiện tại)

| Điều kiện | Giá trị |
|---|---|
| `DB_PATH` trong env | **không được đặt** (không có file `.env`; `.env.example` chỉ có `# DB_PATH=` ở dạng comment) |
| `ROOT` | `/Users/phamminhkhoi/Documents/testchuyennganh` |
| **File DB chính** | **`/Users/phamminhkhoi/Documents/testchuyennganh/data/mayan.db`** |
| File WAL | `/Users/phamminhkhoi/Documents/testchuyennganh/data/mayan.db-wal` |
| File SHM | `/Users/phamminhkhoi/Documents/testchuyennganh/data/mayan.db-shm` |

Xác nhận bằng `ls -la data/`:

```
-rw-r--r--  360448  mayan.db        <- file DB chính
-rw-r--r--   32768  mayan.db-shm
-rw-r--r-- 4124152  mayan.db-wal    <- WAL lớn hơn file .db (chưa checkpoint)
```

> ⚠️ **WAL 4.1 MB > file .db 360 KB.** Ba file này là **một bộ**; chỉ copy riêng `mayan.db` sẽ **mất dữ liệu**. Script backup hiện tại đã xử lý đúng điều này bằng `VACUUM INTO` (xem §7).

### 2.3. Đường dẫn khi triển khai VPS (theo cấu hình sẵn có)

| Nơi | Đường dẫn | Nguồn |
|---|---|---|
| systemd (runtime) | `/var/lib/mayan/mayan.db` | `deploy/mayan-api.service:33` → `Environment=DB_PATH=/var/lib/mayan/mayan.db` |
| deploy.sh (migrate) | `${DATA_DIR}/mayan.db` = `/var/lib/mayan/mayan.db` | `deploy/deploy.sh:19, 89` |
| backup (deploy.sh) | `${DATA_DIR}/backups` = `/var/lib/mayan/backups` | `deploy/deploy.sh:104` |
| DB mặc định nếu không set env | `/var/www/mayan/data/mayan.db` | `server/db.js:14` — **không ghi được** dưới `ProtectSystem=strict` |

`ProtectSystem=strict` + `ReadWritePaths=/var/lib/mayan /var/log/mayan` (`deploy/mayan-api.service:38-40`) → `/var/www` bị **read-only**, nên `DB_PATH` bắt buộc phải là `/var/lib/mayan/...`. Cấu hình hiện tại **đã đúng**.

---


## 3. Toàn bộ bảng trong SQLite và ý nghĩa

Đọc trực tiếp từ `data/mayan.db` (chế độ `readOnly: true`):

| Bảng | Số dòng | Lưu gì | Nguồn định nghĩa |
|---|---|---|---|
| `users` | 103 | Tài khoản: email, tên, `password_hash` (scrypt), `role` (user/admin), `is_active` | `server/db.js:24-33` |
| `sessions` | 226 | Phiên đăng nhập: `token_hash` (sha256), `user_id`, `expires_at`, `last_seen_at` | `server/db.js:35-43` |
| `hotels` | 19 | Khách sạn (19 dòng; **2 đã soft-delete** `is_active=0` — "Khách sạn QA An Toàn") | `server/db.js:45-59` |
| `flights` | 3 | Chuyến bay | `server/db.js:61-76` |
| `rooms` | 37 | Phòng của khách sạn (`hotel_id` FK, giá/đêm, tiện nghi, ảnh) | `server/db.js:208-229` |
| `combos` | 3 | Combo (FK `hotel_id` + `flight_id`) | `server/db.js:80-94` |
| `promotions` | 3 | Voucher: `code`, `rate`, `usage_limit`, `used_count` | `server/db.js:96-111` |
| `bookings` | 175 | **Đơn hàng**: mã `MAN…`, `user_id`, `service_type`, tiền, khách, trạng thái, `payment_status`, `idempotency_key`, `client_id` | `server/db.js:113-147` |
| `payment_attempts` | 0 | Mỗi lần thử thanh toán MoMo: `order_id` (UNIQUE), `amount`, `status`, `trans_id`, `env` | `server/db.js:155-171` |
| `payment_transactions` | 0 | Lịch sử trạng thái giao dịch (IPN): `order_id`, `status`, `trans_id`, `result_code`, `source` | `server/db.js:173-184` |
| `audit_log` | 105 | Nhật ký thao tác admin + sự kiện thanh toán: `actor_email`, `action`, `entity_type`, `detail`, `ip` | `server/db.js:186-197` |
| `seed_meta` | 1 | Cờ "đã seed catalog" (`catalog` → `2026-10-16T15:19:20.695Z`) | `server/db.js:501` |

**Index** (8): `idx_sessions_user`, `idx_bookings_user`, `idx_bookings_status`, `idx_rooms_hotel`, `idx_pay_attempts_booking`, `idx_pay_attempts_user`, `idx_pay_tx_order`, `idx_audit_log_created`.

**PRAGMA**: `journal_mode=wal`, `foreign_keys=1`, `synchronous=2 (FULL)`, `page_size=4096`, `user_version=0`.

> `user_version=0` → **chưa có hệ thống version migration thật sự**. Migration hiện tại là kiểu *idempotent runtime* (xem §4).

---

## 4. Migration — không có thư mục `migrations/`

Toàn bộ schema được tạo bằng `CREATE TABLE IF NOT EXISTS` trong `server/db.js:20-229`, chạy **mỗi lần khởi động server** (vì `server.js:9` import `server/db.js` ở top-level).

Migration cho DB cũ dùng helper `ensureColumn` (`server/db.js:203-206`):

```js
function ensureColumn(table, column, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name)
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`)
}
```

Các cột được thêm nếu thiếu (`server/db.js:232-248`): `bookings.room_id`, `bookings.room_name`, `bookings.nights`, `bookings.rooms_count`, `bookings.adults`, `bookings.children`, `bookings.idempotency_key`, `bookings.client_id`, `bookings.legacy`, `promotions.min_order`.

**Ý nghĩa thực tế:** deploy bản mới lên DB cũ là an toàn (idempotent, không mất dữ liệu). Nhưng **không có** cơ chế rollback schema, và `ensureColumn` bọc trong `try/catch` chỉ `console.error` (`server/db.js:246-248`) → nếu migration lỗi, server **vẫn khởi động** với schema cũ và có thể lỗi runtime.

### 4.1. Dữ liệu seed — code hay DB?

`server/db.js:500-538` — `seedCatalogIfEmpty()`:

```js
export function seedCatalogIfEmpty() {
  db.exec("CREATE TABLE IF NOT EXISTS seed_meta (key TEXT PRIMARY KEY, value TEXT)")
  if (db.prepare("SELECT value FROM seed_meta WHERE key = 'catalog'").get()) return false
  ...
  if (countRows('hotels') === 0) { ...chèn DEFAULT_HOTELS... }
  if (countRows('flights') === 0) { ... }
  if (countRows('promotions') === 0) { ... }
  if (countRows('combos') === 0) { ... }
  db.prepare("INSERT OR REPLACE INTO seed_meta (key, value) VALUES ('catalog', ?)").run(...)
}
```

- Dữ liệu catalog mặc định nằm trong **code**: `server/data.js` (`DEFAULT_HOTELS`, `DEFAULT_FLIGHTS`, `DEFAULT_PROMOTIONS`, `DEFAULT_COMBOS`, `DEFAULT_ROOMS`).
- Chỉ seed **một lần** (đánh dấu bằng `seed_meta`). Admin xoá mềm (`is_active=0`) → không bị seed lại.
- `seedRooms()` (`server/db.js:469-494`) chạy **mỗi lần khởi động**, thêm phòng cho khách sạn chưa có phòng — idempotent.

**Hệ quả:** catalog (khách sạn/vé/phòng/combo/voucher) **không bị mất** khi mất DB → được seed lại từ code. Nhưng **mọi chỉnh sửa của admin** trên catalog (giá, tên, ảnh, voucher) **nằm trong DB** và sẽ mất nếu mất file DB.

## 5. Dữ liệu ở SQLite vs localStorage/sessionStorage vs bộ nhớ

### 5.1. localStorage (trình duyệt, theo máy)

| Key | Nội dung | Tác giả |
|---|---|---|
| `may-an-nhien-client` | UUID định danh trình duyệt (gửi qua header `X-Client-Id`) | `src/api.js:9-20` |
| `may-an-nhien-session` | `{email, name, role}` — **cache hiển thị**, không phải xác thực | `src/App.jsx:296-304, 347-350` |
| `may-an-nhien-traveler:v2` | Thông tin hành khách (tên/điện thoại/email) | `src/App.jsx:277, 343-345` |
| `may-an-nhien-bookings` / `:email` | Đơn hàng **bản cũ** (trước khi có DB) | `src/App.jsx:245, 252-274` |
| `may-an-nhien-bookings:synced:email` | **Bản sao** đơn tải từ server (mirror) | `src/App.jsx:248, 334-340` |
| `may-an-nhien-bookings:email:imported-v1` | Cờ "đã nhập đơn cũ vào DB" | `src/App.jsx:250, 539-554` |

Điểm quan trọng:
- `may-an-nhien-session` **không phải** cơ chế đăng nhập. Server xác thực qua **cookie HttpOnly** `may_an_nhien_sid` (`server/auth.js:5, 20-25`). Đổi `role` trong localStorage **không** có tác dụng (`server/auth.js:61-66` đọc `req.session.user.role` từ DB).
- Key `:imported-v1` là **cờ một lần** → nếu user xoá localStorage, đơn cũ có thể **không** được nhập lại. Nhưng đơn cũ đã vào DB thì vẫn còn.
- `src/App.jsx:332-341` ghi mirror vào key mới, **không** xoá key cũ.
- Import đơn cũ **tắt ở production**: `ALLOW_LEGACY_IMPORT` (`server/config.js:74-75`) mặc định `false` khi `NODE_ENV=production`; route `/api/bookings/import` (`server/routes-public.js:366-368`).

### 5.2. sessionStorage (trình duyệt, theo tab)

| Key | Nội dung | Tác giả |
|---|---|---|
| `may-an-nhien-room-sel` | `{hotelId, roomId}` — phòng đang chọn | `src/App.jsx:169, 171-176, 357-360` |
| `may-an-nhien-hotel-sel` | Khách sạn đang xem | `src/App.jsx:170, 178-184, 353-356` |

→ Chỉ là **lựa chọn điều hướng**, không phải dữ liệu nghiệp vụ. Mất khi đóng tab → không sao.

### 5.3. Chỉ nằm trong bộ nhớ (RAM) — mất khi restart, không sao

| Thứ | Vị trí | Tác giả |
|---|---|---|
| Rate-limit buckets (`attempts`, `buckets`) | `Map` trong RAM | `server/auth.js:80-81, 111-112` |
| Rate-limit đăng nhập 5 lần/15 phút | `Map` trong RAM | `server/auth.js:78-104` |
| `req.session` (object phiên đã giải mã) | RAM mỗi request | `server/auth.js:35-53` |

→ Mất khi restart là **chấp nhận được** (và đây là điểm cần biết: sau restart, rate-limit reset, phiên cookie **vẫn còn** vì `sessions` nằm trong SQLite).

### 5.4. Nguồn sự thật cho mỗi loại dữ liệu

| Loại dữ liệu | Nguồn sự thật | Dự phòng |
|---|---|---|
| Tài khoản, mật khẩu (hash), role | **SQLite `users`** | Không có |
| Phiên đăng nhập | **SQLite `sessions`** (token hash) | Cookie `may_an_nhien_sid` |
| Đơn hàng | **SQLite `bookings`** | localStorage (bản cũ/mirror) |
| Thanh toán MoMo | **SQLite `payment_attempts` + `payment_transactions` + `audit_log`** | Không có |
| Khách sạn / vé / phòng / combo / voucher | **SQLite** (catalog đã sửa) | Seed lại từ `server/data.js` (bản gốc chưa sửa) |
| Nhật ký admin | **SQLite `audit_log`** | Không có |
| Danh mục hiển thị khi API chết | Mảng hard-code trong `src/App.jsx:32-166` | Tĩnh, không cập nhật |

---

## 6. Phân tích: dữ liệu nào còn, dữ liệu nào có nguy cơ mất

### 6.1. Restart server

| Dữ liệu | Kết quả | Lý do |
|---|---|---|
| users, sessions, bookings, catalog, audit_log, payment_* | ✅ **Còn nguyên** | Trong file SQLite |
| Phiên đăng nhập | ✅ Còn | `sessions` trong DB (`findSessionUser`) |
| Rate-limit đăng nhập | ❌ **Mất** | RAM (`server/auth.js:80`) |
| Rate-limit API | ❌ Mất | RAM (`server/auth.js:111`) |
| Catalog | ✅ Còn | `seedCatalogIfEmpty()` chỉ seed khi `seed_meta` trống (`server/db.js:502`) |

### 6.2. Build lại frontend (`npm run build`)

| Dữ liệu | Kết quả | Lý do |
|---|---|---|
| **Toàn bộ dữ liệu server** | ✅ **Còn nguyên 100%** | `npm run build` chỉ ghi `dist/` — không đụng SQLite |
| localStorage/sessionStorage | ✅ Còn | Thuộc trình duyệt, không bị build ảnh hưởng |
| `dist/` | 🔄 Ghi đè | Bình thường |

⚠️ **Không bao giờ** đặt `DB_PATH` trỏ vào `dist/` hoặc thư mục bị build xoá.

### 6.3. Deploy lại (git pull / rsync)

| Dữ liệu | Kết quả | Lý do |
|---|---|---|
| `/var/lib/mayan/mayan.db` | ✅ Còn | Nằm **ngoài** `/var/www/mayan`, `git pull` không đụng tới |
| `data/mayan.db` (nếu cấu hình sai) | ❌ **Mất** | `.gitignore` chứa `data/` → `git pull` **không** cập nhật, nhưng `rsync --delete` hoặc xoá thủ công sẽ mất |
| `sessions` | ✅ Còn | Trong DB |
| Code mới + migration | ✅ Tự động | `ensureColumn` idempotent chạy lúc khởi động |

**Điểm mấu chốt:** `deploy.sh:57` tạo `/var/lib/mayan` và `deploy.sh:89` chạy migrate với `DB_PATH='${DATA_DIR}/mayan.db'` → **đúng**. Nhưng `deploy.sh:66` `git clone` vào `/var/www/mayan` — nếu ai đó đổi `DATA_DIR` về trong repo thì mọi lần deploy sẽ làm mất dữ liệu.

### 6.4. Mất hết dữ liệu khi không có backup

| Mất | Còn được seed lại? | Mức độ |
|---|---|---|
| Catalog gốc (khách sạn/vé/phòng/combo/voucher) | ✅ Có (từ `server/data.js`) | Chấp nhận được |
| **Sửa đổi của admin** (giá, tên, ảnh, voucher, `is_active`) | ❌ **Không** | **Mất vĩnh viễn** |
| **Tài khoản người dùng** | ❌ Không | Mất vĩnh viễn |
| **Đơn hàng** | ❌ Không | Mất vĩnh viễn |
| **Lịch sử thanh toán MoMo** (`payment_attempts`, `payment_transactions`) | ❌ Không | Mất vĩnh viễn — **không đối soát được tiền** |
| **Nhật ký audit** (`audit_log`) | ❌ Không | Mất vĩnh viễn — mất dấu vết quản trị |
| Phiên đăng nhập | ❌ Không | Người dùng phải đăng nhập lại (chấp nhận được) |

---


---


## 7. Cơ chế backup hiện tại

### 7.1. Script backup — `scripts/backup-db.mjs`

Chạy được nhờ `VACUUM INTO` (API chính thức của SQLite) — **không** dùng `cp`:

```js
// scripts/backup-db.mjs:44-52
const db = new DatabaseSync(DB_PATH, { readOnly: true })
try {
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`)
} catch (err) {
  console.error('[backup] VACUUM INTO thất bại:', err.message)
  process.exit(1)
} finally {
  db.close()
}
```

Lý do ghi rõ trong header của file (`scripts/backup-db.mjs:4-7`):

> SQLite ở chế độ WAL có thể đang ghi -> copy thẳng file `.db` có thể tạo bản sao không nhất quán. Script này dùng cơ chế backup chính thức của SQLite (VACUUM INTO) -> tạo file `.db` hoàn chỉnh, nhất quán, tại thời điểm copy.

**Đây là điểm đúng nhất của hệ thống** — đã xử lý đúng rủi ro WAL của §2.2.

Các tính năng khác:
- **Kiểm tra tính toàn vẹn** ngay sau backup (`scripts/backup-db.mjs:57-81`): mở file backup, đếm `users`/`bookings`, chạy `PRAGMA integrity_check` → phải là `ok`, nếu không thì `exit(1)`.
- **Kiểm tra khôi phục thật** với `--verify-restore` (`scripts/backup-db.mjs:84-102`): copy backup → file tạm → đọc lại → xoá file tạm.
- **Dọn bản cũ**, giữ `KEEP` mới nhất (mặc định 14), theo mẫu `mayan-*.db` (`scripts/backup-db.mjs:104-114`).

### 7.2. Bản backup đang có trên máy dev

```
backup/mayan-2026-10-21T09-36-08.db   270336 bytes
backup/mayan-2026-10-22T15-10-26.db   323584 bytes
backup/mayan-2026-10-22T15-21-39.db   348160 bytes
```

### 7.3. Cách chạy (đã có trong `package.json`)

| Lệnh | Tác dụng |
|---|---|
| `npm run backup` | Sao lưu vào `backup/` (mặc định) |
| `npm run backup -- --out /var/backups/mayan` | Sao lưu ra nơi khác |
| `npm run backup:restore-test` | Sao lưu **rồi** khôi phục thử để xác minh |

### 7.4. Các khoảng trống của cơ chế backup

| # | Vấn đề | Bằng chứng | Mức độ |
|---|---|---|---|
| B1 | **Không có cron/systemd timer** trong repo → không có backup định kỳ trên VPS | `deploy/deploy.sh:130` chỉ gợi ý "Bật backup định kỳ (crontab): xem PRODUCTION_READINESS.md" | 🔴 Cao |
| B2 | **Backup nằm cùng VPS** (`/var/lib/mayan/backups`) → hỏng/mất VPS là mất hết | `deploy/deploy.sh:104` | 🔴 Cao |
| B3 | `deploy.sh` chạy backup **sau** khi `systemctl restart` và **sau** migrate (dòng 89→98→104) → nếu migrate làm hỏng dữ liệu thì backup đã lưu bản hỏng | `deploy/deploy.sh:87-104` | 🟡 Trung bình |
| B4 | Không có `restore` script chỉ định — chỉ có `--verify-restore` (tự kiểm file tạm) | `scripts/backup-db.mjs:84-102` | 🟡 Trung bình |
| B5 | Không ghi log backup ra file / journald → không có dấu vết "đêm qua có backup thành công không" | — | 🟡 Trung bình |
| B6 | `KEEP=14` mặc định, không cấu hình theo RPO mong muốn | `scripts/backup-db.mjs:31` | 🟢 Nhẹ |

> Lưu ý: `data/` **có** trong `.gitignore` nên DB không bị commit lên git.

### 7.5. Một vấn đề phát hiện thêm: DB chính bị bộ test ghi vào

`scripts/run-tests.mjs:84-88` khởi động API cho các suite E2E **không** set `DB_PATH` → dùng **DB thật** trong `data/`:

```js
// ---- 1) API server (SQLite thật trong data/, KHÔNG dùng DB tạm cho E2E) ----
if (needsApi) {
  killPort(API_PORT)
  const api = start('api', process.execPath, ['server.js'], { PORT: String(API_PORT) })
```

Hệ quả (đã xác nhận bằng truy vấn):
- `users=103` — **100% email `@mayan.test`**, từ `flighta@mayan.test` đến `escalateae766c23@mayan.test`.
- `bookings=175` — tất cả `payment_status='simulated'`, `legacy=0`.
- `hotels` có 2 dòng tên **"Khách sạn QA An Toàn"** đã soft-delete.
- `audit_log=105` chủ yếu là `admin.hotel.delete` (87 lần) từ suite admin.

→ **DB hiện tại hoàn toàn là dữ liệu kiểm thử, không có dữ liệu khách hàng thật.** Đây là tin tốt cho giai đoạn lên VPS: có thể khởi tạo DB sạch mà không mất gì.

Ngược lại, các suite `payment`, `audit`, `voucher` **đã tách DB riêng** (đúng cách):
- `qa-payment.mjs:33-35` → `data/qa-payment-tmp-<timestamp>.db` + tự dọn
- `qa-audit.mjs:20-22` → `data/qa-audit-tmp.db`
- `qa-voucher.mjs:21-24` → `data/qa-voucher-tmp.db`

*(Các file `data/qa-*-tmp.db` là file tạm của test — không phải dữ liệu cần giữ.)*

---


## 8. Đề xuất lưu dữ liệu bền vững khi triển khai VPS

### 8.1. Nguyên tắc bố trí (giữ đúng những gì đã làm tốt)

```
/var/www/mayan/          ← MÃ NGUỒN (git pull thay thế) — read-only khi chạy
├── server/, src/, dist/ ← code + build
└── data/                ← KHÔNG dùng để lưu dữ liệu thật

/var/lib/mayan/          ← DỮ LIỆU (bền vững, KHÔNG nằm trong repo)
├── mayan.db             ← DB_PATH trong systemd
├── mayan.db-wal
├── mayan.db-shm
└── backups/             ← bản sao lưu local trên VPS

Ngoài VPS                ← BẢN SAO DỰ PHÒNG (S3 / Backblaze / NAS riêng)
```

Điểm cốt lõi: **DB thật nằm ngoài cây mã nguồn** → `git pull`, `rsync --delete`, `npm run build` không bao giờ chạm vào nó.

### 8.2. Checklist cụ thể (đề xuất, chưa thực hiện)

| # | Việc cần làm | Lệnh/thay đổi | Mức độ |
|---|---|---|---|
| V1 | Giữ `DB_PATH=/var/lib/mayan/mayan.db` | Đã có ở `deploy/mayan-api.service:33` | ✅ Xong |
| V2 | Bảo đảm `mayan` sở hữu `/var/lib/mayan` và **KHÔNG** bị `chown -R` phá khi deploy lại | `deploy/deploy.sh:58` đã `chown`; **không** `chown -R` lên `/var/lib/mayan` sau khi có dữ liệu thật | 🔴 |
| V3 | **Cron backup** hằng ngày 02:00 | `0 2 * * * cd /var/www/mayan && DB_PATH=/var/lib/mayan/mayan.db /usr/bin/node scripts/backup-db.mjs --out /var/lib/mayan/backups --verify-restore >> /var/log/mayan/backup.log 2>&1` | 🔴 |
| V4 | **Copy backup ra ngoài VPS** (không chỉ trên cùng máy) | `rclone sync /var/lib/mayan/backups remote:mayan-backups` hoặc `restic` + S3/B2 | 🔴 |
| V5 | Giữ **≥ 7 bản local + ≥ 30 bản ngoài VPS** | `--keep 30` cho bản ngoài; local `--keep 14` | 🔴 |
| V6 | **Script restore** có sẵn, đã kiểm thử | Tạo `scripts/restore-db.mjs` (đọc file backup → `integrity_check` → thay thế `mayan.db` khi server dừng) | 🟡 |
| V7 | **Backup trước** khi deploy, không phải sau | Sửa thứ tự trong `deploy/deploy.sh`: backup (dòng 104) **trước** migrate (dòng 89) và restart (dòng 98) | 🟡 |
| V8 | `PRAGMA wal_checkpoint(TRUNCATE)` định kỳ | Hiện WAL 4.1 MB > DB 360 KB; thêm vào cron hoặc dùng `journal_size_limit` | 🟡 |
| V9 | **Giám sát dung lượng** đĩa | Cảnh báo khi `/var/lib/mayan` > 80% | 🟡 |
| V10 | **Tách DB test khỏi DB thật** | Cho các suite E2E dùng `data/qa-e2e-tmp.db` thay vì `data/mayan.db` — tránh bộ test ghi vào DB production | 🟡 |
| V11 | **KHÔNG** chạy `npm run test:all` trên VPS | Suite E2E sẽ tạo hàng trăm user/booking giả trong DB thật | 🔴 |
| V12 | Xác định **RPO/RTO** và ghi vào `PRODUCTION_READINESS.md` | VD: backup 24h → RPO 24h; restore ~5 phút → RTO 30 phút | 🟡 |
| V13 | Bật `ALLOW_LEGACY_IMPORT=false` ở production | Mặc định đã là false khi `NODE_ENV=production` (`server/config.js:74-75`) | ✅ Xong |
| V14 | Cân nhắc `BOOKINGS_SCOPE=all` cho production | Mặc định `client` → đơn chỉ hiện trên đúng trình duyệt đã tạo (`server/routes-public.js:125, 257-260`) | 🟡 |

### 8.3. Quy trình deploy an toàn (đề xuất)

```bash
# 1. DỪNG app (để không có ghi trong lúc backup)
sudo systemctl stop mayan-api

# 2. BACKUP (đảm bảo có bản tốt trước mọi thay đổi)
cd /var/www/mayan && DB_PATH=/var/lib/mayan/mayan.db \
  node scripts/backup-db.mjs --out /var/lib/mayan/backups --verify-restore

# 3. Cập nhật code
cd /var/www/mayan && git pull --ff-only origin main && npm ci && npm run build

# 4. MIGRATE (idempotent) + kiểm tra
DB_PATH=/var/lib/mayan/mayan.db node -e \
  "import('./server/db.js').then(m=>{m.seedCatalogIfEmpty();m.seedRooms();m.db.close()})"

# 5. KHỞI ĐỘNG lại
sudo systemctl start mayan-api && curl -s https://<domain>/api/health

# 6. Nếu có sự cố → rollback DB từ bản backup ở bước 2
```

### 8.4. Điều KHÔNG được làm

| ❌ Không | Lý do |
|---|---|
| Không `cp mayan.db backup.db` khi server đang chạy | WAL đang ghi → bản sao không nhất quán (đúng lý do `scripts/backup-db.mjs` dùng `VACUUM INTO`) |
| Không copy riêng file `mayan.db` mà bỏ qua `-wal`/`-shm` | Mất dữ liệu chưa checkpoint |
| Không đặt `DB_PATH` vào `/var/www/mayan/...` | `ProtectSystem=strict` → không ghi được |
| Không đặt `DB_PATH` vào `/tmp` | Mất khi reboot |
| Không chạy `npm run test:all` trên VPS | Bộ test ghi vào DB thật (§7.5) |
| Không commit `data/` lên git | `.gitignore:32` đã chặn — giữ nguyên |
| Không xoá `/var/lib/mayan` khi deploy | Mất toàn bộ dữ liệu thật |

---

## 9. Kết luận

1. **Một nguồn sự thật duy nhất**: toàn bộ dữ liệu nghiệp vụ của Mây An Nhiên nằm trong **SQLite file `data/mayan.db`** (12 bảng: `users`, `sessions`, `hotels`, `flights`, `rooms`, `combos`, `promotions`, `bookings`, `payment_attempts`, `payment_transactions`, `audit_log`, `seed_meta`).

2. **Không có thư mục migration** — schema + migration idempotent nằm gọn trong `server/db.js`; chạy tự động mỗi lần khởi động server.

3. **Frontend không giữ dữ liệu nghiệp vụ**: localStorage chỉ chứa cache phiên hiển thị, thông tin hành khách, bản sao đơn và cờ nhập 1 lần; sessionStorage chỉ chứa lựa chọn phòng/khách sạn theo tab; rate-limit nằm trong RAM.

4. **Build frontend không mất dữ liệu nào** — `npm run build` chỉ ghi `dist/`.

5. **Deploy lại chỉ an toàn khi DB nằm ngoài cây mã nguồn** — cấu hình hiện tại (`DB_PATH=/var/lib/mayan/mayan.db`) đã đúng, nhưng `DATA_DIR` không được bao giờ trỏ về trong repo.

6. **Hai lỗ hổng cần bịt trước khi lên VPS**: (a) chưa có cron backup; (b) backup chỉ nằm trên cùng VPS. Thêm V3 + V4 trong §8.2 là bắt buộc.

7. **DB hiện tại chỉ chứa dữ liệu test** (100% `@mayan.test`, mọi đơn đều `payment_status='simulated'`) → có thể khởi tạo DB production sạch mà không mất mát gì.

---

*Báo cáo này chỉ thực hiện thao tác ĐỌC. Database được xác minh còn nguyên vẹn (`PRAGMA integrity_check` → `ok`) sau khi khảo sát.*
