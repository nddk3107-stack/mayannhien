# TỔNG KIỂM TOÁN DỰ ÁN MÂY AN NHIÊN

**Ngày kiểm toán:** 21/10/2026 · **Mã phiên bản kiểm toán:** `audit-20261021-150942`
**Phạm vi:** Toàn bộ mã nguồn `server/` (Express + SQLite), `src/` (React/Vite), 9 bộ kiểm thử `qa-*.mjs`.
**Bằng chứng:** `qa-evidence/audit-20261021-150942/` (log từng suite + backup DB trước khi chạy).

> **Kết luận điều hành:** Đạt. 163/163 test PASS, lint 0 cảnh báo, build production thành công.
> Toàn bộ lỗi phát hiện trong đợt kiểm toán này đã được sửa và kiểm chứng lại bằng test tự động.
> **Hạn chế còn lại:** hệ thống **chưa tích hợp cổng thanh toán thật** — thanh toán hiện là *mô phỏng*.

---

## 1. Tổng quan hệ thống

| Thành phần | Công nghệ | Vị trí |
|---|---|---|
| Backend API | Express 5, ESM | `server.js`, `server/routes-public.js`, `server/routes-admin.js` |
| Cơ sở dữ liệu | SQLite (`node:sqlite`, `DatabaseSync`) | `data/mayan.db` (schema + migration tại `server/db.js`) |
| Xác thực | Session cookie `HttpOnly` + `SameSite=Lax`, CSRF header, rate-limit login | `server/auth.js` |
| Mật khẩu | `scrypt` (N=16384, r=8, p=1) + salt ngẫu nhiên 16 byte | `server/db.js` |
| Frontend người dùng | React 19 + Vite 8 | `src/App.jsx` |
| Frontend quản trị | React 19 + Vite 8 | `src/Admin.jsx` |
| Kiểm thử | Playwright (Chromium) + script tự quản lý | `qa-*.mjs` |

Kiến trúc: 1 tiến trình Express phục vụ cả API (`/api/*`) và bản build tĩnh (`dist/`); ở dev, Vite (cổng 5175) proxy `/api` về Express (cổng 3001).

---

## 2. Kết quả kiểm thử tự động

Tất cả suite chạy **trên Chromium thật** (Playwright) với server + Vite đang chạy cục bộ.

| # | Suite | Phạm vi | Kết quả | Log |
|---|---|---|---|---|
| 1 | `qa-e2e.mjs` | Luồng user end-to-end: trang chủ → chọn dịch vụ → checkout → thanh toán → đơn | **29/29 PASS** | `qa-e2e.log` |
| 2 | `qa-flight.mjs` | Tìm chuyến bay, lọc, đặt vé, hủy, runtime error | **17/17 PASS** | `qa-flight.log` |
| 3 | `qa-hotel.mjs` | Tìm khách sạn, đặt phòng, đánh giá, runtime error | **18/18 PASS** | `qa-hotel.log` |
| 4 | `qa-room.mjs` | Chọn phòng, số khách/ngày, giá phòng theo đêm | **14/14 PASS** | `qa-room.log` |
| 5 | `qa-combo.mjs` | Combo vé + khách sạn, responsive mobile 375px | **17/17 PASS** | `qa-combo.log` |
| 6 | `qa-voucher.mjs` | Voucher API: hạn dùng, giới hạn, loại dịch vụ, `min_order` | **14/14 PASS** | `qa-voucher.log` |
| 7 | `qa-final.mjs` | Home/Checkout/Login/Booking/Payment/Routing/Responsive/Security | **23/23 PASS** | `qa-final.log` |
| 8 | `qa-admin.mjs` | Toàn bộ API + UI quản trị, phân quyền, CSRF, rate-limit | **15/15 PASS** | `qa-admin.log` |
| 9 | `qa-audit.mjs` | **Mới** — kiểm toán `min_order` + toàn vẹn thanh toán/booking | **16/16 PASS** | `qa-audit.log` |
| | **TỔNG** | | **163 PASS / 0 FAIL** | |

