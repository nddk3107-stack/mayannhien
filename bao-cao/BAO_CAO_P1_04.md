# BÁO CÁO CUỐI — P1-04 HOÀN THIỆN TOÀN DIỄN DỰ ÁN MÂY AN NHIÊN

**Dự án:** `/Users/phamminhkhoi/Documents/testchuyennganh`
**Ngày báo cáo:** 30/10/2026 (máy local, macOS)
**Người thực hiện:** Cline (AI coding agent) — chỉ phân tích, sửa mã, chạy kiểm thử local; KHÔNG commit/push/deploy/giao dịch thật.

---

## 1. TỔNG KẾT

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Đọc source, chụp trạng thái DB trước khi sửa | Hoàn thành | `data/mayan.db`: 675840 bytes, mtime 27/10 10:05, hash `4f0cf550...` |
| Bảo vệ DB thật trong toàn bộ kiểm thử | Hoàn thành | Hash/size/mtime `mayan.db` không đổi sau 2 lượt chạy đầy đủ |
| Chạy runner `npm run test:all` | Hoàn thành | 11/11 suite PASS, exit 0 — LẦN 5 và LẦN 6 (hai lần liên tiếp, sạch) |
| Chạy suite riêng `qa-inventory.mjs` | Hoàn thành | 15/15, 53 assertions, exit 0 (chống overbooking, 10 request đồng thời chỉ 1 booking) |
| Lint (`npm run lint` = oxlint) | Hoàn thành | Exit 0; 0 error; 3 warning pre-existing (không do thay đổi này) |
| Build (`npx vite build`) | Hoàn thành | Exit 0, `dist/` sạch |
| `node --check` file đã sửa | Hoàn thành | `qa-hotel.mjs` cú pháp OK |
| Double-submit xác minh bằng backend | Hoàn thành | `qa-hotel.mjs` bước 14 bổ sung verify API: UI 2 đơn, backend +1, mã+ngày khớp |
| Tài liệu triển khai (systemd/nginx/deploy/env) | ĐãReview | Mẫu có sẵn trong `deploy/`, `.env.example`, `PRODUCTION_READINESS.md` — toàn placeholder, chưa kích hoạt trên máy thật |
| MoMo thực tế | Chưa xác minh | Chỉ kiểm chứng bằng mock cục bộ (`qa-payment`, `qa-audit`); cần credential sandbox để kết luận live |

**Không còn blocker nghiêm trọng về mã nguồn.** Dự án còn thiếu hạ infra production (domain, VPS, HTTPS, credential MoMo) — các hạng mục này nằm ở trạng thái `MISSING`/`UNVERIFIED` và KHÔNG được tự tuyên bố là đã sẵn sàng production.

---

## 2. FILE ĐÃ SỬA (lần thực hiện này)

| File | Nội dung sửa | Nguyên nhân | Test xác minh |
|---|---|---|---|
| `qa-hotel.mjs` | Bước 14 "Double-click thanh toán": bổ sung verify qua backend API (`GET /api/bookings` kèm header `X-Client-Id`) trước/sau double-click; assert backend tạo đúng +1 đơn, mã đơn + ngày + tổng tiền khớp; GỮ NGUYÊN assertion UI `count === 2` | B1/B2 yêu cầu double-submit phải được xác minh bằng kết quả backend, không chỉ số phần tử UI; bản trước chỉ đếm thẻ UI và lấy `beforeCount` sau khi đã nhấn (lỗi test của chính bản sửa) | `npm run test:all` hotel PASS 18/18 (lần 5, 6) |
| (không sửa) | `scripts/run-tests.mjs`, `qa-e2e.mjs`, `qa-room.mjs`, `qa-combo.mjs`, `qa-final.mjs` | Đã được sửa ở lượt trước (per-suite temp DB, `ensureUser` trước các bước cần user, stable step 14 hotel) và vẫn đi kèm regression này | Tất cả suite PASS |

**Không file backend nào được sửa** trong lần này — backend đã có cơ chế cần thiết: `BEGIN IMMEDIATE`, `UNIQUE(user_id, idempotency_key)`, `UNIQUE(order_id)`, giá tính lại server-side, IPN verify chữ ký/amount/requestId/duplicate-paid.

