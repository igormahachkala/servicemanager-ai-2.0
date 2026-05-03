/**
 * Генерация одноцветных PNG для PWA (только Node: fs, zlib, buffer).
 * Запуск: node scripts/gen-pwa-icons.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'icons')

function crc32(data) {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    c ^= data[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return (c ^ 0xffffffff) >>> 0
}

function u32be(n) {
  return Buffer.from([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff])
}

function chunk(tag, data) {
  const tagBuf = Buffer.from(tag, 'ascii')
  return Buffer.concat([u32be(data.length), tagBuf, data, u32be(crc32(Buffer.concat([tagBuf, data])))])
}

/** RGB8, filter type 0, без interlace */
function pngRgbSolid(size, r, g, b) {
  const rowLen = 1 + size * 3
  const raw = Buffer.alloc(rowLen * size)
  let o = 0
  for (let y = 0; y < size; y++) {
    raw[o++] = 0
    for (let x = 0; x < size; x++) {
      raw[o++] = r
      raw[o++] = g
      raw[o++] = b
    }
  }
  const idat = deflateSync(raw, { level: 9 })
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

mkdirSync(outDir, { recursive: true })
// theme_color #111827
const rgb = { r: 0x11, g: 0x18, b: 0x27 }
writeFileSync(join(outDir, 'icon-192.png'), pngRgbSolid(192, rgb.r, rgb.g, rgb.b))
writeFileSync(join(outDir, 'icon-512.png'), pngRgbSolid(512, rgb.r, rgb.g, rgb.b))
console.log('Wrote', join(outDir, 'icon-192.png'), join(outDir, 'icon-512.png'))
