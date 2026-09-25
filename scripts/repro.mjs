/**
 * Reproduces the reported interactions and prints the exact HTTP traffic.
 * Usage: node scripts/repro.mjs [base-url]
 */
import { createRequire } from 'node:module'

const require = createRequire(new URL('../frontend/package.json', import.meta.url))
const { chromium } = require('playwright')

const BASE = process.argv[2] ?? 'http://127.0.0.1:8099'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

page.on('request', (r) => {
  if (r.url().includes('/api/tasks')) console.log(`  -> ${r.method()} ${r.url().replace(BASE, '')} ${r.postData() ?? ''}`)
})
page.on('response', async (r) => {
  if (r.url().includes('/api/tasks')) {
    const text = await r.text().catch(() => '')
    console.log(`  <- ${r.status()} ${r.url().replace(BASE, '')} ${text.slice(0, 160)}`)
  }
})

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.locator('h2', { hasText: 'To do' }).waitFor({ timeout: 15000 })

console.log('\n[1] open an ongoing task so the work-day picker is available')
const ongoing = page.locator('section', { has: page.locator('h2', { hasText: 'Ongoing' }) }).locator('button.w-full').first()
await ongoing.click()
await page.getByRole('heading', { name: 'Days worked' }).waitFor({ timeout: 10000 })
console.log('  panel title:', await page.getByLabel('Title').inputValue())

console.log('\n[2] click the "Today" quick button twice (add, then remove)')
await page.getByRole('button', { name: 'Today', exact: true }).click()
await page.waitForTimeout(900)
await page.getByRole('button', { name: 'Today', exact: true }).click()
await page.waitForTimeout(900)

console.log('\n[3] click a day in the month grid')
const grid = page.locator('[role="dialog"] .grid.grid-cols-7').last()
const cells = grid.locator('button:not([disabled])')
const count = await cells.count()
console.log(`  ${count} day cells`)
await cells.nth(Math.max(0, count - 3)).click()
await page.waitForTimeout(900)
await cells.nth(Math.max(0, count - 3)).click()
await page.waitForTimeout(900)

console.log('\n[4] change the queue from Ongoing to Done, then back')
await page.getByRole('button', { name: 'Ongoing', exact: true }).click()
await page.waitForTimeout(1200)
console.log('  status pill now:', await page.locator('[role="dialog"] >> text=/To do|Ongoing|Done/').first().innerText().catch(() => 'n/a'))
console.log('  days worked header:', await page.getByText(/total$/).first().innerText().catch(() => 'n/a'))

await page.screenshot({ path: '.screenshots/30-repro.png' })
await browser.close()
