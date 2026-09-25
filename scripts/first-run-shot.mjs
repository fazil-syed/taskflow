/**
 * Captures the first-run screen from a completely empty database, using a
 * throwaway instance so it never touches real data.
 * Usage: node scripts/first-run-shot.mjs
 */
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'

const require = createRequire(new URL('../frontend/package.json', import.meta.url))
const { chromium } = require('playwright')

const OUT = 'docs'
const PORT = 8097
const compose = ['compose', '-p', 'taskflow-shot', 'up', '-d', '--build']
const env = { ...process.env, APP_PORT: String(PORT), MYSQL_PORT: '3397' }

await mkdir(OUT, { recursive: true })
console.log('starting a throwaway instance…')
execFileSync('docker', compose, { env, stdio: 'inherit' })

// Wait for it to report healthy.
const deadline = Date.now() + 120_000
let ready = false
while (Date.now() < deadline) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/healthz`)
    if (res.ok) {
      ready = true
      break
    }
  } catch {
    // not up yet
  }
  await new Promise((r) => setTimeout(r, 2000))
}
if (!ready) throw new Error('the throwaway instance never became healthy')

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 })
await page.addInitScript(() => {
  try {
    localStorage.setItem('taskflow-theme', 'light')
  } catch {}
})

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' })
await page.getByRole('heading', { name: 'Create your first project' }).waitFor({ timeout: 20000 })
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/first-run.png` })
console.log(`wrote ${OUT}/first-run.png`)

await browser.close()
execFileSync('docker', ['compose', '-p', 'taskflow-shot', 'down', '-v'], { env, stdio: 'inherit' })
console.log('throwaway instance removed')
