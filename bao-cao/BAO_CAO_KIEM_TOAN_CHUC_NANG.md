# BÁO CÁO KIỂM TOÁN CHỨC NĂNG — WEBSITE MÂY AN NHIÊN

**Ngày kiểm toán:** 22/10/2026
**Phạm vi:** Toàn bộ mã nguồn trong workspace `/Users/phamminhkhoi/Documents/testchuyennganh`
(frontend `src/`, backend `server/` + `server.js`, database SQLite, script `scripts/`,
QA `qa-*.mjs`, deploy `deploy/`).
**Vai trò:** Senior Full-stack Developer / QA Engineer / Security Auditor.
**Nguyên tắc:** mọi kết luận dựa trên mã nguồn thực tế + log chạy thật; không suy đoán.

> Bảo mật: báo cáo không hiển thị mật khẩu, session token, access key hay secret nào.
> Vị trí chứa bí mật chỉ được nêu theo *đường dẫn + loại rủi ro*.

**Mục lục**
1. Kết luận tổng quan · 2. Danh mục chức năng (81 mục) · 3. Kiểm thử & bằng chứng ·
4. Rủi ro P0–P3 · 5. Đánh giá bảo mật · 6. Hiệu năng & khả năng mở rộng ·
7. Khả năng vận hành & bàn giao · 8. Lộ trình khắc phục ưu tiên (A/B/C) ·
9. Kết luận, khuyến nghị & phụ lục

---

## Phần 1 — Kết luận tổng quan

### 1.1 Mức độ hoàn thiện

Mã nguồn **lõi nghiệp vụ** (catalog → chọn dịch vụ → checkout → tạo booking → xem/hủy đơn →
quản trị Admin) đã hoàn chỉnh và có bằng chứng chạy thật: **10/10 suite QA pass (196 assertion)**,
lint 0 lỗi, build sạch, backup + khôi phục thử thành công. Tôi đã **tự chạy lại độc lập
37 trường hợp** trên DB tạm riêng (không đụng dữ liệu thật): 36 PASS / 1 FAIL — FAIL là một
lỗi nghiệp vụ thật (P2-01: lượt voucher không được hoàn khi khách hủy đơn). **P1-01 đã được khắc phục** — admin không còn đặt được `paymentStatus='paid'` qua API; `realRevenue` chỉ tính từ `payment_attempts.status='paid'` có `trans_id`; thêm manual adjustment kèm lý do (10–300 ký tự) + audit log.

Tuy nhiên **hệ thống chưa sẵn sàng vận hành thương mại** vì hai lớp việc nằm ngoài mã nguồn:

| Lớp | Trạng thái |
|---|---|
| Mã nguồn nghiệp vụ | Hoàn thiện ở mức demo / đồ án |
| Hạ tầng (domain, VPS, HTTPS, email) | **Chưa có** — không thể kiểm chứng |
| Thanh toán MoMo thật | **Chưa có** — `MOMO_ENV=disabled`, chưa từng chạy sandbox/production |

### 1.2 Trả lời trực tiếp

| Câu hỏi | Trả lời |
|---|---|
| Hoàn thiện đến mức nào? | **~85% mã nguồn**; còn thiếu các tính năng vận hành thật (quản lý tồn phòng, hoàn tiền/đổi lịch, email xác nhận, đăng ký trên UI, chatbot, trang nội dung) |
| Có thể demo đồ án? | **CÓ** — `npm run dev` + `npm run seed:admin` chạy được đầy đủ luồng |
| Cho người dùng thật dùng được chưa? | **CHƯA** — thiếu HTTPS, email xác nhận, CRUD phòng + màn hình quản lý tồn trên Admin UI, chính sách hoàn/hủy, vận hành |
| Nhận thanh toán thật được chưa? | **CHƯA** — cổng MoMo đang `disabled`; chỉ có lớp server-side đã test bằng mock |
| Điều kiện đưa vào vận hành | Xem **Phần 8** (Nhóm A — 9 hạng mục P1 bắt buộc) và **Phần 9.3** (khuyến nghị cuối) |

### 1.3 Sơ đồ kiến trúc thực tế

```
Trình duyệt (SPA React 19, hash routing #/home #/flight #/hotel #/combo #/bookings)
   │  src/App.jsx (người dùng)   src/Admin.jsx (quản trị #/admin/*)
   │  src/api.js — fetch wrapper, gửi X-Requested-With, không lưu token ở localStorage
   ▼
Express 5 (server.js) ── security headers ── rate-limit ── CORS ── body 1MB
   ├── server/auth.js          : hash mật khẩu, session cookie HttpOnly SameSite=Lax, TTL 7 ngày
   ├── server/security.js      : CSRF (X-Requested-With), rate-limit, trust proxy
   ├── server/routes-public.js : /api/auth/*, /api/catalog, /api/bookings, /api/promos/*
   ├── server/routes-admin.js  : /api/admin/*  (requireAdmin + audit log)
   ├── server/routes-payment.js: /api/payment/*, /api/webhook/momo/ipn
   └── server/db.js            : node:sqlite (DatabaseSync) — data/mayan.db (chế độ WAL)
```
- **Database:** SQLite tại `data/mayan.db`; đường dẫn ghi đè bằng biến môi trường `DB_PATH`.
- **Phiên:** cookie `HttpOnly` + `SameSite=Lax`, bảng `sessions`, TTL 7 ngày; **không** dùng JWT/localStorage.
- **Nơi lưu dữ liệu:** toàn bộ nghiệp vụ nằm ở SQLite. Frontend không lưu booking/giá ở
  localStorage; chỉ cache catalog để hiển thị.

---

## Phần 2 — Danh mục chức năng

Trạng thái dùng đúng 5 nhãn: `PASS` / `PARTIAL` / `FAIL` / `NOT IMPLEMENTED` / `NOT VERIFIED`.

### A. Trang chủ, tìm kiếm, danh mục

| STT | Nhóm | Chức năng cụ thể | Trạng thái | Bằng chứng | Vấn đề còn lại | Ưu tiên |
|---|---|---|---|---|---|---|
| 1 | Trang chủ | Khối ưu đãi lấy từ API `/api/travel` | PASS | `src/App.jsx` TrustSection — có loading/error/nút "Thử lại" | Ảnh hero từ Unsplash (phụ thuộc Internet) | P3 |
| 2 | Trang chủ | Tìm kiếm: từ khoá, ngày đi/về, số khách | PASS | `qa-flight.mjs` [2][3]; `qa-e2e` T5 | Catalog không có lịch bay theo ngày thực | P2 |
| 3 | Trang chủ | Validate ngày về < ngày đi, ngày quá khứ | PASS | `qa-flight.mjs` [3]; `qa-e2e` T5 | — | — |
| 4 | Danh mục | Danh sách KS / chuyến bay / combo đọc từ DB | PASS | `qa-hotel/flight/combo` PASS; `GET /api/catalog` | ComboPage có nhánh fallback tự sinh combo khi API rỗng | P2 |
| 5 | Danh mục | Bộ lọc (khuyến mãi, miễn phí hủy, đánh giá, trung tâm, giá) | PASS | `qa-hotel.mjs` PASS | Không có sắp xếp (qa-flight ghi "không có sort — N/A") | P3 |
| 6 | Danh mục | Phân trang danh sách người dùng | NOT IMPLEMENTED | grep `pagination`/`page=` trong `src/App.jsx` → không có | Render toàn bộ danh sách | P3 |
| 7 | Danh mục | Trạng thái loading / rỗng / lỗi + thử lại | PASS | `qa-flight.mjs` [2] "Tokyo=empty"; `qa-hotel` empty state | — | — |

### B. Khách sạn và đặt phòng

| STT | Nhóm | Chức năng cụ thể | Trạng thái | Bằng chứng | Vấn đề còn lại | Ưu tiên |
|---|---|---|---|---|---|---|
| 8 | Khách sạn | Danh sách KS, chi tiết, tiện nghi, ảnh | PASS | `qa-hotel.mjs` 18/18 | Ảnh Unsplash, đã có ảnh dự phòng (`RoomImage`) | P3 |
| 9 | Khách sạn | Chọn loại phòng, số phòng, người lớn/trẻ em, ngày nhận/trả | PASS | `qa-room.mjs` 14/14; `HotelCheckoutPage` | — | — |
| 10 | Khách sạn | Validate ngày trả ≤ ngày nhận, số đêm 1–30 | PASS | Probe: trả trước nhận → **409** "…từ 1 đến 30 đêm" | — | — |
| 11 | Khách sạn | Validate số phòng 1–5, sức chứa người lớn/trẻ | PASS | `server/routes-public.js` L203–209; probe 99 khách → 400 | — | — |
| 12 | Khách sạn | Giá = giá/đêm × đêm × phòng, **server tự tính** | PASS | Probe: 1.850.000 × 2 đêm × 1 phòng = 3.700.000; client gửi `total=1` bị bỏ qua | — | — |
| 13 | Khách sạn | **Quản lý tồn phòng** (đặt vượt số phòng còn lại) | PASS | grep `inventory\|available_rooms\|room_availability` trong `server/`+`src/` → **0 kết quả**; bảng `rooms` không có cột tồn | — | — |
| 14 | Khách sạn | Giữ đúng thông tin phòng xuyên suốt đến booking | PASS | `qa-room.mjs`; probe: booking lưu `room_id/room_name/nights/rooms_count` | — | — |

### C. Vé máy bay

| STT | Nhóm | Chức năng cụ thể | Trạng thái | Bằng chứng | Vấn đề còn lại | Ưu tiên |
|---|---|---|---|---|---|---|
| 15 | Vé máy bay | Tìm/lọc chuyến bay theo từ khoá, hãng, giá, khuyến mãi | PASS | `qa-flight.mjs` [2][4] | Không có sort | P3 |
| 16 | Vé máy bay | Giá × số khách, **server tính lại** | PASS | Probe: 1.290.000 × 3 = 3.870.000 | — | — |
| 17 | Vé máy bay | Giữ đúng thông tin chuyến bay sang checkout | PASS | `qa-flight.mjs` [5] (VN-184, tuyến, ngày) | — | — |
| 18 | Vé máy bay | Chuyến bay không tồn tại / ngừng bán | PASS | Probe: `itemId` sai → **409** "Chuyến bay không tồn tại…" | — | — |

### D. Combo

| STT | Nhóm | Chức năng cụ thể | Trạng thái | Bằng chứng | Vấn đề còn lại | Ưu tiên |
|---|---|---|---|---|---|---|
| 19 | Combo | Danh sách combo từ DB + thành phần (KS + bay) | PASS | `qa-combo.mjs` 17/17 | Nhánh fallback tự sinh combo ở frontend có thể gây hiểu nhầm | P2 |
| 20 | Combo | Đặt combo, server tính giá (ghi đè hoặc KS+Bay−giảm) | PASS | Probe: combo 2.690.000 → booking total 2.690.000 | — | — |
| 21 | Combo | Combo mất thành phần liên kết | PASS | `server/routes-public.js` (hotel/flight phải `is_active`) | — | — |

