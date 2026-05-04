/**
 * Генерация PNG-иконок PWA (только Node: fs, zlib, buffer).
 * Красная скруглённая «плитка» с 3D; белые перекрещенные отвёртка + ключ (читаемо с 192px, без текста).
 * Запуск: npm run gen:pwa-icons
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'icons')

const FG = { r: 0xff, g: 0xff, b: 0xff }

/** Красная палитра плитки (основной / тёмный край / блик). */
const RED = {
  core: { r: 0xdc, g: 0x26, b: 0x26 },
  deep: { r: 0x8b, g: 0x15, b: 0x18 },
  rim: { r: 0x6d, g: 0x0f, b: 0x12 },
  highlight: { r: 0xff, g: 0x8a, b: 0x8a },
}

const TILE_GEOM = { half: 0.44, cornerR: 0.13, outerSd: 0.02 }

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

/** SDF скруглённого прямоугольника (p относительно центра), bx/by — полуразмеры «острого» ящика. */
function sdRoundedBox(px, py, bx, by, cornerR) {
  const qx = Math.abs(px) - bx + cornerR
  const qy = Math.abs(py) - by + cornerR
  const ox = Math.max(qx, 0)
  const oy = Math.max(qy, 0)
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(ox, oy) - cornerR
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function lerpRgb(c0, c1, t) {
  return {
    r: Math.round(lerp(c0.r, c1.r, t)),
    g: Math.round(lerp(c0.g, c1.g, t)),
    b: Math.round(lerp(c0.b, c1.b, t)),
  }
}

/** Цвет плитки в точке (для «прорезей» в инструментах). */
function sampleAppTileRgb(size, x, y) {
  const cx = size * 0.5
  const cy = size * 0.5
  const half = size * TILE_GEOM.half
  const cornerR = size * TILE_GEOM.cornerR
  const bx = half
  const by = half
  const px = x - cx
  const py = y - cy
  const sd = sdRoundedBox(px, py, bx, by, cornerR)

  if (sd > size * TILE_GEOM.outerSd) {
    return { ...RED.rim }
  }

  const nx = x / size
  const ny = y / size
  const depth = nx * 0.22 + ny * 0.55
  let col = lerpRgb(RED.core, RED.deep, Math.min(1, depth))

  const edge = Math.max(0, -sd)
  const rimW = Math.max(1.2, size * 0.018)
  if (edge < rimW) {
    const k = 1 - edge / rimW
    col = lerpRgb(col, RED.rim, k * k * 0.85)
  }

  const hx = (x - cx) / (half * 1.05)
  const hy = (y - cy) / (half * 1.05)
  const gloss = Math.exp(-(hx * hx * 2.2 + Math.pow(hy + 0.35, 2) * 5.5) * 3.5)
  const gloss2 = Math.exp(-(Math.pow(hx - 0.15, 2) * 8 + Math.pow(hy + 0.55, 2) * 12) * 6)
  const spec = Math.min(1, gloss * 0.55 + gloss2 * 0.22)
  col = lerpRgb(col, RED.highlight, spec)

  const aa = Math.max(0, Math.min(1, 0.5 - sd * (size * 0.035)))
  if (sd > -aa && sd < 0) {
    const outT = (sd + aa) / aa
    col = lerpRgb(RED.rim, col, outT)
  }
  return col
}

/** Фон: скруглённый квадрат, градиент глубины, верхний блик, тёмный «ободок». */
function drawAppTileBackground(rgba, size) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const col = sampleAppTileRgb(size, x + 0.5, y + 0.5)
      const i = (y * size + x) * 4
      rgba[i] = col.r
      rgba[i + 1] = col.g
      rgba[i + 2] = col.b
      rgba[i + 3] = 255
    }
  }
}

/** Гаечный ключ (диагональ). */
function drawWrench(rgba, w, h, size, cx, cy, L) {
  const tw = size * 0.076
  const wx1 = cx - L * 0.5
  const wy1 = cy + L * 0.46
  const wx2 = cx + L * 0.44
  const wy2 = cy - L * 0.4
  drawThickLine(rgba, w, h, wx1, wy1, wx2, wy2, tw, FG.r, FG.g, FG.b)

  const jx = wx2
  const jy = wy2
  const jaw = size * 0.09
  fillCircle(rgba, w, h, jx, jy, jaw * 0.55, FG.r, FG.g, FG.b)
  const holeR = jaw * 0.3
  const holeCol = sampleAppTileRgb(size, jx, jy)
  fillCircle(rgba, w, h, jx, jy, holeR, holeCol.r, holeCol.g, holeCol.b)

  const bowR = size * 0.065
  const bx = wx1 + tw * 0.25
  const by = wy1 - tw * 0.15
  fillRing(rgba, w, h, bx, by, bowR, bowR * 0.52, FG.r, FG.g, FG.b)
  const inner = sampleAppTileRgb(size, bx + bowR * 0.32, by)
  fillCircle(rgba, w, h, bx + bowR * 0.32, by, bowR * 0.3, inner.r, inner.g, inner.b)
}

/** Отвёртка: рукоятка + стержень + плоский шлиц (пересекает ключ под другим углом). */
function drawScrewdriver(rgba, w, h, size, cx, cy, L) {
  const shaftW = size * 0.058
  const kx1 = cx - L * 0.42
  const ky1 = cy - L * 0.48
  const kx2 = cx + L * 0.48
  const ky2 = cy + L * 0.44
  drawThickLine(rgba, w, h, kx1, ky1, kx2, ky2, shaftW, FG.r, FG.g, FG.b)

  const ux = (kx2 - kx1) / Math.hypot(kx2 - kx1, ky2 - ky1)
  const uy = (ky2 - ky1) / Math.hypot(kx2 - kx1, ky2 - ky1)
  const px = -uy
  const py = ux

  const handleLen = L * 0.38
  const hx1 = kx1 - ux * handleLen * 0.15
  const hy1 = ky1 - uy * handleLen * 0.15
  const hx2 = kx1 - ux * handleLen * 1.05
  const hy2 = ky1 - uy * handleLen * 1.05
  drawThickLine(rgba, w, h, hx1, hy1, hx2, hy2, shaftW * 1.35, FG.r, FG.g, FG.b)

  const bit = size * 0.055
  const tx = kx2 - ux * bit * 0.9
  const ty = ky2 - uy * bit * 0.9
  fillQuad(
    rgba,
    w,
    h,
    tx - px * bit * 0.55,
    ty - py * bit * 0.55,
    tx + px * bit * 0.55,
    ty + py * bit * 0.55,
    tx + px * bit * 0.55 + ux * bit * 1.0,
    ty + py * bit * 0.55 + uy * bit * 1.0,
    tx - px * bit * 0.55 + ux * bit * 1.0,
    ty - py * bit * 0.55 + uy * bit * 1.0,
    FG.r,
    FG.g,
    FG.b,
  )
}

function renderIcon(size) {
  const w = size
  const h = size
  const rgba = Buffer.alloc(w * h * 4)

  drawAppTileBackground(rgba, size)

  const cx = size * 0.5
  const cy = size * 0.5
  const L = size * 0.42

  drawWrench(rgba, w, h, size, cx, cy, L)
  drawScrewdriver(rgba, w, h, size, cx, cy, L)

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
