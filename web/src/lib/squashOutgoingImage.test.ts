import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { prepareOutgoingTicketMedia } from './ticketAttachmentMedia'
import {
  fitOutgoingSize,
  jpegFileName,
  squashOutgoingImage,
  type SquashCodec,
} from './squashOutgoingImage'

const here = dirname(fileURLToPath(import.meta.url))
const src = (relative: string) => readFileSync(resolve(here, '..', relative), 'utf8')

function tinyImageData(): ImageData {
  return { data: new Uint8ClampedArray(4), width: 1, height: 1, colorSpace: 'srgb' } as ImageData
}

function makeFile(name: string, type: string, bytes: number) {
  return new File([new Uint8Array(bytes)], name, { type, lastModified: 1_700_000_000_000 })
}

function codec(resultBytes: number): SquashCodec {
  return {
    decode: async () => ({ width: 4000, height: 3000, close() {} }),
    drawToImageData: async () => tinyImageData(),
    encode: async () => new Uint8Array(resultBytes).buffer,
  }
}

describe('squashOutgoingImage', () => {
  it('leaves video untouched and does not call the codec', async () => {
    const video = makeFile('clip.mp4', 'video/mp4', 8000)
    let decodeCalls = 0
    const out = await squashOutgoingImage(video, {
      decode: async () => {
        decodeCalls += 1
        return { width: 1, height: 1 }
      },
      drawToImageData: async () => tinyImageData(),
      encode: async () => new Uint8Array([1, 2, 3]).buffer,
    })
    expect(out).toBe(video)
    expect(decodeCalls).toBe(0)
  })

  it('returns jpeg smaller than the source', async () => {
    const source = makeFile('shot.png', 'image/png', 5000)
    const out = await squashOutgoingImage(source, codec(800))
    expect(out).not.toBe(source)
    expect(out.type).toBe('image/jpeg')
    expect(out.name).toBe('shot.jpg')
    expect(out.size).toBe(800)
  })

  it('keeps the source when encode is not smaller or throws', async () => {
    const source = makeFile('shot.jpg', 'image/jpeg', 400)
    const larger = await squashOutgoingImage(source, codec(400))
    expect(larger).toBe(source)
    const failed = await squashOutgoingImage(source, {
      decode: async () => {
        throw new Error('no wasm')
      },
      drawToImageData: async () => tinyImageData(),
      encode: async () => new ArrayBuffer(10),
    })
    expect(failed).toBe(source)
  })

  it('fits the long edge to 1920', () => {
    expect(fitOutgoingSize(4000, 3000)).toEqual({ width: 1920, height: 1440 })
    expect(fitOutgoingSize(800, 600)).toEqual({ width: 800, height: 600 })
    expect(jpegFileName('a.PNG')).toBe('a.jpg')
  })
})

describe('prepareOutgoingTicketMedia', () => {
  it('validates after squash and skips video', async () => {
    const video = makeFile('clip.mp4', 'video/mp4', 1200)
    const preparedVideo = await prepareOutgoingTicketMedia(video, codec(10))
    expect(preparedVideo.error).toBeNull()
    expect(preparedVideo.file).toBe(video)

    const image = makeFile('shot.webp', 'image/webp', 9000)
    const preparedImage = await prepareOutgoingTicketMedia(image, codec(300))
    expect(preparedImage.error).toBeNull()
    expect(preparedImage.file.type).toBe('image/jpeg')
    expect(preparedImage.file.size).toBe(300)
  })
})

describe('offline write-path stays original', () => {
  it('does not import squash in serverMedia or prefetch', () => {
    for (const relative of [
      'mobile/offline/serverMediaCache.ts',
      'mobile/offline/ticketPrefetch.ts',
      'mobile/offline/ticketDetailCache.ts',
      'mobile/offline/roundCache.ts',
    ]) {
      const text = src(relative)
      expect(text).not.toContain('squashOutgoingImage')
      expect(text).not.toContain('@jsquash/jpeg')
    }
  })
})