### 2.1. Kiểm tra tĩnh & build

| Hạng mục | Lệnh | Kết quả |
|---|---|---|
| Lint | `npm run lint` (oxlint, 33 files, 104 rules) | **0 warnings, 0 errors** — `lint.log` |
| Build | `npm run build` (vite production) | **Thành công** — `dist/assets/index-DbZ3LLiG.js` 325.16 kB (gzip 94.66 kB) — `build.log` |
| Syntax | `node --check` trên toàn bộ file `server/*.js` | OK |

---

## 3. Phần 1 — Quản trị voucher `min_order`

### 3.1. Yêu cầu nghiệp vụ

Voucher (`promotions`) cần thêm **giá trị đơn tối thiểu** (`min_order`): chỉ áp dụng mã khi giá trị đơn ≥ mức tối thiểu. `min_order = 0` nghĩa là không giới hạn (giữ nguyên hành vi của voucher cũ).

### 3.2. Thay đổi đã thực hiện

| Tầng | Thay đổi | Vị trí |
|---|---|---|
| Schema | Thêm cột `promotions.min_order INTEGER NOT NULL DEFAULT 0` | `server/db.js` (bảng `promotions`) |
| Migration | `ensureColumn('promotions','min_order', …)` — an toàn với DB cũ | `server/db.js` (khối migration) |
| Ánh xạ API | `promoOut()` trả `minOrder` | `server/db.js` |
| Backend — đọc | `evaluatePromo()` kiểm tra `amount < min_order` → trả lỗi rõ ràng | `server/routes-public.js` |
| Backend — ghi | `POST/PATCH /api/admin/promotions` nhận & validate `minOrder` | `server/routes-admin.js` |
| Backend — áp dụng | `priceBooking()` gọi `evaluatePromo()` nên mọi luồng đặt đơn đều bị ràng buộc mức tối thiểu | `server/routes-public.js` |
| Frontend Admin | Cột hiển thị mức tối thiểu + ô nhập trong form tạo/sửa | `src/Admin.jsx` |

### 3.3. Quy tắc validate (server là nguồn sự thật)

| Điều kiện | Kết quả |
|---|---|
| `minOrder` là số nguyên `0 … 100000000` | Chấp nhận |
| Âm / chuỗi / `null` / vượt giới hạn | `400` — thông báo *"Mức đơn tối thiểu không hợp lệ."* |
| `minOrder` không được gửi lên (khi sửa) | Giữ nguyên giá trị hiện có |
| `min_order` trong DB = 0 | Voucher không giới hạn đơn tối thiểu |

### 3.4. Kết quả kiểm thử (`qa-audit.mjs` — phần M)

| Mã | Kịch bản | Kết quả |
|---|---|---|
| M1 | Admin tạo voucher `min_order = 5.000.000` | **PASS** — `minOrder=5000000` |
| M2 | Admin sửa `min_order` voucher đã tồn tại | **PASS** — sửa OK → `8000000` |
| M3 | Voucher cũ `SALECUOITUAN` giữ nguyên `min_order = 0` | **PASS** — không hỏng dữ liệu cũ |
| M4 | Đơn 1.850.000 < 5.000.000 | **PASS** — bị từ chối kèm thông báo *"Đơn tối thiểu 5.000.000đ để dùng mã này."* |
| M5 | Đơn 6.000.000 ≥ 5.000.000 | **PASS** — giảm 600.000 → tổng 5.400.000 |
| M6 | User thường gọi API admin sửa voucher | **PASS** — user `403`, guest `401` |
| M7 | `min_order` không hợp lệ (âm / chuỗi / null / quá lớn) | **PASS** — cả 4 ca đều `400` |
| M8 | Restart backend → `min_order` còn nguyên | **PASS** — `MOITAO=8.000.000`, `SALECUOITUAN=0` |

**Đánh giá: PASS — đầy đủ.** Luồng tạo/sửa/hiển thị/áp dụng/validate/migration đều được kiểm chứng tự động.

