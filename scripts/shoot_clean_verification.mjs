import { chromium } from 'playwright'
import { createSession } from '../server/db.js'

async function verifyCleanUi() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })

  const token = createSession(23).token
  await context.addCookies([
    {
      name: 'may_an_nhien_sid',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])

  const page = await context.newPage()

  // 1. Check AiPlannerPage
  await page.goto('http://localhost:5175/#/ai-planner', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await page.screenshot({
    path: 'C:/Users/ADMIN/.gemini/antigravity/brain/423f2365-c9d8-40c1-bfeb-e5547d0955c1/ai_planner_clean_verified.png',
  })
  console.log('Saved ai_planner_clean_verified.png')

  // 2. Check Profile page & Deposit Modal
  await page.goto('http://localhost:5175/#/profile', { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    localStorage.setItem(
      'may-an-nhien-session',
      JSON.stringify({
        id: 23,
        email: '77huanle@gmail.com',
        name: 'Mỹ Nữ',
        role: 'customer',
        at: Date.now(),
      })
    )
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  // Find and click Nạp tiền button
  const depositBtn = await page.locator('.wallet-deposit-cta-btn').first()
  if (await depositBtn.isVisible()) {
    await depositBtn.click()
    await page.waitForTimeout(1000)
    // Select amount 100k to show QR
    const amountChip = await page.locator('.amount-preset-chip').first()
    if (await amountChip.isVisible()) {
      await amountChip.click()
      await page.waitForTimeout(1000)
    }
    const modal = await page.locator('.deposit-modal-content, .deposit-modal-wrap').first()
    if (await modal.isVisible()) {
      await modal.screenshot({
        path: 'C:/Users/ADMIN/.gemini/antigravity/brain/423f2365-c9d8-40c1-bfeb-e5547d0955c1/deposit_modal_clean_verified.png',
      })
      console.log('Saved deposit_modal_clean_verified.png')
    }
  }

  await browser.close()
  console.log('Complete!')
  process.exit(0)
}

verifyCleanUi().catch((e) => {
  console.error(e)
  process.exit(1)
})