## 3. DOUBLE-SUBMIT (B3/B2)

### Request thực tế quan sát được
- Bước 14 `qa-hotel.mjs`: trình duyệt bấm 2 lần liên tiếp nút `.pay-btn` (lần thứ 2 dùng `.click({force: true})`, bọc `.catch(() => {})` vì nút bị React disable/detach sau lần đầu — race UI hợp lệ, bỏ qua lỗi Playwright đã xác định).
- Backend nhận **1** yêu cầu tạo đơn hiệu lực (lần thứ 2 bị chặn ở UI hoặc chưa kịp gửi trước khi điều hướng).

### Cách xử lý request trùng phía backend
1. `priceBooking()` — server tự tra DB, tự tính `unit_price/discount/total`; **KHÔNG tin amount/client gửi**.
2. `BEGIN IMMEDIATE` + kiểm tra `roomIsAvailable()` trong khoá ghi → hai request đồng thời đối phòng cuối cùng chỉ 1 thành công (chứng minh bởi `qa-inventory.mjs` R9: 10 request đồng thời → 1 thành công, 9 bị từ chối, không overbooking).
3. `INSERT` cắt bằng `UNIQUE (user_id, idempotency_key)` → request lặp cùng khóa idempotency trả về đơn cũ (`duplicate: true`), không tạo trùng (chứng minh bởi `qa-voucher.mjs` bước 13).
4. Transaction rollback khi `SQLITE_BUSY` hết lượt retry → trả 409 rõ ràng, không tạo booking giả.

### Test chứng minh
Trong `qa-hotel.mjs` bước 14:
- UI: `.booking-card` count === 2 (1 cũ từ bước 11 + 1 mới).
- Backend: `GET /api/bookings` (có cookie phiên + `X-Client-Id` của trình duyệt) trước và sau double-click → `afterList.length === beforeCount + 1`.
- Đơn mới từ backend: `code` khớp mã trên UI (`Mã MAN\d+`), `dates.depart/ret` khớp ngày đã chọn (d+15 → d+18), `total > 0`.
- Kết quả: **không tạo thêm booking, không nhân đôi giao dịch**.

## 4. BOOKING VÀ AUTHORIZATION

### Các luồng đã test (qua `npm run test:all` + `qa-inventory`)
| Luồng | Suite | Kết quả |
|---|---|---|
| Tìm khách sạn, lọc, chọn phòng, đặt phòng, voucher, tổng tiền server-side | hotel | PASS 18/18 |
| Chuyến bay, checkout, vé, refresh route | flight / e2e | PASS |
| Combo, đặt combo, voucher | combo | PASS |
| Tồn phòng, chặn overbooking (10 request đồng thời), admin không xác nhận đơn vượt tồn kho, IPN trễ cho đơn đã hủy | qa-inventory (riêng) | PASS 15/15 |
| Đăng ký/đăng nhập, login gate, session cookie, logout, isolation đơn giữa 2 tài khoản | hotel / e2e / admin | PASS |
| User thường gọi API admin → 403; chưa đăng nhập gọi admin → 401; admin RBAC | qa-admin | PASS 20/20 |
| IDOR: user không đọc/đơn của người khác; tạo phiên thanh toán chỉ cho đơn của mình | qa-admin, routes-payment (owner check) | PASS |
| IPN: sai chữ ký, sai amount, orderId không tồn tại, duplicate callback, resultCode != 0, đơn đã hủy | qa-payment (mock), qa-audit | PASS |

### Kết quả IDOR / ownership
- `GET /api/bookings` lọc theo `user_id` của phiên (cookie HttpOnly), không tin userId từ client.
- `PATCH /api/bookings/:code/cancel` và `GET /api/payment/booking/:code` kiểm tra `user_id` của chủ đơn.
- `POST /api/payment/create` trả 404 (không lộ tồn tại) nếu đơn không thuộc về người đăng nhập.
- Frontend ẩn menu không thay thế authorization server-side (server kiểm tra mọi request).

