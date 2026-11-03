# FLIGHT QA FINAL — Chuyên đề kiểm thử trang Đặt vé máy bay (Mây An Nhiên)

**Kết quả: 17/17 PASS — 0 FAIL** (chạy trên Chromium thật, server dev thật :5175 + :3001)
**Kèm regression tổng: lint 0/0 · build OK · qa-e2e 29/29 PASS**

## BẢNG KẾT QUẢ CHI TIẾT (20 dòng = 17 case + 3 mục tổng hợp)

| # | Case | Kết quả | Chi tiết / Bằng chứng |
|---|------|---------|------------------------|
| 1 | Load trang bay (HTTP 200, hash #/flight, đủ UI, 0 lỗi runtime) | ✅ PASS | 3 chuyến bay hiển thị |
| 2 | Search: bỏ trống / hợp lệ / không tồn tại / theo hãng / nút xóa | ✅ PASS | trống→toast; Đà Nẵng=1; Tokyo=empty; Vietjet=1; xóa→3 |
| 3 | Ngày bay: quá khứ / về<đi / về=đi / Một chiều↔Khứ hồi | ✅ PASS | toast chặn từng loại; Một chiều khóa ngày về; bug native min đã fix |
| 4 | Filter khuyến mãi / giá / hãng (không mất kết quả sai) | ✅ PASS | promo 3→2; giá thấp→empty; khôi phục 3 |
| 5 | Chọn chuyến — info truyền đúng sang checkout | ✅ PASS | VN-184, ngày 2026-10-15→18, ảnh 05-checkout |
| 6 | Form hành khách: rỗng/ngắn/dài/SĐT/email/ký tự lạ | ✅ PASS | maxlength=60 chặn gõ tay; ký tự lạ hiển thị literal, 0 crash |
| 7 | Checkout: giá/giảm/tổng + attrs + refresh không crash | ✅ PASS | 2.580.000đ; giảm -0đ (NBSP); guard khi refresh |
| 8 | Login gate: modal, validation email/password, không lưu plaintext | ✅ PASS | ảnh 08-login-modal; localStorage không chứa mật khẩu |
| 9 | Payment: 3 phương thức + summary + xử lý đơn (bấm 1 lần) | ✅ PASS | ATM mặc định; trạng thái "Đang xử lý" (ảnh 09) |
| 10 | Booking tạo đủ trường | ✅ PASS | MAN7261369 — chuyến, khách, PT, 2.580.000₫ (ảnh 10) |
| 11 | F5 persistence: còn, không duplicate, đúng thông tin | ✅ PASS | 1 đơn trước/sau F5 |
| 12 | Cách ly tài khoản A→khách→B→A (không rò rỉ) | ✅ PASS | A:1, khách:0, B:0, login lại A:1 (ảnh 12) |
| 13 | Cancel/Back/refresh giữa checkout+payment + double-click | ✅ PASS | không booking ma; double-click → +1 đơn (ảnh 13) |
| 14 | Routing: 4 route sống + 404 + F5 từng route | ✅ PASS | 404 đúng; không crash |
| 15 | Responsive 375/390/430/768/1366: tràn, nav, card | ✅ PASS | 0 tràn; bottom-nav 5 mục ≤720px; Ảnh 15-mobile-375 |
| 16 | API: catalog/travel/404 JSON + loading + error + retry + fallback | ✅ PASS | skeleton (ảnh 16a); banner+strip+retry (ảnh 16b) |
| 17 | Console/runtime: pageerror=0, console.error=0 | ✅ PASS | toàn bộ phiên chạy |
| 18 | Regression lint + build | ✅ PASS | 0 warnings/0 errors; build thành công |
| 19 | Regression E2E tổng thể qa-e2e.mjs | ✅ PASS | 29/29 PASS |
| 20 | Ảnh chụp bằng chứng qa-evidence/flight/ | ✅ 14 ảnh | 03a,04,05,06,07a,08,09,10,12,13,15,16a,16b + flight-log.txt |

## BUGS

### Đã phát hiện & ĐÃ FIX trong đợt này
1. **🐛 [App] Ngày quá khứ bị chặn im lặng** — ô "Ngày đi" còn attr `min` → native HTML validation chặn submit, KHÔNG hiện toast tiếng Việt, user không biết lỗi. **Fix:** bỏ `min`, validate phía app trong `submitSearch` với toast "Ngày đi phải từ hôm nay trở về sau." (ảnh 03a chứng minh).

### Bugs trong test script (test sai, app đúng) — đã sửa test
2. Assert giảm giá so sánh `-0 ₫` bằng space thường nhưng Intl format dùng NBSP (U+00A0) → chuẩn hóa NBSP trước khi so.
3. Test 4 phụ thuộc state search còn sót của test 3 (goto hash không reset state) → thêm reload reset.
4. `page.reload(urlString)` — Playwright bỏ qua URL string → reload nhầm trang, strip không tồn tại → tách goto + reload.

### Bugs app đã fix từ các vòng trước (verify lại, không tái diễn)
- Vận chuyển localStorage gây crash; rò rỉ booking giữa 2 tài khoản (bookingsKey theo email); double-payment race (payingRef); native `min` trên ngày về; mobile nav grid 4→5.

### Còn lại / Hạn chế (không chặn demo)
- **Login & thanh toán là mô phỏng client-side** (chưa backend/PSP thật): "Hệ thống đăng nhập và thanh toán hiện được triển khai dưới dạng mô phỏng client-side nhằm phục vụ mục đích demo đồ án."
- Trang Vui chơi / Đưa đón sân bay / Xe khách / Tàu hỏa / Bảo hiểm là nav anchor (out of scope, không có route riêng).

## KẾT LUẬN

**Đạt.** Toàn bộ luồng đặt vé máy bay từ tìm kiếm → filter → chọn vé → validate → đăng nhập → thanh toán → quản lý đơn hoạt động đúng; cách ly dữ liệu giữa các tài khoản an toàn; edge cases (refresh giữa payment, double-click, 404) không tạo trạng thái sai; 0 lỗi console; responsive từ 375px→desktop không tràn ngang. Dự án sẵn sàng cho demo.
