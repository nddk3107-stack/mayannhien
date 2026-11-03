# Báo cáo kiểm thử & sẵn sàng demo — Mây An Nhiên

> Chạy lúc: xem `qa-evidence/e2e-results.json` (`ranAt`)

## 1. Kết quả regression cuối (trước khi demo)

| Bước | Lệnh | Kết quả |
|---|---|---|
| Lint | `npm run lint` | ✅ **0 warnings, 0 errors** (exit 0) |
| Build | `npm run build` | ✅ **Build thành công** (exit 0) |
| E2E | `npm run e2e` | ✅ **29/29 PASS, 0 FAIL** (exit 0) |

Bằng chứng: `qa-evidence/lint.txt`, `build.txt`, `e2e-log.txt`, `e2e-results.json`, ảnh `08-e2e-29-29.png`, `09-lint-build.png`.

## 2. Bảng đánh giá hiện tại

| Hạng mục | Trạng thái |
|---|---|
| UI/UX | ✅ |
| Search/filter | ✅ |
| Flight booking | ✅ |
| Checkout | ✅ |
| Login/logout | ✅ |
| Payment flow | ✅ |
| Booking persistence (F5) | ✅ |
| Tách booking theo tài khoản | ✅ |
| Double-submit protection | ✅ |
| Validation | ✅ |
| API (`/api/catalog`, `/api/travel`, `/api/health`, 404 JSON) | ✅ |
| Loading/Error/Retry (skeleton + banner) | ✅ |
| Routing hash + trang 404 | ✅ |
| Refresh từng route | ✅ |
| Mobile 375/390/430px | ✅ |
| Runtime errors | ✅ 0 |
| Lint | ✅ 0 |
| Build | ✅ |
| E2E | ✅ 29/29 |
| Backend auth thật | ⚠️ Chưa có |
| Payment thật (VNPay/MoMo...) | ⚠️ Chưa có |
| Database booking thật | ⚠️ Chưa có |

## 3. Giới hạn (phải ghi rõ khi báo cáo/demo)

- **Hệ thống đăng nhập và thanh toán hiện được triển khai dưới dạng mô phỏng client-side nhằm phục vụ mục đích demo đồ án.**
- Mật khẩu không được gửi hay lưu lại; phiên đăng nhập chỉ lưu email/tên hiển thị trên trình duyệt của người dùng.
- Đơn đặt chỗ được lưu trong `localStorage` của trình duyệt (không có database phía máy chủ).
- Chưa tích hợp cổng thanh toán thật; nút "Thanh toán" mô phỏng quy trình xử lý và tạo đơn.
- Dữ liệu chuyến bay/khách sạn là dữ liệu mẫu do API nội bộ (`server.js`) cung cấp.

## 4. Kiểm tra dữ liệu cá nhân / dữ liệu test

| Hạng mục | Trạng thái |
|---|---|
| Không còn email/SĐT mặc định trong code | ✅ — traveler mặc định rỗng, chỉ có placeholder |
| Không còn booking test `MAN...` trong code | ✅ — mã đơn sinh ngẫu nhiên khi đặt |
| Không còn tài khoản `qa1/qa2` trong E2E | ✅ — chuyển sang `demo1/demo2@mayan.test` |
| Tự dọn dữ liệu test trong localStorage | ✅ — `src/main.jsx` xóa key của qa1/qa2 + key mẫu cũ khi mở trang |
| Không commit `.env` / secret | ✅ — `.gitignore` có `.env`, `.env.*`; repo không có secret/API key thật |

**Trước khi demo:**
1. Mở trang → app tự xóa dữ liệu test cũ (qa1/qa2, key mẫu).
2. (Khuyến nghị) Xóa nốt dữ liệu site cũ: DevTools → Application → Local Storage → `http://localhost:5175` → Clear.
3. Tạo 1 booking mới bằng tài khoản demo của bạn (~30 giây: chọn vé → thanh toán → đăng nhập → thanh toán).

## 5. Cấu hình production

- Frontend gọi API **cùng origin** qua relative path (`/api/...`) — **không phụ thuộc `localhost:3001`** ở production.
- Dev proxy chỉ nằm trong `vite.config.js` (chạy khi `npm run dev`), target đổi được bằng `VITE_DEV_API`.
- Biến môi trường: xem `.env.example`:
  - `VITE_API_BASE` — đặt khi frontend tách domain với API.
  - `PORT` — port của `server.js` (mặc định 3001).
  - `VITE_DEV_API` — target proxy lúc dev.
- Chạy production: `npm run build` (frontend) + `npm start` (API), đặt reverse proxy `/api` → Express.
- **Không có password/secret/API key nào được commit.** `secret123` trong `qa-e2e.mjs` chỉ là mật khẩu demo của script test cục bộ.

## 6. Bằng chứng demo (ảnh trong `qa-evidence/`)

| File | Nội dung |
|---|---|
| `01-trang-chu.png` | Trang chủ |
| `02-tim-ve-chon-ve.png` | Tìm & chọn vé |
| `03-checkout.png` | Checkout với thông tin hành khách |
| `04-login.png` | Login gate / modal đăng nhập |
| `05-thanh-toan.png` | Chọn phương thức thanh toán |
| `06-dat-cho-thanh-cong.png` | Thanh toán thành công + booking mới |
| `07-api.png` | API/backend (`/api/catalog`) |
| `08-e2e-29-29.png` | Bảng kết quả E2E 29/29 PASS |
| `09-lint-build.png` | Kết quả lint + build |