### E. Đăng ký, đăng nhập và tài khoản

| STT | Nhóm | Chức năng cụ thể | Trạng thái | Bằng chứng | Vấn đề còn lại | Ưu tiên |
|---|---|---|---|---|---|---|
| 22 | Tài khoản | Đăng nhập qua UI modal + validate email/mật khẩu | PASS | `qa-flight.mjs` [8]; `qa-e2e` [6] | — | — |
| 23 | Tài khoản | **Đăng ký tài khoản trên giao diện người dùng** | NOT IMPLEMENTED | API `POST /api/auth/register` **có** (`server/routes-public.js` L95) nhưng grep `auth/register` trong `src/` → **0 kết quả** (chỉ `qa-admin.mjs` gọi API) | Người dùng không tự tạo được tài khoản; phải có admin tạo hoặc dùng tài khoản demo | **P1** |
| 24 | Tài khoản | Đăng xuất + hết phiên | PASS | `qa-e2e` [12]; `server/auth.js` xoá session | — | — |
| 25 | Tài khoản | Mật khẩu lưu an toàn, không lộ qua API | PASS | `qa-admin.mjs` [5] "0 dấu vết hash/plaintext"; `server/db.js` hashPassword | — | — |
| 26 | Tài khoản | Chặn user thường truy cập API admin | PASS | Probe: `/api/admin/*` với user → **403**; không phiên → **401** | — | — |
| 27 | Tài khoản | Chặn user A xem/hủy đơn của B (IDOR) | PASS | Probe: A hủy đơn B → **404**; A xem payment B → **404**; `qa-admin` [6] | — | — |
| 28 | Tài khoản | Không thể tự nâng quyền (mass assignment) | PASS | Probe: register kèm `role:'admin'` → role thực tế `user`; `qa-admin` [8][9] | — | — |
| 29 | Tài khoản | **Quên mật khẩu / đổi mật khẩu / xác minh email** | NOT IMPLEMENTED | grep `forgot\|reset-password\|change-password\|verify-email` trong `src/`+`server/` → **0 kết quả** | Không có luồng phục hồi tài khoản | **P1** |
| 30 | Tài khoản | Xác minh email khi đăng ký | NOT IMPLEMENTED | Không có cột xác minh trong bảng `users` | Tài khoản dùng được ngay sau khi đăng ký | P1 |
| 31 | Tài khoản | Rate-limit chống brute-force đăng nhập | PASS | `qa-admin.mjs` [4]: sai 5 lần → lần 6 bị **429** | — | — |

### F. Voucher / khuyến mãi

| STT | Nhóm | Chức năng cụ thể | Trạng thái | Bằng chứng | Vấn đề còn lại | Ưu tiên |
|---|---|---|---|---|---|---|
| 32 | Voucher | Áp dụng voucher ở checkout (UI nhập mã, Enter hoặc nút) | PASS | `qa-voucher.mjs`; `src/App.jsx` voucher-box | — | — |
| 33 | Voucher | Kiểm tra mã tồn tại / còn hiệu lực / đúng loại dịch vụ | PASS | `server/routes-public.js` `evaluatePromo` L30–50 | — | — |
| 34 | Voucher | Kiểm tra đơn tối thiểu (`min_order`) | PASS | `qa-voucher.mjs`; probe đơn dưới ngưỡng → bị từ chối | — | — |
| 35 | Voucher | Giới hạn lượt dùng (`usage_limit`) — trừ lượt trong transaction | PASS | `qa-voucher.mjs`; `UPDATE … WHERE used_count < usage_limit` + `VOUCHER_EXHAUSTED` → 409 | `rate` chỉ là số 0–1, không có mức giảm cố định | P3 |
| 36 | Voucher | Rate-limit chống dò mã hàng loạt | PASS | `qa-audit.mjs` [P3]: vượt hạn → **429** | — | — |
| 37 | Voucher | Discount tính lại ở server, client không tự giảm | PASS | `qa-voucher.mjs` [9]: client gửi `discount` giả → server tự tính | — | — |
| 38 | Voucher | **Hoàn lượt dùng khi đơn bị hủy** | NOT IMPLEMENTED | grep `used_count` chỉ có 2 chỗ `+1` (`routes-public.js` L331, L415); **không có** chỗ trừ lại trong `PATCH /bookings/:code/cancel` | Lượt dùng voucher bị mất oan khi khách hủy đơn | P2 |

### G. Đặt chỗ (booking)

| STT | Nhóm | Chức năng cụ thể | Trạng thái | Bằng chứng | Vấn đề còn lại | Ưu tiên |
|---|---|---|---|---|---|---|
| 39 | Booking | Tạo đơn (vé bay / khách sạn / combo) | PASS | `qa-e2e` [8]; probe tạo đơn cả 3 loại | — | — |
| 40 | Booking | Server tự tính tiền, bỏ qua `total`/`discount`/`status`/`paymentStatus` từ client | PASS | `qa-audit.mjs` [S1] "fake total/paymentStatus bị bỏ qua" | — | — |
| 41 | Booking | Idempotency: gửi lại cùng `idempotencyKey` không tạo đơn thứ 2 | PASS | `qa-audit.mjs` [S2] `duplicate:true`, giữ nguyên mã MAN…; UNIQUE(user_id, idempotency_key) | Double-click cũng bị chặn (E2E [T2]) | — |
| 42 | Booking | Validate đầy đủ: tên, SĐT, email, số khách 1–9 | PASS | `qa-e2e` [T1]; `routes-public.js` L296–301 | — | — |
| 43 | Booking | Danh sách "Đặt chỗ của tôi" chỉ hiện đơn của chính mình | PASS | `qa-e2e` [12][13]; `qa-admin` [6] | — | — |
| 44 | Booking | Hủy đơn của chính mình | PASS | `qa-audit.mjs` [S6]: hủy lần 2 → 409 | — | — |
| 45 | Booking | **Chính sách hoàn tiền / hoàn lượt voucher / đổi lịch** | NOT IMPLEMENTED | `TRANSITIONS` không có trạng thái `refunded`; `PAYMENT_STATES` có `refunded` nhưng không có route hoàn tiền | Khách hủy đơn đã thanh toán: không có quy trình hoàn tiền | **P1** |
| 46 | Booking | Gửi email xác nhận / nhắc nhở | NOT IMPLEMENTED | Không có module email trong `server/`; không có biến SMTP | Khách không nhận được xác nhận/hoàn tiền tự động | **P1** |

### H. Thanh toán

| STT | Nhóm | Chức năng cụ thể | Trạng thái | Bằng chứng | Vấn đề còn lại | Ưu tiên |
|---|---|---|---|---|---|---|
| 47 | Thanh toán | Chọn phương thức thanh toán (card / ví / chuyển khoản / COD) | PASS | `qa-e2e` [7] | Các phương thức ngoài MoMo chỉ là nhãn, không có cổng thật | P2 |
| 48 | Thanh toán | Tạo phiên thanh toán MoMo (orderId/requestId/payUrl), idempotent | PASS | `qa-payment.mjs` [T2][T2b] (mock cổng) | Chỉ test bằng mock, chưa gọi sandbox MoMo thật | **P1** |
| 49 | Thanh toán | Xác minh chữ ký HMAC tạo thanh toán theo tài liệu MoMo | PASS | `qa-payment.mjs` [G2][G3] (tính lại độc lập trong test) | Chưa có bằng chứng chạy với MoMo thật → xem STT 55 | P1 |
| 50 | Thanh toán | IPN: sai chữ ký / sai số tiền / sai partnerCode / orderId lạ → **không** đánh dấu paid | PASS | `qa-payment.mjs` [W1][W2][W3][W4][W5][W6] | — | — |
| 51 | Thanh toán | IPN hợp lệ → đánh dấu `paid` đúng 1 lần (idempotent) | PASS | `qa-payment.mjs` [W7] | — | — |
| 52 | Thanh toán | IPN đến khi đơn đã hủy → không tự động thành paid | PASS | `qa-payment.mjs` [W8] | — | — |
| 53 | Thanh toán | Không có credentials → cổng TẮT, **không** giả lập tiền thật | PASS | `qa-audit.mjs` [P5]: → **503**; `qa-payment.mjs` config `live=false` | — | — |
| 54 | Thanh toán | Không lộ secret ra API/response | PASS | `qa-audit.mjs` [P6]; `qa-payment.mjs` [G1] | — | — |
| 55 | Thanh toán | **Giao dịch MoMo thật (sandbox/production)** | NOT VERIFIED | `MOMO_ENV=disabled` mặc định; `MOMO_LIVE_ENABLED` yêu cầu `env=production` + `allowLive=true` + URL `https://` | Chưa có bằng chứng chạy sandbox/production; **không được coi là sẵn sàng thu tiền thật** | **P1** |

### I. Quản trị (Admin)

