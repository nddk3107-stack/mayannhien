import { chromium } from 'playwright'

async function inviteCollab() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
  const context = browser.contexts()[0]
  const pages = context.pages()
  const ghPage = pages.find((p) => p.url().includes('settings/access'))

  if (!ghPage) {
    console.error('Không tìm thấy tab settings/access trên Cốc Cốc')
    process.exit(1)
  }

  const addBtn = ghPage.getByRole('button', { name: 'Add people' })
  await addBtn.click()
  await ghPage.waitForTimeout(1000)

  const searchInput = ghPage.locator('input[role="combobox"], input[type="text"]').last()
  await searchInput.fill('77huanle-eng')
  await ghPage.waitForTimeout(2000)

  // Click kết quả gợi ý
  const userResult = ghPage.locator('#autocomplete-results li, ul[role="listbox"] li, .autocomplete-item').first()
  if (await userResult.isVisible()) {
    await userResult.click()
    await ghPage.waitForTimeout(1000)
  }

  const confirmBtn = ghPage.getByRole('button', { name: /Add 77huanle-eng/i })
  if (await confirmBtn.isVisible()) {
    await confirmBtn.click()
    await ghPage.waitForTimeout(2500)
    console.log('Đã click Add 77huanle-eng!')
  }

  await ghPage.screenshot({
    path: 'C:/Users/ADMIN/.gemini/antigravity/brain/423f2365-c9d8-40c1-bfeb-e5547d0955c1/coccoc_github_invited.png',
  })
  console.log('Saved coccoc_github_invited.png')
  process.exit(0)
}

inviteCollab().catch((err) => {
  console.error(err)
  process.exit(1)
})
