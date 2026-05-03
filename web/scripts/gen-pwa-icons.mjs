/**
 * Генерация PNG-иконок PWA (только Node: fs, zlib, buffer).
 * Крест: гаечный ключ + ключ; подпись SMA; фон #111827.
 * Запуск: npm run gen:pwa-icons — или из prebuild при необходимости.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'icons')

const BG = { r: 0x11, g: 0x18, b: 0x27 }
const FG = { r: 0xff, g: 0xff, b: 0xff }

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

function distPointToSegmentSq(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) {
    const qx = px - x1
    const qy = py - y1
    return qx * qx + qy * qy
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const qx = x1 + t * dx
  const qy = y1 + t * dy
  const qpx = px - qx
  const qpy = py - qy
  return qpx * qpx + qpy * qpy
}

function setPixel(rgba, w, h, x, y, r, g, b) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  if (xi < 0 || xi >= w || yi < 0 || yi >= h) return
  const i = (yi * w + xi) * 4
  rgba[i] = r
  rgba[i + 1] = g
  rgba[i + 2] = b
  rgba[i + 3] = 255
}

/** Заливка выпуклого четырёхугольника (плоский ключ / рукоятка). */
function fillQuad(rgba, w, h, ax, ay, bx, by, cx, cy, dx, dy, r, g, b) {
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx, dx)))
  const maxX = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx, dx)))
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy, dy)))
  const maxY = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy, dy)))
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (pointInConvexQuad(x + 0.5, y + 0.5, ax, ay, bx, by, cx, cy, dx, dy)) setPixel(rgba, w, h, x, y, r, g, b)
    }
  }
}

function pointInConvexQuad(px, py, ax, ay, bx, by, cx, cy, dx, dy) {
  return (
    cross(ax, ay, bx, by, px, py) >= 0 &&
    cross(bx, by, cx, cy, px, py) >= 0 &&
    cross(cx, cy, dx, dy, px, py) >= 0 &&
    cross(dx, dy, ax, ay, px, py) >= 0
  )
}

function cross(ox, oy, ax, ay, px, py) {
  return (ax - ox) * (py - oy) - (ay - oy) * (px - ox)
}

function drawThickLine(rgba, w, h, x1, y1, x2, y2, thickness, r, g, b) {
  const half = thickness * 0.5
  const r2 = half * half
  const pad = Math.ceil(half) + 2
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - pad))
  const maxX = Math.min(w - 1, Math.ceil(Math.max(x1, x2) + pad))
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - pad))
  const maxY = Math.min(h - 1, Math.ceil(Math.max(y1, y2) + pad))
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (distPointToSegmentSq(x + 0.5, y + 0.5, x1, y1, x2, y2) <= r2) setPixel(rgba, w, h, x, y, r, g, b)
    }
  }
}

function fillCircle(rgba, w, h, cx, cy, rad, r, g, b) {
  const r2 = rad * rad
  const minX = Math.max(0, Math.floor(cx - rad - 1))
  const maxX = Math.min(w - 1, Math.ceil(cx + rad + 1))
  const minY = Math.max(0, Math.floor(cy - rad - 1))
  const maxY = Math.min(h - 1, Math.ceil(cy + rad + 1))
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      if (dx * dx + dy * dy <= r2) setPixel(rgba, w, h, x, y, r, g, b)
    }
  }
}

function fillRing(rgba, w, h, cx, cy, rOuter, rInner, r, g, b) {
  const ro2 = rOuter * rOuter
  const ri2 = rInner * rInner
  const minX = Math.max(0, Math.floor(cx - rOuter - 1))
  const maxX = Math.min(w - 1, Math.ceil(cx + rOuter + 1))
  const minY = Math.max(0, Math.floor(cy - rOuter - 1))
  const maxY = Math.min(h - 1, Math.ceil(cy + rOuter + 1))
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      const d2 = dx * dx + dy * dy
      if (d2 <= ro2 && d2 >= ri2) setPixel(rgba, w, h, x, y, r, g, b)
    }
  }
}

/** 5×7 псевдографика, '#' — пиксель. */
const LETTERS = {
  S: [' ## ', '#  #', '#   ', ' ## ', '   #', '#  #', ' ## '],
  M: ['#   #', '## ##', '# # #', '#   #', '#   #', '#   #', '#   #'],
  A: [' ## ', '#  #', '#  #', '####', '#  #', '#  #', '#  #'],
}

function drawLetter(rgba, w, h, letter, ox, oy, cell, r, g, b) {
  const rows = LETTERS[letter]
  if (!rows) return 0
  for (let row = 0; row < rows.length; row++) {
    const line = rows[row]
    for (let col = 0; col < line.length; col++) {
      if (line[col] !== '#') continue
      const x0 = ox + col * cell
      const y0 = oy + row * cell
      for (let dy = 0; dy < cell; dy++) {
        for (let dx = 0; dx < cell; dx++) {
          setPixel(rgba, w, h, x0 + dx, y0 + dy, r, g, b)
        }
      }
    }
  }
  return rows[0].length * cell
}