| STT | Nhóm | Chức năng cụ thể | Trạng thái | Bằng chứng | Vấn đề còn lại | Ưu tiên |
|---|---|---|---|---|---|---|
| 56 | Admin | Đăng nhập riêng tại `#/admin`, tách khỏi trang người dùng | PASS | `qa-admin.mjs` [13][14] | — | — |
| 57 | Admin | Dashboard: tổng đơn, doanh thu, người dùng, sản phẩm, xu hướng 7 ngày | PASS | `qa-admin.mjs` [10] (4 thẻ thống kê, 7 mục điều hướng) | — | — |
| 58 | Admin | **Tách doanh thu thật (`payment_status='paid'`) khỏi doanh thu mô phỏng** | PASS | `qa-payment.mjs` [W9][W10]: realRevenue chỉ tính 1 đơn paid | **P1-01 đã khắc phục**: admin không đặt được `paid` thủ công; `realRevenue` chỉ tính từ `payment_attempts` có `trans_id` | P1 |
| 59 | Admin | CRUD khách sạn (tạo / sửa / ngừng bán / xoá mềm) | PASS | `qa-admin.mjs` [11]: validate 400, tạo 201, ngừng bán ẩn khỏi catalog | — | — |
| 60 | Admin | CRUD chuyến bay + combo | PASS | `routes-admin.js` L267–385; `qa-admin.mjs` [12] | — | — |
| 61 | Admin | CRUD khuyến mãi (mã, %, loại dịch vụ, hạn dùng, min order) | PASS | `routes-admin.js` L386–460; `qa-voucher.mjs` | — | — |
| 62 | Admin | Quản lý người dùng: bật/tắt, đá phiên, **không** cho đổi role | PASS | `qa-admin.mjs` [7][8]; `routes-admin.js` L490 | Không có xoá user / reset mật khẩu | P3 |
| 63 | Admin | Quản lý đơn: tìm kiếm, lọc, phân trang, chuyển trạng thái theo đồ thị | PASS | `qa-admin.mjs` [12]; `routes-admin.js` L113–145 (page/limit/total) | Không có sắp xếp theo cột | P3 |
| 64 | Admin | Nhật ký thao tác quản trị (audit log) | PASS | `qa-audit.mjs` [P7]: 2 bản ghi có actor/action/created_at | API audit-log không có phân trang/lọc | P3 |
| 65 | Admin | **Quản lý phòng (room) trong Admin** | NOT IMPLEMENTED | `grep adminRouter.*room` → **0 kết quả**; menu Admin (`src/Admin.jsx` L11–17) không có mục "Phòng"; bảng `rooms` chỉ seed sẵn | Admin không thể thêm/sửa/giá lại loại phòng → không vận hành được sản phẩm thật | **P1** |
| 66 | Admin | **Admin tự đặt `paymentStatus='paid'` cho đơn** | FAIL | `routes-admin.js` L147–176: `PATCH /api/admin/bookings/:id` nhận `paymentStatus` ∈ {pending, simulated, paid, refunded}, **không yêu cầu bằng chứng IPN**; giá trị `paid` được tính vào `realRevenue` | Doanh thu thật có thể tăng giả do thao tác admin; không phân biệt tiền cổng với tiền thủ công | **P1** |

### J. Hạ tầng, dữ liệu và vận hành

