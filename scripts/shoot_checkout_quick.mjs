import { chromium } from 'playwright'
import path from 'node:path'

const ARTIFACT_DIR = 'C:/Users/ADMIN/.gemini/antigravity/brain/423f2365-c9d8-40c1-bfeb-e5547d0955c1'
const BASE_URL = 'http://localhost:5175'
const API_URL = 'http://localhost:3001'

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 950 }, colorScheme: 'light' })
  const page = await context.newPage()

  const randomPhone = `09${Math.floor(10000000 + Math.random() * 90000000)}`
  const testUser = {
    email: `chk_quick_${Date.now()}@mayan.vn`,
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
  if (!regData.ok) {
    console.error('Lỗi register:', regRes.status, regData)
    return
  }
  const rawCookie = regRes.headers.get('set-cookie') || ''
  const cookieHeader = rawCookie.split(';')[0] || ''
  const cookieMatch = rawCookie.match(/([^=;\s]+)=([^;]+)/)
  if (cookieMatch) {
    await context.addCookies([{ name: cookieMatch[1], value: cookieMatch[2], domain: 'localhost', path: '/' }])
  }

  // Thêm 2 hành khách
  await fetch(`${API_URL}/api/profile/passengers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'Cookie': cookieHeader },
    body: JSON.stringify({ fullName: 'LÊ HUÂN', phone: '0901234567', label: 'Bản thân' }),
  })
  await fetch(`${API_URL}/api/profile/passengers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'Cookie': cookieHeader },
    body: JSON.stringify({ fullName: 'NGUYỄN THỊ MAI', phone: '0988776655', label: 'Gia đình' }),
  })

  // Đi thẳng tới Checkout
  await page.goto(`${BASE_URL}/#/checkout`, { waitUntil: 'networkidle' })
  await page.evaluate((u) => {
    localStorage.setItem('may-an-nhien-session', JSON.stringify({
      email: u.email, name: u.name, phone: u.phone, id: u.id, role: 'customer', at: Date.now(),
    }))
  }, { ...testUser, id: regData.user.id })

  await page.reload({ waitUntil: 'networkidle' })
  await new Promise((r) => setTimeout(r, 1200))

  const shot = path.join(ARTIFACT_DIR, 'checkout_quick_passenger_selector.png')
  await page.screenshot({ path: shot, fullPage: true })
  console.log('Đã chụp Checkout thành công:', shot)

  await browser.close()
}

run().catch(console.error)
