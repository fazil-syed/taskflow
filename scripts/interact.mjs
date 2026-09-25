/**
 * Interaction tests for the things that were previously broken: dragging a card
 * anywhere on its surface, moving it between queues, and the task drawer
 * reflecting edits immediately.
 * Usage: node scripts/interact.mjs [base-url]
 */
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'

const require = createRequire(new URL('../frontend/package.json', import.meta.url))
const { chromium } = require('playwright')

const BASE = process.argv[2] ?? 'http://127.0.0.1:8099'
await mkdir('.screenshots', { recursive: true })

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '\x1b[32mok\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m'} ${label}${ok ? '' : ` — ${detail}`}`)
  if (!ok) failures++
}

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1600, height: 950 }, deviceScaleFactor: 1 })

const consoleErrors = []
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
page.on('pageerror', (e) => consoleErrors.push(e.message))

const column = (name) => page.locator('section').filter({ has: page.locator('h2', { hasText: name }) }).first()
const cardsIn = (name) => column(name).locator('button.w-full')
const titlesIn = async (name) =>
  (await cardsIn(name).allInnerTexts()).map((t) => t.split('\n')[0].trim()).filter(Boolean)

/** Drags a card by pressing in the middle of it, not on any handle. */
async function dragCard(card, target) {
  const box = await card.boundingBox()
  const to = await target.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  // Move in steps so the sensor sees a real drag rather than a jump.
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(
      box.x + box.width / 2 + ((to.x + to.width / 2 - box.x - box.width / 2) * i) / 12,
      box.y + box.height / 2 + ((to.y + to.height / 2 - box.y - box.height / 2) * i) / 12,
    )
    await page.waitForTimeout(20)
  }
  await page.waitForTimeout(150)
  await page.mouse.up()
  await page.waitForTimeout(900)
}

console.log(`\ninteractions against ${BASE}`)

// A dedicated project, so the test never touches anything else in the database.
const project = await (await page.request.post(`${BASE}/api/projects`, { data: { name: 'Drag test', color: '#6366f1' } })).json()
const projectId = project.id
const mk = async (title) =>
  (await page.request.post(`${BASE}/api/projects/${projectId}/tasks`, { data: { title } })).json()

const a = await mk('Alpha task')
const b = await mk('Beta task')
const c = await mk('Gamma task')
void b
void c

await page.goto(`${BASE}/?project=${projectId}`, { waitUntil: 'networkidle' })
await page.locator('h2', { hasText: 'To do' }).waitFor({ timeout: 15000 })
await page.waitForTimeout(500)

console.log('\n[1] drag a card by its body, not a handle')
const first = cardsIn('To do').first()
const firstTitle = (await first.innerText()).split('\n')[0].trim()
await dragCard(first, cardsIn('To do').nth(2))
const afterReorder = await titlesIn('To do')
check(
  'card moved to the end after a body drag',
  afterReorder[afterReorder.length - 1] === firstTitle,
  `expected "${firstTitle}" last, got ${JSON.stringify(afterReorder)}`,
)
await page.screenshot({ path: '.screenshots/40-after-reorder.png' })

console.log('\n[2] drag a card from To do into Ongoing')
const todoCard = cardsIn('To do').first()
const title = (await todoCard.innerText()).split('\n')[0].trim()
await dragCard(todoCard, column('Ongoing'))
check('target column now contains the card', (await titlesIn('Ongoing')).includes(title), `got ${JSON.stringify(await titlesIn('Ongoing'))}`)
check('source column no longer contains it', !(await titlesIn('To do')).includes(title))
await page.screenshot({ path: '.screenshots/41-after-cross-column.png' })

console.log('\n[3] the drawer reflects changes immediately')
await cardsIn('Ongoing').first().click()
await page.getByRole('heading', { name: 'Days worked' }).waitFor({ timeout: 10000 })
const panelTitleBefore = await page.getByLabel('Title').inputValue()
check('drawer shows the task', panelTitleBefore === title, `got "${panelTitleBefore}"`)

// Start the task, then confirm the panel updates without a manual refresh.
await page.getByRole('button', { name: 'Ongoing', exact: true }).click()
await page.waitForTimeout(1200)
const statusPill = await page.locator('[role="dialog"] span', { hasText: /^Ongoing$|^Done$|^To do$/ }).first().innerText()
check('queue control moved the task', statusPill === 'Ongoing', `status pill reads "${statusPill}"`)

const dayCountBefore = await page.getByText(/total$/).first().innerText()
await page.getByRole('button', { name: 'Today', exact: true }).click()
await page.waitForTimeout(1200)
const dayCountAfter = await page.getByText(/total$/).first().innerText()
check('logging a day updates the panel total', dayCountBefore !== dayCountAfter, `${dayCountBefore} -> ${dayCountAfter}`)

await page.getByRole('button', { name: 'Today', exact: true }).click()
await page.waitForTimeout(1200)
const dayCountToggled = await page.getByText(/total$/).first().innerText()
check('clicking the same day again removes it', dayCountToggled === dayCountBefore, `${dayCountAfter} -> ${dayCountToggled}`)
await page.screenshot({ path: '.screenshots/42-drawer-live.png' })

// Finish and lock; the panel must show the locked state straight away.
await page.getByRole('button', { name: 'Done', exact: true }).click()
await page.getByRole('button', { name: 'Finish and lock' }).click()
await page.waitForTimeout(1300)
const lockedBanner = await page.getByText('Finished and locked').first().isVisible().catch(() => false)
check('drawer shows the locked state immediately', lockedBanner)
check('title is read-only when locked', await page.getByLabel('Title').isDisabled())
await page.screenshot({ path: '.screenshots/43-drawer-locked.png' })

await page.keyboard.press('Escape')
await page.waitForTimeout(600)
check('board shows the task in Done', (await titlesIn('Done')).includes(title), `got ${JSON.stringify(await titlesIn('Done'))}`)

console.log('\n[4] the header logo links home')
await page.click('a[href="/calendar"]')
await page.waitForTimeout(700)
await page.click('a[aria-label="TaskFlow home"]')
await page.waitForTimeout(900)
check('logo navigates to the board', new URL(page.url()).pathname === '/', page.url())

// Clean up only what this run created.
await page.request.delete(`${BASE}/api/projects/${project.id}`).catch(() => {})

await browser.close()

console.log('')
if (consoleErrors.length) {
  console.log(`${consoleErrors.length} console error(s):`)
  for (const e of [...new Set(consoleErrors)]) console.log(`  - ${e}`)
  failures++
}
if (failures === 0) console.log('\x1b[32mall interactions passed\x1b[0m')
else console.log(`\x1b[31m${failures} failure(s)\x1b[0m`)
process.exitCode = failures === 0 ? 0 : 1
