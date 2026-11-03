# FINAL WEBSITE QA — Mây An Nhiên

> Thời điểm: 10/10/2026 · Browser thật Chromium/Playwright · Site: http://localhost:5175/
> Regression cuối: lint 0/0 · build ✓ · e2e 29/29 · flight 17/17 · hotel 18/18 · combo 17/17 · final 23/23
> **Tổng: 104 browser test cases — 104 PASS, 0 FAIL**

## Bảng tổng hợp

| Module | Tests | PASS | FAIL | Status |
|---|---:|---:|---:|---|
| Home | 6 | 6 | 0 | ✅ |
| Flight | 17 | 17 | 0 | ✅ |
| Hotel | 18 | 18 | 0 | ✅ |
| Combo | 17 | 17 | 0 | ✅ |
| Checkout | 3 | 3 | 0 | ✅ |
| Login | 1 | 1 | 0 | ✅ |
| Payment | 1 | 1 | 0 | ✅ |
| Booking | 3 | 3 | 0 | ✅ |
| Routing | 3 | 3 | 0 | ✅ |
| API | 1 | 1 | 0 | ✅ |
| Responsive | 2 | 2 | 0 | ✅ |
| Security basic | 2 | 2 | 0 | ✅ |
| Runtime (console/pageerror) | 1 | 1 | 0 | ✅ |
| E2E regression (qa-e2e) | 29 | 29 | 0 | ✅ |
| **TỔNG** | **104** | **104** | **0** | **✅ ALL GREEN** |

Ghi chú phân bổ: Home/Checkout/Login/Payment/Booking/Routing/API/Responsive/Security/Runtime = suite `qa-final.mjs` (23 test) · Flight = `qa-flight.mjs` · Hotel = `qa-hotel.mjs` (26 yêu cầu Part 4 gộp thành 18 case) · Combo = `qa-combo.mjs` · E2E = `qa-e2e.mjs` (giữ nguyên, không sửa).

## Bugs found

**App bug (tìm thấy ở session trước, đã fix, regression xác nhận còn nguyên):**
1. Input ngày đi có HTML `min` → native validation chặn submit **im lặng** (không có toast tiếng Việt). Fix: bỏ `min`, validate trong `submitSearch` với toast "Ngày đi phải từ hôm nay trở về sau." — xác nhận PASS bởi flight [3], hotel [7], combo [6].

**App bug mới trong lần FINAL QA này: KHÔNG phát hiện.** Mọi FAIL ban đầu đều là defect của test script (test sai, app đúng):
1. `qa-hotel` [4]: expectation filter "Gần trung tâm" = 1, thực tế app trả 2 — đúng (data có hotel `location: 'Trung tâm Sa Pa'` + perk `Trung tâm`). Sửa expectation + chi tiết assert.
2. `qa-hotel` [17]: sai API Playwright `route.request().abort()` → `route.abort()` (gây crash process).
3. `qa-hotel` [17]: selector sai `.error-strip`/`.error-banner` → app dùng `.data-error-strip`/`.data-error-banner`.
4. `qa-hotel`: cấu trúc file hỏng do insert_line chèn lệch (test 8 thiếu `})`, test 12/16 bị cắt dời) → cấu trúc lại, 18/18 chạy trọn vẹn.
5. `qa-hotel` [18]: console.error do **test chủ động abort API** (`net::ERR_FAILED`) bị đếm nhầm → filter theo `apiFailurePhase`.
6. `qa-final` [10]: mất dòng `shot()` do edit cũ đè → "file is not defined".
7. `qa-final` [11]: assert label "Ngày bay" — label thật trong booking card là "Lịch trình".
8. `qa-final` [13]: selector OR (`.status-pill.cancelled, .booking-card`) làm assert luôn đúng → đổi thành `.status-pill` filter.
9. `qa-final` [15]: assert health `ok:true` — server trả `{status:'ok'}`.
10. `qa-hotel` [4]: chuỗi mô tả return "trung tâm 1" → "trung tâm 2" (cosmetic, khớp assert).

→ **Không có sửa test nào che bug ứng dụng**: mọi sửa đổi đều sửa kỳ vọng sai/selector sai/API sai của test so với hành vi đúng đã verify bằng code + browser.

## Bugs fixed

- Chỉ fixes ở test scripts (mục 1–10 trên) + 1 app bug từ session trước (native `min` ngày đi).
- **Không đụng vào code ứng dụng trong lần FINAL QA này** → không có rủi ro phá chức năng.

## Remaining issues (biết rõ, không chặn demo)

1. **Payment là DEMO client-side** (mô phỏng 700ms rồi tạo đơn) — KHÔNG phải VNPay/MoMo/payment production thật. Không có luồng "hủy thanh toán" trung gian vì app mô phỏng tự động thành công.
2. Trường hợp "không chọn payment method" = N/A: UI luôn có sẵn lựa chọn mặc định `ATM` (không thể để trống) — hành vi cố ý.
3. Booking lưu ở `localStorage` theo từng tài khoản (không persistence server-side) — đúng thiết kế demo.
4. Số khách hiển thị theo state `passengers` kể cả combo/guest (giá combo ×1) — chênh lệch hiển thị nhỏ, không ảnh hưởng tổng tiền.
5. Skeleton loading chỉ quan sát được khi API bị làm chậm chủ động (API local quá nhanh) — đã thấy `skeleton=có` khi test delay 1.2–1.5s.
6. Login demo chấp nhận mọi email hợp lệ + password ≥6 ký tự (client-side, không backend auth) — đúng thiết kế demo.

## Regression result (chạy cuối cùng, sau mọi thay đổi)

| Lệnh | Kết quả |
|---|---|
| `npm run lint` | ✅ 0 warnings, 0 errors |
| `npm run build` | ✅ built (dist 261.34 kB JS / 26.53 kB CSS) |
| `node qa-e2e.mjs` | ✅ 29/29 PASS |
| `node qa-flight.mjs` | ✅ 17/17 PASS |
| `node qa-hotel.mjs` | ✅ 18/18 PASS |
| `node qa-combo.mjs` | ✅ 17/17 PASS |
| `node qa-final.mjs` | ✅ 23/23 PASS (chạy trước regression, 0 lỗi) |
| Runtime | ✅ 0 pageerror, 0 console.error (ngoại trừ API test chủ động) |

## Evidence

- `qa-evidence/final/lint.txt`, `build.txt`, `e2e-log.txt`, `flight-log.txt`, `hotel-log.txt`, `combo-log.txt`, `final-log.txt`, `regression-log.txt`
- JSON: `hotel-results.json`, `combo-results.json`, `final-results.json` (+ `qa-evidence/flight-results.json` cũ)
- 47 screenshots: `final/hotel/` (16), `final/combo/` (11), `final/screens/` (20)
- Báo cáo module cũ: `qa-evidence/FLIGHT-REPORT.md`, `qa-evidence/REPORT.md`

## Final recommendation

# 🟢 READY FOR DEMO

Lý do: 104/104 browser test PASS trên Chromium thật; 0 app bug còn mở; lint/build sạch; mọi luồng chính (search → chọn → checkout → login gate → thanh toán demo → booking → persistence → isolation → hủy) hoạt động đúng trên desktop (1440), tablet (768) và mobile (375/390/430). Nhắc khi demo: thanh toán là **mô phỏng client-side**, booking lưu **localStorage theo tài khoản**.