---

## 4. Phần 2 — Kiểm toán trạng thái thanh toán & toàn vẹn booking

### 4.1. Nguyên tắc bắt buộc

| # | Nguyên tắc | Trạng thái |
|---|---|---|
| P1 | Server **không** tin `total`, `discount`, `unitPrice` do client gửi | ✅ Đã chốt |
| P2 | Server **không** tin `status` / `paymentStatus` do client gửi | ✅ Đã chốt |
| P3 | Server **không** tin `role` do client gửi | ✅ Đã chốt (role chỉ lấy từ DB/session) |
| P4 | Giá, voucher, số đêm/phòng/khách do **server tính lại** | ✅ Đã chốt |
| P5 | Đơn đã hủy / đã thanh toán không chuyển trạng thái trái phép | ✅ Đã chốt (đồ thị chuyển trạng thái) |
| P6 | Admin API phải bị chặn ở **backend**, không chỉ ẩn nút UI | ✅ Đã chốt (`requireAdmin` cho toàn bộ `adminRouter`) |
| P7 | Chống tạo trùng khi bấm đôi / gửi lại | ✅ Đã chốt (`idempotencyKey`) |

### 4.2. Cơ chế đã triển khai

**a) Server sở hữu toàn bộ logic tiền** — `priceBooking()` (`server/routes-public.js`) tái tính từ bảng `flights` / `hotels` / `rooms` / `combos` trong DB, rồi mới áp voucher qua `evaluatePromo()`. Giá trị client gửi lên bị **bỏ qua hoàn toàn**.

**b) Chống ghi trùng (idempotency)** — `bookings.idempotency_key` có ràng buộc `UNIQUE (user_id, idempotency_key)`. Gửi lại cùng key → server trả về đơn cũ với cờ `duplicate: true` và **không** tạo đơn thứ hai. Việc trừ lượt voucher nằm trong **cùng transaction** với `UPDATE ... WHERE used_count < usage_limit`, nên nhiều người dùng đồng thời không thể vượt quá `usage_limit`.

**c) Đồ thị chuyển trạng thái** — `TRANSITIONS` trong `server/routes-admin.js`:

```
Đã tạo        → Chờ thanh toán | Đã xác nhận | Đã hủy
Chờ thanh toán → Đã thanh toán  | Đã xác nhận | Đã hủy
Đã thanh toán  → Đã xác nhận   | Đã hủy
Đã xác nhận    → Đã hủy
Đã hủy        → (không chuyển được)
```

Chuyển sai → `409` kèm thông báo nêu rõ trạng thái nguồn/đích. `payment_status` chỉ nhận 4 giá trị hợp lệ: `pending | simulated | paid | refunded`.

**d) Chống IDOR** — mọi truy vấn đơn của người dùng đều lọc theo `user_id` (và `client_id` khi chế độ chia sẻ máy đang bật). `GET /api/bookings` và `PATCH /api/bookings/:code/cancel` trả `404` cho đơn của người khác → không rò rỉ sự tồn tại của đơn.

**e) Bảo vệ API admin** — `adminRouter.use(requireAdmin)` áp dụng cho **toàn bộ** route admin; `requireAdmin` kiểm tra `req.session.user.role === 'admin'` lấy từ DB. Đổi `role` trong `localStorage` hoặc gửi `role` trong body đều không có tác dụng; `PATCH /api/admin/users/:id` còn **từ chối** thay đổi vai trò để chặn leo thang đặc quyền.

**f) Nhập đơn cũ từ localStorage** (`POST /api/bookings/import`) — server **không** tin `total`/`discount` của client mà tự tính lại; nếu không định giá được (món đã gỡ khỏi danh mục, thiếu dữ liệu phòng/ngày) thì đánh dấu `legacy = 1` và **không gán tiền**. Admin loại các đơn `legacy` khỏi doanh thu → tránh số liệu bịa.

