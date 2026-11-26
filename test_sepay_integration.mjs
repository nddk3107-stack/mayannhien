// test_sepay_integration.mjs — Kiểm thử tự động toàn diện API thanh toán SePay VietQR & Webhook
import { strict as assert } from 'node:assert'

const BASE = 'http://localhost:3001'

async function run() {
  console.log('=== BẮT ĐẦU KIỂM THỬ TÍCH HỢP SEPAY VIETQR ===\n')

  // 1. Kiểm tra cấu hình SePay từ /api/payment/config
  console.log('[1] Kiểm tra /api/payment/config...')
  const configRes = await fetch(`${BASE}/api/payment/config`)
  assert.equal(configRes.status, 200, 'Config status must be 200')
  const config = await configRes.json()
  assert.ok(config.sepay, 'sepay config must exist')
  assert.equal(config.sepay.enabled, true, 'sepay must be enabled')
  assert.equal(config.sepay.accName, 'PHAM MINH KHOI', 'Account name must match Phạm Minh Khôi')
  console.log('   ✓ SePay config hợp lệ:', config.sepay.bank, config.sepay.accNumber, config.sepay.accName)

  // 2. Đăng ký/đăng nhập tài khoản test
  console.log('\n[2] Đăng ký tài khoản test...')
  const now = Date.now()
  const email = `sepay_test_${now}@mayan.test`
  const phone = `09${Math.floor(10000000 + Math.random() * 90000000)}`
  const password = 'TestUser@123456'
  const regRes = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
    body: JSON.stringify({ email, password, name: 'Phạm Minh Khôi', phone }),
  })
  assert.equal(regRes.status, 201, 'Register status must be 201')
  const cookie = regRes.headers.get('set-cookie')
  assert.ok(cookie, 'Phải có session cookie')
  console.log('   ✓ Đăng ký tài khoản test thành công:', email, phone)

  // 3. Tạo đơn hàng với phương thức SePay VietQR
  console.log('\n[3] Tạo đơn hàng đặt vé máy bay với phương thức SePay VietQR...')
  const departDate = `2027-01-${String(Math.floor(10 + Math.random() * 15))}`
  const bookRes = await fetch(`${BASE}/api/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'fetch',
      Cookie: cookie,
    },
    body: JSON.stringify({
      serviceType: 'combo',
      itemId: 'combo-hotel-1',
      passengers: 2,
      traveler: { name: 'Phạm Minh Khôi', phone: '0988776655', email: 'khoi@example.com' },
      paymentMethod: 'Chuyển khoản SePay VietQR (Tự động 24/7)',
      dates: { depart: departDate, ret: '2027-01-28' },
    }),
  })
  const bookData = await bookRes.json()
  assert.equal(bookRes.status, 201, 'Booking status must be 201')
  const booking = bookData.booking
  assert.ok(booking?.code, 'Phải có mã đơn hàng')
  assert.equal(booking.status, 'Chờ thanh toán', 'Trạng thái ban đầu phải là Chờ thanh toán')
  assert.equal(booking.paymentStatus, 'pending', 'paymentStatus ban đầu phải là pending')
  console.log(`   ✓ Tạo đơn ${booking.code} thành công: tổng tiền ${booking.total}đ, trạng thái = "${booking.status}"`)

  // 4. Lấy thông tin thanh toán & mã VietQR động từ /api/payment/sepay/info/:code
  console.log('\n[4] Lấy thông tin thanh toán & mã VietQR từ /api/payment/sepay/info/:code...')
  const qrRes = await fetch(`${BASE}/api/payment/sepay/info/${booking.code}`)
  assert.equal(qrRes.status, 200, 'Sepay info status must be 200')
  const qrData = await qrRes.json()
  assert.equal(qrData.ok, true)
  assert.equal(qrData.bookingCode, booking.code)
  assert.equal(qrData.accountName, 'PHAM MINH KHOI')
  assert.ok(qrData.qrUrl.includes('qr.sepay.vn'), 'qrUrl phải trỏ về qr.sepay.vn')
  assert.ok(qrData.qrUrl.includes(booking.code), 'qrUrl phải chứa mã đơn hàng')
  console.log('   ✓ VietQR URL:', qrData.qrUrl)

  // 5. Kiểm thử mô phỏng thanh toán thành công qua /api/payment/sepay/simulate
  console.log('\n[5] Kiểm thử mô phỏng thanh toán qua /api/payment/sepay/simulate...')
  const simRes = await fetch(`${BASE}/api/payment/sepay/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', Cookie: cookie },
    body: JSON.stringify({ bookingCode: booking.code }),
  })
  assert.equal(simRes.status, 200, 'Simulate status must be 200')
  const simData = await simRes.json()
  assert.equal(simData.ok, true)
  assert.equal(simData.status, 'Đã thanh toán')
  assert.equal(simData.paymentStatus, 'paid')
  console.log('   ✓ Mô phỏng thanh toán thành công:', simData.message)

  // 6. Kiểm tra lại trạng thái đơn hàng trong DB sau khi mô phỏng
  console.log('\n[6] Kiểm tra lại trạng thái đơn qua /api/payment/sepay/status/:code...')
  const checkRes = await fetch(`${BASE}/api/payment/sepay/status/${booking.code}`)
  assert.equal(checkRes.status, 200)
  const checkData = await checkRes.json()
  assert.equal(checkData.status, 'Đã thanh toán', 'Trạng thái đơn phải là Đã thanh toán')
  assert.equal(checkData.paid, true, 'paid phải là true')
  console.log('   ✓ Đơn hàng đã chuyển sang trạng thái "Đã thanh toán" và đã được cộng tiền!')

  // 7. Tạo đơn hàng thứ 2 để kiểm thử Webhook thực tế từ SePay (server-to-server)
  console.log('\n[7] Tạo đơn hàng thứ 2 để kiểm tra Webhook IPN từ SePay...')
  const bookRes2 = await fetch(`${BASE}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', Cookie: cookie },
    body: JSON.stringify({
      serviceType: 'combo',
      itemId: 'combo-hotel-2',
      passengers: 1,
      traveler: { name: 'Khách SePay', phone: '0988776655', email: 'sepay@example.com' },
      paymentMethod: 'Chuyển khoản SePay VietQR (Tự động 24/7)',
      dates: { depart: '2027-02-05', ret: '2027-02-08' },
    }),
  })
  assert.equal(bookRes2.status, 201, 'Booking 2 status must be 201')
  const book2 = (await bookRes2.json()).booking
  console.log(`   ✓ Tạo đơn thứ hai: ${book2.code}, tổng tiền ${book2.total}đ, trạng thái = "${book2.status}"`)

  // 8. Giả lập gửi SePay Webhook trực tiếp tới /api/payment/sepay/webhook (không cần Cookie / CSRF)
  console.log('\n[8] Gửi Webhook SePay (chuẩn payload SePay)...')
  const sepayPayload = {
    id: 998877,
    gateway: 'MBBank',
    transactionDate: '2026-11-26 21:00:00',
    accountNumber: '0901234567',
    code: null,
    content: `${book2.code} chuyen tien may an nhien`,
    transferType: 'in',
    transferAmount: book2.total,
    accumulated: 10000000,
    referenceCode: 'FT26330TEST123',
    description: `Khach hang chuyen tien ${book2.code}`,
  }

  const webhookRes = await fetch(`${BASE}/api/payment/sepay/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }, // Server-to-server không có X-Requested-With
    body: JSON.stringify(sepayPayload),
  })
  assert.equal(webhookRes.status, 200, 'Webhook status must be 200')
  const webhookData = await webhookRes.json()
  assert.equal(webhookData.success, true, 'Webhook phải xử lý thành công')
  console.log('   ✓ Webhook SePay trả về HTTP 200:', webhookData.message)

  // 9. Kiểm tra đơn hàng thứ 2 đã được cập nhật thành công
  console.log('\n[9] Kiểm tra đơn thứ 2 sau khi nhận Webhook...')
  const checkRes2 = await fetch(`${BASE}/api/payment/sepay/status/${book2.code}`)
  const checkData2 = await checkRes2.json()
  assert.equal(checkData2.status, 'Đã thanh toán')
  assert.equal(checkData2.paid, true)
  console.log('   ✓ Đơn thứ 2 đã tự động cập nhật: Đã thanh toán & đã cộng tiền!')

  // 10. Kiểm tra tính Idempotent (gửi lặp cùng webhook không gây lỗi hoặc cộng tiền lặp)
  console.log('\n[10] Kiểm tra Idempotency khi SePay gửi lại Webhook trùng...')
  const dupWebhookRes = await fetch(`${BASE}/api/payment/sepay/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sepayPayload),
  })
  assert.equal(dupWebhookRes.status, 200)
  const dupData = await dupWebhookRes.json()
  assert.equal(dupData.duplicate, true, 'Phải nhận diện giao dịch lặp')
  console.log('   ✓ Idempotency hoạt động chuẩn xác: duplicate = true')

  console.log('\n======================================================')
  console.log('🎉 TOÀN BỘ 10 BƯỚC KIỂM THỬ SEPAY VIETQR ĐỀU THÀNH CÔNG 100%!')
  console.log('======================================================')
}

run().catch((err) => {
  console.error('❌ LỖI KIỂM THỬ:', err)
  process.exit(1)
})
