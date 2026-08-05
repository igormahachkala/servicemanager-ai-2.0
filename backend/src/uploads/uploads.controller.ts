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
import { join } from 'path'

import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { resolveReadableTicketAccess } from '../tickets/ticket-access.utils'

const ALLOWED_FOLDERS = new Set(['ticket-attachments', 'inspection-run-items'])

// UUID v4 followed by a short safe extension: e.g. uuid.png, uuid.jpeg, uuid.bin
const SAFE_FILENAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-zA-Z0-9]{1,10}$/

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
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
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

    const fileSize = statSync(absolutePath).size
    const range = this.parseRange(rangeHeader, fileSize)

    res.set({
      'Content-Type': mimeType,
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `inline; filename="${this.safeFilenameHeader(originalName)}"`,
      'Cache-Control': 'private, max-age=3600',
      'Accept-Ranges': 'bytes',
    })

    if (range) {
      res.status(206)
      res.set({
        'Content-Range': `bytes ${range.start}-${range.end}/${fileSize}`,
        'Content-Length': String(range.end - range.start + 1),
      })
      return new StreamableFile(createReadStream(absolutePath, range))
    }

    res.set('Content-Length', String(fileSize))
    return new StreamableFile(createReadStream(absolutePath))
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