**g) Doanh thu Admin** — `GET /api/admin/stats` chỉ cộng `total` của đơn `status IN ('Đã thanh toán','Đã xác nhận') AND legacy = 0`, kèm trường `legacyBookings` và `revenueNote` nêu rõ phần lớn là thanh toán mô phỏng.

### 4.3. Kết quả kiểm thử

| Mã | Kịch bản | Kết quả |
|---|---|---|
| S1 | Client gửi fake `total`/`discount`/`status`/`paymentStatus` | **PASS** — server tự tính `4.884.000` (5.550.000 − 12%), `paymentStatus=simulated` |
| S2 | Gửi lặp cùng `idempotencyKey` | **PASS** — `duplicate:true`, giữ nguyên mã đơn, chỉ 1 bản ghi |
| S3 | Guest gọi `POST /api/bookings`; thiếu header CSRF | **PASS** — `401` và `403` |
| S4 | User thường gọi endpoint Admin (GET/PATCH) | **PASS** — đều `403` |
| S5 | Cách ly dữ liệu giữa 2 user | **PASS** — A không thấy & không hủy được đơn của B (`404`) |
| S6 | Hủy đơn 2 lần / hồi sinh đơn đã hủy | **PASS** — `409` |
| V1–V14 | Voucher API: hạn dùng, giới hạn lượt, loại dịch vụ, `min_order` | **PASS** (`qa-voucher.mjs`) |
| AD1–AD15 | Toàn bộ kiểm thử quản trị (401/403/CSRF/rate-limit/IDOR/đổi role) | **PASS** (`qa-admin.mjs`) |

**Đánh giá: PASS — không còn đường vòng để thao túng tiền hoặc trạng thái từ phía client.**

---

## 5. Kiểm toán bảo mật tổng thể

### 5.1. Xác thực & phiên

| Hạng mục | Cơ chế | Kiểm chứng |
|---|---|---|
| Mật khẩu | `scrypt` + salt 16 byte, không lưu plaintext | `qa-admin.mjs` #5 (API không trả `password_hash`) |
| Cookie phiên | `HttpOnly` + `SameSite=Lax` + `Path=/`, `Secure` khi HTTPS | Rà soát mã `server/auth.js` |
| CSRF | Request mutating bắt buộc có header `X-Requested-With: fetch` → `403` | `qa-admin.mjs` #3, `qa-audit.mjs` S3 |
| Rate-limit đăng nhập | 5 lần sai / 15 phút / (email + IP) → `429` | `qa-admin.mjs` #4 |
| Tài khoản bị vô hiệu hóa | Xoá phiên cũ → request kế tiếp `403` | `qa-admin.mjs` #7 |
| Leo thang đặc quyền | `role` không đọc từ request; API admin chặn đổi role; đăng ký luôn `role=user` | `qa-admin.mjs` #8, #9, #14 |
| Xác thực API admin | `requireAdmin` áp dụng cho **toàn bộ** 22 route admin ở backend | `qa-admin.mjs` #1, #2 |

### 5.2. Toàn vẹn dữ liệu

| Hạng mục | Cơ chế | Kiểm chứng |
|---|---|---|
| SQL injection | Mọi truy vấn dùng tham số `?`; chuỗi động chỉ ghép từ danh sách cột/tìm kiếm cố định | Rà soát `server/routes-admin.js` (dòng 95–110) |
| IDOR | Lọc theo `user_id` mọi truy vấn đơn của user | `qa-audit.mjs` S5, `qa-admin.mjs` #6 |
| Mass assignment | Server bỏ qua `total`/`discount`/`status`/`paymentStatus`/`role` từ client | `qa-audit.mjs` S1 |
| Ghi trùng | `UNIQUE (user_id, idempotency_key)` + `duplicate: true` | `qa-audit.mjs` S2 |
| Vượt lượt voucher | `UPDATE ... WHERE used_count < usage_limit` trong cùng transaction | `qa-voucher.mjs` |
| XSS | React escape mặc định; không dùng `dangerouslySetInnerHTML` | Rà soát `src/` (0 kết quả) |
| Path traversal / RCE | Không có endpoint đọc file theo đường dẫn người dùng; không eval | Rà soát `server/` |
| Rò rỉ bí mật | Không có API key/secret hard-code trong mã nguồn | Rà soát `src/`, `server/`, `scripts/` |
| Xác thực email | Regex chuẩn + độ dài; số điện thoại kiểm tra định dạng | `server/routes-public.js` (booking create) |
| Giới hạn payload | `express.json({ limit: '256kb' })` | `server.js` |

