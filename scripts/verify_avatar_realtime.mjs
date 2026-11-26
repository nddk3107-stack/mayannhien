import { chromium } from 'playwright'
import { db, createSession, findUserById } from '../server/db.js'
import WebSocket from 'ws'
import fs from 'fs'
import path from 'path'

async function run() {
  console.log('--- BẮT ĐẦU KIỂM THỬ AVATAR & REAL-TIME WEBSOCKET ---')
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get('77huanle@gmail.com')
  if (!user) {
    console.error('Không tìm thấy user 77huanle@gmail.com')
    process.exit(1)
  }

  // Tạo token phiên đăng nhập hợp lệ
  const rawToken = createSession(user.id)
  console.log('Đã tạo phiên đăng nhập cho user:', user.email, 'Token:', rawToken)

  // 1. Tạo test image 100x100 PNG
  const sampleImagePath = path.resolve('scripts/sample_avatar.png')
  // Minimal valid 1x1 or small PNG buffer
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA6SURBVHhe7cExAQAAAMKg9U9tDQ8gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgDca7AABaFh8hAAAAABJRU5ErkJggg=='
  fs.writeFileSync(sampleImagePath, Buffer.from(pngBase64, 'base64'))

  // 2. Kết nối WebSocket client để lắng nghe real-time event
  let receivedWsEvent = null
  const ws = new WebSocket('ws://localhost:3001/api/realtime/ws')
  ws.on('open', () => {
    console.log('[WS] Đã kết nối thành công tới WebSocket server')
    ws.send(JSON.stringify({ type: 'auth', token: rawToken.token }))
    ws.send(JSON.stringify({ type: 'sub', channel: `user:${user.id}` }))
    ws.send(JSON.stringify({ type: 'sub', channel: 'all' }))
  })
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString())
      console.log('[WS] Nhận sự kiện:', data.event, data.data || data)
      if (data.event === 'user:avatar:updated') {
        receivedWsEvent = data
      }
    } catch {}
  })

  // 3. Khởi chạy Playwright
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  })

  // Thêm session cookie
  await context.addCookies([
    {
      name: 'may_an_nhien_sid',
      value: rawToken.token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])

  const page = await context.newPage()

  console.log('Mở trang Profile...')
  await page.goto('http://localhost:5175/#/profile', { waitUntil: 'networkidle' })
  await page.evaluate((userData) => {
    localStorage.setItem(
      'may-an-nhien-session',
      JSON.stringify({
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        phone: userData.phone,
        avatarUrl: userData.avatar_url || '',
        at: Date.now(),
      })
    )
  }, user)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  // Kiểm tra file input
  const fileInput = await page.$('input[type="file"]')
  if (!fileInput) {
    throw new Error('Không tìm thấy input[type="file"] trên ProfilePage!')
  }

  console.log('Tiến hành upload ảnh đại diện mới qua UI...')
  await fileInput.setInputFiles(sampleImagePath)

  // Đợi phản hồi thành công
  await page.waitForTimeout(2500)

  // Kiểm tra xem có thông báo lỗi CSRF không
  const errorText = await page.evaluate(() => {
    const el = document.querySelector('.error-banner, [style*="color: #ef4444"], [style*="color: rgb(239, 68, 68)"]')
    return el ? el.textContent : null
  })

  if (errorText && errorText.includes('CSRF')) {
    console.error('LỖI CSRF VẪN XUẤT HIỆN:', errorText)
    await page.screenshot({ path: 'avatar_csrf_failed.png' })
    process.exit(1)
  }

  // Chụp ảnh kết quả trang Profile
  await page.screenshot({ path: 'C:/Users/ADMIN/.gemini/antigravity/brain/423f2365-c9d8-40c1-bfeb-e5547d0955c1/avatar_upload_success.png' })
  console.log('Đã chụp screenshot: avatar_upload_success.png')

  // Kiểm tra Navbar avatar
  const navbarAvatarImg = await page.$('.account-avatar img')
  const navbarAvatarSrc = navbarAvatarImg ? await navbarAvatarImg.getAttribute('src') : null
  console.log('Navbar Avatar Image src:', navbarAvatarSrc)

  // Chụp vùng Navbar
  const navbar = await page.$('.navbar, header, .nav-wrap')
  if (navbar) {
    await navbar.screenshot({ path: 'C:/Users/ADMIN/.gemini/antigravity/brain/423f2365-c9d8-40c1-bfeb-e5547d0955c1/navbar_avatar_updated.png' })
    console.log('Đã chụp screenshot: navbar_avatar_updated.png')
  }

  // Chuyển sang Light Mode và chụp trang Checkout để kiểm tra contrast
  console.log('Mở trang Checkout trong Light Mode...')
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light')
    localStorage.setItem('mayan_theme', 'light')
  })
  await page.goto('http://localhost:5175/#/checkout?type=flight', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  // Click vào phương thức ATM
  const atmCard = await page.$('.pay-method-card.pay-bank')
  if (atmCard) {
    await atmCard.click()
    await page.waitForTimeout(500)
  }

  await page.screenshot({ path: 'C:/Users/ADMIN/.gemini/antigravity/brain/423f2365-c9d8-40c1-bfeb-e5547d0955c1/checkout_payment_methods_contrast.png', fullPage: false })
  console.log('Đã chụp screenshot: checkout_payment_methods_contrast.png')

  console.log('Real-Time WS Event nhận được:', receivedWsEvent ? 'CÓ (Thành công)' : 'CHƯA')

  await browser.close()
  ws.close()

  console.log('--- HOÀN THÀNH KIỂM THỬ THÀNH CÔNG ---')
  process.exit(0)
}

run().catch((err) => {
  console.error('LỖI KIỂM THỬ:', err)
  process.exit(1)
})
