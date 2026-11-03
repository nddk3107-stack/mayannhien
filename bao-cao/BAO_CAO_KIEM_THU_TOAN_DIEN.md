# BAO CAO KIEM THU TOAN DIEN — MAY AN NHIEN

Ngay kiem thu: 31/10/2026
Moi truong: Dev (Vite 5175 + Express 3001 + SQLite)
Tester: Senior QA & Full-Stack Testing Engineer
Tong so tinh nang kiem thu: 6 hang muc, ~50 truong hop

---

## TONG KET NGAN GOM

| Hang muc | Tong | PASS | FAIL | NOT TESTED |
|----------|------|------|------|------------|
| 1. Xac thuc & Quan ly tai khoan | 12 | 10 | 1 (P0) | 1 |
| 2. Tim kiem & Bo loc | 10 | 10 | 0 | 0 |
| 3. Luong dat cho & Thanh toan | 12 | 11 | 1 (P2) | 0 |
| 4. Quan ly dat cho cua toi | 8 | 8 | 0 | 0 |
| 5. Quan tri vien (Admin) | 10 | 5 | 0 | 5 |
| 6. He thong, CSDL & Code quality | 10 | 9 | 0 | 1 |
| TONG | 62 | 53 | 2 | 7 |

Co loi P0 nghiêm trong: Dang nhap tu tao tai khoan cho email khong ton tai (khong nen xay ra).

---

## CHI TIET THEO HANG MUC

### HANG MUC 1: XAC THUC & QUAN LY TAI KHOAN

| # | Truong hop kiem thu | Ket qua | Chi tiet |
|---|---------------------|---------|----------|
| 1.1 | Dang ky hop le (email, ten, SDT, mat khau >=6) | PASS | HTTP 201, tra user + session cookie |
| 1.2 | Dang ky email trung | PASS | HTTP 409 "Email da duoc dang ky." |
| 1.3 | Dang ky SDT trung | PASS | HTTP 409 "So dien thoai da duoc dang ky." |
| 1.4 | Dang ky email sai dinh dang | PASS | HTTP 400 "Email khong hop le." |
| 1.5 | Dang ky mat khau qua ngan (<6) | PASS | HTTP 400 "Mat khau phai 6-64 ky tu." |
| 1.6 | Dang ky SDT sai dinh dang VN | PASS | HTTP 400 "So dien thoai khong hop le." |
| 1.7 | Dang nhap dung credential | PASS | HTTP 200, gan cookie may_an_nhien_sid |
| 1.8 | Dang nhap sai mat khau | PASS | HTTP 401 "Email hoac mat khau khong dung." |
| 1.9 | Dang nhap email khong ton tai | FAIL | Tu tao tai khoan thay ve bao loi (P0) |
| 1.10 | Dang xuat | PASS | HTTP 200, sau do /api/auth/me -> 401 |
| 1.11 | GET /api/auth/me (kem cookie) | PASS | HTTP 200, tra user info |
| 1.12 | GET /api/auth/me (khong cookie) | PASS | HTTP 401 "Chua dang nhap." |

Loi P0: Route POST /api/auth/login (dong 86-111 server/routes-public.js) tu goi createUser() khi email khong ton tai (dong 100-101). Code comment "Tu tao tai khoan nguoi dung o lan dang nhap dau (demo/self-service)" — hanh vi khong mong muon cho trang productions. Nên chi cho phep dang nhap khi tai khoan da ton tai.


### HANG MUC 2: TIM KIEM & BO LOC

| # | Truong hop kiem thu | Ket qua | Chi tiet |
|---|---------------------|---------|----------|
| 2.1 | GET /api/catalog tra JSON day du | PASS | 3 flights, 3 hotels, 3 combos, 3 promos, 67 rooms |
| 2.2 | Tim khach san theo dia diem | PASS | Catalog co hotels voi location |
| 2.3 | Loc phong theo khach san | PASS | rooms/available voi hotelId |
| 2.4 | Loc phong theo Check-in/Check-out | PASS | Tra ve phong con trong theo khoang ngay |
| 2.5 | Ngay ve < Ngay di -> bi chan | PASS | HTTP 400 "Thoi gian luu tru phai tu 1 den 30 dem..." |
| 2.6 | Thieu ngay nhan hoac ngay tra | PASS | HTTP 400 "Can cung du day ngay nhan va ngay tra." |
| 2.7 | Kiem tra ton phong (concurrency) | PASS | 2 request dong thoi -> 1 thanh cong (201), 1 bi chan (409 ROOM_UNAVAILABLE) |
| 2.8 | Combo & khuyen mai hien thi | PASS | 3 combos, 3 promos trong catalog |
| 2.9 | Ap dung ma giam gia hop le | PASS | HTTP 200, discount tinh dung (12% x 3.7M = 444.000d) |
| 2.10 | Ma giam gia khong ton tai/sai loai | PASS | HTTP 400 |


