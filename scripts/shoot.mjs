/**
 * Renders the real UI in Chromium and writes screenshots to .screenshots/.
 * Usage: node scripts/shoot.mjs [base-url]
 */
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'

// Playwright is a dev dependency of the frontend, so resolve it from there.
const require = createRequire(new URL('../frontend/package.json', import.meta.url))
const { chromium } = require('playwright')

const BASE = process.argv[2] ?? 'http://127.0.0.1:8099'
const OUT = '.screenshots'
await mkdir(OUT, { recursive: true })

// Use the locally installed Chrome so no browser download is needed.
const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const page = await context.newPage()

const problems = []
page.on('console', (msg) => {
  if (msg.type() === 'error') problems.push(`console: ${msg.text()}`)
})
page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
page.on('requestfailed', (req) => problems.push(`requestfailed: ${req.url()} ${req.failure()?.errorText}`))

const shot = async (name) => {
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log(`  wrote ${OUT}/${name}.png`)
}

console.log('board')
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.locator('h2', { hasText: 'To do' }).waitFor({ timeout: 15000 })
await shot('01-board')

console.log('board with a priority filter')
await page.selectOption('select[aria-label="Filter by priority"]', 'urgent')
await page.waitForTimeout(800)
await shot('02-board-filtered')

console.log('clearing filters')
await page.selectOption('select[aria-label="Filter by priority"]', '')
await page.waitForTimeout(600)

console.log('task panel')
await page.getByRole('button', { name: /^Build the pricing page/ }).first().click()
await page.getByRole('heading', { name: 'Days worked' }).waitFor({ timeout: 15000 })
await shot('03-task-panel')

console.log('task panel scrolled to the calendar')
await page.getByRole('heading', { name: 'Days worked' }).scrollIntoViewIfNeeded()
await shot('04-task-panel-workdays')

console.log('closing the panel')
await page.keyboard.press('Escape')
await page.waitForTimeout(400)

console.log('task list')
await page.click('a[href="/tasks"]')
await page.waitForSelector('table', { timeout: 10000 })
await shot('05-task-list')

console.log('task list with a selection')
await page.click('input[aria-label="Select all tasks"]')
await page.waitForTimeout(400)
await shot('06-task-list-bulk')

console.log('calendar')
await page.click('a[href="/calendar"]')
await page.getByRole('heading', { name: 'Calendar', exact: true }).waitFor({ timeout: 15000 })
await shot('07-calendar')

console.log('calendar day drawer')
const day = page.locator('button[aria-pressed]').filter({ has: page.locator('span.rounded-full') }).first()
await day.click()
await page.waitForTimeout(700)
await shot('08-calendar-day')

console.log('dark mode')
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
await page.click('button[aria-label*="dark theme"]')
await page.waitForTimeout(500)
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await shot('09-board-dark')

await page.goto(`${BASE}/calendar`, { waitUntil: 'networkidle' })
await shot('10-calendar-dark')

console.log('narrow viewport')
const mobile = await context.newPage()
await mobile.setViewportSize({ width: 430, height: 860 })
await mobile.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await mobile.waitForTimeout(900)
await mobile.screenshot({ path: `${OUT}/11-board-narrow.png` })
console.log(`  wrote ${OUT}/11-board-narrow.png`)

await browser.close()

console.log('')
if (problems.length === 0) {
  console.log('no console errors, page errors, or failed requests')
} else {
  console.log(`${problems.length} problem(s):`)
  for (const p of [...new Set(problems)]) console.log(`  - ${p}`)
  process.exitCode = 1
}