### Các luồng chưa test (ghi rõ)
- Hủy booking qua UI người dùng đã có (được test ở API routes-public; UI hotel chưa có bước hủy rõ rệt) — hợp lệ, không tạo thêm test mới ngoài phạm vi.
- Sửa booking của người dùng khác — API không có endpoint sửa booking của người khác, chỉ admin có quyền thay đổi trạng thái đơn (kèm lý do + audit log).


## 5. PAYMENT / MOMO

### Mức độ tích hợp hiện tại
- `server/momo.js`: xây dựng chữ ký HMAC tạo đơn + xác minh IPN theo thứ tự trường của MoMo (accessKey, amount, …, transId), `safeEqual` (timing-safe), `queryPayment` đối soát.
- `server/routes-payment.js`: `/api/payment/create` (yêu cầu auth, chủ đơn, server tự lấy `total` từ DB, orderId/requestId duy nhất), `/api/payment/booking/:code` (xem trạng thái), `/api/payment/query` (tra cứu MoMo), IPN webhook `/api/webhook/momo/ipn` (trả 200 mọi trường hợp, verify chữ ký, đối chiếu orderId/amount/partnerCode, requestId khớp attempt, idempotent khi đã `paid`, không paid nếu đơn bị hủy hoặc resultCode khác '0').
- `server/config.js`: `MOMO_ENV=disabled` mặc định; `MOMO_LIVE_ENABLED` chỉ true khi production + credentials đủ + `allowLive=true` + returnUrl/ipnUrl HTTPS. Secret **KHÔNG** ra frontend, **KHÔNG** vào log (`/api/payment/config` chỉ trả cờ `enabled`/`live`/`env`).

### Phần đã kiểm thử (mock cục bộ, không giao dịch thật, không cần Internet)
- `qa-payment.mjs`: 28/28 PASS — tạo phiên, idempotency, chặn IDOR/guest, IPN sai chữ ký/sai amount/thiếu trường/Content-Type không hỗ trợ, duplicate callback, đơn không tồn tại, cổng tắt khi thiếu credential (503), config không lộ secret.
- `qa-audit.mjs`: IPN sai chữ ký → không `paid`; tạo phiên khi chưa cấu hình → 503; config không lộ secret.

### Phần cần credential sandbox / chưa xác minh
- MoMo sandbox end-to-end (cần Merchant ID, accessKey, secretKey sandbox từ developers.momo.vn) — `UNVERIFIED`.
- MoMo production (tiền thật) — bị chặn bởi `MOMO_ALLOW_LIVE=false` và chưa có credential; **KHÔNG được tuyên bố đã hoạt động**.
- Không ghi secret vào source/log/báo cáo; `.env.example` chỉ chứa placeholder.

## 6. DATABASE VÀ BACKUP

### Migration
- Cơ chế hiện tại: `server/db.js` tạo bảng `CREATE TABLE IF NOT EXISTS` và `ensureColumn(table, column, def)` dùng `ALTER TABLE ADD COLUMN` khi cột chưa có — **chỉ thêm, không xóa**, idempotent, có thể chạy lại an toàn. Các cột mới (`idempotency_key`, `client_id`, `legacy`, `min_order`, `room_id/name/nights/…`) được thêm qua migration này.
- Không có thư mục migration riêng biệt; rủi ro: nếu migration `ALTER` thất bại giữa chừng, báo lỗi rõ qua `console.error` nhưng không rollback toàn schema. Hạn chế đã ghi rõ; không viết lại toàn bộ hệ thống migration để tránh rủi ro dữ liệu.

### Integrity check
- Khi khởi động: `PRAGMA foreign_keys = ON`, `PRAGMA journal_mode = WAL`, `PRAGMA busy_timeout = 10000`.
- `scripts/backup-db.mjs`: dùng `VACUUM INTO` (cơ chế chính thức SQLite) tạo file nhất quán (không `cp` file đang mở), kiểm tra `users`/`bookings` + `PRAGMA integrity_check`, giữ 14 bản mới nhất, có chế độ `--verify-restore` (copy backup sang file tạm, verify integrity) — chạy trên **file tạm**, không đụng DB thật.

