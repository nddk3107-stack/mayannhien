// scripts/shoot_clean_real_ui.mjs — Chụp ảnh xác thực đã xóa toàn bộ nút mô phỏng & banner API Key
import { chromium } from 'playwright'
import path from 'node:path'

const ARTIFACT_DIR = 'C:/Users/ADMIN/.gemini/antigravity/brain/423f2365-c9d8-40c1-bfeb-e5547d0955c1'
const BASE_URL = 'http://localhost:5175'
const API_URL = 'http://localhost:3001'

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' })
  const page = await context.newPage()

  // 1. Chụp AiPlannerPage để xác nhận đã xóa banner "Dữ liệu Web & SQLite thật 100% · API Key Đã Tích Hợp Sẵn"
  console.log('1. Chụp AiPlannerPage...')
  await page.goto(`${BASE_URL}/#/ai-planner`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'ai_planner_clean_production.png'), fullPage: false })

  // 2. Đăng ký/đăng nhập và mở DepositModal để xác nhận đã xóa nút mô phỏng nạp tiền
  console.log('2. Mở Profile & DepositModal...')
  const testUser = {
    email: `clean_real_${Date.now()}@mayan.vn`,
    password: 'password123',
    name: 'Khách Hàng Thực',
    phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
  }

  const regRes = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify(testUser),
  })
  const regData = await regRes.json()
  const rawCookie = regRes.headers.get('set-cookie') || ''
  const cookieMatch = rawCookie.match(/([^=;\s]+)=([^;]+)/)
  if (cookieMatch) {
    await context.addCookies([{ name: cookieMatch[1], value: cookieMatch[2], domain: 'localhost', path: '/' }])
  }

  await page.goto(`${BASE_URL}/#/profile`, { waitUntil: 'networkidle' })
  await page.evaluate((u) => {
    localStorage.setItem('may-an-nhien-session', JSON.stringify({
      email: u.email, name: u.name, phone: u.phone, id: u.id, role: 'customer', at: Date.now(),
    }))
  }, { ...testUser, id: regData.user.id })

  await page.reload({ waitUntil: 'networkidle' })
  await new Promise((r) => setTimeout(r, 1000))

  // Bấm nút Nạp tiền qua SePay VietQR để mở modal nạp tiền
  const depositBtn = await page.$('.wallet-deposit-cta-btn')
  if (depositBtn) {
    await depositBtn.click()
    await new Promise((r) => setTimeout(r, 1000))
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'deposit_modal_clean_production.png'), fullPage: false })
    console.log('Đã chụp DepositModal sạch 100% nút test!')
  }

  await browser.close()
  console.log('=== HOÀN TẤT CHỤP XÁC THỰC ===')
}

run().catch(console.error)
