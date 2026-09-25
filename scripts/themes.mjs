/**
 * Captures the main screens in both themes for visual review.
 * Usage: node scripts/themes.mjs [base-url]
 */
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'

const require = createRequire(new URL('../frontend/package.json', import.meta.url))
const { chromium } = require('playwright')

const BASE = process.argv[2] ?? 'http://127.0.0.1:8099'
const OUT = '.screenshots'
await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const errors = []

async function capture(theme) {
  const context = await browser.newContext({
    viewport: { width: 1500, height: 940 },
    deviceScaleFactor: 2,
    colorScheme: theme,
  })
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(`${theme}: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && errors.push(`${theme}: ${m.text()}`))

  // Seed the theme choice so the app's own toggle state matches the capture.
  await page.addInitScript((value) => {
    try {
      localStorage.setItem('taskflow-theme', value)
    } catch {}
  }, theme)

  // Pick a project that actually has tasks, otherwise the board renders empty.
  const projects = await (await page.request.get(`${BASE}/api/projects`)).json()
  const richest = [...projects].sort((a, b) => b.task_count - a.task_count)[0]
  const boardUrl = richest ? `/?project=${richest.id}` : '/'

  const shoot = async (name, url, prepare) => {
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)
    if (prepare) await prepare(page)
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${OUT}/${name}.png` })
    console.log(`  ${OUT}/${name}.png`)
  }

  await shoot(`60-${theme}-board`, boardUrl)
  await shoot(`61-${theme}-tasks`, '/tasks')
  await shoot(`62-${theme}-calendar`, '/calendar')

  await shoot(`63-${theme}-drawer`, boardUrl, async (p) => {
    await p.locator('section').filter({ has: p.locator('h2', { hasText: 'Ongoing' }) }).locator('button.w-full').first().click()
    await p.getByRole('heading', { name: 'Days worked' }).waitFor({ timeout: 10000 })
  })

  await shoot(`64-${theme}-locked`, boardUrl, async (p) => {
    await p.locator('section').filter({ has: p.locator('h2', { hasText: 'Done' }) }).locator('button.w-full').first().click()
    await p.getByText('Finished and locked').waitFor({ timeout: 10000 })
  })

  await context.close()
}

console.log('light')
await capture('light')
console.log('dark')
await capture('dark')

await browser.close()
console.log(errors.length ? `\n${errors.length} console error(s):\n  ${[...new Set(errors)].join('\n  ')}` : '\nno console errors')
