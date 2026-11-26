import { chromium } from 'playwright'

async function run() {
  console.log('--- BẮT ĐẦU TEST TÍNH NĂNG ĐỊNH VỊ VỊ TRÍ TRỰC TIẾP (GPS & MAP MODAL) ---')
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: 10.7769, longitude: 106.7009 }, // Tọa độ trung tâm TP. Hồ Chí Minh
  })
  const page = await context.newPage()

  try {
    // 1. Vào trang Khách sạn
    console.log('1. Điều hướng đến #/hotel...')
    await page.goto('http://localhost:5175/#/hotel', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    // 2. Kiểm tra minimap card và nút Lấy vị trí trực tiếp
    const minimapCard = page.locator('.man-minimap-card')
    const hasMinimap = await minimapCard.isVisible()
    console.log(`Minimap card hiển thị: ${hasMinimap}`)
    if (!hasMinimap) throw new Error('Không tìm thấy .man-minimap-card')

    const geoBtn = page.locator('.man-geolocation-btn')
    const btnText = await geoBtn.innerText()
    console.log(`Nút định vị: "${btnText}"`)
    if (!btnText.includes('Lấy vị trí trực tiếp')) throw new Error('Nút định vị không đúng text')

    // 3. Click nút Lấy vị trí trực tiếp
    console.log('2. Click nút "Lấy vị trí trực tiếp"...')
    await geoBtn.click()
    await page.waitForTimeout(1200)

    // 4. Kiểm tra thông tin vị trí hiển thị
    const locationInfo = page.locator('.man-user-location-info')
    const hasLocInfo = await locationInfo.isVisible()
    console.log(`Bảng thông tin vị trí người dùng: ${hasLocInfo}`)
    if (!hasLocInfo) throw new Error('Không hiển thị .man-user-location-info sau khi bấm GPS')

    const locText = await locationInfo.innerText()
    console.log(`Chi tiết vị trí: \n${locText}`)
    if (!locText.includes('TP.HCM') && !locText.includes('Hồ Chí Minh')) {
      throw new Error('Chưa nhận diện đúng thành phố TP.HCM')
    }
    if (!locText.includes('Caravelle Saigon')) {
      throw new Error('Chưa hiển thị đúng khách sạn gần nhất (Caravelle Saigon Hotel)')
    }

    // 5. Kiểm tra danh sách khách sạn đã tự động xếp "Gần tôi nhất"
    const activeSortPill = page.locator('.man-sort-pill.active')
    const activeSortText = await activeSortPill.innerText()
    console.log(`Chế độ xếp đang chọn: "${activeSortText}"`)
    if (!activeSortText.includes('Gần tôi nhất')) {
      throw new Error('Chưa tự động chọn "Gần tôi nhất"')
    }

    const firstHotelTitle = page.locator('.man-hotel-title').first()
    const firstTitleText = await firstHotelTitle.innerText()
    console.log(`Khách sạn đứng đầu danh sách: "${firstTitleText}"`)
    if (!firstTitleText.includes('Caravelle Saigon')) {
      throw new Error(`Khách sạn gần nhất phải là Caravelle Saigon, thực tế là: ${firstTitleText}`)
    }

    const distChip = page.locator('.man-hotel-dist-chip').first()
    const hasDistChip = await distChip.isVisible()
    console.log(`Hiển thị khoảng cách trên thẻ khách sạn: ${hasDistChip}`)
    if (hasDistChip) {
      console.log(`Khoảng cách hiển thị: "${await distChip.innerText()}"`)
    }

    // Chụp ảnh bằng chứng
    await page.screenshot({ path: 'uat_screenshots/gps_located_success.png' })
    console.log('Đã lưu ảnh bằng chứng: uat_screenshots/gps_located_success.png')

    // 6. Test mở Interactive Map Modal
    console.log('3. Mở Interactive Map Modal qua click vào bản đồ nhỏ...')
    await page.locator('.man-minimap-art').click()
    await page.waitForTimeout(800)

    const mapModal = page.locator('.man-map-modal-card')
    const isMapOpen = await mapModal.isVisible()
    console.log(`Interactive Map Modal hiển thị: ${isMapOpen}`)
    if (!isMapOpen) throw new Error('Interactive Map Modal không mở!')

    const modalTitle = await page.locator('.man-map-modal-title h3').innerText()
    console.log(`Tiêu đề Modal: "${modalTitle}"`)

    const userPin = page.locator('.man-map-user-pin')
    const hasUserPin = await userPin.isVisible()
    console.log(`Ghim vị trí người dùng trên bản đồ: ${hasUserPin}`)

    const hotelPins = page.locator('.man-map-pin-group')
    const pinCount = await hotelPins.count()
    console.log(`Số lượng khách sạn ghim trên bản đồ: ${pinCount}`)
    if (pinCount < 8) throw new Error(`Số lượng pin khách sạn không đủ: ${pinCount}`)

    const dockTitle = await page.locator('.man-dock-title').innerText()
    console.log(`Khách sạn xem trước dưới đáy bản đồ: "${dockTitle}"`)

    await page.screenshot({ path: 'uat_screenshots/gps_map_modal_open.png' })
    console.log('Đã lưu ảnh bằng chứng: uat_screenshots/gps_map_modal_open.png')

    // Đóng Modal
    await page.locator('.man-map-close-btn').click()
    await page.waitForTimeout(500)
    const isMapClosed = !(await mapModal.isVisible())
    console.log(`Đóng modal thành công: ${isMapClosed}`)

    console.log('>>> TEST TÍNH NĂNG ĐỊNH VỊ VỊ TRÍ TRỰC TIẾP HOÀN TOÀN THÀNH CÔNG (100% PASS)! <<<')
  } finally {
    await browser.close()
  }
}

run().catch((err) => {
  console.error('LỖI TEST:', err)
  process.exit(1)
})