function drawSma(rgba, w, h, centerX, topY, cell, r, g, b) {
  const letters = ['S', 'M', 'A']
  const widths = letters.map((L) => LETTERS[L][0].length * cell)
  const gap = Math.max(2, Math.round(cell * 0.35))
  const total = widths.reduce((a, b) => a + b, 0) + gap * (letters.length - 1)
  let x = centerX - total * 0.5
  for (let i = 0; i < letters.length; i++) {
    drawLetter(rgba, w, h, letters[i], x, topY, cell, r, g, b)
    x += widths[i] + gap
  }
}

function renderIcon(size) {
  const w = size
  const h = size
  const rgba = Buffer.alloc(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = BG.r
    rgba[i * 4 + 1] = BG.g
    rgba[i * 4 + 2] = BG.b
    rgba[i * 4 + 3] = 255
  }

  const cx = size * 0.5
  const cy = size * 0.36
  const L = size * 0.34
  const tw = size * 0.055
  const tk = size * 0.042

  // Гаечный ключ: диагональ \ (снизу-слева → вверх-вправо)
  const wx1 = cx - L * 0.52
  const wy1 = cy + L * 0.48
  const wx2 = cx + L * 0.42
  const wy2 = cy - L * 0.42
  drawThickLine(rgba, w, h, wx1, wy1, wx2, wy2, tw, FG.r, FG.g, FG.b)

  // Рот гаечного ключа (шестигранник упрощённо — утолщение + вырез)
  const jx = wx2
  const jy = wy2
  const jaw = size * 0.09
  fillCircle(rgba, w, h, jx, jy, jaw * 0.55, FG.r, FG.g, FG.b)
  fillCircle(rgba, w, h, jx, jy, jaw * 0.28, BG.r, BG.g, BG.b)

  // Ключ: диагональ / + бородка кольца у нижнего-левого конца
  const kx1 = cx - L * 0.48
  const ky1 = cy - L * 0.46
  const kx2 = cx + L * 0.5
  const ky2 = cy + L * 0.44
  drawThickLine(rgba, w, h, kx1, ky1, kx2, ky2, tk, FG.r, FG.g, FG.b)

  const bowR = size * 0.07
  const bx = kx1 - tk * 0.35
  const by = ky1 + tk * 0.2
  fillRing(rgba, w, h, bx, by, bowR, bowR * 0.55, FG.r, FG.g, FG.b)
  fillCircle(rgba, w, h, bx + bowR * 0.35, by, bowR * 0.32, BG.r, BG.g, BG.b)

  // Зубцы ключа (короткий перпендикуляр к хвосту)
  const ux = (kx2 - kx1) / Math.hypot(kx2 - kx1, ky2 - ky1)
  const uy = (ky2 - ky1) / Math.hypot(kx2 - kx1, ky2 - ky1)
  const px = -uy
  const py = ux
  const bit = size * 0.06
  const tx = kx2 - ux * bit * 1.2
  const ty = ky2 - uy * bit * 1.2
  fillQuad(
    rgba,
    w,
    h,
    tx - px * bit * 0.9,
    ty - py * bit * 0.9,
    tx + px * bit * 0.9,
    ty + py * bit * 0.9,
    tx + px * bit * 0.9 + ux * bit * 1.1,
    ty + py * bit * 0.9 + uy * bit * 1.1,
    tx - px * bit * 0.9 + ux * bit * 1.1,
    ty - py * bit * 0.9 + uy * bit * 1.1,
    FG.r,
    FG.g,
    FG.b,
  )

  const cell = Math.max(2, Math.round(size * 0.034))
  const textTop = size * 0.68
  drawSma(rgba, w, h, cx, textTop, cell, FG.r, FG.g, FG.b)

  return rgba
}

function pngRgba(size, rgba) {
  const rowLen = 1 + size * 4
  const raw = Buffer.alloc(rowLen * size)
  let o = 0
  for (let y = 0; y < size; y++) {
    raw[o++] = 0
    for (let x = 0; x < size; x++) {
      const p = (y * size + x) * 4
      raw[o++] = rgba[p]
      raw[o++] = rgba[p + 1]
      raw[o++] = rgba[p + 2]
      raw[o++] = rgba[p + 3]
    }
  }
  const idat = deflateSync(raw, { level: 9 })
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

mkdirSync(outDir, { recursive: true })
for (const dim of [192, 512]) {
  const rgba = renderIcon(dim)
  writeFileSync(join(outDir, `icon-${dim}.png`), pngRgba(dim, rgba))
}
console.log('Wrote', join(outDir, 'icon-192.png'), join(outDir, 'icon-512.png'))
