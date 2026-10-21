import { BadRequestException } from '@nestjs/common'

import {
  MAX_IMAGE_ATTACHMENT_SIZE_BYTES,
  MAX_VIDEO_ATTACHMENT_SIZE_BYTES,
  assertTicketAttachmentMedia,
  ticketAttachmentExtension,
} from './ticket-attachment-media'

function file(overrides: Record<string, unknown> = {}) {
  return {
    originalname: 'evidence.jpg',
    mimetype: 'image/jpeg',
    size: 1,
    buffer: Buffer.from('x'),
    ...overrides,
  }
}

describe('ticket attachment media policy', () => {
  it('accepts supported image and video formats', () => {
    expect(assertTicketAttachmentMedia(file())).toBe('image')
    expect(assertTicketAttachmentMedia(file({ originalname: 'work.mp4', mimetype: 'video/mp4' }))).toBe('video')
    expect(assertTicketAttachmentMedia(file({ originalname: 'work.mov', mimetype: 'video/quicktime' }))).toBe('video')
    expect(assertTicketAttachmentMedia(file({ originalname: 'work.webm', mimetype: 'video/webm' }))).toBe('video')
  })

  it('infers safe camera MIME types from extensions', () => {
    const iosVideo = file({ originalname: 'IMG_1001.MOV', mimetype: 'application/octet-stream' })
    expect(assertTicketAttachmentMedia(iosVideo)).toBe('video')
    expect(iosVideo.mimetype).toBe('video/quicktime')
  })

  it('rejects unsupported files', () => {
    expect(() => assertTicketAttachmentMedia(file({ originalname: 'payload.exe', mimetype: 'application/octet-stream' }))).toThrow(
      BadRequestException,
    )
  })

  it('enforces separate image and video limits', () => {
    expect(() => assertTicketAttachmentMedia(file({ size: MAX_IMAGE_ATTACHMENT_SIZE_BYTES + 1 }))).toThrow('Изображение слишком большое')
    expect(() =>
      assertTicketAttachmentMedia(
        file({ originalname: 'work.mp4', mimetype: 'video/mp4', size: MAX_VIDEO_ATTACHMENT_SIZE_BYTES + 1 }),
      ),
    ).toThrow('Видео слишком большое')
  })

  it('uses stable storage extensions', () => {
    expect(ticketAttachmentExtension('video/mp4')).toBe('.mp4')
    expect(ticketAttachmentExtension('video/quicktime')).toBe('.mov')
  })
})
