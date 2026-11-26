// test_sepay_success_ui.mjs
import { chromium } from 'playwright'
import path from 'node:path'
import { createSession } from './server/db.js'

async function run() {
  const adminSession = createSession(1)
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addCookies([
    { name: 'may_an_nhien_sid', value: adminSession.token, domain: 'localhost', path: '/' }
  ])
  const page = await context.newPage()
  await page.addInitScript(() => {
    localStorage.setItem('may-an-nhien-session', JSON.stringify({
      id: 1,
      email: 'admin@mayan.vn',
      name: 'Phạm Minh Khôi',
      role: 'admin',
    }))
  })

  // Đi tới combo và checkout
  await page.goto('http://localhost:5175/#/combo', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  const bookBtn = page.locator('.hotel-card button:has-text("Đặt ngay"), .combo-card button, button:has-text("Đặt ngay")').first()
  if (await bookBtn.count() > 0) {
    await bookBtn.click()
    await page.waitForTimeout(1000)
  }

  const inputs = page.locator('.checkout-form input')
  if (await inputs.count() >= 3) {
    await inputs.nth(0).fill('Phạm Minh Khôi')
    await inputs.nth(1).fill('0912345678')
    await inputs.nth(2).fill('khoi@example.com')
  }

  const sepayBtn = page.locator('button.pay-sepay')
  if (await sepayBtn.count() > 0) {
    await sepayBtn.click()
  }

  const payBtn = page.locator('.pay-cta-btn')
  if (await payBtn.count() > 0) {
    await payBtn.click()
  }

  // Chờ modal SePay xuất hiện
  await page.waitForSelector('.sepay-modal-container', { timeout: 10000 })
  await page.waitForTimeout(1000)

  // Bấm nút "Xác nhận thanh toán ngay (Mô phỏng Test SePay)"
  const testPayBtn = page.locator('.sepay-btn-simulate')
  await testPayBtn.click()
  console.log('Đã bấm nút mô phỏng thanh toán SePay!')

  // Chờ hiển thị giao diện thành công
  await page.waitForSelector('.sepay-success-pane', { timeout: 8000 })
  await page.waitForTimeout(1000)

  // Chụp ảnh màn hình thanh toán thành công
  await page.screenshot({ path: path.join(process.cwd(), 'sepay_payment_success.png') })
  console.log('Đã chụp ảnh sepay_payment_success.png thành công!')

  await browser.close()
}

run().catch(console.error)
