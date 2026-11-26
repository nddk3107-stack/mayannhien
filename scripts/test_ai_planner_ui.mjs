import { chromium } from 'playwright'

async function testAiPlanner() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 1600 } })
  const page = await context.newPage()

  await page.goto('http://localhost:5175/#/ai-planner', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  // Click Lập lịch trình button
  const submitBtn = page.getByRole('button', { name: 'Lập lịch trình', exact: true })
  await submitBtn.click()
  console.log('Clicked Lập lịch trình...')

  // Wait for plan output container
  await page.waitForSelector('.ai-plan-container', { timeout: 10000 })
  await page.waitForTimeout(1000)

  await page.screenshot({
    path: 'C:/Users/ADMIN/.gemini/antigravity/brain/423f2365-c9d8-40c1-bfeb-e5547d0955c1/ai_planner_result_full.png',
    fullPage: true,
  })
  console.log('Saved ai_planner_result_full.png!')

  // Check One-Click Booking button
  const bookingBtn = page.getByRole('button', { name: 'Đặt trọn gói 1 chạm ngay' })
  if (await bookingBtn.isVisible()) {
    console.log('Nút Đặt trọn gói 1 chạm ngay hiển thị!')
    await bookingBtn.click()
    await page.waitForTimeout(1500)
    console.log('URL sau khi bấm đặt combo:', page.url())
    await page.screenshot({
      path: 'C:/Users/ADMIN/.gemini/antigravity/brain/423f2365-c9d8-40c1-bfeb-e5547d0955c1/ai_planner_to_checkout.png',
    })
    console.log('Saved ai_planner_to_checkout.png!')
  }

  await browser.close()
  process.exit(0)
}

testAiPlanner().catch((e) => {
  console.error(e)
  process.exit(1)
})
