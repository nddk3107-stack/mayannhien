# BÁO CÁO: Hệ thống quản trị Admin cho Mây An Nhiên

Ngày: 17/10/2026 · Kết quả cuối: **lint 0 lỗi · build OK · 104/104 test cũ PASS · 15/15 test admin mới PASS**

---

## 1. Tổng quan

Hệ thống có thêm khu vực quản trị **riêng biệt** tại `#/admin` (SPA độc lập, không trộn vào
giao diện người dùng):

- **Xác thực thật**: đăng nhập đối chiếu mật khẩu băm **scrypt** trong SQLite; phiên là
  cookie **HttpOnly + SameSite=Lax** (không thể đọc/tam cấp từ JavaScript).
- **Phân quyền thật (RBAC)**: mọi API `/api/admin/*` đều qua middleware `requireAuth` +
  `requireAdmin` phía **server**. Sửa `localStorage` role hoàn toàn vô hiệu — API vẫn 401/403.
- **Đơn đặt chỗ lưu ở database**: checkout gọi `POST /api/bookings`, **server tự tính lại tổng
  tiền** (không tin số của client), mã đơn duy nhất, chống tạo trùng (idempotency key).
- **Thanh toán vẫn là MÔ PHỎNG** (delay ~700ms như cũ); đơn ghi `Đã xác nhận` +
  `Thanh toán mô phỏng (demo)` — không có giao dịch tiền thật nào; admin dashboard ghi rõ điều này.
- **104 test cũ giữ nguyên, không sửa 1 dòng test nào** — toàn bộ PASS.

## 2. File tạo mới

| File | Vai trò |
|---|---|
| `server/db.js` | Mở SQLite (`node:sqlite`, không thêm dependency), tạo bảng, seed catalog, hash scrypt, phiên |
| `server/data.js` | Dữ liệu mặc định (3 chuyến bay / 3 khách sạn / 3 mã / 3 combo) — trùng khớp 100% giá mà test cũ kiểm tra |
| `server/auth.js` | Cookie phiên, `requireAuth`, `requireAdmin`, rate-limit đăng nhập, guard CSRF (header `X-Requested-With`) |
| `server/routes-public.js` | API công khai: auth, catalog, travel, health, bookings (tạo/ls/hủy/import) |
| `server/routes-admin.js` | API quản trị: stats, bookings, hotels, flights, combos, promotions, users |
| `scripts/seed-admin.mjs` | Tạo/cấp lại admin đầu tiên — **không hard-code mật khẩu** |
| `src/api.js` | Lớp fetch dùng chung (gắn CSRF header + mã trình duyệt) |
| `src/Admin.jsx` | SPA quản trị: đăng nhập, dashboard, CRUD 5 nhóm, người dùng |
| `src/admin.css` | Theme tối riêng cho admin (không đụng theme người dùng) |
| `qa-admin.mjs` | Bộ test an ninh/admin mới — 15 case |

## 3. File sửa

| File | Thay đổi |
|---|---|
| `server.js` | Viết lại thành entry mỏng: JSON body → CSRF guard → session → mount router → 404 JSON → error handler; phục vụ `dist/` nếu có |
| `src/App.jsx` | Đăng nhập/đăng xuất/nạp & hủy đơn đi qua API; checkout POST booking + idempotency; route `#/admin` render AdminApp; combo/promo lấy từ DB (fallback dữ liệu cũ khi API lỗi); mirror localStorage sang key mới, **không xóa dữ liệu cũ** |
| `package.json` | Script `seed:admin`, `test:admin`, `test:all` |
| `.gitignore` | Thêm `data/` (file SQLite) |
| `.env.example` | Thêm `DB_PATH`, `BOOKINGS_SCOPE` |

## 4. Bảng SQLite (`data/mayan.db`)

`users` (role ∈ {user, admin}, password_hash scrypt, is_active) · `sessions` (token_hash
SHA-256, hết hạn 7 ngày) · `hotels` · `flights` · `combos` (liên kết hotel_id + flight_id;
giá = KS + vé − saving, hoặc price_override) · `promotions` (rate, applies_to, usage_limit,
used_count) · `bookings` (code `MAN...` UNIQUE, service_type, traveler, total, discount, status,
payment_status, idempotency_key UNIQUE per user, client_id, legacy).

Xóa danh mục = **soft-delete** (`is_active=0`, giữ đơn cũ); chặn xóa khách sạn/chuyến bay khi
còn combo liên kết (409). Combo tự ẩn khi một trong hai thành phần ngừng bán. Seed catalog chỉ
chạy khi DB trống.

## 5. Routes trang

`#/admin` · `#/admin/login` · `#/admin/dashboard` · `#/admin/bookings` · `#/admin/hotels` ·
`#/admin/flights` · `#/admin/combos` · `#/admin/promotions` · `#/admin/users`
(AdminApp tự quản lý hash con; trang người dùng không có link tới admin.)

