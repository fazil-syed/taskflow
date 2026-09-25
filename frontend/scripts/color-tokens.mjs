/**
 * One-off codemod: rewrites hard-coded slate utilities to the semantic color
 * tokens defined in index.css, so the light and dark palettes are each defined
 * in exactly one place.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { join, extname } from 'node:path'

const LIGHT = {
  'bg-white': 'surface',
  'bg-slate-50': 'canvas',
  'bg-slate-100': 'elevated',
  'bg-slate-200': 'strong',
  'bg-slate-300': 'strong',
  'bg-slate-400': 'line-strong',
  'border-slate-100': 'line',
  'border-slate-200': 'line',
  'border-slate-300': 'line-strong',
  'border-slate-400': 'line-strong',
  'border-slate-800': 'line-strong',
  'ring-slate-200': 'line',
  'ring-slate-300': 'line-strong',
  'ring-slate-400': 'line-strong',
  'ring-slate-900': 'ink',
  'text-slate-300': 'ink-faint',
  'text-slate-400': 'ink-faint',
  'text-slate-500': 'ink-faint',
  'text-slate-600': 'ink-soft',
  'text-slate-700': 'ink-soft',
  'text-slate-800': 'ink',
  'text-slate-900': 'ink',
  'text-slate-100': 'ink',
}

const DARK = {
  'bg-slate-950': 'canvas',
  'bg-slate-900': 'surface',
  'bg-slate-800': 'elevated',
  'bg-slate-700': 'strong',
  'bg-slate-600': 'strong',
  'border-slate-800': 'line',
  'border-slate-700': 'line-strong',
  'border-slate-600': 'line-strong',
  'ring-slate-700': 'line-strong',
  'ring-slate-600': 'line-strong',
  'ring-slate-100': 'white',
  'text-slate-50': 'ink',
  'text-slate-100': 'ink',
  'text-slate-200': 'ink',
  'text-slate-300': 'ink-soft',
  'text-slate-400': 'ink-soft',
  'text-slate-600': 'ink-faint',
  'text-slate-700': 'ink-faint',
  'text-slate-950': 'white',
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else if (['.ts', '.tsx', '.css'].includes(extname(entry.name))) yield path
  }
}

const unmapped = new Map()
let changedFiles = 0
let changedTokens = 0

// Matches an optional chain of variant prefixes, the property, and the shade.
const PATTERN = /((?:[a-z-]+:)*)(bg|border|ring|text|divide|from|to|via|outline|decoration|accent|caret)-slate-(\d{2,3})(\/\d+)?/g

for await (const file of walk('src')) {
  const before = await readFile(file, 'utf8')
  const after = before.replace(PATTERN, (match, prefixes, prop, shade, alpha = '') => {
    const isDark = prefixes.includes('dark:')
    const table = isDark ? DARK : LIGHT
    const key = `${prop}-slate-${shade}`
    const token = table[key]
    if (!token) {
      unmapped.set(`${isDark ? 'dark:' : ''}${key}`, (unmapped.get(`${isDark ? 'dark:' : ''}${key}`) ?? 0) + 1)
      return match
    }
    changedTokens++
    return `${prefixes}${prop}-${token}${alpha}`
  })

  if (after !== before) {
    await writeFile(file, after)
    changedFiles++
  }
}

console.log(`rewrote ${changedTokens} utilities across ${changedFiles} files`)
if (unmapped.size > 0) {
  console.log('left alone (no token defined):')
  for (const [key, count] of [...unmapped].sort((a, b) => b[1] - a[1])) console.log(`  ${key} x${count}`)
}