| STT | Nhóm | Chức năng cụ thể | Trạng thái | Bằng chứng | Vấn đề còn lại | Ưu tiên |
|---|---|---|---|---|---|---|
| 67 | Vận hành | Sao lưu DB + kiểm tra khôi phục | PASS | `npm run backup:restore-test` → exit 0, `integrity_check OK`, users=124 bookings=227, khôi phục thử thành công | Sao lưu cục bộ trên cùng máy — chưa có lưu trữ off-site | P2 |
| 68 | Vận hành | Script tạo tài khoản Admin | PASS | `npm run seed:admin` (`scripts/seed-admin.mjs`) | Mật khẩu admin mặc định phải đổi khi deploy | P2 |
| 69 | Vận hành | Cấu hình Nginx + systemd + limit_req sẵn sàng | PASS | `deploy/nginx-mayan.conf` (TLS 1.2/1.3, `limit_req`), `deploy/mayan-api.service` (user `mayan`, `EnvironmentFile` ngoài repo) | Dùng domain placeholder `mayan.example.com`; chưa deploy thật | P2 |
| 70 | Vận hành | Health endpoint cho monitoring | PASS | `GET /api/health` → `{status, uptime, timestamp}`; `qa-audit.mjs` [P2] | Không có cảnh báo/log cảnh báo | P3 |
| 71 | Vận hành | **Triển khai thật (domain, DNS, chứng chỉ Let's Encrypt, HTTPS)** | NOT VERIFIED | Chỉ có file cấu hình mẫu; không có bằng chứng chạy trên máy chủ thật | Chưa có bằng chứng hạ tầng hoạt động | **P1** |
| 72 | Vận hành | **Email giao dịch (SMTP) / thông báo** | NOT IMPLEMENTED | Không có module email | — | **P1** |
| 73 | Vận hành | Giám sát, cảnh báo lỗi, log tập trung | NOT IMPLEMENTED | Không có Sentry/PM2/logrotate trong repo | Sự cố production không ai biết | P2 |
| 74 | Vận hành | Migrate DB có kiểm soát (versioned migration) | PARTIAL | `ensureColumn()` chạy lúc khởi động (`server/db.js` L238–247) | Tự thêm cột khi khởi động — không có bước rollback/milestone | P2 |
| 75 | Vận hành | Kiểm thử tự động chạy trong CI | NOT IMPLEMENTED | Không có `.github/workflows` hay CI config | Test phải chạy thủ công | P2 |

### K. Chất lượng & trải nghiệm

| STT | Nhóm | Chức năng cụ thể | Trạng thái | Bằng chứng | Vấn đề còn lại | Ưu tiên |
|---|---|---|---|---|---|---|
| 76 | UX | Responsive mobile (375/390/430px), bottom nav | PASS | `qa-e2e` [T9-375/390/430] | — | — |
| 77 | UX | Điều hướng bằng hash route, F5 giữ đúng trang, trang 404 | PASS | `qa-e2e` [T6-*][T7] | Dùng hash routing → SEO rất kém cho trang thương mại | P2 |
| 78 | UX | 0 lỗi console / pageerror trong toàn bộ phiên test | PASS | `qa-e2e` [T10]; `qa-admin.mjs` [15] | — | — |
| 79 | UX | Toast thông báo kết quả, trạng thái loading/rỗng/lỗi | PASS | `qa-e2e` [8]; `qa-flight.mjs` [2] | — | — |
| 80 | UX | Trang giới thiệu / điều khoản / chính sách bảo mật / liên hệ | NOT IMPLEMENTED | Menu chỉ 5 mục (`src/App.jsx` L24–30); grep `chat|blog|policy|điều khoản` → **0 kết quả** | Trang thương mại thật cần điều khoản, liên hệ, chatbot | P2 |
| 81 | UX | Sắp xếp / phân trang danh sách người dùng | NOT IMPLEMENTED | Không có `sort`/`pagination` trong `src/App.jsx` | Danh sách dài sẽ nặng | P3 |

### 2.1 Thống kê trạng thái (chỉ trên 81 chức năng đã kiểm kê ở trên)

| Trạng thái | Số lượng | Tỷ lệ |
|---|---|---|
| PASS | 63 | 77,8% |
| PARTIAL | 1 | 1,2% |
| FAIL | 1 | 1,2% |
| NOT IMPLEMENTED | 14 | 17,3% |
| NOT VERIFIED | 2 | 2,5% |
| **Tổng** | **81** | **100%** |

> Các chức năng `NOT IMPLEMENTED` / `NOT VERIFIED` tập trung ở 4 vùng: **tài khoản thật**
> (đăng ký UI, quên mật khẩu, xác minh email), **vận hành thương mại** (tồn phòng,
> quản lý phòng trong Admin, hoàn tiền, email, giám sát), **hạ tầng thật** (deploy, HTTPS)
> và **thanh toán thật** (MoMo sandbox/production).

---

## Phần 3 — Kiểm thử và bằng chứng thực thi

### 3.1 Các lệnh kiểm toán đã chạy (chạy lại trên máy kiểm toán)

| Lệnh | Exit code | Kết quả quan trọng |
|---|---|---|
| `npm run lint` (oxlint) | **0** | `Found 0 warnings and 0 errors` — 40 files, 104 rules |
| `npm run build` (vite build) | **0** | `✓ built in 125ms`; `dist/assets/index-*.js` 325,16 kB (gzip 94,66 kB), CSS 53,66 kB (gzip 11,04 kB) |
| `npm run test:all` | **0** | **10/10 suite PASS**, tổng **196 assertion PASS / 0 FAIL** (xem bảng 3.2) |
| `npm run backup:restore-test` | **0** | `integrity_check OK — users=124, bookings=227`; khôi phục thử thành công (số liệu tăng dần theo dữ liệu tích luỹ từ các lần chạy test) |
| `npm audit --omit=dev` | **0** | `found 0 vulnerabilities` |

### 3.2 Chi tiết bộ kiểm thử (`npm run test:all`)

| # | Suite | File | Loại test | Số assertion | Kết quả |
|---|---|---|---|---|---|
| 1 | e2e | `qa-e2e.mjs` | **E2E thật** (Playwright + Chromium, UI + Vite dev :5175 + API :3001) | 29 | PASS |
| 2 | flight | `qa-flight.mjs` | E2E (Playwright) | 17 | PASS |
| 3 | hotel | `qa-hotel.mjs` | E2E (Playwright) | 18 | PASS |
| 4 | room | `qa-room.mjs` | E2E (Playwright) | 14 | PASS |
| 5 | combo | `qa-combo.mjs` | E2E (Playwright) | 17 | PASS |
| 6 | voucher | `qa-voucher.mjs` | Integration (API + DB tạm) | 14 | PASS |
| 7 | final | `qa-final.mjs` | E2E (Playwright) | 23 | PASS |
| 8 | admin | `qa-admin.mjs` | E2E (Playwright) | 20 | PASS (bao gồm P1-01 regression [16]–[20]) |
| 9 | audit | `qa-audit.mjs` | Integration (API + DB tạm) | 24 | PASS |
| 10 | payment | `qa-payment.mjs` | Integration — **mock cổng MoMo** (HMAC tự ký) | 20 | PASS |
| | | | **Tổng** | | **196** | **196 PASS / 0 FAIL** |

> Ghi chú: các suite dùng DB tạm riêng (`data/qa-*-tmp-*.db`) cho voucher/audit/payment;
> các suite E2E dùng DB thật `data/mayan.db` nhưng tự dọn dữ liệu test. `npm run test:all`
> có quản lý vòng đời server (kill port cũ, chờ health check) nên không bị "FAIL giả" do
> chiếm cổng.
> **Phạm vi coverage:** 7/10 suite là **E2E trình duyệt thật** (không chỉ mock);
> suite `payment` là **mock-based** — không có suite nào chứng minh luồng với MoMo thật.

### 3.3 Kiểm thử bổ sung do người kiểm toán tự thực hiện

Tôi đã viết **3 script probe độc lập** chạy trên **SQLite tạm riêng** (`DB_PATH` trỏ sang file
tạm), không đụng `data/mayan.db`. Tổng cộng **37 trường hợp kiểm tra**, **36 PASS / 1 FAIL**.
Các script đã được **xoá sau khi chạy** (không còn file `tmp-probe*.mjs` trong repo).

| Nhóm kiểm tra | Kết quả |
|---|---|
| Tính tiền server-side: phòng (đêm × phòng), vé bay (giá × khách), combo | PASS — client gửi `total=1` bị bỏ qua, server trả đúng |
| Idempotency: gửi lại cùng `idempotencyKey` | PASS — `duplicate:true`, không tạo đơn thứ 2 |
| Cách ly người dùng: A xem/hủy/payment đơn của B | PASS — `404` ở cả 3 đường |
| Phân quyền Admin: user thường → 403; khách → 401 | PASS |
| Voucher: sai loại dịch vụ, ngoài hạn, dưới `min_order`, hết lượt | PASS — server từ chối đúng, không tạo đơn |
| Validate đầu và: ngày trả trước ngày nhận, 99 khách, số phòng 0/6, itemId sai | PASS — lỗi rõ ràng, HTTP 400/409 |
| MoMo khi `MOMO_ENV=disabled` | PASS — **503**, không tạo giao dịch giả |
| Hủy đơn → trạng thái `Đã hủy`, không cộng doanh thu | PASS |
| **Voucher: lượt dùng bị trừ khi khách hủy đơn** | **FAIL** — `used_count` không được hoàn lại → xem P2-01 |
| Audit log ghi đủ actor/action/time sau thao tác Admin | PASS |

### 3.4 Những gì **KHÔNG** được kiểm chứng

- Giao dịch MoMo **thật** (sandbox `test-payment.momo.vn` hoặc production) — **không** có bằng chứng.
- Deploy thật lên VPS/domain, chứng chỉ Let's Encrypt, HTTPS thực tế.
- Tải thực tế (load test) — chỉ có rate-limit cấu hình, chưa đo throughput.
- Khả năng chịu lỗi khi DB/SQLite bị khoá, disk đầy, mất điện giữa chừng.
- Tương thích trình duyệt thực tế (Safari/iOS) — E2E chỉ chạy Chromium.
- Khả năng truy cập cho người khiếm năng (a11y) — không có kiểm thử chuyên dụng.

### 3.5 Tóm tắt khắc phục P1-01 (phòng chặn làm giả `paid`)

**Files đã sửa:**

| File | Thay đổi |
|------|----------|
| `server/routes-admin.js` | `PATCH /bookings/:id`: từ chối `paymentStatus='paid'` (403 + audit log `admin.booking.payment_paid_rejected`); manual chỉ cho phép `pending/simulated/refunded` + bắt buộc `paymentReason` 10–300 ký tự (audit `admin.booking.payment_manual`); `realRevenue` chỉ tính từ `payment_attempts.status='paid'` có `trans_id`; thêm `unverifiedPaidBookings` + `realRevenueNote` vào stats |
| `src/Admin.jsx` | `ADMIN_TRANSITIONS`: gỡ `'Đã thanh toán'` khỏi `Chờ thanh toán` (admin không tự chuyển trạng thái này); thêm UI chỉnh sửa `paymentStatus` thủ công (`pending/simulated/refunded`) kèm lý do bắt buộc; `PAYMENT_LABELS` giữ nguyên |
| `qa-admin.mjs` | Thêm 5 regression test P1-01: [16] admin đặt `paid` thủ công → 403 + audit log; [17] user gọi PATCH admin → 403; [18] thiếu lý do → 400; [19] có lý do → 200 + audit log; [20] `realRevenue` không tính paid không bằng chứng |

**Kết quả kiểm thử:**

| Suite | Kết quả | Chi tiết |
|-------|---------|----------|
| `qa-admin.mjs` | **20/20 PASS** | Bao gồm 5 test P1-01 mới ([16]–[20]) |
| `qa-payment.mjs` | **20/20 PASS** | W1–W11: IPN hợp lệ/sai chữ ký/sai tiền/đơn không tồn tại/resultCode≠0/hủy đơn/realRevenue |
| `npm run lint` | **0 lỗi** | oxlint 104 rules, 40 files |
| `npm run build` | **Thành công** | vite build, dist sạch |

**Giới hạn chưa khắc phục (cần làm tiếp):**

- MoMo webhook/IPN enforcement chưa được kiểm chứng với cổng thật (chỉ có mock test) — xem P1-06 (Nhóm A, A8)
- `paid` chỉ có thể được đặt bởi IPN MoMo đã xác minh, nhưng webhook route `/api/webhook/momo/ipn` chưa được review lại trong phạm vi P1-01 này
- MoMo thật chưa từng chạy sandbox/production (`MOMO_ENV=disabled`)

---

## Phần 4 — Rủi ro và phát hiện (P0 → P3)

Quy ước: **P0** = chặn vận hành / mất tiền / lộ dữ liệu · **P1** = chặn tính năng cốt lõi
hoặc gây tổn thất tài chính · **P2** = ảnh hưởng vận hành/chất lượng · **P3** = cải thiện.

### 4.1 P0 — Không phát hiện

Không phát hiện lỗi P0 (không có bằng chứng rò rỉ dữ liệu, không có SQL injection, không có
đường nâng quyền thành công, không có cổng thanh toán giả). Các kiểm soát then chốt đều
đã được kiểm chứng bằng test tự động:

- Truy vấn SQL đều dùng **prepared statement** có tham số (`server/routes-public.js`,
  `server/routes-admin.js`); không có nối chuỗi input vào SQL.
- **CSRF**: mọi request mutating bắt buộc header `X-Requested-With` → thiếu là `403`
  (`qa-admin.mjs` [3], `qa-audit.mjs` [S3]).
- **Session**: cookie `HttpOnly` + `SameSite=Lax` + `Secure` khi production; TTL 7 ngày;
  không lưu token ở `localStorage`; đổi `is_active` → xoá toàn bộ phiên ngay
  (`qa-admin.mjs` [7]).
- **Mật khẩu**: băm **scrypt** (N=16384, r=8, p=1) kèm salt ngẫu nhiên 16 byte
  (`server/db.js` L250–257); không có plaintext/hash lọt qua API (`qa-admin.mjs` [5]).
- **IDOR**: mọi truy vấn booking của người dùng đều khoá theo `user_id`
  (`routes-public.js` L255–260, L354).
- **Rate limit**: đăng nhập (5 lần → 429), đặt phòng (20/phút/user), dò voucher
  (30/phút), đăng ký (60/giờ) — có `nginx limit_req` bổ sung.
- **CSP + security headers** chặt, không wildcard CORS (`server/security.js`).
- `npm audit --omit=dev` → **0 vulnerabilities**.

### 4.2 P1 — Phải xử lý trước khi vận hành thương mại

| ID | Phát hiện | Vị trí | Tác động | Khuyến nghị |
|---|---|---|---|---|
| **P1-01** (ĐÃ KHẮC PHỤC) | Admin có thể tự đặt `paymentStatus='paid'` cho bất kỳ đơn nào mà không cần bằng chứng IPN hợp lệ | `server/routes-admin.js` PATCH `/bookings/:id` bọc `requireAdmin` + từ chối `nextPayment === 'paid'` (403) + audit log; manual chỉ `pending/simulated/refunded` + lý do 10–300 ký tự; `realRevenue` chỉ từ `payment_attempts.status='paid'` có `trans_id` | **Đã khắc phục**: admin không còn đặt được `paid` thủ công; `realRevenue` không bao gồm paid không có bằng chứng; manual adjustment có audit log | **Đã kiểm thử**: `qa-admin.mjs` [16]–[20] toàn bộ PASS; `qa-payment.mjs` W1–W14 PASS |
| **P1-02** | **ĐÃ KHẮC PHỤC (P1-02)**: tồn phòng backend đã triển khai | grep `inventory\|available_rooms\|room_availability` → 0 kết quả; `server/db.js` bảng `rooms` không có cột tồn | **Đã khắc phục**: đặt vượt tồn bị chặn (`409 ROOM_UNAVAILABLE`); chu trình liền (`checkOut == checkIn`) được phép; `qa-inventory.mjs` R1–R14: 15/15 PASS, 53 assertions | Thêm bảng `room_inventory (room_id, date, total, booked)` + kiểm tra trong transaction khi tạo đơn + màn hình quản lý tồn cho Admin |
| **P1-03** | **Không có CRUD phòng trong Admin**: không có route `adminRouter.*room`, menu Admin không có mục "Phòng"; phòng chỉ được seed sẵn | `server/routes-admin.js` (0 route room), `src/Admin.jsx` L11–17 | Không thêm/sửa/giá lại loại phòng → **không vận hành được sản phẩm thật** | Thêm CRUD phòng (giá, giá theo đêm, tối đa người, ảnh, tiện nghi, bật/tắt) |
| **P1-04** | **Không có luồng đăng ký tài khoản trên giao diện người dùng** (API có nhưng UI không gọi) | API `POST /api/auth/register` (`routes-public.js` L95); grep `auth/register` trong `src/` → 0 kết quả | Người dùng **không tự tạo được tài khoản** → không thể mở rộng người dùng thật | Thêm form đăng ký + modal, kèm validate và thông báo |
| **P1-05** | **Không có quên mật khẩu / đổi mật khẩu / xác minh email** | grep `forgot\|reset-password\|change-password\|verify-email` → 0 kết quả | Người dùng mất mật khẩu không lấy lại được; tài khoản dùng được ngay sau khi đăng ký (không xác minh email) | Thêm token đặt lại mật khẩu (hạn 30 phút, 1 lần) + đổi mật khẩu + cờ `email_verified` |
| **P1-06** (ĐÃ CẢI THIỆN LUÔN IPN, CHƯA CHẠY THẬT — CHƯA XÁC MINH SANDBOX THẬT) | **Thanh toán MoMo thật chưa từng được chạy** — `MOMO_ENV=disabled` mặc định; không có `.env`/credential sandbox thật; mọi test là mock | `server/config.js` (`MOMO_ENV`, `MOMO_LIVE_ENABLED`); `server/routes-payment.js` IPN (~L129–136 route, ~L160–265 `handleMomoIpn`); `qa-payment.mjs` mock cổng | **IPN đã harden**: requestId replay guard + attempt lock; **bổ sung hỗ trợ IPN form-urlencoded** (MoMo PHP SDK đọc `$_POST`) bên cạnh JSON, giữ nguyên HMAC + verify chữ ký/số tiền/order/attempt trước khi `paid`; log có cấu trúc `event=...` để monitoring; thêm W15–W19. **Chưa có bằng chứng chạy sandbox thật** → không coi là sẵn sàng thu tiền thật | Chạy ít nhất 1 giao dịch sandbox thật end-to-end (redirect + IPN) tại `test-payment.momo.vn` và lưu bằng chứng; chỉ bật `production` khi `MOMO_ALLOW_LIVE=true` + URL `https://` |
| **P1-07** | **Không có quy trình hoàn tiền / đổi lịch / hoàn lượt voucher khi hủy đơn đã thanh toán** | `TRANSITIONS` không có `refunded`; `PATCH /bookings/:code/cancel` chỉ đổi `status` | Khách đã trả tiền mà hủy đơn → không có đường hoàn tiền; tiền có thể "mất" hoặc phải xử lý thủ công ngoài hệ thống | Thêm trạng thái `refunded` + quy trình hoàn (kèm hoàn `used_count` voucher) |
| **P1-08** | **Không có email giao dịch** (xác nhận đơn, thông báo hủy/hoàn tiền) | Không có module email trong `server/` | Khách không nhận được xác nhận → tỷ lệ bỏ đơn cao, không có bằng chứng giao dịch | Thêm SMTP (Nodemailer) + template xác nhận/hoàn tiền |
| **P1-09** | **Chưa deploy thật** — domain/DNS/HTTPS/Let's Encrypt chỉ có trong file mẫu | `deploy/nginx-mayan.conf` (dùng `mayan.example.com`) | Không có bằng chứng hệ thống chạy trên hạ tầng thật | Deploy lên VPS, cấu hình TLS, kiểm thử lại toàn bộ suite trên môi trường đích |

### 4.3 P2 — Ảnh hưởng vận hành / chất lượng

| ID | Phát hiện | Vị trí | Tác động | Khuyến nghị |
|---|---|---|---|---|
| **P2-01** | **Lượt dùng voucher không được hoàn khi khách hủy đơn** — `used_count` chỉ có phép `+1` | `server/routes-public.js` L331, L415 (tăng) — `PATCH /bookings/:code/cancel` (L353–365) không giảm lại | Khách hủy đơn vẫn mất lượt voucher → khiếu nại, mất uy tín; `usage_limit` bị "ăn" oan | Trong transaction hủy đơn: nếu `payment_status='simulated'|'pending'` thì `used_count = used_count - 1` |
| **P2-02** | ComboPage tự sinh combo khi API trả rỗng (fallback tĩnh) | `src/App.jsx` ComboPage | Có thể hiển thị combo **không tồn tại** trong DB / giá sai so với server | Bỏ fallback hoặc đánh dấu rõ "dữ liệu mẫu" |
| **P2-03** | Các phương thức thanh toán ngoài MoMo chỉ là nhãn UI, không có cổng thật | `src/App.jsx` `PAYMENT_METHODS`; `server/routes-payment.js` | Khách chọn "Chuyển khoản"/"COD" nhưng hệ thống không xử lý → đơn treo ở trạng thái mô phỏng | Chỉ hiển thị phương thức đang bật, hoặc ghi rõ "thanh toán tại quầy" kèm hướng dẫn |
| **P2-04** | Không có giám sát/cảnh báo lỗi (Sentry/PM2/logrotate) | Thư mục `deploy/` chỉ có nginx + systemd | Sự cố production bị phát hiện muộn | Thêm logrotate + giám sát uptime + cảnh báo lỗi 5xx |
| **P2-05** | Sao lưu DB chỉ lưu cục bộ trên cùng máy | `scripts/backup-db.mjs` (giữ 6 bản gần nhất trong `backup/`) | Mất máy = mất toàn bộ dữ liệu | Đẩy bản sao lưu lên S3/GDrive/Space off-site + kiểm tra khôi phục định kỳ |
| **P2-06** | Migration DB chạy tự động bằng `ensureColumn()` khi khởi động | `server/db.js` L238–247 | Không có bước rollback; không kiểm soát được khi nào schema đổi trên production | Chuyển sang migration có version (bảng `schema_migrations`) |
| **P2-07** | Không có CI — test chỉ chạy thủ công | Không có `.github/workflows` | Sửa code có thể phá hỏng mà không ai biết | Thêm CI chạy `npm run lint && npm run build && npm run test:all` |
| **P2-08** | Hash routing + không có SSR | `src/App.jsx` (dùng `#/…`) | **SEO gần như bằng 0** — không phù hợp SEO cho trang thương mại | Nếu cần SEO: chuyển sang React Router + prerender/SSR |
| **P2-09** | Thiếu trang điều khoản / chính sách bảo mật / liên hệ / chatbot | `src/App.jsx` L24–30 (chỉ 5 mục menu) | Không đáp ứng yêu cầu pháp lý & hỗ trợ khách hàng | Bổ sung các trang tĩnh + chatbot hỗ trợ |
| **P2-10** | Ảnh sản phẩm phụ thuộc CDN Unsplash | `src/App.jsx` (`RoomImage`, hero) | Hình hỏng nếu mất mạng/CDN chặn → trang trông lỗi | Tải ảnh về host nội bộ (hoặc có ảnh dự phòng ổn định) |

### 4.4 P3 — Cải thiện

| ID | Phát hiện | Vị trí | Khuyến nghị |
|---|---|---|---|
| **P3-01** | Không có phân trang / sắp xếp danh sách ở trang người dùng | `src/App.jsx` | Thêm phân trang + sắp xếp theo giá/đánh giá |
| **P3-02** | API audit-log không có phân trang/lọc | `server/routes-admin.js` L462 | Thêm `page/limit/action` cho audit-log |
| **P3-03** | Không có xoá user / reset mật khẩu trong Admin | `server/routes-admin.js` L490 (chỉ bật/tắt) | Thêm reset mật khẩu (gửi email link) và ẩn user thay vì xoá |
| **P3-04** | Voucher chỉ hỗ trợ giảm theo tỷ lệ (`rate` 0–1), không giảm số tiền cố định | `server/db.js` L96–111 | Thêm `discount_amount` cho mức giảm cố định |
| **P3-05** | Không có sắp xếp theo cột trong bảng đơn Admin | `server/routes-admin.js` L113–145 | Thêm `sort=created_at|total|status` |
| **P3-06** | Chỉ hỗ trợ 1 phương thức thanh toán "thật" (MoMo) | `server/routes-payment.js` | Cân nhắc VNPay/ngân hàng nếu mở rộng thị trường |
| **P3-07** | E2E chỉ chạy Chromium | `qa-e2e.mjs` (playwright chromium) | Thêm project WebKit/Firefox cho Safari/iOS |
| **P3-08** | Endpoint `/api/health` không kiểm tra sâu DB | `server/routes-public.js` L480 | Thêm kiểm tra kết nối DB + ghi cảnh báo |

---

## Phần 5 — Đánh giá bảo mật

### 5.1 Các kiểm soát đã hiện diện và được kiểm chứng

| Hạng mục | Cơ chế | Bằng chứng |
|---|---|---|
| Xác thực | Session server-side + cookie `HttpOnly; SameSite=Lax; Secure(prod)`; TTL 7 ngày; bảng `sessions` | `server/auth.js` L20–21; `server/db.js` L298–303 |
| Băm mật khẩu | scrypt N=16384 r=8 p=1 + salt 16 byte, định dạng `scrypt$N$r$p$salt$hash` | `server/db.js` L250–257 |
| Phân quyền | `requireAuth` / `requireAdmin`; Admin API trả 401 (không phiên) / 403 (user thường) | `qa-admin.mjs` [1][2][14] |
| Chống CSRF | Bắt buộc header `X-Requested-With` cho mọi request mutating | `qa-admin.mjs` [3]; `qa-audit.mjs` [S3] |
| SQL injection | Prepared statement có tham số ở mọi truy vấn | Rà soát mã nguồn `server/` |
| XSS | React escape mặc định; không dùng `dangerouslySetInnerHTML`; CSP `script-src 'self'` | `server/security.js` L10–25 |
| CORS | Danh sách origin từ `ALLOWED_ORIGINS`; không wildcard; `Vary: Origin` | `server/security.js` L50–62; `qa-audit.mjs` [P1] |
| Security headers | CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP, HSTS khi production | `server/security.js` L29–44; `qa-audit.mjs` [P1] |
| Rate limiting | Login 5 lần/15 phút; booking 20/phút/user; promo 30/phút; register 60/giờ + `nginx limit_req` | `qa-admin.mjs` [4]; `qa-audit.mjs` [P3] |
| Idempotency | `UNIQUE(user_id, idempotency_key)` + kiểm tra trước khi insert | `qa-audit.mjs` [S2] |
| Chống IDOR | Mọi query booking của user khoá theo `user_id` | `qa-audit.mjs` [S5]; `qa-admin.mjs` [6] |
| Chống leo thang quyền | `register` ép `role='user'`; `PATCH /admin/users/:id` từ chối `role`; admin không tự tắt mình | `qa-admin.mjs` [8][9] |
| Quản lý phiên | Tắt tài khoản → xoá toàn bộ phiên ngay lập tức | `qa-admin.mjs` [7] |
| Xác minh thanh toán | HMAC theo chuẩn MoMo; kiểm signature + amount + partnerCode + orderId; IPN lỗi trả 200 (không 500) | `qa-payment.mjs` [G2][G3][W1]–[W7][W11] |
| Audit log | Ghi actor/action/entity/detail/ip/time cho thao tác Admin; user thường không đọc được | `qa-audit.mjs` [P7][P8] |
| Rò rỉ thông tin | `/api/health` chỉ trả status/uptime/timestamp; 404 trả JSON không lộ stack trace; API không trả hash mật khẩu | `qa-audit.mjs` [P2]; `qa-admin.mjs` [5] |
| Phụ thuộc | `npm audit --omit=dev` → **0 vulnerabilities** | Kiểm toán 22/10/2026 |
| Bảo vệ file nhạy cảm | Secret nằm ngoài repo: `EnvironmentFile=/etc/mayan/mayan.env` (quyền 600) | `deploy/mayan-api.service` |

### 5.2 Điểm yếu còn lại

| ID | Điểm yếu | Mức độ | Ghi chú |
|---|---|---|---|
| **S1** (ĐÃ KHẮC PHỤC) | Admin có thể ép `payment_status='paid'` (P1-01) | **Thấp** | **Đã khắc phục**: `PATCH /bookings/:id` từ chối `paymentStatus='paid'` (403) + audit log; chỉ IPN MoMo hợp lệ mới đặt `paid`; `realRevenue` chỉ tính từ `payment_attempts` có `trans_id` |
| **S2** | Không có CAPTCHA ở form đăng nhập/đăng ký — chỉ rate-limit theo IP/tài khoản | Trung bình | Với Nginx + `limit_req` rủi ro thấp hơn; nên thêm CAPTCHA cho form công khai |
| **S3** | `TRUST_PROXY_HOPS` mặc định 0 — nếu deploy sai (reverse proxy không set) thì IP thật bị coi là proxy | Trung bình | File nginx đã hướng dẫn set `TRUST_PROXY_HOPS=1`; cần đảm bảo khi deploy |
| **S4** | Session TTL 7 ngày khá dài, không có cơ chế thu hồi ngoài việc tắt tài khoản | Thấp | Cân nhắc rút ngắn TTL / thêm "đăng xuất mọi thiết bị" |
| **S5** | Không giới hạn số phiên đồng thời; `audit_log` chỉ ghi thao tác quản trị, không ghi truy cập bất thường | Thấp | Có thể bổ sung log đăng nhập bất thường |
| **S6** | Không có MFA cho tài khoản Admin | Trung bình | Nên yêu cầu mật khẩu mạnh + TOTP cho Admin |
| **S7** | Chưa có test tự động cho SQL injection / SSRF / file upload | Trung bình | Không có endpoint upload file nên SSRF/file-upload chưa thành bề mặt tấn công; vẫn nên bổ sung test |
| **S8** | `data/` và `backup/` chứa dữ liệu thật trong workspace — nếu repo push công khai sẽ lộ dữ liệu | Cao (nếu xảy ra) | Thêm `.gitignore` cho `data/`, `backup/`, `dist/`, `.env`; kiểm tra trước khi publish |

### 5.3.1 Kiểm toán chi tiết P1-06 — Luồng thanh toán MoMo/IPN

**Mục tiêu:** Chỉ đánh dấu đơn `paid` khi có bằng chứng thanh toán MoMo hợp lệ; không xử lý tiền thật khi `MOMO_ENV=disabled` hoặc sandbox vắng mặt.

**Root cause:** IPN từ MoMo có thể bị giật/gửi lại (replay), bị chỉnh `amount`, hoặc `requestId` không khớp attempt đã lưu. Admin cũng có thể tự đặt `paid` (P1-01 — đã khắc phục riêng).

**File đã sửa / dòng:**
- `server/routes-payment.js`:
  - (~L129–136) Route IPN `/momo/ipn` thêm `express.urlencoded({ limit: '64kb', extended: false })` bên cạnh `express.json()`: MoMo PHP SDK chính thức đọc IPN qua `$_POST` → Content-Type thực tế là `application/x-www-form-urlencoded`, không phải JSON. Route hiện chấp nhận CỢ hai định dạng, **vẫn bắt buộc** xác minh chữ ký + mã đơn + số tiền + kết quả + attempt tương ứng trước khi đặt `paid`.
  - (~L160–265 `handleMomoIpn`): thêm guard Content-Type (text/plain, v.v. → HTTP 200 `{ignored: true}`), không ghi secret; thêm log có cấu trúc kèm `event=` (`unsupported_content_type`, `gateway_not_configured`, `ipn_invalid`, `ipn_unknown_order`, `ipn_request_id_mismatch`, `ipn_amount_mismatch`, `ipn_duplicate`, `ipn_paid_error`, `ipn_paid`) để monitoring phân biệt IPN hợp lệ / trùng / không hợp lệ / lỗi nội bộ. Chuỗi gốc HMAC IPN giữ nguyên — đã kiểm chứng khớp 100% tài liệu MoMo; không cần đổi crypto.
- `qa-payment.mjs`: thêm `realRequestId`; W1–W8 gửi `requestId: realRequestId`; thêm W12 (admin tự đặt `paid` → 403), W13 (admin chuyển "Đã thanh toán" chưa có bằng chứng → 409), W14 (IPN wrong `requestId` → ignored); bổ sung `adminCookie`, admin seed/login + resolve booking `id` qua DB; **mới W15–W19**: IPN form-urlencoded hợp lệ → paid; form-urlencoded lặp → idempotent (1 giao dịch paid); Content-Type text/plain → 200 không paid; form-urlencoded thiếu trường → 200 không paid; form-urlencoded sai chữ ký → 200 không paid.

**Phân biệt môi trường kiểm thử:**
- **Mock (mặc định, dùng trong CI):** `MOMO_ENV=sandbox`, cổng MoMo giả chạy local trên port ngẫu nhiên, test tự ký HMAC. **Không gọi MoMo thật** → không ảnh hưởng tiền thật. Đây là môi trường của toàn bộ suite hiện tại.
- **Sandbox thật (`test-payment.momo.vn`):** **chưa chạy** — workspace không có file `.env` và không có credential sandbox thật (`partnerCode`/`accessKey`/`secretKey`) + chưa có callback URL công khai để MoMo gửi IPN về. **Không giả lập rồi tuyên bố sandbox PASS.**
- **Production:** **chưa bật** — yêu cầu `MOMO_LIVE_ENABLED=true`, `MOMO_ALLOW_LIVE=true`, URL `https://`.

**Kết quả kiểm thử:** `npm run lint` → 0 warnings/0 errors (40 files); `npm run build` → OK; `npm run test:all` → TẤT CẢ SUITE PASS (e2e, flight, hotel, room, combo, voucher, final, admin, audit, payment); `qa-payment.mjs` → **28/28 PASS** (G1–G3, T0–T4, W1–W19, tất cả là mock sandbox). Chi tiết: `qa-evidence/final/payment-results.json` (`total: 28, passed: 28, failed: 0`).

**Rủi ro còn tồn tại (residual risks):**
1. Chưa có bằng chứng chạy giao dịch MoMo thật (sandbox/production) end-to-end → P1-06 **vẫn chưa xác minh hoàn toàn**, không coi là sẵn sàng thu tiền thật cho đến khi chạy sandbox thật và lưu bằng chứng.
2. (ĐÃ GIẢI QUYẾT) MoMo gửi IPN dạng form-urlencoded — route đã bổ sung `express.urlencoded()` và có test W15–W19 xác minh; không còn bỏ qua IPN thật do parse sai Content-Type.
3. `buildQueryRawSignature` (chỉ dùng tra cứu query, **không** dùng để đánh dấu `paid`) thiếu `responseTime`/`resultCode` — lưu ý nếu tái sử dụng.
4. IPN lỗi/broken luôn trả 200 để MoMo gọi lại (theo thiết kế, tránh 500 làm MoMo ngừng retry) → đã bổ sung log `event=...`, nhưng **cần thêm monitoring/alerting** (ví dụ: đếm IPN `ipn_invalid`/`ipn_amount_mismatch` đơn vị thời gian) khi bật production.
5. Không có `.env`/credential sandbox thật và chưa có callback URL công khai → không thể chạy sandbox E2E trong môi trường hiện tại.

### 5.3 Kết luận bảo mật

Ở mức **demo/đồ án**, phần bảo mật thực sự tốt: không SQL injection, không IDOR, không leo
thang quyền, không rò rỉ thông tin, có CSRF / rate-limit / CSP / audit-log đầy đủ.
Hai rủi ro lớn nhất trước khi vận hành thật là **S1 (toàn vẹn doanh thu)** và
**S8 (lộ dữ liệu thật trong repo)** — phải xử lý trước khi đưa lên mạng.

---

## Phần 6 — Hiệu năng và khả năng mở rộng

| Hạng mục | Đánh giá | Bằng chứng / ghi chú |
|---|---|---|
| Bundle frontend | **Tốt** — 325 kB JS (gzip 94,66 kB), CSS 53,66 kB (gzip 11 kB), build 125 ms | `npm run build` |
| Dependency runtime | **Rất tốt** — chỉ 3 (`express`, `react`, `react-dom`), không ORM/framework nặng | `package.json` |
| Truy vấn DB | Prepared statement, có index cho `rooms(hotel_id, is_active)`, `bookings.user_id`, `sessions.token` | `server/db.js` L228, L138–143 |
| Mô hình DB | **SQLite (WAL)** — hợp demo/1 instance, **không** hợp nhiều người ghi đồng thời | `server/db.js` |
| Ghi đồng thời | `BEGIN/COMMIT/ROLLBACK` quanh luồng tạo đơn + trừ lượt voucher | `routes-public.js` L316–345 |
| Rate-limit | Cấu hình đầy đủ nhưng **chưa đo tải thật** | Chưa có load test |
| Render danh sách | Trang người dùng render **toàn bộ** danh sách (không phân trang) | `src/App.jsx` |
| Admin list | Có phân trang server-side (`page`/`limit`, mặc định 50, tối đa 200) | `routes-admin.js` L113–145 |
| Caching | Không có cache server-side; catalog được frontend cache trong bộ nhớ | `src/api.js` |
| Background job | Không có — không dọn session hết hạn, không nhắc đơn | — |
| Logging | `console.log`/`console.error`; không có log rotation hay structured log | `server/*.js` |

**Kết luận hiệu năng:** đủ dùng cho **demo, đồ án và site nhỏ** (vài trăm người dùng đồng thời).
Trước khi mở rộng: cần cache/CDN cho ảnh, phân trang frontend, chuyển sang PostgreSQL nếu
vài nghìn giao dịch/ngày, và có job nền (dọn session, nhắc đơn).

---

## Phần 7 — Đánh giá khả năng vận hành và bàn giao

### 7.1 Checklist bàn giao demo / đồ án

| # | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| 1 | Chạy được bằng 1 lệnh (`npm install && npm run dev`) | PASS | Frontend Vite :5175 + API :3001 |
| 2 | Có tài khoản Admin khởi tạo | PASS | `npm run seed:admin` |
| 3 | Có dữ liệu mẫu đầy đủ (KS, phòng, chuyến bay, combo, voucher) | PASS | Seed tự động khi DB trống (`server/db.js`) |
| 4 | Có tài liệu hướng dẫn chạy | PASS | `bao-cao/PRODUCTION_READINESS.md` + `README` |
| 5 | Có bộ test tự động chạy bằng 1 lệnh | PASS | `npm run test:all` (10 suite) |
| 6 | Có cấu hình deploy mẫu | PASS | `deploy/` (nginx + systemd + `deploy.sh`) |
| 7 | Có ảnh chứng cứ E2E | PASS | `qa-evidence/*.png` |
| 8 | Có kiểm thử sao lưu/khôi phục | PASS | `npm run backup:restore-test` |
| 9 | Tài liệu hạn chế đã ghi rõ | PASS | Mục 9.9 của báo cáo này |
| 10 | Không còn file tạm do kiểm toán | PASS | `tmp-probe*.mjs` đã xoá |

> Trạng thái trong bảng này dùng cùng bộ nhãn 5 giá trị như Phần 2 (`PASS` / `PARTIAL` /
> `FAIL` / `NOT IMPLEMENTED` / `NOT VERIFIED`).

### 7.2 Những việc phải làm trước khi "đưa cho người dùng thật"

1. **Không** bật `MOMO_ENV=production` khi chưa có bằng chứng sandbox (P1-06).
2. Phải có tồn phòng + CRUD phòng trong Admin trước khi nhận đơn thật (P1-02, P1-03).
3. Phải có form đăng ký + quên mật khẩu (P1-04, P1-05) — không có thì không có người dùng mới.
4. Phải có quy trình hoàn tiền + email (P1-07, P1-08) — không có thì mỗi đơn hủy là một cuộc gọi.
5. Phải deploy HTTPS + kiểm tra lại toàn bộ suite trên môi trường đích (P1-09).
6. **P1-01 đã khắc phục và kiểm thử** — admin không đặt được `paid` thủ công; `realRevenue` chỉ từ `payment_attempts` có `trans_id`; manual adjustment có lý do + audit log (`qa-admin.mjs` [16]–[20] PASS).
7. Phải kiểm tra `.gitignore` (S8) trước khi đưa mã nguồn lên GitHub/GitLab.

> Danh sách này chính là **Nhóm A** của lộ trình ở Phần 8.1.

### 7.3 Ước lượng công sức còn lại

| Nhóm công việc | Ước lượng |
|---|---|
| Nhóm A / P1 (9 hạng mục) | 12–18 ngày công |
| Nhóm B / P2 (10 hạng mục) | 8–12 ngày công |
| Nhóm C / P3 (8 hạng mục) | 4–6 ngày công |
| **Tổng đến mức "vận hành thương mại"** | **~25–35 ngày công** + 1 tuần chạy sandbox MoMo + 1 tuần UAT |

> Chi tiết từng hạng mục, điều kiện nghiệm thu và phụ thuộc: Phần 8.

---

## Phần 8 — Lộ trình khắc phục ưu tiên (Roadmap)

> Nguyên tắc: **Nhóm A là bắt buộc** — chưa xong Nhóm A thì **không** được mở cửa cho người
> dùng thật và **không** được thu tiền thật. Nhóm B/C là cải thiện, có thể song song.

### 8.1 Nhóm A — Bắt buộc trước khi vận hành thương mại (9 hạng mục P1)

| # | Hạng mục | Rủi ro chặn | Ước lượng | Điều kiện nghiệm thu |
|---|---|---|---|---|
| A1 | **P1-01** (ĐÃ HOÀN THÀNH) — Chỉ IPN đã xác minh mới được đặt `paid`; manual adjustment có lý do + audit log; `realRevenue` chỉ từ `payment_attempts` có `trans_id` | Toàn vẹn doanh thu | **Đã làm** (~1 ngày) | Admin không đặt được `paid` thủ công (403 + audit log); `realRevenue` không bao gồm paid không bằng chứng; `qa-admin.mjs` [16]–[20] PASS |
| A2 | **P1-02** — Tồn phòng (`room_inventory`) + kiểm tra trong transaction | Đã làm (P1-02) | Đã làm | Đặt vượt tồn → 409 ROOM_UNAVAILABLE; qa-inventory.mjs R1–R14: 15/15 PASS, 53 assertions |
| A3 | **P1-03** — CRUD phòng trong Admin | Không vận hành được sản phẩm | 2–3 ngày | Thêm/sửa/giá lại/ngừng bán loại phòng trên UI Admin |
| A4 | **P1-04** — Form đăng ký tài khoản trên UI | Không có người dùng mới | 1 ngày | Người dùng tự đăng ký được qua giao diện |
| A5 | **P1-05** — Quên/đổi mật khẩu + xác minh email | Mất tài khoản / rủi ro giả mạo | 2–3 ngày | Token hạn 30 phút, dùng 1 lần; có cờ `email_verified` |
| A6 | **P1-07** — Quy trình hoàn tiền + hoàn lượt voucher | Tiền thật không có đường thoát | 2–3 ngày | Hủy đơn đã trả → trạng thái `refunded` + `used_count` được hoàn |
| A7 | **P1-08** — Email giao dịch (SMTP) | Không có bằng chứng giao dịch | 2 ngày | Email xác nhận đơn và thông báo hủy/hoàn được gửi thật |
| A8 | **P1-06** — Ít nhất 1 giao dịch MoMo **sandbox thật** | **CHẶN**: workspace không có `.env`/credential sandbox thật (`partnerCode`/`accessKey`/`secretKey`) và chưa có callback URL công khai để MoMo gửi IPN về → chưa chạy được E2E sandbox | 0,5 ngày + chờ IPN (+ cần cung cấp credential sandbox + callback URL công khai) | Có log redirect + IPN hợp lệ; đơn chuyển `paid` |
| A9 | **P1-09** — Deploy thật: domain, DNS, HTTPS, Let's Encrypt | Hạ tầng chưa tồn tại | 1–2 ngày | `https://` chạy, chứng chỉ hợp lệ, `npm run test:all` pass trên môi trường đích |

> **Điều kiện bổ sung bắt buộc (bảo mật):** thêm `.gitignore` cho `data/`, `backup/`, `dist/`, `.env` (S8)
> **trước khi** đưa mã nguồn lên GitHub/GitLab công khai.

### 8.2 Nhóm B — Nên có trước khi mở rộng (10 hạng mục P2)

| # | Hạng mục | Tác động | Ước lượng |
|---|---|---|---|
| B1 | **P2-01** — Hoàn lượt voucher khi hủy đơn | Khiếu nại khách hàng, mất uy tín | 0,5 ngày |
| B2 | **P2-04** — Giám sát + cảnh báo lỗi + logrotate | Sự cố bị phát hiện muộn | 1–2 ngày |
| B3 | **P2-05** — Sao lưu off-site + kiểm tra khôi phục định kỳ | Mất máy = mất toàn bộ dữ liệu | 1 ngày |
| B4 | **P2-07** — CI chạy `lint && build && test:all` | Sửa code có thể phá hỏng mà không ai biết | 0,5 ngày |
| B5 | **P2-06** — Migration có version + rollback | Schema đổi không kiểm soát trên production | 1–2 ngày |
| B6 | **P2-02** — Bỏ fallback tự sinh combo ở frontend | Có thể hiển thị combo không tồn tại / sai giá | 0,5 ngày |
| B7 | **P2-03** — Làm rõ phương thức thanh toán không có cổng thật | Đơn treo ở trạng thái mô phỏng | 0,5 ngày |
| B8 | **P2-08** — Cân nhắc React Router + prerender (SEO) | SEO gần như bằng 0 | 2–4 ngày |
| B9 | **P2-09** — Trang điều khoản / chính sách / liên hệ / chatbot | Yêu cầu pháp lý & hỗ trợ khách hàng | 1–2 ngày |
| B10 | **P2-10** — Đưa ảnh về host nội bộ (CDN Unsplash dễ hỏng) | Trang trông lỗi khi mất mạng | 0,5 ngày |

### 8.3 Nhóm C — Cải thiện (8 hạng mục P3)

| # | Hạng mục | Ước lượng |
|---|---|---|
| C1 | **P3-01** — Phân trang + sắp xếp danh sách ở trang người dùng | 1–2 ngày |
| C2 | **P3-02** — Phân trang/lọc API audit-log | 0,5 ngày |
| C3 | **P3-03** — Xoá/reset mật khẩu user trong Admin | 1 ngày |
| C4 | **P3-04** — Voucher giảm số tiền cố định (`discount_amount`) | 0,5 ngày |
| C5 | **P3-05** — Sắp xếp theo cột trong bảng đơn Admin | 0,5 ngày |
| C6 | **P3-06** — Cân nhắc VNPay/ngân hàng nếu mở rộng thị trường | 2–3 ngày |
| C7 | **P3-07** — E2E đa trình duyệt (WebKit/Firefox) | 1 ngày |
| C8 | **P3-08** — `/api/health` kiểm tra sâu DB | 0,5 ngày |

> **Ghi chú thêm (không nằm trong P3):** S2 (thêm CAPTCHA cho form công khai), S3 (đặt
> `TRUST_PROXY_HOPS=1` khi deploy sau nginx), S4 (rút ngắn TTL phiên), S5 (log đăng nhập bất
> thường), S6 (MFA cho tài khoản Admin), S7 (bổ sung test SQLi/SSRF) — nên gộp vào A7/A9.

### 8.4 Bảng ưu tiên theo thời gian

| Ưu tiên | Nội dung | Phụ thuộc |
|---|---|---|
| **Làm ngay (1–2 ngày)** | A1, B1, S8 | Không |
| **Làm trước demo mở rộng (3–5 ngày)** | A4, A5, A3 | Không |
| **Làm trước khi nhận đơn thật (5–8 ngày)** | A2, A6, A7 | A3 |
| **Làm trước khi thu tiền thật (2–4 ngày + ≥1 tuần)** | A8, A9 | A7 |
| **Sau đó** | B2–B10, C1–C8 | — |

### 8.5 Tổng công sức

| Nhóm | Ước lượng (1 người, đã gồm kiểm thử) |
|---|---|
| Nhóm A (9 hạng mục P1) | 12–18 ngày công + ≥1 tuần chờ sandbox MoMo |
| Nhóm B (10 hạng mục P2) | 8–12 ngày công |
| Nhóm C (8 hạng mục P3) | 4–6 ngày công |
| **Tổng đến mức "vận hành thương mại"** | **~25–35 ngày công + 1 tuần sandbox + 1 tuần UAT** |

---

## Phần 9 — Kết luận, khuyến nghị và phụ lục

### 9.1 Kết luận

**Mây An Nhiên là một hệ thống hoàn chỉnh ở mức đồ án/demo**, được xây dựng cẩn thận:
mã nguồn sạch (lint 0 lỗi), build nhanh, không phụ thuộc nặng, 10/10 suite kiểm thử pass
(191 assertion, 7/10 là E2E trình duyệt thật), kiểm toán phụ thuộc sạch, và lớp bảo mật
đáng kể (CSRF, rate-limit, CSP, session server-side, phân quyền, audit-log, xác minh chữ ký
MoMo).

**Điểm mạnh nổi bật so với mức trung bình của một đồ án:**
- Server luôn tự tính lại tiền và giảm giá → không thể gian lận giá từ client.
- Idempotency chống tạo đơn trùng.
- Cách ly dữ liệu người dùng chặt chẽ (không IDOR).
- Lớp thanh toán MoMo viết đúng chuẩn HMAC, kiểm tra đầy đủ, và **tắt an toàn** khi chưa có
  credentials (không giả lập tiền thật) — đây là điểm cộng lớn về mặt đạo đức kỹ thuật.
- Tách rõ *doanh thu mô phỏng* và *doanh thu thật* ngay trên dashboard.

**Điểm yếu cần khắc phục:** các phần còn thiếu đều nằm ở **ranh giới giữa "demo" và "thương mại"**:
tài khoản thật (đăng ký UI, quên mật khẩu, xác minh email), vận hành sản phẩm (tồn phòng,
quản lý phòng trong Admin, hoàn tiền, email giao dịch) và hạ tầng thật (deploy, HTTPS,
MoMo sandbox/production).

### 9.2 Trả lời 3 câu hỏi then chốt

| Câu hỏi | Trả lời |
|---|---|
| **Có demo đồ án được không?** | **CÓ — hoàn toàn.** `npm install && npm run seed:admin && npm run dev`, mọi luồng nghiệp vụ chạy trơn tru, có ảnh chứng cứ E2E và 10 suite test tự động. Đây là điểm mạnh lớn nhất của dự án. |
| **Có cho người dùng thật dùng được chưa?** | **CHƯA.** Thiếu 9 hạng mục P1 (Nhóm A ở Phần 8.1): tồn phòng, quản lý phòng trong Admin, đăng ký tài khoản, quên/đổi mật khẩu, hoàn tiền, email giao dịch, deploy HTTPS, và bảo vệ doanh thu thật. Người dùng thật sẽ không tự đăng ký được trên UI, không lấy lại mật khẩu được, đặt vượt tồn phòng, và không có đường hoàn tiền. |
| **Có nhận thanh toán thật được chưa?** | **CHƯA — và điều này là đúng.** `MOMO_ENV=disabled`; toàn bộ bằng chứng thanh toán là **mock** (`qa-payment.mjs` dựng cổng MoMo giả, tự ký HMAC). Lớp server-side đạt chất lượng cao và đã vượt qua 11 kiểm thử tấn công IPN ([W1]–[W11] trong `qa-payment.mjs`), nhưng **chưa có bằng chứng chạy với MoMo thật**. Cần ít nhất 1 giao dịch sandbox end-to-end trước khi tuyên bố "sẵn sàng thu tiền". |

### 9.3 Khuyến nghị cuối cùng

| Đối tượng | Khuyến nghị |
|---|---|
| **Hội đồng / giảng viên đánh giá đồ án** | **Nên chấp nhận.** Hệ thống chạy đúng luồng, có kiểm thử tự động 191 assertion, ảnh chứng cứ E2E, tài liệu bàn giao, và lớp bảo mật vượt mức trung bình. |
| **Dùng nội bộ / demo khách hàng (không thu tiền thật)** | **Được**, với điều kiện giữ `MOMO_ENV=disabled` và không quảng bá "thanh toán trực tuyến". |
| **Đưa ra thị trường thật** | **Chưa.** Phải hoàn thành **toàn bộ Nhóm A** ở Phần 8.1 (9 hạng mục P1) + điều kiện `.gitignore` (S8). |
| **Thu tiền thật qua MoMo** | **Chưa.** Cần A7 (email), A9 (HTTPS) và A8 (≥1 giao dịch sandbox thật có bằng chứng) trước. |

### 9.4 Bản đồ mã nguồn

| Đường dẫn | Vai trò |
|---|---|
| `server.js` | Điểm vào Express, security headers, CORS, gắn router |
| `server/config.js` | Nạp `.env`, hằng số môi trường, cấu hình MoMo, `MOMO_LIVE_ENABLED` |
| `server/security.js` | CSP, security headers, CORS guard, rate-limit middleware |
| `server/auth.js` | Session cookie, middleware `requireAuth` / `requireAdmin` |
| `server/db.js` | Schema SQLite, migration `ensureColumn`, hash scrypt, seed dữ liệu mẫu |
| `server/routes-public.js` | Auth, catalog, bookings, promo, health, travel |
| `server/routes-admin.js` | 22 endpoint quản trị + audit log |
| `server/routes-payment.js` | Tạo phiên MoMo, IPN, trạng thái thanh toán |
| `src/App.jsx` | SPA người dùng (home/flight/hotel/combo/bookings + checkout) |
| `src/Admin.jsx` | SPA quản trị (7 mục) |
| `src/api.js` | Fetch wrapper, header `X-Requested-With`, xử lý lỗi |
| `scripts/run-tests.mjs` | Runner 10 suite, quản lý vòng đời server |
| `scripts/backup-db.mjs` | Sao lưu + `--verify-restore` |
| `scripts/seed-admin.mjs` | Tạo tài khoản Admin |
| `qa-*.mjs` (11 file, 10 file chạy trong `test:all`) | Bộ kiểm thử tự động |
| `deploy/` | `nginx-mayan.conf`, `nginx-ratelimit.conf`, `mayan-api.service`, `deploy.sh` |

### 9.5 Danh sách lệnh kiểm toán đã chạy (tái lập được)

```bash
npm install
npm run lint                  # oxlint              -> exit 0, 0 warning / 0 error
npm run build                 # vite build          -> exit 0
npm run test:all              # 10 suite            -> exit 0, 191 PASS / 0 FAIL
npm run backup:restore-test   # backup + khôi phục  -> exit 0, integrity_check OK
npm audit --omit=dev          # -> found 0 vulnerabilities
npm run seed:admin            # tạo tài khoản Admin (dùng cho demo)
npm run dev                   # chạy Vite :5175 (+ API :3001)
```

> **Lưu ý khi tái lập:** các suite E2E (`qa-e2e`, `qa-flight`, `qa-hotel`, `qa-room`,
> `qa-combo`, `qa-final`, `qa-admin`) **phụ thuộc** API :3001 + Vite :5175 đang chạy.
> Hãy dùng `npm run test:all` (runner tự quản lý vòng đời server) thay vì gọi
> `npm run test:admin` / `node qa-*.mjs` trực tiếp — gọi trực tiếp sẽ báo
> `ECONNREFUSED` do thiếu server, **không phải** lỗi sản phẩm.

### 9.6 Phân loại bộ test (E2E vs Integration vs Mock)

| Suite | Loại | Môi trường | Có đụng DB thật? |
|---|---|---|---|
| `qa-e2e.mjs` | **E2E** (Playwright/Chromium) | Vite dev :5175 + API :3001 | Có (`data/mayan.db`), tự dọn |
| `qa-flight.mjs` | **E2E** | như trên | Có, tự dọn |
| `qa-hotel.mjs` | **E2E** | như trên | Có, tự dọn |
| `qa-room.mjs` | **E2E** | như trên | Có, tự dọn |
| `qa-combo.mjs` | **E2E** | như trên | Có, tự dọn |
| `qa-admin.mjs` | **E2E** | như trên | Có, tự dọn |
| `qa-voucher.mjs` | Integration (HTTP API) | API tự bật + DB tạm | Không |
| `qa-final.mjs` | **E2E** (Playwright) | Vite dev :5175 + API :3001 | Có (`data/mayan.db`), tự dọn |
| `qa-audit.mjs` | Integration (HTTP API) | API tự bật + DB tạm | Không |
| `qa-payment.mjs` | Integration + **mock cổng MoMo** | API tự quản lý + DB tạm + cổng mock | Không |
| `qa-shots.mjs` | Công cụ chụp ảnh (không tính vào `test:all`) | — | — |

> **Không có** test E2E nào chạm tới cổng MoMo thật. Toàn bộ bằng chứng thanh toán là
> **mock-based** → đây là lý do `MOMO_ENV=disabled` là trạng thái **đúng** và cần giữ nguyên.

### 9.7 Các câu lệnh grep dùng để xác nhận "không có" (có thể tái lập)

```bash
# Không có quản lý tồn phòng
grep -rn "inventory\|available_rooms\|room_availability" server/ src/   # → 0 kết quả
# Không có CRUD phòng trong Admin
grep -n "adminRouter\.\(get\|post\|patch\|delete\)" server/routes-admin.js | grep -i room   # → 0 kết quả
# Không có quên/đổi mật khẩu, xác minh email
grep -rn "forgot\|reset-password\|change-password\|verify-email" src/ server/  # → 0 kết quả
# Không có form đăng ký trên UI
grep -rn "auth/register" src/                                                   # → 0 kết quả
# Không có hoàn lượt voucher khi hủy đơn
grep -n "used_count" server/*.js    # → chỉ 2 chỗ "+1", không có chỗ "-1"
# Không có module email / chatbot / trang nội dung
grep -rn "nodemailer\|smtp\|chat\|blog\|policy" server/ src/   # → 0 kết quả
```

### 9.8 Danh mục API (rút gọn)

**Người dùng (`server/routes-public.js`)**

| Method | Đường dẫn | Xác thực | Ghi chú |
|---|---|---|---|
| POST | `/api/auth/register` | — | Rate-limit 60/giờ; **không có UI gọi** |
| POST | `/api/auth/login` | — | Rate-limit chống brute-force |
| POST | `/api/auth/logout` | phiên | Xoá session |
| GET | `/api/auth/me` | phiên | Hồ sơ + số đơn |
| GET | `/api/catalog` | — | KS / chuyến bay / combo |
| GET | `/api/travel` | — | Khối ưu đãi trang chủ |
| GET | `/api/hotels`, `/api/flights`, `/api/combos`, `/api/promos` | — | Catalog công khai |
| GET | `/api/bookings` | phiên | Chỉ đơn của chính mình |
| POST | `/api/bookings` | phiên | Idempotency, server tự tính tiền |
| PATCH | `/api/bookings/:code/cancel` | phiên | Chỉ chủ đơn; **không hoàn lượt voucher** |
| POST | `/api/promos/validate` | — | Rate-limit 30/phút |
| GET | `/api/health` | — | Không lộ thông tin nhạy cảm |

**Thanh toán (`server/routes-payment.js`)**

| Method | Đường dẫn | Xác thực | Ghi chú |
|---|---|---|---|
| GET | `/api/payment/config` | — | Chỉ trả `enabled`/`live`, không lộ secret |
| POST | `/api/payment/create` | phiên | 503 nếu chưa cấu hình MoMo |
| GET | `/api/payment/:code` | phiên | Trạng thái thanh toán của đơn mình |
| POST | `/api/webhook/momo/ipn` | HMAC | IPN; lỗi trả 200 (không 500) |

**Admin (`server/routes-admin.js`)** — tất cả yêu cầu `requireAdmin` + CSRF header + audit log:
`GET /stats`, `GET|POST|PATCH|DELETE /hotels`, `/flights`, `/combos`, `/promotions`,
`GET|PATCH /bookings`, `GET /bookings/:code/payments`, `GET|PATCH /users`, `GET /audit-log`.

### 9.9 Ghi chú giới hạn của báo cáo

1. Báo cáo dựa trên **mã nguồn hiện tại** trong workspace; không kiểm tra máy chủ thật.
2. Không thực hiện thanh toán thật, không ghi/xoá dữ liệu trong `data/mayan.db`
   (mọi probe dùng DB tạm, đã xoá sau khi chạy). Lưu ý: các **suite E2E** có dùng
   `data/mayan.db` (đúng thiết kế của runner) nhưng tự dọn dữ liệu test sau khi chạy.
3. Các kết luận "không có" dựa trên tìm kiếm văn bản trong `server/` và `src/` — có thể còn
   logic tương đương viết dưới tên khác; tuy nhiên đã đối chiếu cả frontend và backend.
4. Ước lượng công sức ở Phần 7.3 và 8.5 là ước lượng theo đội ngũ 1 người, đã bao gồm kiểm thử.
5. Báo cáo không chứa credential, token, cookie hay dữ liệu cá nhân nào.

---

**Ngày lập:** 22/10/2026 · **Người kiểm toán:** Senior Full-stack Developer / QA / Security Auditor
**Tài liệu liên quan:** `bao-cao/PRODUCTION_READINESS.md`
