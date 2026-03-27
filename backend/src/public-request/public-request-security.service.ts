import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { createHash } from 'crypto'

@Injectable()
export class PublicRequestSecurityService {
  private readonly allowedMimeTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ])

  private readonly maxPhotoSizeBytes = 10 * 1024 * 1024
  private readonly burstWindowMs = 10 * 60 * 1000
  private readonly burstLimit = 5
  private readonly phoneCooldownMs = 2 * 60 * 1000

  constructor(private readonly prisma: PrismaService) {}

  normalizeDescription(value: string) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim()
    if (normalized.length < 3) {
      throw new BadRequestException('Description is too short')
    }
    if (normalized.length > 2000) {
      throw new BadRequestException('Description is too long')
    }
    return normalized
  }

  normalizeName(value?: string | null) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim()
    return normalized ? normalized.slice(0, 255) : null
  }

  normalizePhone(value: string | undefined, required: boolean) {
    const raw = String(value || '').trim()
    if (!raw) {
      if (required) throw new BadRequestException('Phone number is required')
      return null
    }

    let digits = raw.replace(/\D+/g, '')
    if (digits.length === 11 && digits.startsWith('8')) {
      digits = '7' + digits.slice(1)
    }

    if (digits.length < 10 || digits.length > 15) {
      throw new BadRequestException('Phone number format is invalid')
    }

    return '+' + digits
  }

  normalizeIp(ip?: string | null) {
    const raw = String(ip || '').trim()
    if (!raw) return null
    return raw.split(',')[0].trim() || null
  }

  hash(value?: string | null) {
    if (!value) return null
    return createHash('sha256').update(value).digest('hex')
  }

  validatePhotos(
    files: Array<{ mimetype?: string; size?: number }> = [],
    settings: { publicRequestAllowPhotos: boolean; publicRequestMaxPhotos: number },
  ) {
    if (!settings.publicRequestAllowPhotos && files.length > 0) {
      throw new BadRequestException('Photos are disabled for this request channel')
    }

    if (files.length > settings.publicRequestMaxPhotos) {
      throw new BadRequestException(`At most ${settings.publicRequestMaxPhotos} photos are allowed`)
    }

    for (const file of files) {
      if (!this.allowedMimeTypes.has(String(file.mimetype || '').toLowerCase())) {
        throw new BadRequestException('Unsupported photo format')
      }
      if ((file.size || 0) <= 0 || (file.size || 0) > this.maxPhotoSizeBytes) {
        throw new BadRequestException('Photo size is invalid')
      }
    }
  }

  async assertSubmitAllowed(params: {
    companyId: string
    token: string
    ip: string | null
    phone: string | null
    locationId: string
    enabled: boolean
  }) {
    if (!params.enabled) return

    const now = Date.now()
    const tokenHash = this.hash(params.token)
    const ipHash = this.hash(params.ip)
    const phoneHash = this.hash(params.phone)

    const burstCount = await this.prisma.publicRequestLog.count({
      where: {
        companyId: params.companyId,
        action: 'submit',
        tokenHash: tokenHash || undefined,
        ipHash: ipHash || undefined,
        createdAt: { gte: new Date(now - this.burstWindowMs) },
      },
    })

    if (burstCount >= this.burstLimit) {
      throw new HttpException('Too many requests from this link. Please wait a few minutes and try again.', HttpStatus.TOO_MANY_REQUESTS)
    }

    if (phoneHash) {
      const phoneCooldownCount = await this.prisma.publicRequestLog.count({
        where: {
          companyId: params.companyId,
          action: 'submit',
          phoneHash,
          locationId: params.locationId,
          createdAt: { gte: new Date(now - this.phoneCooldownMs) },
        },
      })

      if (phoneCooldownCount > 0) {
        throw new HttpException('A recent request from this phone for this location already exists. Please wait before sending another one.', HttpStatus.TOO_MANY_REQUESTS)
      }
    }
  }

  async logSubmit(params: {
    companyId: string
    token: string
    ip: string | null
    phone: string | null
    locationId: string
    channel: string
  }) {
    await this.prisma.publicRequestLog.create({
      data: {
        companyId: params.companyId,
        tokenHash: this.hash(params.token)!,
        ipHash: this.hash(params.ip),
        phoneHash: this.hash(params.phone),
        locationId: params.locationId,
        channel: params.channel,
        action: 'submit',
      },
    })
  }
}
