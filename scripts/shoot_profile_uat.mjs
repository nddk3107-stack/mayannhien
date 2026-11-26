// scripts/shoot_profile_uat.mjs — Chụp ảnh thực tế Profile Tabs & Checkout Quick Passenger Selector
import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'

const ARTIFACT_DIR = 'C:/Users/ADMIN/.gemini/antigravity/brain/423f2365-c9d8-40c1-bfeb-e5547d0955c1'
const BASE_URL = 'http://localhost:5175'
const API_URL = 'http://localhost:3001'

async function shoot() {
  console.log('Khởi động Chrome Playwright...')
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 950 },
    colorScheme: 'light',
  })
  const page = await context.newPage()

  console.log('1. Đăng ký & đăng nhập tài khoản test UI...')
  const randomPhone = `09${Math.floor(10000000 + Math.random() * 90000000)}`
  const testUser = {
    email: `uat_profile_${Date.now()}@mayan.vn`,
    password: 'password123',
    name: 'Lê Huân',
    phone: randomPhone,
  }

  const regRes = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify(testUser),
  })
  const regData = await regRes.json()
  const cookieHeader = regRes.headers.get('set-cookie')?.split(';')[0] || ''
  const [cName, cVal] = cookieHeader.split('=')

  await context.addCookies([
    {
      name: cName,
      value: cVal,
      domain: 'localhost',
      path: '/',
    },
  ])

  // Thêm 2 hành khách vào danh bạ qua API
  await fetch(`${API_URL}/api/profile/passengers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': cookieHeader,
    },
    body: JSON.stringify({
      fullName: 'LÊ HUÂN',
      dob: '1995-10-20',
      gender: 'Nam',
      nationality: 'Việt Nam',
      idNumber: '079095012345',
      phone: randomPhone,
      label: 'Bản thân',
    }),
  })

  await fetch(`${API_URL}/api/profile/passengers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': cookieHeader,
    },
    body: JSON.stringify({
      fullName: 'NGUYỄN THỊ MAI',
      dob: '1998-03-12',
      gender: 'Nữ',
      nationality: 'Việt Nam',
      idNumber: '079198054321',
      phone: '0988776655',
      label: 'Gia đình',
    }),
  })

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  // Set localStorage session để React nhận diện phiên đăng nhập ngay lập tức
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
  }, { ...testUser, id: regData.user.id })

  await page.reload({ waitUntil: 'networkidle' })
  await sleep(1200)

  // Đi đến trang Profile
  console.log('2. Chụp ảnh Profile Tab 1 (Tổng quan, Thẻ hạng & Ví)...')
  const shot1 = path.join(ARTIFACT_DIR, 'profile_overview_loyalty.png')
  await page.screenshot({ path: shot1, fullPage: true })
  console.log('Đã chụp Tab 1:', shot1)

  // Chuyển sang Tab 2: Hành khách đã lưu
  console.log('3. Chuyển sang Tab 2: Hành khách đã lưu...')
  const tabButtons = await page.$$('.profile-tab-btn')
  console.log('Tìm thấy số tabs:', tabButtons.length)
  if (tabButtons.length >= 2) {
    await tabButtons[1].click()
    await sleep(800)
    const shot2 = path.join(ARTIFACT_DIR, 'profile_saved_passengers.png')
    await page.screenshot({ path: shot2, fullPage: true })
    console.log('Đã chụp Tab 2:', shot2)
  }

  // Chuyển sang Tab 3: Thông tin cá nhân & Bảo mật
  console.log('4. Chuyển sang Tab 3: Thông tin cá nhân & Bảo mật...')
  if (tabButtons.length >= 3) {
    await tabButtons[2].click()
    await sleep(800)
    const shot3 = path.join(ARTIFACT_DIR, 'profile_security_sessions.png')
    await page.screenshot({ path: shot3, fullPage: true })
    console.log('Đã chụp Tab 3:', shot3)
  }

  // 5. Đến trang Home rồi bấm chọn 1 chuyến bay để vào Checkout
  console.log('5. Điều hướng tới trang Home và bấm chọn chuyến bay vào Checkout...')
  await page.goto(`${BASE_URL}/#/home`, { waitUntil: 'networkidle' })
  await sleep(1000)

  // Bấm nút Đặt vé trên card đầu tiên
  const bookBtn = await page.$('.flight-card button, .hotel-card button, button.pick-room-btn')
  if (bookBtn) {
    await bookBtn.click()
    await sleep(1500)
  } else {
    // Hoặc click vào nút đầu tiên có chữ "Đặt"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      const b = btns.find((btn) => btn.textContent.includes('Đặt') || btn.textContent.includes('Chọn'))
      if (b) b.click()
    })
    await sleep(1500)
  }

  const shot4 = path.join(ARTIFACT_DIR, 'checkout_quick_passenger_selector.png')
  await page.screenshot({ path: shot4, fullPage: true })
  console.log('Đã chụp Checkout:', shot4)

  await browser.close()
  console.log('=== HOÀN TẤT CHỤP ẢNH UAT ===')
}

shoot().catch(console.error)