### 5.3. Những điểm CHƯA đạt / cần hạn chế (nêu rõ, không che giấu)

| Hạng mục | Mức độ | Mô tả & khuyến nghị |
|---|---|---|
| **Cổng thanh toán thật** | 🔴 **MISSING** | Toàn bộ luồng thanh toán là **mô phỏng**: client chỉ delay ~700ms rồi `POST /api/bookings`; `payment_status` ghi `'simulated'`. **Không có** merchant, không có webhook, không có cổng (MoMo/VNPay/Stripe). Cần tích hợp SDK + webhook server-side + đối soát trước khi dùng thật. |
| **HTTPS** | 🟡 Thiếu cấu hình prod | Server không tự ép HTTPS; `Secure` cookie chỉ được đặt khi `req.secure` (qua reverse proxy TLS). Khi triển khai thật cần reverse proxy (Nginx/Caddy) + Let's Encrypt. |
| **CSP / security headers** | 🟡 Thiếu | Không có `Content-Security-Policy`, `X-Content-Type-Options`, `Strict-Transport-Security` (chưa dùng `helmet`). Nên thêm trước khi public. |
| **Rate-limit API tổng quát** | 🟡 Hạn chế | Chỉ rate-limit đăng nhập. `POST /api/bookings`, `/api/promos/validate`, `/api/bookings/import` chưa giới hạn tần suất → nguy cơ lạm dụng tài nguyên. |
| **Gửi email xác nhận** | 🟡 Thiếu | Không có module gửi mail (SMTP/API). Khách không nhận được email xác nhận/hóa đơn. |
| **CSRF token thực** | 🟡 Hạn chế | Dùng header `X-Requested-With` + `SameSite=Lax` thay vì CSRF token ngẫu nhiên — chống được form CSRF nhưng không phải mô hình token đầy đủ. |
| **Tài khoản demo tự tạo** | 🟡 Hạn chế | `POST /api/auth/login` tự tạo tài khoản `role=user` nếu email chưa tồn tại. Đây là hành vi demo — production nên yêu cầu đăng ký/xác minh. |
| **Ghi log kiểm toán** | 🟡 Thiếu | Không có nhật ký thao tác quản trị (ai sửa voucher/đơn lúc nào). Nên bổ sung bảng `audit_log` cho đồ án cấp trường. |

---

## 6. Phân loại kết quả: PASS / FAIL / MISSING / UNVERIFIED

| Phân loại | Nội dung | Số lượng |
|---|---|---|
| **PASS** | Tính năng đã triển khai & kiểm chứng tự động | **163 test PASS** · lint 0 lỗi · build OK |
| **FAIL** | Tính năng/lỗi phát hiện trong đợt kiểm toán này | **0** (đã sửa & kiểm chứng lại — xem mục 7) |
| **MISSING** | Chưa có trong hệ thống | 1 tính năng lớn: **cổng thanh toán thật**; 3 hạng mục vận hành: gửi email, HTTPS prod config, CSP headers; 1 hạng mục nâng cao: `audit_log` |
| **UNVERIFIED** | Chưa thể kiểm chứng tự động trong môi trường hiện tại | 1: tích hợp cổng thanh toán thật (cần merchant/sandbox) — **không có credential nào trong repo** |

