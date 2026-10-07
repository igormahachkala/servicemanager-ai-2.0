export const OUTGOING_JPEG_QUALITY = 75
export const OUTGOING_MAX_EDGE_PX = 1920

export type DecodedBitmap = {
  width: number
  height: number
  close?: () => void
}

export type SquashCodec = {
  decode: (file: Blob) => Promise<DecodedBitmap>
  drawToImageData: (bitmap: DecodedBitmap, width: number, height: number) => Promise<ImageData>
  encode: (imageData: ImageData, quality: number) => Promise<ArrayBuffer>
}

function isVideoFile(file: File): boolean {
  return String(file.type || '').toLowerCase().startsWith('video/')
}

function looksLikeImage(file: File): boolean {
  const type = String(file.type || '').toLowerCase()
  if (type.startsWith('image/')) return true
  return /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(file.name || '')
}

export function jpegFileName(name: string): string {
  const trimmed = String(name || '').trim()
  const base = trimmed.replace(/\.[^.]+$/, '') || 'photo'
  return `${base}.jpg`
}

export function fitOutgoingSize(width: number, height: number, maxEdge = OUTGOING_MAX_EDGE_PX) {
  const safeWidth = Math.max(1, Math.round(width))
  const safeHeight = Math.max(1, Math.round(height))
  const edge = Math.max(safeWidth, safeHeight)
  if (edge <= maxEdge) return { width: safeWidth, height: safeHeight }
  const scale = maxEdge / edge
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  }
}

function defaultCodec(): SquashCodec {
  return {
    async decode(file) {
      if (typeof createImageBitmap !== 'function') {
        throw new Error('createImageBitmap недоступен')
      }
      return createImageBitmap(file)
    },
    async drawToImageData(bitmap, width, height) {
      if (typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(width, height)
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('OffscreenCanvas без 2d')
        ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height)
        return ctx.getImageData(0, 0, width, height)
      }
      if (typeof document === 'undefined') {
        throw new Error('canvas недоступен')
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas без 2d')
      ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height)
      return ctx.getImageData(0, 0, width, height)
    },
    async encode(imageData, quality) {
      const { default: encode } = await import('@jsquash/jpeg/encode')
      return encode(imageData, { quality })
    },
  }
}

export async function squashOutgoingImage(file: File, codec?: SquashCodec): Promise<File> {
  if (isVideoFile(file) || !looksLikeImage(file)) return file

  try {
    const impl = codec ?? defaultCodec()
    const bitmap = await impl.decode(file)
    try {
      const size = fitOutgoingSize(bitmap.width, bitmap.height)
      const imageData = await impl.drawToImageData(bitmap, size.width, size.height)
      const encoded = await impl.encode(imageData, OUTGOING_JPEG_QUALITY)
      if (!encoded || encoded.byteLength <= 0 || encoded.byteLength >= file.size) return file
      return new File([encoded], jpegFileName(file.name), {
        type: 'image/jpeg',
        lastModified: file.lastModified || Date.now(),
      })
    } finally {
      bitmap.close?.()
    }
  } catch {
    return file
  }
}