## 6. API chính

- Công khai: `POST /api/auth/login` · `POST /api/auth/register` (role luôn ép `user`) ·
  `POST /api/auth/logout` · `GET /api/auth/me` · `GET /api/catalog` · `GET /api/travel` ·
  `GET /api/health` · `GET/POST /api/bookings` · `PATCH /api/bookings/:code/cancel` (chỉ chủ
  đơn) · `POST /api/bookings/import` (nhập đơn cũ từ localStorage, không xóa dữ liệu gốc)
- Quản trị (401 chưa đăng nhập, 403 không phải admin): `GET /api/admin/stats` ·
  `GET/PATCH /api/admin/bookings` · CRUD `hotels|flights|combos|promotions` ·
  `GET/PATCH /api/admin/users` (**không cho đổi role qua API** — chặn leo thang đặc quyền)

Bảo mật: request mutating thiếu header `X-Requested-With` → 403 (CSRF); sai mật khẩu 5 lần /
15 phút → 429; vô hiệu hóa tài khoản → xoá mọi phiên cũ ngay lập tức.

## 7. Tạo admin đầu tiên

```bash
npm run seed:admin                                          # hỏi email + mật khẩu (ẩn khi gõ)
npm run seed:admin -- --email admin@mayan.test --generate   # sinh mật khẩu mạnh, in 1 lần
npm run seed:admin -- --email a@b.c --rotate                # cấp lại mật khẩu (đá mọi phiên cũ)
```

Không có mật khẩu mặc định nào trong source. Đăng nhập tại `http://localhost:5175/#/admin`.
*Lưu ý demo:* ở trang người dùng, lần đăng nhập **đầu tiên** của email chưa có sẽ tự tạo tài
khoản `user` (role luôn ép `user`, không bao giờ đọc role từ request) để demo không cần đăng ký
trước; admin chỉ tạo được qua script ở trên.

## 8. Kết quả kiểm thử (chạy `npm run test:all`)

| Suite | Kết quả |
|---|---|
| qa-e2e (test cũ) | 29/29 PASS |
| qa-flight (test cũ) | 17/17 PASS |
| qa-hotel (test cũ) | 18/18 PASS |
| qa-combo (test cũ) | 17/17 PASS |
| qa-final (test cũ) | 23/23 PASS |
| **Tổng test cũ** | **104/104 PASS** |
| qa-admin (mới) | 15/15 PASS |
| `npm run lint` | 0 lỗi (10 warning advisory React Hooks) |
| `npm run build` | OK (JS 300,96 kB) |

15 case an ninh/admin: 401 khi chưa đăng nhập · 403 khi là user thường (GET/POST/PATCH) ·
CSRF thiếu header → 403 · rate-limit 429 sau 5 lần sai · không lộ hash/plaintext mật khẩu ·
cách ly đơn giữa 2 user (404 khi hủy đơn người khác) · vô hiệu hóa tài khoản đá phiên cũ
ngay · không leo thang role (register ép user, PATCH role → 400) · sửa localStorage role =
vô hiệu · admin UI login + dashboard (ghi chú "thanh toán mô phỏng") · CRUD khách sạn qua UI +
lan sang catalog + soft-delete dọn sạch · tìm/chuyển trạng thái đơn + 409 khi nhảy sai ·
trang người dùng không trộn menu admin · tài khoản thường bị từ chối ở /admin ·
0 console error / 0 pageerror.

Bằng chứng: `qa-evidence/admin-results.json`, ảnh `qa-evidence/admin-dashboard.png`,
backup mã trước khi sửa: `bao-cao/backup-admin-20261015/`.

## 9. Quyết định thiết kế & giới hạn cần biết

1. **Đơn hiển thị theo (tài khoản, trình duyệt)** — mỗi trình duyệt mới bắt đầu với danh sách
   trống, đúng hành vi mà 104 test cũ xây quanh việc lưu `localStorage`. Muốn thấy đơn trên
   mọi thiết bị: đặt `BOOKINGS_SCOPE=all` (xem `.env.example`).
2. **Không xóa dữ liệu người dùng cũ**: đơn từ `localStorage` được *nhập* vào DB qua
   `/api/bookings/import` một lần (cờ `:imported-v1`); key dữ liệu cũ được giữ nguyên; bản sao
   đơn tải từ server ghi sang key mới `may-an-nhien-bookings:synced:<email>`.
3. **Thanh toán là mô phỏng** — không có cổng thanh toán thật; `payment_status='simulated'`,
   admin chỉ có thể tự đánh dấu `paid` khi đã đối soát chứng từ.
4. **Không thêm dependency ngoài** — dùng `node:sqlite` và `node:crypto/scrypt` có sẵn.

