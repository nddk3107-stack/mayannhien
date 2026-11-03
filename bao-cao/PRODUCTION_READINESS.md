# PRODUCTION READINESS — Mây An Nhiên

**Ngày lập:** 2026-10-21
**Phạm vi:** Website Mây An Nhiên (React + Express + SQLite) và lớp thanh toán MoMo
**Mục đích:** Bảng trạng thái trước khi triển khai thật. Mọi mục `MISSING` hoặc
`UNVERIFIED` phải được xử lý bằng chứng thực tế (ảnh chụp/log/phiếu kiểm thử)
trước khi nhận tiền thật.

---

## 1. Cách đọc trạng thái

| Nhãn | Ý nghĩa |
|---|---|
| `PASS` | Đã kiểm chứng bằng test tự động chạy trong repo, có log/bằng chứng lưu lại. |
| `FAIL` | Đã kiểm thử và **đang lỗi**. Phải sửa trước khi deploy. |
| `MISSING` | Hạng mục chưa có — thiếu hạ tầng/tài khoản/credentials. Chưa thể kiểm thử. |
| `UNVERIFIED` | Đã có hạ tầng nhưng **chưa kiểm chứng được** trong môi trường thật (Internet, HTTPS, sandbox MoMo). |

> ⚠️ **Không được tuyên bố "thanh toán MoMo production đã hoạt động"** khi còn
> bất kỳ mục nào ở trạng thái `MISSING` hoặc `UNVERIFIED` liên quan tới MoMo.

---

## 2. Tổng quan hiện trạng

| Hạng mục | Trạng thái | Bằng chứng |
|---|---|---|
| Lint (oxlint) | **PASS** | 0 warning / 0 error trên 40 file |
| Build production (vite) | **PASS** | `dist/` build sạch, không secret, không URL localhost |
| Bộ test tự động | **PASS** | 196 assertion / 10 suite — 0 FAIL |
| Backup + khôi phục thử | **PASS** | `integrity_check OK`, khôi phục thử thành công |
| Audit-log quản trị | **PASS** | Mọi route ghi dữ liệu của admin đều được ghi nhật ký |
| IPN MoMo (server-side) | **PASS (mock)** | 20/20 — chữ ký HMAC, amount, partner, idempotency |
| Không lộ secret ra client | **PASS** | `dist/` không chứa secret; `/api/payment/config` chỉ trả cờ |
| Domain + DNS | **MISSING** | Chưa có domain, chưa có VPS |
| Chứng chỉ HTTPS thật | **MISSING** | Chưa chạy certbot (cần domain trỏ đúng IP) |
| MoMo sandbox end-to-end | **UNVERIFIED** | Chưa có tài khoản MoMo Merchant + credentials sandbox |
| MoMo production (tiền thật) | **UNVERIFIED** | Bị chặn bởi sandbox + checklist bên dưới |
| Triển khai production | **BLOCKED** | Chưa có VPS / quyền truy cập / domain |

**Kết luận ngắn:** Phần **mã nguồn** đã sẵn sàng. Phần **hạ tầng** chưa có gì —
mọi hạng mục production đều `MISSING`/`UNVERIFIED` và **không được tuyên bố là đã
hoạt động**.

---

## 3. Chi tiết kiểm thử tự động

Chạy toàn bộ: `npm run test:all` → **10/10 suite PASS**.

| Suite | File | Kết quả |
|---|---|---|
| e2e | `qa-e2e.mjs` | 29/29 |
| flight | `qa-flight.mjs` | 17/17 |
| hotel | `qa-hotel.mjs` | 18/18 |
| room | `qa-room.mjs` | 14/14 |
| combo | `qa-combo.mjs` | 17/17 |
| voucher | `qa-voucher.mjs` | 14/14 |
| final | `qa-final.mjs` | 23/23 |
| admin | `qa-admin.mjs` | 24/24 |
| audit | `qa-audit.mjs` | 24/24 |
| **payment** | `qa-payment.mjs` | **20/20** |
| **TỔNG** | | **196/196** |

Log chi tiết: `qa-evidence/final/*.log`, kết quả JSON: `qa-evidence/final/*-results.json`.