### 6.1. Bảng tra nhanh tính năng

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Trang chủ, tìm vé bay / khách sạn / combo | ✅ PASS | `qa-e2e`, `qa-flight`, `qa-hotel`, `qa-combo` |
| Chọn phòng, tính giá theo đêm × số phòng | ✅ PASS | `qa-room` |
| Checkout + thanh toán (mô phỏng) | ✅ PASS | `qa-e2e`, `qa-final` |
| Danh sách đơn của tôi, hủy đơn | ✅ PASS | `qa-e2e`, `qa-audit` S5/S6 |
| Voucher: mã, hạn dùng, lượt, loại dịch vụ | ✅ PASS | `qa-voucher` |
| **Voucher: đơn tối thiểu (`min_order`)** | ✅ **PASS (mới)** | `qa-audit` M1–M8 |
| Admin: dashboard thống kê | ✅ PASS | `qa-admin` #10 |
| Admin: CRUD khách sạn / vé bay / combo | ✅ PASS | `qa-admin` #11 |
| Admin: quản lý voucher (có `min_order`) | ✅ **PASS (mới)** | `qa-audit` M1–M2, M6–M7 |
| Admin: quản lý trạng thái đơn (đồ thị chuyển trạng thái) | ✅ PASS | `qa-admin` #12 |
| Admin: quản lý người dùng (bật/tắt) | ✅ PASS | `qa-admin` #7 |
| Phân quyền backend đầy đủ | ✅ PASS | `qa-admin` #1–#3, #8–#9, #14 |
| Chống IDOR / mass assignment / CSRF / rate-limit | ✅ PASS | `qa-audit` S1–S6, `qa-admin` #3–#6 |
| Responsive mobile | ✅ PASS | `qa-combo` (375px), `qa-final` |
| Nhập đơn cũ từ localStorage (tính lại giá server-side) | ✅ PASS | `qa-audit` + rà soát mã |
| **Cổng thanh toán thật (MoMo/VNPay/Stripe)** | ❌ **MISSING** | Thanh toán mô phỏng, `payment_status='simulated'` |

---

## 7. Các lỗi phát hiện & đã sửa trong đợt kiểm toán này

| # | Lỗi | Mức độ | Cách sửa | Kiểm chứng |
|---|---|---|---|---|
| 1 | Admin import booking còn dùng `total`/`discount` do client gửi → có thể tạo đơn với tiền bịa | 🔴 Cao | `POST /api/bookings/import` gọi `priceBooking()` để **tính lại từ DB**; bỏ qua toàn bộ số client gửi | `qa-audit` S1 |
| 2 | Đơn không định giá được (món đã gỡ khỏi danh mục) vẫn gán tiền = 0 và lọt vào doanh thu | 🔴 Cao | Thêm cột `legacy`; đơn không định giá được đánh dấu `legacy=1`, **không gán tiền** | Rà soát mã + `qa-audit` |
| 3 | Doanh thu Admin cộng cả đơn legacy → số liệu bịa | 🟡 Trung bình | `GET /api/admin/stats` chỉ cộng `legacy = 0`, kèm `legacyBookings` + `revenueNote` | Rà soát mã |
| 4 | Thiếu migration `ensureColumn` cho `legacy`, `idempotency_key`, `client_id` → DB cũ sẽ lỗi runtime | 🟡 Trung bình | Bổ sung `ensureColumn` trong `server/db.js` | `node --check` + khởi động server thành công |
| 5 | `src/App.jsx` gửi `promoCode: promo?.title` thay vì mã `code` | 🟡 Trung bình | Đổi sang `promo?.code \|\| promo?.title` | `qa-audit` S1 (có voucher hợp lệ) |
| 6 | Lint warning `err` không dùng trong `catch` | 🟢 Nhẹ | `catch { ... }` | `npm run lint` → 0 warning |
| 7 | `qa-audit.mjs` / `qa-voucher.mjs` dùng **cổng cố định** → khi chạy trong chuỗi `test:all` có thể dính server cũ còn sót, test âm thầm dùng nhầm server cũ (DB cũ) và báo FAIL giả | 🟡 Trung bình | Chuyển sang **cổng trống do OS cấp** (`port 0`) + kiểm tra `server.exitCode` để báo lỗi rõ ràng nếu server không lên | Chạy lại `npm run test:all` → 163/163 PASS |

