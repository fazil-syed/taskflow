/**
 * Turns the recorded WebM into a small animated GIF.
 *
 * The ffmpeg build that ships with Playwright cannot encode GIF, so it only
 * extracts PNG frames; the frames are then quantised and assembled here with
 * gifenc. Frames are sampled down and palette-reduced to keep the file small
 * enough to live in the repository.
 *
 * Usage: node scripts/make-gif.mjs <webm> <out.gif> [fps] [width] [colors]
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const require = createRequire(new URL('../frontend/package.json', import.meta.url))
const { GIFEncoder, quantize, applyPalette } = require('gifenc')

const [webm, out, fpsArg, widthArg, colorsArg] = process.argv.slice(2)
if (!webm || !out) {
  console.error('usage: node make-gif.mjs <in.webm> <out.gif> [fps] [width] [colors]')
  process.exit(1)
}
const fps = Number(fpsArg ?? 10)
const width = Number(widthArg ?? 760)
const colors = Number(colorsArg ?? 96)

const framesDir = join(tmpdir(), 'taskflow-gif-frames')
rmSync(framesDir, { recursive: true, force: true })
mkdirSync(framesDir, { recursive: true })

// Playwright's ffmpeg has no GIF encoder but does have PNG.
const ffmpeg = execFileSync('sh', ['-c', 'ls ~/Library/Caches/ms-playwright/ffmpeg-*/ffmpeg-mac | head -1'], {
  encoding: 'utf8',
}).trim()

// This ffmpeg build has no `fps` filter, so the frame rate is set as an output
// option and the width with the `scale` filter.
console.log(`extracting frames at ${fps}fps, ${width}px wide…`)
execFileSync(
  ffmpeg,
  ['-hide_banner', '-loglevel', 'error', '-i', webm, '-vf', `scale=${width}:-1`, '-r', String(fps), join(framesDir, 'f%04d.png')],
  { stdio: 'inherit' },
)

const files = readdirSync(framesDir).filter((f) => f.endsWith('.png')).sort()
if (files.length === 0) throw new Error('no frames were extracted')

console.log(`encoding ${files.length} frames with ${colors} colours…`)
const encoder = GIFEncoder()
// Frames arrive as PNG bytes; gifenc wants raw RGBA, so decode via the palette
// step on the same buffer by asking it to read the PNG dimensions first.
const frames = []
for (const file of files) {
  const png = readFileSync(join(framesDir, file))
  const rgba = decodePng(png)
  const palette = quantize(rgba.data, colors)
  const index = applyPalette(rgba.data, palette)
  frames.push({ index, palette, width: rgba.width, height: rgba.height })
}

// The encoder writes the signature and the logical screen descriptor itself on
// the first frame; calling writeHeader() by hand suppresses that initialisation.
const { width: w, height: h } = frames[0]
for (let i = 0; i < frames.length; i++) {
  const frame = frames[i]
  encoder.writeFrame(frame.index, w, h, {
    palette: frame.palette,
    delay: Math.round(1000 / fps),
    // Every frame is a full snapshot, so disposal 1 keeps it simple and robust.
    dispose: 1,
  })
  if (i % 20 === 0) console.log(`  ${i}/${frames.length}`)
}
encoder.finish()
writeFileSync(out, Buffer.from(encoder.bytesView()))
rmSync(framesDir, { recursive: true, force: true })
console.log(`wrote ${out}`)

/** Minimal PNG decoder: enough for non-interlaced 8-bit RGBA/RGB images. */
function decodePng(buffer) {
  const { inflateSync } = require('node:zlib')

  let offset = 8 // skip the signature
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  const idat = []

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`)
      if (data[12] !== 0) throw new Error('interlaced PNGs are not supported')
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    offset += length + 12
  }

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0
  if (channels === 0) throw new Error(`unsupported colour type ${colorType}`)

  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const out = Buffer.alloc(width * height * 4)

  // Undo the per-scanline filters.
  let prev = Buffer.alloc(stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride)
    const cur = Buffer.alloc(stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0
      const b = prev[x]
      const c = x >= channels ? prev[x - channels] : 0
      let value = line[x]
      switch (filter) {
        case 1:
          value = (value + a) & 0xff
          break
        case 2:
          value = (value + b) & 0xff
          break
        case 3:
          value = (value + ((a + b) >> 1)) & 0xff
          break
        case 4: {
          const p = a + b - c
          const pa = Math.abs(p - a)
          const pb = Math.abs(p - b)
          const pc = Math.abs(p - c)
          const predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
          value = (value + predictor) & 0xff
          break
        }
        default:
          break
      }
      cur[x] = value
    }
    for (let x = 0; x < width; x++) {
      const src = x * channels
      const dst = (y * width + x) * 4
      if (channels === 4) {
        out[dst] = cur[src]
        out[dst + 1] = cur[src + 1]
        out[dst + 2] = cur[src + 2]
        out[dst + 3] = cur[src + 3]
      } else {
        out[dst] = cur[src]
        out[dst + 1] = cur[src + 1]
        out[dst + 2] = cur[src + 2]
        out[dst + 3] = 255
      }
    }
    prev = cur
  }

  return { data: out, width, height }
}