### 3.1. Lớp thanh toán MoMo (`qa-payment.mjs`, 20/20)

Test dùng **mock cổng MoMo chạy cục bộ** + credentials giả → **không tạo giao dịch
thật, không cần Internet**. Đây là bằng chứng về *logic server*, **không phải**
bằng chứng rằng MoMo thật đã hoạt động.

| Mã | Nội dung | Kết quả |
|---|---|---|
| G1–G4 | Cấu hình cổng: `enabled`/`live`, không lộ secret, thiếu credential → tắt cổng | PASS |
| T1–T4 | Tạo phiên thanh toán, idempotency, chặn IDOR, chặn guest | PASS |
| W1 | IPN sai chữ ký → không `paid` | PASS |
| W2 | IPN sai số tiền → không `paid` | PASS |
| W3 | IPN sai `partnerCode` → không `paid` | PASS |
| W4 | IPN `orderId` không tồn tại → bỏ qua | PASS |
| W5 | IPN thiếu trường bắt buộc → bỏ qua, không crash | PASS |
| W6 | IPN `resultCode=49` (thất bại) → cập nhật trạng thái failed, **không** `paid` | PASS |
| W7 | IPN hợp lệ → `paid` đúng 1 lần; callback lặp không cộng tiền lần 2 | PASS |
| W8 | IPN tới đơn đã hủy → không tự động `paid` | PASS |
| W9–W10 | Doanh thu thật chỉ tính đơn `paid`, tách bạch giao dịch mô phỏng | PASS |
| W11 | IPN lỗi/payload hỏng → **luôn HTTP 200**, không trả 500 | PASS |

> **Vì sao W6 quan trọng:** `resultCode != '0'` là giao dịch thất bại. Nếu bị xử lý
> sai thì hệ thống có thể ghi nhận đơn đã thanh toán dù khách chưa trả tiền.
> Nhánh này **tuyệt đối không** được dẫn tới trạng thái `paid`.

### 3.2. Hạ tầng liên quan đã sửa trong đợt kiểm thử này

| # | Vấn đề | Mức độ | Đã sửa |
|---|---|---|---|
| 1 | `qa-payment.mjs` thiếu dấu đóng `})` → các block test lồng nhầm, suite treo | Nghiêm trọng | ✅ |
| 2 | IPN có thể trả HTTP 500 khi lỗi DB/runtime → MoMo gọi lại liên tục | Cao | ✅ Bọc try/catch toàn bộ handler, luôn trả 200 |
| 3 | Payload JSON hỏng từ MoMo trả 400 → MoMo retry vô hạn | Trung bình | ✅ Error handler riêng cho `/api/webhook` trả 200 |
| 4 | 12 route ghi dữ liệu của admin **không** ghi audit-log | Cao | ✅ Thêm `audit()` cho hotel/flight/combo/promotion |
| 5 | systemd `ProtectSystem=strict` làm `/var/www` read-only nhưng `DB_PATH` có thể trỏ về đó | Cao | ✅ Ép `DB_PATH=/var/lib/mayan/mayan.db` trong unit file |
| 6 | `qa-payment.mjs` nuốt log server → không thấy nguyên nhân khi FAIL | Trung bình | ✅ Gom log, chỉ in khi có bước FAIL |

---


## 4. Checklist MoMo — bắt buộc hoàn tất trước khi nhận tiền thật

Trạng thái hiện tại: **❌ CHƯA LÀM ĐƯỢC** (thiếu tài khoản Merchant + domain).

- [ ] **C1.** Có tài khoản MoMo Merchant đã được duyệt (business verification xong).
- [ ] **C2.** Nhận được `partnerCode`, `accessKey`, `secretKey` (sandbox).
- [ ] **C3.** Điền `.env` trên VPS (`/etc/mayan/mayan.env`, quyền `600`):
      `MOMO_ENV=sandbox`, `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`.
- [ ] **C4.** `MOMO_RETURN_URL=https://<domain>/thanh-toan/ket-qua` — bắt buộc HTTPS.
- [ ] **C5.** `MOMO_IPN_URL=https://<domain>/api/webhook/momo/ipn` — **phải truy cập được
      từ Internet**, không được chặn bởi IP allowlist, WAF hay Basic Auth.
