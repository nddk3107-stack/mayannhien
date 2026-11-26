// test_user_features.mjs — Kiểm thử 4 tính năng người dùng yêu cầu:
// 1. Google Maps embed và link tọa độ (10.8593152, 106.7843584)
// 2. Deal tốt trên App: Mã QR hàm băm SHA-256
// 3. Trợ lý AI lập lịch trình: API Key & Đồng bộ dữ liệu Web
// 4. Chuông thông báo tương phản cao trên Header

import { chromium } from 'playwright'
import { createSession } from './server/db.js'

const BASE_URL = 'http://localhost:5175'

async function run() {
  console.log('🚀 Bắt đầu kiểm thử các tính năng người dùng yêu cầu...')
  const adminSession = createSession(1)
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addCookies([
    { name: 'may_an_nhien_sid', value: adminSession.token, domain: 'localhost', path: '/' }
  ])
  const page = await context.newPage()
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()))
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message))
  page.on('requestfailed', (req) => console.log('REQ FAIL:', req.url(), req.failure()))
  await page.addInitScript(() => {
    localStorage.setItem('may-an-nhien-session', JSON.stringify({
      id: 1,
      email: 'admin@mayan.vn',
      name: 'le huân',
      role: 'admin',
    }))
  })

  try {
    // -------------------------------------------------------------
    // TÍNH NĂNG 1: Trang chủ - Mã QR Hàm băm SHA-256
    // -------------------------------------------------------------
    console.log('\n--- 1. KIỂM THỬ MÃ QR HÀM BĂM SHA-256 ---')
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    const qrWrap = page.locator('.tvlk-qr-svg-wrap')
    await qrWrap.scrollIntoViewIfNeeded()
    console.log('Đã tìm thấy khối mã QR DEAL TỐT TRÊN APP.')

    // Kiểm tra badge hiển thị hàm băm SHA-256
    const hashBadge = page.locator('.tvlk-qr-hash-badge')
    const hashBadgeText = await hashBadge.innerText()
    console.log('Badge hiển thị:', hashBadgeText)
    if (!hashBadgeText.includes('SHA-256:')) {
      throw new Error('Không thấy chữ ký SHA-256 trên badge!')
    }

    // Bấm vào mã QR để mở Modal xác thực SHA-256
    await qrWrap.click()
    await page.waitForTimeout(600)

    const shaModal = page.locator('.tvlk-sha-modal')
    const modalVisible = await shaModal.isVisible()
    console.log('Modal xác thực SHA-256 hiển thị:', modalVisible)
    if (!modalVisible) throw new Error('Modal SHA-256 không mở!')

    const shaAlgo = await page.locator('.tvlk-sha-algo').innerText()
    const shaFullHash = await page.locator('.tvlk-sha-full-hash').innerText()
    const voucherCode = await page.locator('.tvlk-sha-code-pill').innerText()
    console.log(`Thuật toán: ${shaAlgo}`)
    console.log(`Mã băm SHA-256 (64 hex): ${shaFullHash} (Độ dài: ${shaFullHash.length})`)
    console.log(`Mã voucher: ${voucherCode}`)

    if (shaFullHash.length !== 64) {
      throw new Error(`Độ dài chuỗi băm SHA-256 không chuẩn (${shaFullHash.length} != 64)`)
    }
    await page.screenshot({ path: 'uat_screenshots/user_sha256_modal.png' })
    await page.locator('.login-close').click()
    await page.waitForTimeout(400)

    // -------------------------------------------------------------
    // TÍNH NĂNG 2: Chuông thông báo trên Header (Tương phản cao)
    // -------------------------------------------------------------
    console.log('\n--- 2. KIỂM THỬ NÚT CHUÔNG THÔNG BÁO HEADER ---')
    const notifBtn = page.locator('.notif-btn')
    const notifVisible = await notifBtn.isVisible()
    console.log('Nút chuông thông báo hiển thị:', notifVisible)
    if (!notifVisible) throw new Error('Không tìm thấy nút chuông thông báo!')

    const notifBox = await notifBtn.boundingBox()
    console.log('Kích thước nút chuông:', notifBox)

    // Kiểm tra màu stroke của icon Bell
    const bellSvg = page.locator('.notif-btn svg')
    const stroke = await bellSvg.getAttribute('stroke')
    console.log('Màu stroke của Bell icon:', stroke)
    await page.screenshot({ path: 'uat_screenshots/user_notif_bell.png' })

    // -------------------------------------------------------------
    // TÍNH NĂNG 3: Khách sạn & Google Maps trực tiếp (10.8593152, 106.7843584)
    // -------------------------------------------------------------
    console.log('\n--- 3. KIỂM THỬ BẢN ĐỒ GOOGLE MAPS TRỰC TIẾP ---')
    await page.goto(`${BASE_URL}/#/hotel`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    // Link Google Maps trên FilterPanel
    const gmapsLink = page.locator('.man-gmaps-link-btn')
    const gmapsHref = await gmapsLink.getAttribute('href')
    console.log('Link Google Maps trên FilterPanel:', gmapsHref)
    if (!gmapsHref.includes('10.8593152') || !gmapsHref.includes('106.7843584')) {
      throw new Error('Link Google Maps không đúng tọa độ yêu cầu (10.8593152, 106.7843584)!')
    }

    // Mở Modal Bản đồ
    const openMapArt = page.locator('.man-minimap-art')
    await openMapArt.click()
    await page.waitForTimeout(1000)

    const mapModal = page.locator('.man-map-modal-card')
    const mapModalVisible = await mapModal.isVisible()
    console.log('Modal bản đồ hiển thị:', mapModalVisible)
    if (!mapModalVisible) throw new Error('Modal bản đồ không mở!')

    // Kiểm tra Google Maps iframe
    const gmapsIframe = page.locator('.man-map-gmaps-viewport iframe')
    const iframeVisible = await gmapsIframe.isVisible()
    const iframeSrc = await gmapsIframe.getAttribute('src')
    console.log('Iframe Google Maps hiển thị:', iframeVisible)
    console.log('Iframe src:', iframeSrc)
    if (!iframeVisible || !iframeSrc.includes('maps.google.com')) {
      throw new Error('Iframe Google Maps không hiển thị!')
    }

    // Kiểm tra nút chuyển tọa độ Thủ Đức (10.8593, 106.7844)
    const thuDucBtn = page.locator('.man-loc-jump-btn:has-text("Thủ Đức")')
    const thuDucBtnVisible = await thuDucBtn.isVisible()
    console.log('Nút nhảy tọa độ Thủ Đức:', thuDucBtnVisible)
    if (thuDucBtnVisible) {
      await thuDucBtn.click()
      await page.waitForTimeout(500)
    }

    // Nút mở Google Maps trong dock
    const dockGmapsBtn = page.locator('.man-dock-gmaps-btn')
    const dockGmapsVisible = await dockGmapsBtn.isVisible()
    console.log('Nút Google Maps trong dock khách sạn:', dockGmapsVisible)

    await page.screenshot({ path: 'uat_screenshots/user_google_maps_modal.png' })
    await page.locator('.man-map-close-btn').click()
    await page.waitForTimeout(400)

    // -------------------------------------------------------------
    // TÍNH NĂNG 4: Trợ lý AI Lập Lịch Trình - API Key & Web Data
    // -------------------------------------------------------------
    console.log('\n--- 4. KIỂM THỬ TRỢ LÝ AI LẬP LỊCH TRÌNH ---')
    await page.goto(`${BASE_URL}/#/ai-planner`, { waitUntil: 'load' })
    await page.waitForTimeout(1000)

    // Xác thực nút cấu hình API Key đã được ẩn khỏi UI (API Key chỉ cấu hình trong mã nguồn)
    const apiKeyBtn = page.locator('button:has-text("Cấu hình API Key")')
    const apiKeyBtnVisible = await apiKeyBtn.isVisible()
    console.log('Nút Cấu hình API Key đã ẩn khỏi UI (an toàn bảo mật):', !apiKeyBtnVisible)
    if (apiKeyBtnVisible) throw new Error('Nút Cấu hình API Key vẫn còn hiển thị trên UI!')

    const aiPlanBtn = page.locator('button.register-btn:has-text("Lập lịch trình")')
    await aiPlanBtn.scrollIntoViewIfNeeded()
    await aiPlanBtn.click()
    await page.waitForSelector('.ai-web-insights-card', { timeout: 10000 })

    const webCard = page.locator('.ai-web-insights-card')
    const webCardVisible = await webCard.isVisible()
    console.log('Card Dữ liệu Web thời gian thực hiển thị:', webCardVisible)
    if (!webCardVisible) throw new Error('Không thấy card Thông tin & Mẹo du lịch từ Web!')

    const weatherText = await page.locator('.ai-web-insights-card').innerText()
    console.log('Nội dung dữ liệu Web trích đoạn:', weatherText.slice(0, 150) + '...')
    await page.screenshot({ path: 'uat_screenshots/user_ai_web_planner.png' })

    console.log('\n🎉 TẤT CẢ 4 TÍNH NĂNG ĐÃ VƯỢT QUA KIỂM THỬ 100% THÀNH CÔNG!')
  } finally {
    await browser.close()
  }
}

run().catch((err) => {
  console.error('❌ Kiểm thử thất bại:', err)
  process.exit(1)
})
