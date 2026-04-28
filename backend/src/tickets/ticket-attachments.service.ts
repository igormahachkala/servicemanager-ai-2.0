import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { mkdir, rm, writeFile } from 'fs/promises'
import { extname, join } from 'path'
import { randomUUID } from 'crypto'

import { PrismaService } from '../prisma/prisma.service'
import { type UserCtx } from '../policy/tickets.policy'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { resolveReadableTicketAccess } from './ticket-access.utils'

@Injectable()
export class TicketAttachmentsService {
  private readonly uploadsDir = join(process.cwd(), 'uploads', 'ticket-attachments')

  constructor(
    private readonly prisma: PrismaService,
    private readonly serviceContractsService: ServiceContractsService,
  ) {}

  async uploadDraftAttachment(companyId: string, uploadedByUserId: string | null, file: any) {
    this.assertImageFile(file)

    const stored = await this.persistFile(file)

    return this.prisma.ticketAttachment.create({
      data: {
        companyId,
        ticketId: null,
        uploadedByUserId,
        originalName: file.originalname,
        storageKey: stored.storageKey,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        url: stored.url,
      },
      select: this.attachmentSelect(),
    })
  }

  async bindAttachmentsToTicketTx(
    tx: Prisma.TransactionClient,
    params: {
      companyId: string
      ticketId: string
      attachmentIds?: string[] | null
      actorCompanyId?: string | null
      uploadedByUserId?: string | null
    },
  ) {
    const attachmentIds = [...new Set((params.attachmentIds || []).filter(Boolean))]
    if (attachmentIds.length === 0) return []

    const allowedCompanyIds = Array.from(
      new Set([params.companyId, params.actorCompanyId].filter((value): value is string => !!value)),
    )

    const attachments = await tx.ticketAttachment.findMany({
      where: {
        id: { in: attachmentIds },
        companyId: { in: allowedCompanyIds },
      },
      select: {
        id: true,
        companyId: true,
        ticketId: true,
        uploadedByUserId: true,
      },
    })

    if (attachments.length !== attachmentIds.length) {
      throw new BadRequestException('Some attachmentIds are invalid')
    }

    const alreadyBound = attachments.find((attachment) => attachment.ticketId && attachment.ticketId !== params.ticketId)
    if (alreadyBound) {
      throw new BadRequestException('Attachment already belongs to another ticket')
    }

    const invalidCrossCompanyAttachment = attachments.find((attachment) => {
      if (attachment.companyId === params.companyId) return false
      return (
        !params.actorCompanyId ||
        attachment.companyId !== params.actorCompanyId ||
        !params.uploadedByUserId ||
        attachment.uploadedByUserId !== params.uploadedByUserId ||
        attachment.ticketId !== null
      )
    })

    if (invalidCrossCompanyAttachment) {
      throw new BadRequestException('Some attachmentIds are invalid')
    }

    await tx.ticketAttachment.updateMany({
      where: {
        id: { in: attachmentIds },
        companyId: { in: allowedCompanyIds },
      },
      data: {
        ticketId: params.ticketId,
        companyId: params.companyId,
      },
    })

    return tx.ticketAttachment.findMany({
      where: {
        id: { in: attachmentIds },
      },
      select: this.attachmentSelect(),
      orderBy: { createdAt: 'asc' },
    })
  }

  async listForTicket(
    user: UserCtx,
    ticketId: string,
    linkedClientCompanyId?: string,
    observerCompanyId?: string,
  ) {
    const ticketCompanyId = await this.resolveReadableTicketCompanyId(
      user,
      ticketId,
      linkedClientCompanyId,
      observerCompanyId,
    )

    const candidateCompanyIds = Array.from(new Set([ticketCompanyId, user.companyId].filter(Boolean)))

    return this.prisma.ticketAttachment.findMany({
      where: {
        ticketId,
        ...(candidateCompanyIds.length === 1
          ? { companyId: candidateCompanyIds[0] }
          : { companyId: { in: candidateCompanyIds } }),
      },
      select: this.attachmentSelect(),
      orderBy: { createdAt: 'asc' },
    })
  }

  async uploadToTicket(user: UserCtx, ticketId: string, file: any, linkedClientCompanyId?: string) {
    const ticketCompanyId = await this.resolveReadableTicketCompanyId(user, ticketId, linkedClientCompanyId)
    this.assertImageFile(file)

    const stored = await this.persistFile(file)

    return this.prisma.ticketAttachment.create({
      data: {
        companyId: ticketCompanyId,
        ticketId,
        uploadedByUserId: user.id,
        originalName: file.originalname,
        storageKey: stored.storageKey,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        url: stored.url,
      },
      select: this.attachmentSelect(),
    })
  }

  async deleteDraftAttachment(companyId: string, attachmentId: string) {
    const attachment = await this.prisma.ticketAttachment.findFirst({
      where: {
        id: attachmentId,
        companyId,
        ticketId: null,
      },
    })

    if (!attachment) {
      throw new NotFoundException('Attachment not found')
    }

    await this.prisma.ticketAttachment.delete({ where: { id: attachment.id } })
    await this.removeStoredFile(attachment.storageKey)

    return { ok: true }
  }

  async deleteFromTicket(user: UserCtx, ticketId: string, attachmentId: string, linkedClientCompanyId?: string) {
    const ticketCompanyId = await this.resolveReadableTicketCompanyId(user, ticketId, linkedClientCompanyId)

    const attachment = await this.prisma.ticketAttachment.findFirst({
      where: {
        id: attachmentId,
        companyId: ticketCompanyId,
        ticketId,
      },
    })

    if (!attachment) {
      throw new NotFoundException('Attachment not found')
    }

    await this.prisma.ticketAttachment.delete({ where: { id: attachment.id } })
    await this.removeStoredFile(attachment.storageKey)

    return { ok: true }
  }

  private async resolveReadableTicketCompanyId(
    user: UserCtx,
    ticketId: string,
    linkedClientCompanyId?: string,
    observerCompanyId?: string,
  ) {
    const readable = await resolveReadableTicketAccess({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor: {
        id: user.id,
        role: user.role,
        companyId: user.companyId,
        accessFlags: user.accessFlags,
      },
      ticketId,
      linkedClientCompanyId,
      observerCompanyId,
    })

    return readable.ticket.companyId
  }

  private attachmentSelect() {
    return {
      id: true,
      ticketId: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      url: true,
      createdAt: true,
      uploadedBy: {
        select: {
          id: true,
          email: true,
        },
      },
    } satisfies Prisma.TicketAttachmentSelect
  }

  private assertImageFile(file: any) {
    if (!file) {
      throw new BadRequestException('file is required')
    }

    if (!file.mimetype || !String(file.mimetype).startsWith('image/')) {
      throw new BadRequestException('Only image uploads are supported')
    }

    if (!file.buffer || !file.size) {
      throw new BadRequestException('Uploaded file is empty')
    }
  }

  private async persistFile(file: any) {
    await mkdir(this.uploadsDir, { recursive: true })

    const ext = extname(file.originalname || '') || '.bin'
    const storageKey = `${randomUUID()}${ext}`
    const absolutePath = join(this.uploadsDir, storageKey)

    await writeFile(absolutePath, file.buffer)

    return {
      storageKey,
      url: `/uploads/ticket-attachments/${storageKey}`,
    }
  }

  private async removeStoredFile(storageKey: string) {
    if (!storageKey) return
    await rm(join(this.uploadsDir, storageKey), { force: true })
  }
}