### Kết quả kiểm thử backup
- `npm run backup:restore-test` đã được xác minh trong lượt trước (users=93, bookings=149 tại thời điểm kiểm thử, integrity OK). Đường dẫn mẫu: `backup/mayan-<timestamp>.db`, không chứa secret.

## 7. DEPLOYMENT READINESS

Tất cả **chưa được kích hoạt** trên máy này (không deploy, không sudo, không tạo VPS/domain):

| Thành phần | Trạng thái | Ghi chú |
|---|---|---|
| `deploy/mayan-api.service` | Mẫu systemd | Chạy user `mayan` (không root), `EnvironmentFile=/etc/mayan/mayan.env` (quyền 600), `DB_PATH=/var/lib/mayan/mayan.db`, `ProtectSystem=strict`, `Restart=always` |
| `deploy/deploy.sh` | Mẫu script | Cài user, Node 22, nginx, ufw, sqlite3; cần file `/etc/mayan/mayan.env` trước |
| `deploy/nginx-mayan.conf` | Mẫu nginx | Reverse proxy 80→443 (certbot), rate limit auth/API, IPN webhook, SPA fallback, headers bảo mật |
| `.env.example` | Mẫu env | `NODE_ENV=development`, `MOMO_ENV=disabled`, `MOMO_ALLOW_LIVE=false`, tất cả secret để trống/placeholder |
| `server/config.js` | Validation | `MOMO_LIVE_ENABLED` đòihoek HTTPS + credentials; `TRUST_PROXY_HOPS` mặc định 0 (không bị giả mạo IP); cookie Secure chỉ bật production/HTTPS |
| `.gitignore` | Đúng | Bỏ qua `.env`, `data/`, `backup/`, `dist/`, `node_modules`, logs |

Còn phải người dùng thực hiện sau khi có VPS/domain: đặt A/AAAA record, certbot HTTPS, tạo `/etc/mayan/mayan.env` (quyền 600), chạy `deploy/deploy.sh`, cài cron backup ra ngoài VPS, kiểm tra `curl /api/health` và HSTS.


## 8. KIỂM THỬ

| Suite | Chạy riêng | Full run #5 | Full run #6 | PASS/FAIL | Exit code |
|---|---|---|---|---|---|
| e2e | — | PASS | PASS | PASS | 0 |
| flight | — | PASS | PASS | PASS | 0 |
| hotel | — | PASS | PASS | PASS | 0 |
| room | — | PASS | PASS | PASS | 0 |
| combo | — | PASS | PASS | PASS | 0 |
| voucher | — | PASS | PASS | PASS | 0 |
| final | — | PASS | PASS | PASS | 0 |
| admin | — | PASS | PASS | PASS | 0 |
| audit | — | PASS | PASS | PASS | 0 |
| payment | — | PASS | PASS | PASS | 0 |
| rooms-admin | — | PASS | PASS | PASS | 0 |
| **inventory (riêng)** | PASS 15/15 | — | — | PASS | 0 |

