// take_wallet_screenshots.mjs — Chụp ảnh thực tế Profile Wallet, Deposit Modal và Light Mode Checkout
import { chromium } from 'playwright'

const BASE_URL = 'http://localhost:5175'
const API_URL = 'http://localhost:3001'

async function capture() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })

  const context = await browser.newContext({
    viewport: { width: 1280, height: 1200 },
    colorScheme: 'light',
  })

  const page = await context.newPage()

  console.log('1. Đăng ký & Đăng nhập tài khoản test để chụp UI...')
  const randomPhone = `09${Math.floor(10000000 + Math.random() * 90000000)}`
  const testUser = {
    email: `ui_test_${Date.now()}@mayan.vn`,
    password: 'password123',
    name: 'Phạm Minh Khôi',
    phone: randomPhone,
  }

  const regRes = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
    body: JSON.stringify(testUser),
  })
  const regData = await regRes.json()
  const userId = regData.user.id
  const cookieHeader = regRes.headers.get('set-cookie')?.split(';')[0] || ''

  // Nạp sẵn 1.500.000 đ vào ví qua simulate để UI có dữ liệu thực tế
  await fetch(`${API_URL}/api/payment/wallet/deposit/simulate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'fetch',
      'Cookie': cookieHeader,
    },
    body: JSON.stringify({ amount: 1500000 }),
  })

  // Set cookie vào browser context
  const [cName, cVal] = cookieHeader.split('=')
  await context.addCookies([
    {
      name: cName,
      value: cVal,
      domain: 'localhost',
      path: '/',
    },
  ])

  // Set localStorage session để React sync ngay lập tức
  await page.goto(`${BASE_URL}/#/profile`, { waitUntil: 'networkidle' })
  await page.evaluate((u) => {
    localStorage.setItem('may-an-nhien-session', JSON.stringify({
      email: u.email,
      name: u.name,
      phone: u.phone,
      id: u.id,
      role: 'customer',
      at: Date.now(),
    }))
  }, { ...testUser, id: userId })

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  // 1. Chụp ảnh Profile Page với Wallet Card & Lịch sử
  await page.screenshot({ path: 'wallet_profile_page.png' })
  console.log('📸 Đã chụp: wallet_profile_page.png')

  // 2. Mở Deposit Modal và chụp ảnh
  const depositBtn = page.locator('.wallet-deposit-cta-btn')
  if (await depositBtn.count() > 0) {
    await depositBtn.click()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'wallet_deposit_modal.png' })
    console.log('📸 Đã chụp: wallet_deposit_modal.png')

    // Bấm test nạp tiền mô phỏng
    const simBtn = page.locator('.sepay-simulate-btn')
    if (await simBtn.count() > 0) {
      await simBtn.click()
      await page.waitForTimeout(1200)
      await page.screenshot({ path: 'wallet_deposit_success.png' })
      console.log('📸 Đã chụp: wallet_deposit_success.png')
    }
  }

  // 3. Vào trang Checkout để chụp kiểm tra độ tương phản Light Mode
  await page.goto(`${BASE_URL}/#/flight`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const bookBtn = page.locator('.flight-book-btn, button:has-text("Đặt vé"), button:has-text("Chọn")')
  if (await bookBtn.count() > 0) {
    await bookBtn.first().click({ force: true })
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'checkout_light_contrast_verified.png' })
    console.log('📸 Đã chụp: checkout_light_contrast_verified.png')
  }

  await browser.close()
  console.log('✅ Hoàn tất chụp ảnh minh chứng UI!')
}

capture().catch((e) => {
  console.error('Lỗi chụp ảnh:', e)
  process.exit(1)
})