- [ ] **C6.** Đăng ký IPN URL trong portal MoMo (khớp **chính xác** C5).
- [ ] **C7.** `TRUST_PROXY_HOPS=1` trong `.env` (đúng 1 tầng nginx) — nếu để sai,
      client giả mạo `X-Forwarded-For` để né rate-limit.
- [ ] **C8.** Chạy 1 giao dịch sandbox **thật** end-to-end:
      tạo đơn → chuyển hướng → thanh toán → nhận IPN → đơn chuyển `paid`.
      **Lưu bằng chứng:** ảnh màn hình + log server + dòng `payment_transactions`.
- [ ] **C9.** Kiểm tra IPN **không hợp lệ** trên môi trường thật: sửa `amount` → server
      phải từ chối và **không** đánh dấu `paid`.
- [ ] **C10.** Kiểm tra IPN **lặp** (MoMo thường gửi lại): đơn vẫn `paid`, chỉ có
      **1** bản ghi `paid` trong `payment_transactions`.
- [ ] **C11.** Đối soát tiền thật: đơn `paid` trên website ⇔ giao dịch trên app MoMo
      (cùng `transId`, cùng `orderId`, cùng số tiền).
- [ ] **C12.** Bật production **chỉ khi** C1–C11 xong:
      `MOMO_ENV=production`, `MOMO_ALLOW_LIVE=true`, credentials production.
- [ ] **C13.** Sau khi bật live, giám sát log `payment.ipn.*` và `payment.paid` ít nhất
      3 giao dịch đầu tiên trước khi tuyên bố "đã hoạt động".

> ⚠️ `MOMO_ALLOW_LIVE=true` với `MOMO_ENV=sandbox` **không** thu tiền thật. Ngược
> lại, đặt `MOMO_ENV=production` mà thiếu credential sẽ khiến server **tự tắt cổng
> thanh toán** (fail-safe) chứ không giả lập giao dịch.

---

## 5. Checklist hạ tầng production

Trạng thái hiện tại: **❌ CHƯA LÀM ĐƯỢC** (chưa có domain/VPS).

- [ ] **H1.** Mua domain + VPS Ubuntu 22.04/24.04; tạo A/AAAA record trỏ về IP VPS.
- [ ] **H2.** Tạo user `mayan` (không root), cài Node.js 22.
- [ ] **H3.** Chạy `sudo bash deploy/deploy.sh` (cài nginx, systemd, firewall, build).
- [ ] **H4.** Tạo `/etc/mayan/mayan.env` (quyền `600`) từ `.env.example`; đặt
      `NODE_ENV=production`, `DB_PATH=/var/lib/mayan/mayan.db`, `TRUST_PROXY_HOPS=1`,
      `ALLOWED_ORIGINS=` (để trống = chỉ cùng origin).
- [ ] **H5.** `certbot --nginx -d <domain>` → có HTTPS + HSTS. **Bắt buộc.**

## 6. Checklist dữ liệu — backup / khôi phục / rollback

Trạng thái: script đã **PASS** trên máy dev; chưa chạy trên VPS thật → phần cài
cron trên VPS là `MISSING`.

- [ ] **D1.** ✅ Backup dùng `VACUUM INTO` (SQLite chính thức) → bản sao nhất quán
      dù DB đang ghi. Đã kiểm chứng: `integrity_check OK`.
- [ ] **D2.** ✅ Khôi phục thử (`npm run backup:restore-test`) → thành công, số liệu
      khớp (`users=93, bookings=149` tại thời điểm kiểm thử).
- [ ] **D3.** ❌ Cài cron trên VPS (chưa làm):
      `0 2 * * * cd /var/www/mayan && DB_PATH=/var/lib/mayan/mayan.db /usr/bin/node scripts/backup-db.mjs --out /var/lib/mayan/backups >> /var/log/mayan-backup.log 2>&1`
- [ ] **D4.** ❌ **Copy backup ra ngoài VPS** (S3/GitHub/SFTP). Backup cùng ổ đĩa thì
      mất ổ đĩa là mất toàn bộ dữ liệu. **Không được coi là đạt cho tới khi có.**