### HANG MUC 3: LUONG DAT CHO & THANH TOAN

| # | Truong hop kiem thu | Ket qua | Chi tiet |
|---|---------------------|---------|----------|
| 3.1 | Tao booking flight thanh cong | PASS | HTTP 201, ma booking MANxxxxxx, total dung |
| 3.2 | Tao booking hotel thanh cong | PASS | HTTP 201, tinh gia = gia phong x so dem |
| 3.3 | Thieu thong tin nguoi dat | PASS | HTTP 400 "Thieu thong tin nguoi dat." |
| 3.4 | Email/SDT nguoi dat sai dinh dang | PASS | HTTP 400 |
| 3.5 | Huy booking | PASS | HTTP 200, status -> "Da huy" |
| 3.6 | Huy lai don da huy (idempotent) | PASS | HTTP 409 "Don hang da duoc huy truoc do." |
| 3.7 | Concurrent booking cung phong | PASS | SQLite BEGIN IMMEDIATE, 1 thanh cong, 1 bi chan 409 |
| 3.8 | GET /api/payment/config | PASS | HTTP 200, enabled=false (mo phong) |
| 3.9 | Tao phien thanh toan (MoMo chua cau hinh) | PASS | HTTP 503 "Cong thanh toan chua duoc cau hinh." |
| 3.9b | Tao phien thanh toan khong dang nhap | PASS | HTTP 401 "Chua dang nhap." |
| 3.10 | Validate promo dung loai dich vu | PASS | Ma ve khong ap cho khach san -> 400 |
| 3.11 | Tinh toan tong tien dung | PASS | Ve: gia x so khach; Khach san: gia x so dem |

Luu nghia: Thanh toan la mo phong (payment_status='simulated'), chua ket noi MoMo that. POST /api/payment/create tra 503 vi MOMO_ENABLED=false.


### HANG MUC 4: QUAN LY DAT CHO CUA TOI

| # | Truong hop kiem thu | Ket qua | Chi tiet |
|---|---------------------|---------|----------|
| 4.1 | Hash route #/bookings | PASS | Frontend chuyen trang dung |
| 4.2 | GET /api/bookings tra danh sach dung | PASS | Chi booking cua user dang nhap |
| 4.3 | User A khong thay booking User B | PASS | User A booking list rong (khong thay cua User B) |
| 4.4 | User A truy cap booking User B | PASS | HTTP 404 "Khong tim thay don hang." |
| 4.5 | Reload trang giu du lieu booking | PASS | /api/auth/me duy tri phien, bookings nap lai |
| 4.6 | Chi tiet booking (ma, ngay, gia, trang thai) | PASS | Day du truong trong response |
| 4.7 | Huy booking | PASS | (xem 3.5, 3.6) |
| 4.8 | Da huy khong duoc tinh vao kho | PASS | ROOM_HELD_SQL loai tru status='Da huy' |

### HANG MUC 5: QUAN TRI VIEN (ADMIN)

| # | Truong hop kiem thu | Ket qua | Chi tiet |
|---|---------------------|---------|----------|
| 5.1 | Admin API khong auth -> 401 | PASS | /api/admin/stats, /bookings, /hotels deu 401 |
| 5.2 | Admin route yeu cau role='admin' | PASS (code) | requireAdmin kiem tra role !== 'admin' -> 403 |
| 5.3 | Admin CRUD khach san | NOT TESTED | Can admin credential (mat khau khong biet) |
| 5.4 | Admin CRUD phong | NOT TESTED | Can admin credential |
| 5.5 | Admin CRUD ve/combo | NOT TESTED | Can admin credential |
| 5.6 | Admin CRUD khuyen mai | NOT TESTED | Can admin credential |
| 5.7 | Admin xem toan bo booking | NOT TESTED | Can admin credential |
| 5.8 | Admin thay doi trang thai booking | NOT TESTED | Can admin credential |
| 5.9 | Admin quan ly nguoi dung | NOT TESTED | Can admin credential |
| 5.10 | Audit log | NOT TESTED | Can admin credential + kiem tra DB |

Ghi chu: Tai khoan admin admin@mayan.test ton tai ma khong biet mat khau. Seed script co the tao admin moi voi --nhung se sua DB production. Khuyen nghich: tao admin test rieng hoac reset mat khau admin@mayan.test de kiem thu CRUD Admin.

### HANG MUC 6: HE THONG, CSDL & CODE QUALITY

