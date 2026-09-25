/**
 * Drag-and-drop verification. Every drag grabs the card in the middle of its
 * body, never a handle, and asserts the resulting queue order.
 * Usage: node scripts/drag.mjs [base-url]
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
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })

const DEBUG = process.env.DEBUG_DRAG === '1'
if (DEBUG) {
  page.on('request', (r) => {
    if (r.url().includes('/move')) console.log(`    -> ${r.method()} ${r.postData()}`)
  })
  page.on('response', async (r) => {
    if (r.url().includes('/move')) console.log(`    <- ${r.status()} ${(await r.text().catch(() => '')).slice(0, 120)}`)
  })
}
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => {
  if (m.text().startsWith('[dbg]')) {
    if (DEBUG) console.log(`    ${m.text()}`)
    return
  }
  if (m.type() === 'error') errors.push(m.text())
})

const column = (name) => page.locator('section').filter({ has: page.locator('h2', { hasText: name }) }).first()
const cardsIn = (name) => column(name).locator('button.w-full')
const titlesIn = async (name) =>
  (await cardsIn(name).allInnerTexts()).map((t) => t.split('\n')[0].trim()).filter(Boolean)

/** Presses in the middle of the card and drags to a point, in small steps. */
async function dragTo(card, x, y) {
  const box = await card.boundingBox()
  const sx = box.x + box.width / 2
  const sy = box.y + box.height / 2
  if (DEBUG) {
    const info = await page.evaluate(
      ([px, py]) => {
        const el = document.elementFromPoint(px, py)
        if (!el) return 'nothing'
        const parts = []
        let node = el
        for (let i = 0; i < 4 && node; i++) {
          parts.push(`${node.tagName.toLowerCase()}${node.className ? '.' + String(node.className).split(' ').slice(0, 3).join('.') : ''}`)
          node = node.parentElement
        }
        return parts.join(' < ')
      },
      [sx, sy],
    )
    console.log(`    press at (${Math.round(sx)},${Math.round(sy)}) over: ${info}`)
  }
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  for (let i = 1; i <= 15; i++) {
    await page.mouse.move(sx + ((x - sx) * i) / 15, sy + ((y - sy) * i) / 15)
    await page.waitForTimeout(18)
  }
  await page.waitForTimeout(200)
  await page.mouse.up()
  await page.waitForTimeout(1000)
}

const dropOnCard = async (queue, index) => {
  const card = cardsIn(queue).nth(index)
  const box = await card.boundingBox()
  await dragTo(card, box.x + box.width / 2, box.y + box.height / 2)
}

const dropAtEndOf = async (queue) => {
  const col = column(queue)
  const box = await col.boundingBox()
  await dragTo(cardsIn(queue).first(), box.x + box.width / 2, box.y + box.height - 30)
}

// Fresh project with four known cards.
const existing = await (await page.request.get(`${BASE}/api/projects`)).json()
for (const p of existing) await page.request.delete(`${BASE}/api/projects/${p.id}`)
const project = await (await page.request.post(`${BASE}/api/projects`, { data: { name: 'Drag test', color: '#6366f1' } })).json()
for (const title of ['One', 'Two', 'Three', 'Four']) {
  await page.request.post(`${BASE}/api/projects/${project.id}/tasks`, { data: { title } })
}

await page.goto(`${BASE}/?project=${project.id}`, { waitUntil: 'networkidle' })
await page.locator('h2', { hasText: 'To do' }).waitFor({ timeout: 15000 })
await page.waitForTimeout(600)

console.log('\n[1] grab the card in the middle of its body, drop on the last card')
check('starts as One, Two, Three, Four', JSON.stringify(await titlesIn('To do')) === '["One","Two","Three","Four"]', JSON.stringify(await titlesIn('To do')))
await dropOnCard('To do', 3)
check('dropping on the last card moves the card last', JSON.stringify(await titlesIn('To do')) === '["Two","Three","Four","One"]', JSON.stringify(await titlesIn('To do')))
await page.screenshot({ path: '.screenshots/50-drag-to-end.png' })

console.log('\n[2] drag the last card to the top')
await dropAtEndOf('To do')
const last = cardsIn('To do').last()
const lastTitle = (await last.innerText()).split('\n')[0].trim()
const colBox = await column('To do').boundingBox()
// drop into the empty space just under the header, above the first card
await dragTo(last, colBox.x + colBox.width / 2, colBox.y + 70)
const reordered = await titlesIn('To do')
check('card lands at the top', reordered[0] === lastTitle, `expected ${lastTitle} first, got ${JSON.stringify(reordered)}`)
await page.screenshot({ path: '.screenshots/51-drag-to-top.png' })

console.log('\n[3] drop into the middle of the queue')
await dropOnCard('To do', 1)
const afterMiddle = await titlesIn('To do')
check('queue still holds every card exactly once', afterMiddle.length === 4 && new Set(afterMiddle).size === 4, JSON.stringify(afterMiddle))
await page.screenshot({ path: '.screenshots/52-drag-middle.png' })

console.log('\n[4] drag across columns, then back')
const ongoingBox = await column('Ongoing').boundingBox()
await dragTo(cardsIn('To do').first(), ongoingBox.x + ongoingBox.width / 2, ongoingBox.y + 90)
check('card left To do', (await titlesIn('To do')).length === 3, JSON.stringify(await titlesIn('To do')))
check('card arrived in Ongoing', (await titlesIn('Ongoing')).length === 1, JSON.stringify(await titlesIn('Ongoing')))
await page.screenshot({ path: '.screenshots/53-drag-cross.png' })

const todoBox = await column('To do').boundingBox()
await dragTo(cardsIn('Ongoing').first(), todoBox.x + todoBox.width / 2, todoBox.y + todoBox.height - 30)
check('card came back to To do', (await titlesIn('To do')).length === 4, JSON.stringify(await titlesIn('To do')))
check('Ongoing is empty again', (await titlesIn('Ongoing')).length === 0, JSON.stringify(await titlesIn('Ongoing')))

console.log('\n[5] the order survives a reload (it was persisted)')
await page.reload({ waitUntil: 'networkidle' })
await page.locator('h2', { hasText: 'To do' }).waitFor({ timeout: 15000 })
await page.waitForTimeout(600)
const afterReload = await titlesIn('To do')
check('reload shows the same order', JSON.stringify(afterReload) === JSON.stringify(await titlesIn('To do')), '')
check('all four cards still present', afterReload.length === 4, JSON.stringify(afterReload))
const server = await (await page.request.get(`${BASE}/api/projects/${project.id}/board`)).json()
const serverOrder = server.columns.find((c) => c.status === 'todo').tasks.map((t) => t.title)
check('server order matches the board', JSON.stringify(serverOrder) === JSON.stringify(afterReload), `${JSON.stringify(serverOrder)} vs ${JSON.stringify(afterReload)}`)

await browser.close()
console.log('')
if (errors.length) {
  console.log(`${errors.length} console error(s):`)
  for (const e of [...new Set(errors)]) console.log(`  - ${e}`)
  failures++
}
console.log(failures === 0 ? '\x1b[32mall drag checks passed\x1b[0m' : `\x1b[31m${failures} failure(s)\x1b[0m`)
process.exitCode = failures === 0 ? 0 : 1
