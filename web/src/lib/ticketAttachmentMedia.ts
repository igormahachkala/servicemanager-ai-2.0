export const TICKET_MEDIA_ACCEPT = 'image/*,video/mp4,video/quicktime,video/webm,video/x-m4v,.mov,.m4v'
export const MAX_TICKET_IMAGE_BYTES = 25 * 1024 * 1024
export const MAX_TICKET_VIDEO_BYTES = 100 * 1024 * 1024

export type TicketMediaKind = 'image' | 'video'

const MIME_BY_EXTENSION: Record<string, string> = {
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

export function ticketMediaKind(value: { type?: string | null; mimeType?: string | null; name?: string | null; originalName?: string | null }): TicketMediaKind | null {
  const declared = String(value.type || value.mimeType || '').trim().toLowerCase()
  if (declared.startsWith('image/')) return 'image'
  if (declared.startsWith('video/')) return 'video'

  const name = String(value.name || value.originalName || '').trim().toLowerCase()
  const extension = name.split('.').pop() || ''
  const inferred = MIME_BY_EXTENSION[extension]
  if (inferred?.startsWith('image/')) return 'image'
  if (inferred?.startsWith('video/')) return 'video'
  return null
}

export function normalizeTicketMediaFile(file: File): File {
  const declared = String(file.type || '').trim().toLowerCase()
  if (declared && declared !== 'application/octet-stream' && ticketMediaKind(file)) return file

  const extension = String(file.name || '').trim().toLowerCase().split('.').pop() || ''
  const inferred = MIME_BY_EXTENSION[extension]
  if (!inferred) return file

  try {
    return new File([file], file.name || `ticket-media-${Date.now()}`, {
      type: inferred,
      lastModified: file.lastModified || Date.now(),
    })
  } catch {
    return file
  }
}

export function validateTicketMediaFile(file: File): string | null {
  const kind = ticketMediaKind(file)
  if (!kind) return 'Поддерживаются фотографии и видео MP4, MOV, WebM или M4V'
  if (file.size <= 0) return 'Файл пустой'

  const maxBytes = kind === 'video' ? MAX_TICKET_VIDEO_BYTES : MAX_TICKET_IMAGE_BYTES
  if (file.size > maxBytes) {
    return `${kind === 'video' ? 'Видео' : 'Изображение'} слишком большое (максимум ${maxBytes / 1024 / 1024} МБ)`
  }
  return null
}

export function ticketMediaNoun(value: Parameters<typeof ticketMediaKind>[0]) {
  return ticketMediaKind(value) === 'video' ? 'Видео' : 'Фото'
}
