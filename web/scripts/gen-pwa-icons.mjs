/**
 * Генерация PNG-иконок PWA (только Node: fs, zlib, buffer).
 * Красная iOS-плитка (скруглённый квадрат), глянец; белые перекрещенные ключ + отвёртка.
 * Без текста, без SMA. Запуск: npm run gen:pwa-icons
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'icons')

/** Белый инструмент (#ffffff). */
const FG = { r: 0xff, g: 0xff, b: 0xff }
/** Тень под инструментами (мягкая, не чистый чёрный). */
const SHADOW = { r: 0x4a, g: 0x0c, b: 0x0e }
const SHADOW_SOFT = { r: 0x6e, g: 0x14, b: 0x16 }

/** Градиент плитки: верхний левый → нижний правый. */
const RED_TL = { r: 0xff, g: 0x3b, b: 0x30 }
const RED_BR = { r: 0xb7, g: 0x1c, b: 0x1c }
const RED_EDGE = { r: 0x6d, g: 0x0f, b: 0x12 }

/** Плитка: полуразмер «короба», радиус скругления ~24% стороны иконки (в диапазоне 22–26%). */
const TILE = { half: 0.42, cornerR: 0.24, outerSd: 0.02 }

/** Инструменты: характерная длина от центра ~33% размера → визуально ~65–70% иконки, поля ~12–15%. */
const TOOL = { halfSpan: 0.33 }

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

function blendPixel(rgba, w, h, x, y, r, g, b, a) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  if (xi < 0 || xi >= w || yi < 0 || yi >= h) return
  const i = (yi * w + xi) * 4
  const ia = 1 - a
  rgba[i] = Math.round(r * a + rgba[i] * ia)
  rgba[i + 1] = Math.round(g * a + rgba[i + 1] * ia)
  rgba[i + 2] = Math.round(b * a + rgba[i + 2] * ia)
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

function drawThickLineBlend(rgba, w, h, x1, y1, x2, y2, thickness, r, g, b, alpha) {
  const half = thickness * 0.5
  const r2 = half * half
  const pad = Math.ceil(half) + 2
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - pad))
  const maxX = Math.min(w - 1, Math.ceil(Math.max(x1, x2) + pad))
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - pad))
  const maxY = Math.min(h - 1, Math.ceil(Math.max(y1, y2) + pad))
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (distPointToSegmentSq(x + 0.5, y + 0.5, x1, y1, x2, y2) <= r2) blendPixel(rgba, w, h, x, y, r, g, b, alpha)
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

/** SDF скруглённого прямоугольника (центр холста). */
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

/** Точка в локальных осях: u — вдоль (+1,+1), v — вдоль (-1,+1), нормализовано. */
function toGlobal(cx, cy, u, v) {
  const n = Math.SQRT1_2
  const gx = cx + (u - v) * n
  const gy = cy + (u + v) * n
  return { x: gx, y: gy }
}

/** Цвет плитки (для «дыр» в ключе). */
function sampleAppTileRgb(size, x, y) {
  const cx = size * 0.5
  const cy = size * 0.5
  const half = size * TILE.half
  const cornerR = size * TILE.cornerR
  const px = x - cx
  const py = y - cy
  const sd = sdRoundedBox(px, py, half, half, cornerR)

  if (sd > size * TILE.outerSd) {
    return { ...RED_EDGE }
  }

  const nx = x / size
  const ny = y / size
  const tDiag = Math.min(1, Math.max(0, (nx + ny) * 0.5))
  let col = lerpRgb(RED_TL, RED_BR, tDiag)

  const edge = Math.max(0, -sd)
  const innerW = Math.max(2, size * 0.05)
  if (edge < innerW) {
    const k = 1 - edge / innerW
    col = lerpRgb(col, RED_EDGE, k * k * 0.55)
  }

  const hx = (x - cx) / (half * 1.02)
  const hy = (y - cy) / (half * 1.02)
  const gloss = Math.exp(-(hx * hx * 2.0 + Math.pow(hy + 0.42, 2) * 5.0) * 4.0)
  const glossWide = Math.exp(-(Math.pow(hy + 0.55, 2) * 10 + hx * hx * 1.5) * 2.5)
  const spec = Math.min(1, gloss * 0.42 + glossWide * 0.18)
  col = lerpRgb(col, { r: 0xff, g: 0xf5, b: 0xf4 }, spec)

  const aa = Math.max(0, Math.min(1, 0.5 - sd * (size * 0.032)))
  if (sd > -aa && sd < 0) {
    const outT = (sd + aa) / aa
    col = lerpRgb(RED_EDGE, col, outT)
  }
  return col
}

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

/**
 * Ключ: тело вдоль диагонали +45° (u-ось), раскрытая головка (кольцо с вырезом снизу).
 * u: от центра к «голове» положительное.
 */