- [ ] **D5.** ❌ Kiểm tra khôi phục **trên chính VPS** (không chỉ local): copy file
      backup về DB tạm, mở lên, đối chiếu `users`/`bookings`.
- [ ] **D6.** ❌ Quy trình **rollback** khi deploy hỏng: (1) `git checkout <tag>` →
      (2) `npm ci && npm run build` → (3) `systemctl restart mayan-api` →
      (4) nếu lỗi dữ liệu: khôi phục DB từ bản backup gần nhất (D3/D5).
- [ ] **D7.** ❌ Xác định **RPO/RTO** mà doanh nghiệp chấp nhận (vd: RPO 24h, RTO 2h)
      và viết vào quy trình vận hành.

---

## 7. Rủi ro còn lại (đã biết, chưa xử lý được ở môi trường dev)

| # | Rủi ro | Mức độ | Giảm thiểu / ghi chú |
|---|---|---|---|
| R1 | Chưa có giao dịch MoMo **thật** nào được thực hiện | Cao | Bắt buộc hoàn tất C8–C11 |
| R2 | Endpoint IPN chưa được kiểm tra từ Internet (có thể bị WAF/IP allowlist chặn) | Cao | Mở `MOMO_IPN_URL` trước khi bật live |
| R3 | Chưa đo tải (load test) — SQLite + single process | Trung bình | Chấp nhận tải nhỏ; nếu lớn thì chuyển Postgres |
| R4 | SQLite là file đơn → không có HA, mất VPS là mất dữ liệu (nếu chưa có D4) | Cao | Bắt buộc có backup ngoài VPS (D4) |
| R5 | Còn dữ liệu mẫu trong DB dev (93 users / 149 bookings) | Trung bình | Deploy bằng DB **trống**, không copy DB dev lên VPS |
| R6 | Chưa có giám sát/alerting (lỗi IPN, sập API) | Trung bình | Dùng `journalctl -u mayan-api` + script kiểm tra định kỳ |

---

## 8. Lệnh kiểm tra lại trước khi deploy

```bash
npm run lint            # 0 error
npm run build           # build dist/ sạch
npm run test:all        # 10/10 suite, 196/196 assertion
npm run backup:restore-test   # backup + khôi phục thử OK
```

Sau khi có VPS + domain, kiểm tra thêm:

```bash
curl -s https://<domain>/api/health          # {"ok":true}
curl -sI https://<domain> | grep -i strict-transport   # có HSTS
systemctl status mayan-api                    # active (running)
journalctl -u mayan-api -n 50 --no-pager      # không lỗi
```

---

## 9. Kết luận

- **Mã nguồn:** Sẵn sàng. Lint sạch, build sạch, 196/196 assertion PASS, backup/
  khôi phục thử thành công, IPN MoMo server-side đã được kiểm chứng bằng mock.
- **Hạ tầng:** Chưa có gì (domain, VPS, HTTPS, chứng chỉ). Mọi mục liên quan
  tới production nằm ở trạng thái `MISSING`/`UNVERIFIED`.
- **Thanh toán MoMo production:** **CHƯA ĐƯỢC KIỂM CHỨNG.** Chỉ có bằng chứng mock.
  Không được tuyên bố đã hoạt động.
- **Điều kiện để triển khai:** hoàn tất checklist §4 (C1–C12), §5 (H1–H10),
  §6 (D1–D6), sau đó bật live và theo dõi C13.

---

*Bản này được cập nhật kèm mã nguồn. Khi có bằng chứng mới (ảnh chụp màn hình
sandbox, log IPN thật, ảnh chụp HTTPS), cập nhật trạng thái tương ứng tại đây và
ghi rõ ngày.*

- [ ] **H6.** `npm run seed:admin` → tạo tài khoản admin, đổi mật khẩu mặc định.
- [ ] **H7.** Kiểm tra `curl -s https://<domain>/api/health` trả `{"ok":true}`.
- [ ] **H8.** Kiểm tra cookie phiên có cờ `Secure` + `HttpOnly` + `SameSite`.
- [ ] **H9.** Kiểm tra CSP và security headers qua `curl -I https://<domain>`.
- [ ] **H10.** Firewall: chỉ mở 22/80/443; cổng 3001 **không** mở ra ngoài.

---
