import { BadRequestException } from '@nestjs/common'

export const MAX_IMAGE_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024
export const MAX_VIDEO_ATTACHMENT_SIZE_BYTES = 100 * 1024 * 1024

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

const ALLOWED_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
])

const EXT_MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  m4v: 'video/x-m4v',
}

export type TicketAttachmentMediaKind = 'image' | 'video'

export function normalizeTicketAttachmentMime(file: any): string {
  let mime = String(file?.mimetype || '').toLowerCase().trim()

  // iOS and embedded webviews can send camera files as octet-stream.
  // Infer only from a narrow allow-list of known extensions.
  if (!mime || mime === 'application/octet-stream') {
    const ext = String(file?.originalname || '').split('.').pop()?.toLowerCase() ?? ''
    const inferred = EXT_MIME_MAP[ext]
    if (inferred) {
      mime = inferred
      file.mimetype = inferred
    }
  }

  return mime
}

export function ticketAttachmentMediaKind(mime: string): TicketAttachmentMediaKind | null {
  if (ALLOWED_IMAGE_MIME_TYPES.has(mime)) return 'image'
  if (ALLOWED_VIDEO_MIME_TYPES.has(mime)) return 'video'
  return null
}

export function assertTicketAttachmentMedia(file: any): TicketAttachmentMediaKind {
  if (!file) {
    throw new BadRequestException('file is required')
  }

  const mime = normalizeTicketAttachmentMime(file)
  const kind = ticketAttachmentMediaKind(mime)
  if (!kind) {
    throw new BadRequestException('Поддерживаются изображения JPEG, PNG, WebP, HEIC, HEIF и видео MP4, MOV, WebM, M4V')
  }

  if (!file.buffer || !file.size) {
    throw new BadRequestException('Uploaded file is empty')
  }

  const maxSize = kind === 'video' ? MAX_VIDEO_ATTACHMENT_SIZE_BYTES : MAX_IMAGE_ATTACHMENT_SIZE_BYTES
  if (file.size > maxSize) {
    const maxMegabytes = maxSize / 1024 / 1024
    throw new BadRequestException(`${kind === 'video' ? 'Видео' : 'Изображение'} слишком большое (максимум ${maxMegabytes} МБ)`)
  }

  return kind
}

export function ticketAttachmentExtension(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/heic': '.heic',
    'image/heif': '.heif',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'video/webm': '.webm',
    'video/x-m4v': '.m4v',
  }
  return map[mime] ?? '.bin'
}