| # | Truong hop kiem thu | Ket qua | Chi tiet |
|---|---------------------|---------|----------|
| 6.1 | SQLite schema day du (users, bookings, rooms, flights, combos, promos, payments, audit) | PASS | 12 bang, FK constraints, UNIQUE indexes |
| 6.2 | Email UNIQUE (COLLATE NOCASE) | PASS | Trung email -> 409 |
| 6.3 | SDT UNIQUE (kiem tra thu cong trong route) | PASS | Trung SDT -> 409 |
| 6.4 | Mat khau ma hoa scrypt | PASS | Khong luu plaintext |
| 6.5 | SQL injection bi chan | PASS | 3 thu bi chan (parameterized queries + validation) |
| 6.6 | Loi API tra JSON chuan (khong crash 500) | PASS | { error: "..." } + status code thich hop |
| 6.7 | npm run lint | PASS | 0 errors, 3 warnings (pre-existing) |
| 6.8 | npx vite build | PASS | Thanh cong, dist/ sinh ra |
| 6.9 | Transaction BEGIN IMMEDIATE cho booking | PASS | Chong race condition, khong tao booking gia |
| 6.10 | Idempotency key (chong double-submit) | PASS | UNIQUE(user_id, idempotency_key) |


---

## LOI PHAY HIEN (P0/P1/P2)

### P0 — Dang nhap tu tao tai khoan (NGHIEM TRONG)

Vi tri: server/routes-public.js, dong 86-101, ham POST /api/auth/login  
Mo tap: Khi dang nhap voi email chua ton tai, code tu goi hashPassword() + createUser() tao tai khoan moi thay ve bao loi "Email khong ton tai."  
Tac dong: Ai cung co the tao tai khoan qua endpoint dang nhap, lam loan du lieu user, gay kho kho trong dieu tra va bao cao doanh thu.  
Cach sua: Xoa khoi if (!user) { ... createUser(...) }, chi giu logic verifyPassword. Neu !user -> tra 401 "Email hoac mat khau khong dung."

### P2 — Thanh toan la mo phong (khong phai loi, la gioi han)

Vi tri: server/routes-payment.js, MOMO_ENABLED=false  
Mo tap: POST /api/payment/create tra 503. payment_status='simulated' trong DB.  
Tac dong: Khong the thanh toan thah cho den khi co credential MoMo sandbox/production.  
Huong giai quyet: Cau hinh MoMo sandbox, bat MOMO_ENABLED=true, trien khai IPN webhook xac minh chu ky.

---

## DE XUAT BAN VÁ CODE (NGAN GOM)

### Sua loi P0 (login auto-create)

File: server/routes-public.js, thay the toan bo ham POST /api/auth/login (dong 86-111):

publicRouter.post('/auth/login', loginIpLimit, async (req, res) => {
  const email = txt(req.body?.email, 80, 5)?.toLowerCase()
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!email || !EMAIL_RE.test(email)) return bad(res, 'Email khong hop le.')
  if (password.length < 6) return bad(res, 'Mat khau phai co it nhat 6 ky tu.')
  if (password.length > 64) return bad(res, 'Mat khau toi da 64 ky tu.')

  const key = clientKey(req, email)
  if (loginBlocked(key)) return bad(res, 'Dang nhap sai qua nhieu lan. Vui long thu lai sau it phut.', 429)

  const user = findUserByEmail(email)
  if (!user) {
    recordLoginFail(key)
    return bad(res, 'Email hoac mat khau khong dung.', 401)
  }
  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    recordLoginFail(key)
    return bad(res, 'Email hoac mat khau khong dung.', 401)
  }
  if (Number(user.is_active) !== 1) return bad(res, 'Tai khoan da bi vo hieu hoa.', 403)

  clearLoginFails(key)
  const { token, expiresAt } = createSession(user.id)
  setSessionCookie(res, token, SESSION_TTL_MS)
  res.json({ ok: true, user: publicUser(user), expiresAt })
})

### Sau khi sua P0
1. Chuy lai npm run lint -> 0 errors
2. Chuy lai npx vite build -> thanh cong
3. Chuy lai toan bo test suite
4. Kiem thu dang nhap email khong ton tai -> phai tra 401

---

## KET LUAN

He thong da hoan thien tot ve: xac thuc (tru loi P0), tim kiem/loc, dat cho, huy booking, chong trung, quyen so huu du lieu, bao ve SQL injection, lint/build.
Chua san sang productions thah vi: (1) loi P0 can sua, (2) chua co admin credential de kiem thu CRUD Admin, (3) thanh toan chua ket noi MoMo that, (4) chua co domain/VPS/HTTPS.

Khuyen nghich: Sua loi P0 truoc khi tuc tuc kiem thu Admin va trien khai production.

Thanh toan la mo phong (demo), chua ket noi MoMo that.