/**
 * Records a short walkthrough of the app as a WebM video, which is then turned
 * into an animated GIF (see scripts/record.sh). Also drops a handful of stills
 * into docs/ for the README.
 * Usage: node scripts/record.mjs [base-url] [outDir]
 */
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'

const require = createRequire(new URL('../frontend/package.json', import.meta.url))
const { chromium } = require('playwright')

const BASE = process.argv[2] ?? 'http://127.0.0.1:8099'
const OUT = process.argv[3] ?? 'docs'
await mkdir(OUT, { recursive: true })
await mkdir('.recordings', { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: '.recordings', size: { width: 1280, height: 800 } },
})
const page = await context.newPage()

// Light theme reads better in a compressed GIF.
await page.addInitScript(() => {
  try {
    localStorage.setItem('taskflow-theme', 'light')
  } catch {}
})

const settle = (ms = 900) => page.waitForTimeout(ms)
const shot = async (name) => {
  await settle(700)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log(`  still: ${OUT}/${name}.png`)
}
const section = async (name) => {
  await settle(1100)
  await shot(name)
}

const projects = await (await page.request.get(`${BASE}/api/projects`)).json()
const board = [...projects].sort((a, b) => b.task_count - a.task_count)[0]
if (!board) throw new Error('no projects to record; run scripts/seed.sh first')

const column = (name) => page.locator('section').filter({ has: page.locator('h2', { hasText: name }) }).first()
const cardIn = (queue) => column(queue).locator('button.w-full').first()

console.log('recording…')

// 1. The board
await page.goto(`${BASE}/?project=${board.id}`, { waitUntil: 'networkidle' })
await page.locator('h2', { hasText: 'To do' }).waitFor({ timeout: 15000 })
await section('board')

// 2. Drag a task from To do into Ongoing
const source = await cardIn('To do').boundingBox()
const ongoing = await column('Ongoing').boundingBox()
await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
await page.mouse.down()
for (let i = 1; i <= 14; i++) {
  await page.mouse.move(
    source.x + source.width / 2 + ((ongoing.x + ongoing.width / 2 - source.x - source.width / 2) * i) / 14,
    source.y + source.height / 2 + ((ongoing.y + 120 - source.y - source.height / 2) * i) / 14,
  )
  await page.waitForTimeout(25)
}
await page.mouse.up()
await section('board-after-drag')

// 3. The task drawer, and logging a day of work
await cardIn('Ongoing').click()
await page.getByRole('heading', { name: 'Days worked' }).waitFor({ timeout: 10000 })
await section('task-drawer')
await page.getByRole('button', { name: 'Today', exact: true }).click()
await page.getByRole('heading', { name: 'Days worked' }).scrollIntoViewIfNeeded()
await section('task-workdays')
await page.keyboard.press('Escape')
await settle(600)

// 4. The calendar
await page.goto(`${BASE}/calendar`, { waitUntil: 'networkidle' })
await page.getByRole('heading', { name: 'Calendar', exact: true }).waitFor({ timeout: 15000 })
await section('calendar-logged')

await page.getByRole('tab', { name: 'Due' }).click()
await section('calendar-due')

const day = page.locator('button[aria-pressed]').filter({ has: page.locator('span.rounded-full') }).first()
if (await day.count()) {
  await day.click()
  await settle(800)
  await shot('calendar-day-drawer')
  await page.keyboard.press('Escape')
}
await settle(500)

// 5. The task list
await page.goto(`${BASE}/tasks`, { waitUntil: 'networkidle' })
await page.locator('table').waitFor({ timeout: 15000 })
await section('task-list')

// 6. The export dialog
await page.goto(`${BASE}/?project=${board.id}`, { waitUntil: 'networkidle' })
await page.locator('h2', { hasText: 'To do' }).waitFor({ timeout: 15000 })
await page.getByRole('button', { name: 'Export' }).click()
await page.getByRole('dialog').waitFor({ timeout: 10000 })
await section('export')
await page.keyboard.press('Escape')

// 7. Dark mode
await page.goto(`${BASE}/?project=${board.id}`, { waitUntil: 'networkidle' })
await page.locator('h2', { hasText: 'To do' }).waitFor({ timeout: 15000 })
await page.getByRole('button', { name: 'Use the dark theme' }).click()
await section('board-dark')
await page.goto(`${BASE}/calendar`, { waitUntil: 'networkidle' })
await section('calendar-dark')

await context.close()
await browser.close()
console.log('done; video is in .recordings/')
