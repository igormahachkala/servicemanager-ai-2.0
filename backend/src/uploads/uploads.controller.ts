import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Param,
  Query,
  Res,
  StreamableFile,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ServiceContractRole, UserRole } from '@prisma/client'
import type { Response } from 'express'
import { createReadStream, existsSync, statSync } from 'fs'
import type { Stats } from 'fs'
import { join } from 'path'

import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import {
  isLocationAllowedByLocationScope,
  resolveActorLocationScope,
  resolveReadableTicketAccess,
} from '../tickets/ticket-access.utils'

// SMA-EQUIPMENT-V2-110A: снимки оборудования раздаются тем же авторизованным
// маршрутом. Публичного каталога у них нет — только эта папка в общем списке.
const ALLOWED_FOLDERS = new Set(['ticket-attachments', 'inspection-run-items', 'equipment'])

// UUID v4 followed by a short safe extension: e.g. uuid.png, uuid.jpeg, uuid.bin
const SAFE_FILENAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-zA-Z0-9]{1,10}$/

const UPLOAD_CACHE_CONTROL = 'private, max-age=31536000, immutable'

type JwtPayload = {
  sub: string
  userId?: string
  email?: string
  companyId: string
  role: UserRole
}

@Controller('uploads')
export class UploadsController {
  private readonly uploadsRoot = join(process.cwd(), 'uploads')

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly serviceContractsService: ServiceContractsService,
  ) {}

  @Get(':folder/:filename')
  async serve(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Query('token') queryToken: string | undefined,
    @Headers('authorization') authHeader: string | undefined,
    @Headers('range') rangeHeader: string | undefined,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Headers('if-modified-since') ifModifiedSince: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile | void> {
    if (!ALLOWED_FOLDERS.has(folder)) {
      throw new NotFoundException('File not found')
    }

    if (!SAFE_FILENAME_RE.test(filename)) {
      throw new NotFoundException('File not found')
    }

    const user = await this.resolveUser(authHeader, queryToken)
    if (!user) {
      throw new UnauthorizedException('Authentication required')
    }

    const { mimeType, originalName } = await this.assertAccessAndResolveMetadata(
      folder,
      filename,
      user,
    )

    const absolutePath = join(this.uploadsRoot, folder, filename)
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('File not found')
    }

    const stat = statSync(absolutePath)
    const etag = this.fileEtag(stat)
    const lastModified = stat.mtime.toUTCString()
    const range = this.parseRange(rangeHeader, stat.size)

    res.set({
      'Content-Type': mimeType,
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `inline; filename="${this.safeFilenameHeader(originalName)}"`,
      'Cache-Control': UPLOAD_CACHE_CONTROL,
      'Accept-Ranges': 'bytes',
      ETag: etag,
      'Last-Modified': lastModified,
    })

    if (!range && this.isNotModified(stat, etag, ifNoneMatch, ifModifiedSince)) {
      res.status(304)
      return
    }

    if (range) {
      res.status(206)
      res.set({
        'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}`,
        'Content-Length': String(range.end - range.start + 1),
      })
      return new StreamableFile(createReadStream(absolutePath, range))
    }

    res.set('Content-Length', String(stat.size))
    return new StreamableFile(createReadStream(absolutePath))
  }

  private fileEtag(stat: Stats): string {
    return `"${stat.size}-${stat.mtimeMs}"`
  }

  private isNotModified(
    stat: Stats,
    etag: string,
    ifNoneMatch: string | undefined,
    ifModifiedSince: string | undefined,
  ): boolean {
    if (ifNoneMatch) {
      const tokens = ifNoneMatch.split(',').map((token) => token.trim())
      return tokens.includes('*') || tokens.includes(etag)
    }
    if (!ifModifiedSince) return false
    const since = Date.parse(ifModifiedSince)
    if (!Number.isFinite(since)) return false
    return Math.floor(stat.mtimeMs / 1000) <= Math.floor(since / 1000)
  }

  private async resolveUser(
    authHeader: string | undefined,
    queryToken: string | undefined,
  ): Promise<JwtPayload | null> {
    const raw =
      typeof queryToken === 'string' && queryToken.trim()
        ? queryToken.trim()
        : authHeader?.startsWith('Bearer ')
          ? authHeader.slice(7)
          : null

    if (!raw) return null

    try {
      const payload = this.jwt.verify<JwtPayload>(raw)
      const userId = payload.userId || payload.sub
      if (!userId || !payload.companyId) return null

      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
          companyId: payload.companyId,
          isActive: true,
          deletedAt: null,
        },
        select: { id: true, email: true, companyId: true, role: true },
      })
      if (!user) return null

      return {
        sub: user.id,
        userId: user.id,
        email: user.email,
        companyId: user.companyId,
        role: user.role,
      }
    } catch {
      return null
    }
  }

  private async assertAccessAndResolveMetadata(
    folder: string,
    storageKey: string,
    user: JwtPayload,
  ): Promise<{ mimeType: string; originalName: string }> {
    if (folder === 'ticket-attachments') {
      return this.assertTicketAttachmentAccess(storageKey, user)
    }
    if (folder === 'equipment') {
      return this.assertEquipmentAttachmentAccess(storageKey, user)
    }
    return this.assertInspectionAttachmentAccess(storageKey, user)
  }

  private async assertTicketAttachmentAccess(
    storageKey: string,
    user: JwtPayload,
  ): Promise<{ mimeType: string; originalName: string }> {
    const attachment = await this.prisma.ticketAttachment.findFirst({
      where: { storageKey },
      select: {
        companyId: true,
        mimeType: true,
        originalName: true,
        ticketId: true,
        uploadedByUserId: true,
      },
    })

    if (!attachment) {
      throw new NotFoundException('File not found')
    }

    if (user.role === 'PLATFORM_ADMIN') {
      return { mimeType: attachment.mimeType, originalName: attachment.originalName }
    }

    if (!attachment.ticketId) {
      if (attachment.companyId === user.companyId && attachment.uploadedByUserId === user.sub) {
        return { mimeType: attachment.mimeType, originalName: attachment.originalName }
      }
      throw new NotFoundException('File not found')
    }

    try {
      await resolveReadableTicketAccess({
        prisma: this.prisma,
        serviceContractsService: this.serviceContractsService,
        actor: {
          id: user.sub,
          role: user.role,
          companyId: user.companyId,
        },
        ticketId: attachment.ticketId,
        linkedClientCompanyId:
          attachment.companyId !== user.companyId ? attachment.companyId : undefined,
        allowedLinkedClientContractRoles: [
          ServiceContractRole.PRIMARY,
          ServiceContractRole.SECONDARY,
        ],
      })
      return { mimeType: attachment.mimeType, originalName: attachment.originalName }
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof ForbiddenException) {
        throw new NotFoundException('File not found')
      }
      throw err
    }
  }

  /**
   * SMA-EQUIPMENT-V2-110A.
   * Снимок виден тому, кто видит саму единицу: свой tenant, либо провайдер с
   * действующим договором и площадкой в своей области. Правила берутся из общих
   * примитивов доступа, второго резолвера здесь не заводится.
   */
  private async assertEquipmentAttachmentAccess(
    storageKey: string,
    user: JwtPayload,
  ): Promise<{ mimeType: string; originalName: string }> {
    const attachment = await this.prisma.equipmentAttachment.findFirst({
      where: { storageKey },
      select: {
        companyId: true,
        mimeType: true,
        originalName: true,
        equipment: { select: { locationId: true } },
      },
    })

    if (!attachment) {
      throw new NotFoundException('File not found')
    }

    const meta = { mimeType: attachment.mimeType, originalName: attachment.originalName }

    if (user.role === 'PLATFORM_ADMIN') {
      return meta
    }

    if (attachment.companyId !== user.companyId) {
      const access = await this.serviceContractsService.getLinkedClientAccess(
        user.companyId,
        attachment.companyId,
      )
      if (!access) {
        throw new NotFoundException('File not found')
      }
    }

    const locationScope = await resolveActorLocationScope({
      prisma: this.prisma,
      actor: { id: user.sub, role: user.role, companyId: user.companyId },
      scopeCompanyId: attachment.companyId,
    })
    if (!isLocationAllowedByLocationScope(locationScope, attachment.equipment.locationId)) {
      throw new NotFoundException('File not found')
    }

    return meta
  }

  private async assertInspectionAttachmentAccess(
    storageKey: string,
    user: JwtPayload,
  ): Promise<{ mimeType: string; originalName: string }> {
    const attachment = await this.prisma.inspectionRunItemAttachment.findFirst({
      where: { storageKey },
      select: { companyId: true, mimeType: true, originalName: true },
    })

    if (!attachment) {
      throw new NotFoundException('File not found')
    }

    if (user.role === 'PLATFORM_ADMIN' || attachment.companyId === user.companyId) {
      return { mimeType: attachment.mimeType, originalName: attachment.originalName }
    }

    throw new ForbiddenException('Access denied')
  }

  private safeFilenameHeader(name: string): string {
    return name.replace(/[^\w.\-_ ]/g, '_').slice(0, 200)
  }

  private parseRange(rangeHeader: string | undefined, fileSize: number): { start: number; end: number } | null {
    if (!rangeHeader || fileSize <= 0) return null
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
    if (!match) return null

    const rawStart = match[1]
    const rawEnd = match[2]
    if (!rawStart && !rawEnd) return null

    let start: number
    let end: number
    if (!rawStart) {
      const suffixLength = Number(rawEnd)
      if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null
      start = Math.max(fileSize - suffixLength, 0)
      end = fileSize - 1
    } else {
      start = Number(rawStart)
      end = rawEnd ? Number(rawEnd) : fileSize - 1
    }

    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return null
    if (start < 0 || end < start || start >= fileSize) return null
    return { start, end: Math.min(end, fileSize - 1) }
  }
}