- `npm run lint`: exit 0, 0 error, 3 warning pre-existing (import `roomOut` chưa dùng, biến `lastErr`, React set-state-in-effect trong Admin.jsx — không liên quan thay đổi này).
- `npx vite build`: exit 0, `dist/` build thành công.
- Không cộng trùng PASS giữa các lần chạy; hai full run (#5, #6) đều 11/11 PASS, exit 0.

## 9. DATABASE THẬT

| Thời điểm | Đường dẫn | Kích thước | mtime | SHA-256 |
|---|---|---|---|---|
| Trước chạy test | `data/mayan.db` | 675840 bytes | 27/10 10:05:19 | `4f0cf5503a9c57c3342b247895690bac8be2e2a5935d9bc609e317a82cc6d5d9` |
| Sau 2 full run + inventory | `data/mayan.db` | 675840 bytes | 27/10 10:05:19 | `4f0cf5503a9c57c3342b247895690bac8be2e2a5935d9bc609e317a82cc6d5d9` |

**Kết luận:** `data/mayan.db` KHÔNG THAY ĐỔI (hash, kích thước, mtime identical). WAL/SHM của DB thật không tăng (`mayan.db-wal` = 0 byte, mtime cũ 28/10). Runner thực sự dùng `data/qa-runner-<suite>-<ts>-<rand>.db` (xem log runner, ví dụ `qa-runner-hotel-1793295076236-b27ddfb2.db`) và xóa sạch sau mỗi phiên.

## 10. CLEANUP

- Không còn file `data/qa-runner-*.db` / `-wal` / `-shm` (runner đã xóa trong `finally`).
- Không còn tiến trình `server.js` / `vite` / `run-tests.mjs` do runner tạo (chỉ còn tiến trình VS Code, không liên quan).
- Các file temp do **standalone suites** tự quản lý: `data/qa-audit-tmp.db`, `data/qa-voucher-tmp.db` (và `-wal`/`-shm`) vẫn còn từ lượt chạy `test:all` — chúng là DB tạm của suite standalone, **không phải DB thật**, **không phải backup**, runner không xóa (theo thiết kế standalone tự quản lý). Có thể xóa nếu không cần lưu artifact chạy.
- Không xóa bất kỳ backup nào trong `backup/`.

## 11. RỦI RO CÒN LẠI

| # | Rủi ro | Mức độ | Trạng thái | Ghi chú |
|---|---|---|---|---|
| R1 | Chưa có giao dịch MoMo thật | Cao | Chưa xác minh | Cần credential sandbox, sau đó production checklist |
| R2 | Endpoint IPN chưa kiểm thử từ Internet | Cao | Chưa xác minh | Cần `MOMO_IPN_URL` công khai trước khi bật live |
| R3 | Chưa đo tải; SQLite + single process | Trung bình | Chưa xác minh | Chấp nhận tải nhỏ; lớn hơn có thể chuyển Postgres |
| R4 | SQLite file đơn, mất VPS = mất dữ liệu nếu chưa backup ngoài | Cao | Chưa xác minh | Bắt buộc backup ra ngoài VPS (cron + S3/SFTP) |
| R5 | DB dev có dữ liệu mẫu (93 users / 149 bookings) | Trung bình | Có thể khắc phục | Deploy bằng DB trống, không copy DB dev |
| R6 | Chưa có giám sát/alerting | Trung bình | Chưa xác minh | `journalctl -u mayan-api` + script kiểm tra định kỳ |
| R7 | Chưa có domain/VPS/HTTPS | Cao | Chưa có | Không tự mua/kích hoạt; cần người dùng phê duyệt |

## 12. KẾT LUẬN

**Đã hoàn thành các hạng mục trong phạm vi (mã nguồn + kiểm thử):**
- Test ổn định qua nhiều lần chạy (2 full run liên tiếp 11/11 PASS, exit 0; suite inventory riêng 15/15).
- Chống đặt chỗ và gửi thanh toán trùng đã được chứng minh bằng kết quả backend (BEGIN IMMEDIATE, unique constraints, idempotency key, IPN duplicate skip).
- Đăng nhập/session/cookie/admin được kiểm thử (auth gate, 401/403, IDOR, audit log).
- Đánh giá phòng/tổng tiền tính lại server-side; không tin trạng thái thanh toán từ client.
- MoMo server-side đã kiểm chứng bằng mock cục bộ (chữ ký, amount, duplicate callback, failure, cổng tắt khi thiếu credential).
- Backup/restore SQLite có cơ chế an toàn (VACUUM INTO + integrity_check), đã thử khôi phục trên DB tạm.
- Cấu hình production (systemd, nginx, env, deploy.sh) có sẵn dưới dạng mẫu/placeholder.
- Database thật `data/mayan.db` không bị đụng (hash identical); không còn tiến trình/temp file của runner.

**Điều kiện còn thiếu (không tự khẳng định production-ready tuyệt đối):** domain, VPS, chứng chỉ HTTPS thật, credential MoMo sandbox/production, backup ngoài VPS, load test, giám sát — cần người dùng có hạ tầng và phê duyệt trước khi triển khai thật và bật `MOMO_ALLOW_LIVE=true`.

Không commit/push/deploy theo yêu cầu.