function drawWrench(rgba, w, h, size, cx, cy, S, color, alpha = 1) {
  const draw = alpha >= 0.99 ? (a, b, c, d, t, rr, gg, bb) => drawThickLine(rgba, w, h, a, b, c, d, t, rr, gg, bb) : (a, b, c, d, t, rr, gg, bb) => drawThickLineBlend(rgba, w, h, a, b, c, d, t, rr, gg, bb, alpha)

  const tw = size * 0.095
  const u0 = -S * 0.72
  const u1 = S * 0.38
  const p0 = toGlobal(cx, cy, u0, 0)
  const p1 = toGlobal(cx, cy, u1, 0)
  draw(p0.x, p0.y, p1.x, p1.y, tw, color.r, color.g, color.b)

  const headU = S * 0.52
  const headV = 0
  const hc = toGlobal(cx, cy, headU, headV)
  const jawR = size * 0.11
  fillCircle(rgba, w, h, hc.x, hc.y, jawR * 0.52, color.r, color.g, color.b)
  const holeCol = sampleAppTileRgb(size, hc.x, hc.y)
  fillCircle(rgba, w, h, hc.x, hc.y, jawR * 0.32, holeCol.r, holeCol.g, holeCol.b)

  const bowU = -S * 0.48
  const bowV = 0
  const bc = toGlobal(cx, cy, bowU, bowV)
  const bowR = size * 0.078
  fillRing(rgba, w, h, bc.x, bc.y, bowR, bowR * 0.48, color.r, color.g, color.b)
  const inner = sampleAppTileRgb(size, bc.x + bowR * 0.28, bc.y)
  fillCircle(rgba, w, h, bc.x + bowR * 0.28, bc.y, bowR * 0.28, inner.r, inner.g, inner.b)
}

/**
 * Отвёртка: вдоль −45° (v-ось), рукоятка (толстая), стержень, плоский наконечник.
 */
function drawScrewdriver(rgba, w, h, size, cx, cy, S, color, alpha = 1) {
  const draw = alpha >= 0.99 ? (a, b, c, d, t, rr, gg, bb) => drawThickLine(rgba, w, h, a, b, c, d, t, rr, gg, bb) : (a, b, c, d, t, rr, gg, bb) => drawThickLineBlend(rgba, w, h, a, b, c, d, t, rr, gg, bb, alpha)

  const shaftW = size * 0.072
  const vShaft0 = -S * 0.55
  const vShaft1 = S * 0.62
  const s0 = toGlobal(cx, cy, 0, vShaft0)
  const s1 = toGlobal(cx, cy, 0, vShaft1)
  draw(s0.x, s0.y, s1.x, s1.y, shaftW, color.r, color.g, color.b)

  const dx = s1.x - s0.x
  const dy = s1.y - s0.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const px = -uy
  const py = ux

  const handleLen = S * 0.42
  const handleW = shaftW * 1.45
  const h1 = toGlobal(cx, cy, 0, vShaft0)
  const h2x = h1.x - ux * handleLen
  const h2y = h1.y - uy * handleLen
  draw(h1.x, h1.y, h2x, h2y, handleW, color.r, color.g, color.b)

  fillCircle(rgba, w, h, h2x, h2y, handleW * 0.52, color.r, color.g, color.b)

  const bit = size * 0.065
  const tx = s1.x + ux * bit * 0.15
  const ty = s1.y + uy * bit * 0.15
  fillQuad(
    rgba,
    w,
    h,
    tx - px * bit * 0.62,
    ty - py * bit * 0.62,
    tx + px * bit * 0.62,
    ty + py * bit * 0.62,
    tx + px * bit * 0.62 + ux * bit * 1.05,
    ty + py * bit * 0.62 + uy * bit * 1.05,
    tx - px * bit * 0.62 + ux * bit * 1.05,
    ty - py * bit * 0.62 + uy * bit * 1.05,
    color.r,
    color.g,
    color.b,
  )
}

function drawToolShadows(rgba, w, h, size, cx, cy, S) {
  const ox = size * 0.018
  const oy = size * 0.026
  const layers = [
    { dx: ox * 1.2, dy: oy * 1.2, a: 0.22, c: SHADOW },
    { dx: ox * 0.7, dy: oy * 0.9, a: 0.16, c: SHADOW_SOFT },
  ]
  for (const layer of layers) {
    const tcx = cx + layer.dx
    const tcy = cy + layer.dy
    drawWrench(rgba, w, h, size, tcx, tcy, S, layer.c, layer.a)
    drawScrewdriver(rgba, w, h, size, tcx, tcy, S, layer.c, layer.a)
  }
}

function renderIcon(size) {
  const w = size
  const h = size
  const rgba = Buffer.alloc(w * h * 4)

  drawAppTileBackground(rgba, size)

  const cx = size * 0.5
  const cy = size * 0.5
  const S = size * TOOL.halfSpan

  drawToolShadows(rgba, w, h, size, cx, cy, S)
  drawWrench(rgba, w, h, size, cx, cy, S, FG, 1)
  drawScrewdriver(rgba, w, h, size, cx, cy, S, FG, 1)

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