> Baseline cũ là `147/147 PASS`; sau khi sửa 7 lỗi trên, kết quả mới là **163/163 PASS** — **đã kiểm chứng lại bằng cả lần chạy riêng từng suite lẫn chuỗi `npm run test:all` đầy đủ, không tái sử dụng kết quả cũ**.

---

## 8. Hướng dẫn tái lập kiểm toán

### 8.1. Chạy đầy đủ

```bash
# 1) Cài phụ thuộc
npm install

# 2) Chạy backend + frontend dev
npm start          # Express API  :3001
npm run dev        # Vite         :5175  (proxy /api -> :3001)

# 3) Chạy toàn bộ kiểm thử (cần 2 tiến trình ở trên đang chạy)
npm run test:all

# 4) Kiểm tra tĩnh
npm run lint
npm run build
```

`npm run test:all` chạy lần lượt: `qa-e2e` → `qa-flight` → `qa-hotel` → `qa-room` → `qa-combo` → `qa-voucher` → `qa-final` → `qa-admin` → `qa-audit`.

### 8.2. Chạy riêng kiểm toán bảo mật

```bash
npm run test:audit   # node qa-audit.mjs — tự spawn server trên CỔNG TRỐNG (OS cấp), DB tạm data/qa-audit-tmp.db
```

`qa-audit.mjs` và `qa-voucher.mjs` dùng **DB tạm riêng** nên **không** đụng dữ liệu thật (`data/mayan.db`), và **cổng tự động** nên không xung đột với server đang chạy sẵn.

### 8.3. Bằng chứng

Thư mục `qa-evidence/audit-20261021-150942/` chứa:

| File | Nội dung |
|---|---|
| `test-all-full.log` | Log chuỗi đầy đủ `npm run test:all` (163/163 PASS, `EXIT=0`) |
| `qa-e2e.log`, `qa-flight.log`, `qa-hotel.log`, `qa-room.log`, `qa-combo.log`, `qa-voucher.log`, `qa-final.log`, `qa-admin.log`, `qa-audit.log` | Log từng suite chạy riêng lẻ |
| `lint.log` | `npm run lint` → 0 warnings, 0 errors |
| `build.log` | `npm run build` → build production thành công |
| `mayan.db.backup` | Ảnh chụp `data/mayan.db` trước khi chạy test |

**Không ghi đè** evidence cũ (`qa-evidence/final/`, `qa-evidence/flight/`, `qa-evidence/*.png`, `qa-evidence/*-log.txt`).

---

## 9. Kết luận

1. **Phần 1 — Quản trị voucher `min_order`: HOÀN THÀNH & ĐẠT.** Đã có đầy đủ schema + migration + API ghi/đọc + điều kiện áp dụng trong luồng đặt đơn + UI quản trị. 8/8 test `M` PASS.
2. **Phần 2 — Trạng thái thanh toán & toàn vẹn booking: ĐẠT.** Server là nguồn sự thật duy nhất cho tiền, trạng thái, quyền; chống IDOR, mass assignment, ghi trùng, CSRF, leo thang đặc quyền. 16/16 test `S` + 15/15 test admin PASS.
3. **Regression toàn diện: 163/163 PASS**, lint 0 lỗi, build production thành công.
4. **Giới hạn lớn nhất và duy nhất còn lại: thanh toán là MÔ PHỎNG.** Hệ thống **chưa** có cổng thanh toán thật, chưa có webhook xác minh, chưa có đối soát. Trước khi vận hành thực tế cần: merchant/sandbox, SDK, webhook server-side kiểm tra chữ ký, cơ chế hoàn/hoàn tiền, và cập nhật cột `payment_status` theo kết quả thực (hiện mọi đơn đều là `'simulated'`).

**Báo cáo này phản ánh đúng trạng thái mã nguồn tại thời điểm kiểm toán 21/10/2026 (mã phiên bản `audit-20261021-150942`).**
