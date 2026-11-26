// test_wallet_integration.mjs — Kiểm thử tích hợp Ví Mây An Nhiên, Nạp tiền SePay VietQR & Webhook
import assert from 'node:assert'

const BASE_URL = 'http://localhost:3001'

async function runTests() {
  console.log('🚀 Bắt đầu kiểm thử toàn diện Ví Mây An Nhiên & SePay Webhook...')

  const randomPhone = `09${Math.floor(10000000 + Math.random() * 90000000)}`
  const testUser = {
    email: `test_wallet_${Date.now()}@example.com`,
    password: 'password123',
    name: 'Khách Hàng Thử Nghiệm Ví',
    phone: randomPhone,
  }

  // 1. Đăng ký tài khoản
  console.log('1. Đăng ký tài khoản mới...')
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
    body: JSON.stringify(testUser),
  })
  const regData = await regRes.json()
  assert.ok(regRes.status === 200 || regRes.status === 201, 'Đăng ký phải trả về 200 hoặc 201')
  const user = regData.user
  const cookie = regRes.headers.get('set-cookie')?.split(';')[0] || ''
  assert.ok(cookie, 'Phải có session cookie')
  console.log(`   -> Người dùng ID: ${user.id}, Email: ${user.email}`)

  const authHeaders = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'fetch',
    'Cookie': cookie,
  }

  // 2. Kiểm tra GET /api/profile ban đầu
  console.log('2. Kiểm tra GET /api/profile ban đầu...')
  const profRes = await fetch(`${BASE_URL}/api/profile`, { headers: authHeaders })
  const profData = await profRes.json()
  assert.equal(profRes.status, 200)
  assert.equal(profData.user.balance, 0, 'Số dư ban đầu phải là 0')
  assert.equal(profData.wallet.balance, 0)
  console.log('   -> Số dư ban đầu: 0 đ (Hợp lệ)')

  // 3. Kiểm tra GET /api/payment/wallet/deposit/info
  console.log('3. Lấy thông tin VietQR SePay nạp tiền...')
  const depInfoRes = await fetch(`${BASE_URL}/api/payment/wallet/deposit/info?amount=1000000`, { headers: authHeaders })
  const depInfo = await depInfoRes.json()
  assert.equal(depInfoRes.status, 200)
  assert.equal(depInfo.bank, 'MBBank')
  assert.equal(depInfo.accountNumber, '0901234567')
  assert.equal(depInfo.accountName, 'PHAM MINH KHOI')
  assert.equal(depInfo.content, `NAP${user.id}`, `Nội dung chuyển khoản phải là NAP${user.id}`)
  assert.ok(depInfo.qrUrl.includes('qr.sepay.vn'), 'Phải có link VietQR')
  console.log(`   -> MBBank: 0901234567 (PHAM MINH KHOI), Memo: ${depInfo.content}`)

  // 4. Mô phỏng nạp tiền qua API Test (500.000 đ)
  console.log('4. Kiểm tra mô phỏng nạp tiền 500.000 đ...')
  const simRes = await fetch(`${BASE_URL}/api/payment/wallet/deposit/simulate`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ amount: 500000 }),
  })
  const simData = await simRes.json()
  assert.equal(simRes.status, 200)
  assert.equal(simData.balance, 500000, 'Số dư sau nạp mô phỏng phải là 500.000 đ')
  console.log(`   -> Số dư mới sau nạp: ${new Intl.NumberFormat('vi-VN').format(simData.balance)} đ`)

  // 5. Kiểm tra SePay Webhook NẠP TIỀN THỰC TẾ với cú pháp NAP<userId> (1.500.000 đ)
  console.log('5. Gửi SePay Webhook nạp tiền (1.500.000 đ, memo "NAP' + user.id + '")...')
  const refCode = `SEPAY_DEP_${Date.now()}`
  const webhookPayload = {
    id: 123456,
    gateway: 'MBBank',
    transactionDate: '2026-11-26 21:00:00',
    accountNumber: '0901234567',
    subAccount: null,
    code: null,
    content: `NAP${user.id} ung dung chuyen tien`,
    transferType: 'in',
    description: `NAP${user.id} ung dung chuyen tien`,
    transferAmount: 1500000,
    referenceCode: refCode,
    accumulated: 2000000,
  }

  const hookRes = await fetch(`${BASE_URL}/api/payment/sepay/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(webhookPayload),
  })
  const hookData = await hookRes.json()
  assert.equal(hookRes.status, 200, 'Webhook phải trả về 200')
  assert.equal(hookData.success, true)
  assert.equal(hookData.type, 'deposit', 'Phải nhận diện loại giao dịch là deposit')
  assert.equal(hookData.balance, 2000000, 'Số dư sau nạp webhook phải là 2.000.000 đ')
  console.log(`   -> Webhook khớp lệnh thành công! Số dư sau nạp: ${new Intl.NumberFormat('vi-VN').format(hookData.balance)} đ`)

  // 6. Kiểm tra Idempotency chống nạp trùng lặp
  console.log('6. Kiểm tra Idempotency webhook trùng lặp...')
  const dupHookRes = await fetch(`${BASE_URL}/api/payment/sepay/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(webhookPayload),
  })
  const dupHookData = await dupHookRes.json()
  assert.equal(dupHookRes.status, 200)
  assert.equal(dupHookData.duplicate, true, 'Lần 2 phải báo duplicate = true')
  assert.equal(dupHookData.balance, 2000000, 'Số dư không bị cộng lần 2')
  console.log('   -> Idempotency bảo vệ an toàn: Không bị cộng trùng tiền.')

  // 7. Kiểm tra GET /api/profile hiển thị lịch sử ví
  console.log('7. Kiểm tra GET /api/profile sau khi nạp...')
  const profRes2 = await fetch(`${BASE_URL}/api/profile`, { headers: authHeaders })
  const profData2 = await profRes2.json()
  assert.equal(profData2.user.balance, 2000000)
  assert.equal(profData2.wallet.transactions.length, 2, 'Phải có 2 giao dịch nạp')
  console.log(`   -> Hồ sơ cá nhân: Số dư: ${profData2.user.balance} đ, ${profData2.wallet.transactions.length} giao dịch`)

  // 8. Đặt phòng khách sạn hoặc vé máy bay thanh toán BẰNG SỐ DƯ VÍ
  console.log('8. Tạo đơn đặt vé thanh toán trực tiếp bằng Số dư ví Mây An Nhiên...')
  const catalogRes = await fetch(`${BASE_URL}/api/catalog`)
  const catalog = await catalogRes.json()
  const flight = catalog.flights[0]

  const bookRes = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      serviceType: 'flight',
      itemId: flight.id,
      passengers: 1,
      traveler: {
        name: testUser.name,
        phone: testUser.phone,
        email: testUser.email,
      },
      paymentMethod: 'Số dư ví Mây An Nhiên',
      destination: flight.to,
      tripType: 'Một chiều',
      dates: { depart: '2026-12-01' },
      idempotencyKey: `IDEM_${Date.now()}`,
    }),
  })
  const bookData = await bookRes.json()
  assert.equal(bookRes.status, 201, 'Tạo đơn phải thành công 201')
  assert.equal(bookData.booking.status, 'Đã thanh toán', 'Trạng thái đơn phải là "Đã thanh toán"')
  assert.equal(bookData.booking.paymentStatus, 'paid', 'paymentStatus phải là "paid"')
  assert.equal(bookData.booking.paymentMethod, 'Số dư ví Mây An Nhiên')
  console.log(`   -> Đơn hàng ${bookData.booking.code} thanh toán thành công với số tiền ${new Intl.NumberFormat('vi-VN').format(bookData.booking.total)} đ`)

  // 9. Kiểm tra số dư ví đã được trừ chính xác
  console.log('9. Kiểm tra số dư ví và giao dịch thanh toán sau khi đặt đơn...')
  const profRes3 = await fetch(`${BASE_URL}/api/profile`, { headers: authHeaders })
  const profData3 = await profRes3.json()
  const expectedBalance = 2000000 - bookData.booking.total
  assert.equal(profData3.user.balance, expectedBalance, `Số dư sau trừ tiền phải là ${expectedBalance}`)
  const latestTx = profData3.wallet.transactions[0]
  assert.equal(latestTx.type, 'payment', 'Giao dịch mới nhất phải là payment')
  assert.equal(latestTx.amount, -bookData.booking.total, 'Số tiền giao dịch phải là âm')
  assert.equal(latestTx.booking_code, bookData.booking.code)
  console.log(`   -> Số dư còn lại: ${new Intl.NumberFormat('vi-VN').format(profData3.user.balance)} đ`)
  console.log(`   -> Lịch sử giao dịch: ${latestTx.description} (${latestTx.amount} đ)`)

  // 10. Kiểm tra từ chối thanh toán khi số dư không đủ
  console.log('10. Kiểm tra từ chối khi số dư không đủ...')
  const expensiveRes = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      serviceType: 'flight',
      itemId: flight.id,
      passengers: 2, // 2 vé (2.580.000đ) vượt quá số dư còn lại (710.000đ)
      traveler: {
        name: testUser.name,
        phone: testUser.phone,
        email: testUser.email,
      },
      paymentMethod: 'Số dư ví Mây An Nhiên',
      destination: flight.to,
      tripType: 'Một chiều',
      dates: { depart: '2026-12-01' },
      idempotencyKey: `IDEM_FAIL_${Date.now()}`,
    }),
  })
  const failData = await expensiveRes.json()
  assert.equal(expensiveRes.status, 400, 'Phải trả về 400 khi không đủ tiền')
  assert.equal(failData.code, 'INSUFFICIENT_BALANCE')
  assert.ok(failData.error.includes('không đủ'), 'Phải có thông báo lỗi rõ ràng')
  console.log(`   -> Bắt lỗi chuẩn xác: "${failData.error}"`)

  console.log('\n======================================================')
  console.log('🎉 TẤT CẢ 10/10 BƯỚC KIỂM THỬ VÍ & SEPAY WEBHOOK ĐỀU PASS 100%!')
  console.log('======================================================')
}

runTests().catch((err) => {
  console.error('❌ Lỗi kiểm thử:', err)
  process.exit(1)
})
