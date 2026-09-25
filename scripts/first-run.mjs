/**
 * First-run walkthrough against an empty database: the flow that only appears
 * before any project exists. Fails loudly if any step cannot be completed.
 * Usage: node scripts/first-run.mjs [base-url]
 */
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'

const require = createRequire(new URL('../frontend/package.json', import.meta.url))
const { chromium } = require('playwright')

const BASE = process.argv[2] ?? 'http://127.0.0.1:8099'
const OUT = '.screenshots'
await mkdir(OUT, { recursive: true })

const problems = []
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`))
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))

const step = (name) => console.log(`  ${name}`)

/** Waits for the board heading, so we never read a stale project name. */
const waitForHeading = (text) =>
  page.locator('h1', { hasText: text }).first().waitFor({ timeout: 15000 })
const shot = async (n) => {
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/${n}.png` })
  console.log(`    wrote ${OUT}/${n}.png`)
}

step('load an empty instance')
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.getByRole('heading', { name: 'Create your first project' }).waitFor({ timeout: 15000 })
await shot('20-first-run')

step('click "New project"')
await page.getByRole('button', { name: 'New project' }).first().click()
await page.getByRole('dialog').waitFor({ timeout: 10000 })
await page.getByLabel('Name').fill('First project')
await page.getByLabel('Description').fill('Created from the empty state.')
await shot('21-new-project-dialog')

step('submit and land on a working board')
await page.getByRole('button', { name: 'Create project' }).click()
await waitForHeading('First project')
await shot('22-board-after-create')

step('add a task through the board')
await page.getByRole('button', { name: 'New task' }).click()
await page.getByPlaceholder('Task title').fill('First task')
await page.getByRole('button', { name: 'Add task' }).click()
await page.getByRole('button', { name: /^First task/ }).first().waitFor({ timeout: 15000 })
await page.locator('h2', { hasText: 'To do' }).waitFor({ timeout: 15000 })
await shot('23-first-task')

step('create a second project from the rail')
await page.getByRole('button', { name: 'New project' }).first().click()
await page.getByLabel('Name').fill('Second project')
await page.getByRole('button', { name: 'Create project' }).click()
// Creating a project from the rail should select it.
await waitForHeading('Second project')
if (!page.url().includes('project=2')) throw new Error(`expected ?project=2 in the url, got ${page.url()}`)

step('the task list is reachable and not empty')
await page.click('a[href="/tasks"]')
await page.getByRole('cell', { name: /^First task/ }).waitFor({ timeout: 15000 })
await shot('24-first-run-task-list')

step('the calendar is reachable')
await page.click('a[href="/calendar"]')
await page.getByRole('heading', { name: 'Calendar', exact: true }).waitFor({ timeout: 15000 })
await shot('25-first-run-calendar')

await browser.close()

console.log('')
if (problems.length === 0) {
  console.log('first run completed with no console errors')
} else {
  console.log(`${problems.length} problem(s):`)
  for (const p of [...new Set(problems)]) console.log(`  - ${p}`)
  process.exitCode = 1
}
