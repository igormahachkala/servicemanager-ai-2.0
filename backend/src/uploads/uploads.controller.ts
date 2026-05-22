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
import type { Response } from 'express'
import { createReadStream, existsSync } from 'fs'
import { join } from 'path'

import { PrismaService } from '../prisma/prisma.service'

const ALLOWED_FOLDERS = new Set(['ticket-attachments', 'inspection-run-items'])

// UUID v4 followed by a short safe extension: e.g. uuid.png, uuid.jpeg, uuid.bin
const SAFE_FILENAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-zA-Z0-9]{1,10}$/

type JwtPayload = {
  sub: string
  userId?: string
  email?: string
  companyId: string
  role: string
}

@Controller('uploads')
export class UploadsController {
  private readonly uploadsRoot = join(process.cwd(), 'uploads')

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  @Get(':folder/:filename')
  async serve(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Query('token') queryToken: string | undefined,
    @Headers('authorization') authHeader: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!ALLOWED_FOLDERS.has(folder)) {
      throw new NotFoundException('File not found')
    }

    if (!SAFE_FILENAME_RE.test(filename)) {
      throw new NotFoundException('File not found')
    }

    const user = this.resolveUser(authHeader, queryToken)
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

    res.set({
      'Content-Type': mimeType,
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `inline; filename="${this.safeFilenameHeader(originalName)}"`,
      'Cache-Control': 'private, max-age=3600',
    })

    return new StreamableFile(createReadStream(absolutePath))
  }

  private resolveUser(authHeader: string | undefined, queryToken: string | undefined): JwtPayload | null {
    const raw =
      typeof queryToken === 'string' && queryToken.trim()
        ? queryToken.trim()
        : authHeader?.startsWith('Bearer ')
          ? authHeader.slice(7)
          : null

    if (!raw) return null

    try {
      return this.jwt.verify<JwtPayload>(raw)
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
      select: { companyId: true, mimeType: true, originalName: true },
    })

    if (!attachment) {
      throw new NotFoundException('File not found')
    }

    if (user.role === 'PLATFORM_ADMIN') {
      return { mimeType: attachment.mimeType, originalName: attachment.originalName }
    }

    if (attachment.companyId === user.companyId) {
      return { mimeType: attachment.mimeType, originalName: attachment.originalName }
    }

    // Provider accessing client attachment via PRIMARY service contract
    const contract = await this.prisma.serviceContract.findUnique({
      where: {
        clientCompanyId_providerCompanyId: {
          clientCompanyId: attachment.companyId,
          providerCompanyId: user.companyId,
        },
      },
      select: { status: true, role: true },
    })

    if (contract?.status === 'ACTIVE' && contract.role === 'PRIMARY') {
      return { mimeType: attachment.mimeType, originalName: attachment.originalName }
    }

    throw new ForbiddenException('Access denied')
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
}
