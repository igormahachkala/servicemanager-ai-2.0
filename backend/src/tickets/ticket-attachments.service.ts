import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { mkdir, rm, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { TicketsPolicy, type UserCtx } from '../policy/tickets.policy';
import { assertAllowed } from '../policy/policy.utils';

@Injectable()
export class TicketAttachmentsService {
  private readonly uploadsDir = join(process.cwd(), 'uploads', 'ticket-attachments');
  private readonly policy = new TicketsPolicy();

  constructor(private readonly prisma: PrismaService) {}

  async uploadDraftAttachment(companyId: string, uploadedByUserId: string | null, file: any) {
    this.assertImageFile(file);

    const stored = await this.persistFile(file);

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
    });
  }

  async bindAttachmentsToTicketTx(
    tx: Prisma.TransactionClient,
    params: { companyId: string; ticketId: string; attachmentIds?: string[] | null },
  ) {
    const attachmentIds = [...new Set((params.attachmentIds || []).filter(Boolean))];
    if (attachmentIds.length === 0) return [];

    const attachments = await tx.ticketAttachment.findMany({
      where: {
        id: { in: attachmentIds },
        companyId: params.companyId,
      },
      select: {
        id: true,
        ticketId: true,
      },
    });

    if (attachments.length !== attachmentIds.length) {
      throw new BadRequestException('Some attachmentIds are invalid');
    }

    const alreadyBound = attachments.find((attachment) => attachment.ticketId && attachment.ticketId !== params.ticketId);
    if (alreadyBound) {
      throw new BadRequestException('Attachment already belongs to another ticket');
    }

    await tx.ticketAttachment.updateMany({
      where: {
        id: { in: attachmentIds },
        companyId: params.companyId,
      },
      data: {
        ticketId: params.ticketId,
      },
    });

    return tx.ticketAttachment.findMany({
      where: {
        id: { in: attachmentIds },
      },
      select: this.attachmentSelect(),
      orderBy: { createdAt: 'asc' },
    });
  }

  async listForTicket(user: UserCtx, ticketId: string) {
    await this.assertTicketReadable(user, ticketId);

    return this.prisma.ticketAttachment.findMany({
      where: {
        companyId: user.companyId,
        ticketId,
      },
      select: this.attachmentSelect(),
      orderBy: { createdAt: 'asc' },
    });
  }

  async uploadToTicket(user: UserCtx, ticketId: string, file: any) {
    await this.assertTicketReadable(user, ticketId);
    this.assertImageFile(file);

    const stored = await this.persistFile(file);

    return this.prisma.ticketAttachment.create({
      data: {
        companyId: user.companyId,
        ticketId,
        uploadedByUserId: user.id,
        originalName: file.originalname,
        storageKey: stored.storageKey,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        url: stored.url,
      },
      select: this.attachmentSelect(),
    });
  }

  async deleteDraftAttachment(companyId: string, attachmentId: string) {
    const attachment = await this.prisma.ticketAttachment.findFirst({
      where: {
        id: attachmentId,
        companyId,
        ticketId: null,
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    await this.prisma.ticketAttachment.delete({ where: { id: attachment.id } });
    await this.removeStoredFile(attachment.storageKey);

    return { ok: true };
  }

  async deleteFromTicket(user: UserCtx, ticketId: string, attachmentId: string) {
    await this.assertTicketReadable(user, ticketId);

    const attachment = await this.prisma.ticketAttachment.findFirst({
      where: {
        id: attachmentId,
        companyId: user.companyId,
        ticketId,
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    await this.prisma.ticketAttachment.delete({ where: { id: attachment.id } });
    await this.removeStoredFile(attachment.storageKey);

    return { ok: true };
  }

  private async assertTicketReadable(user: UserCtx, ticketId: string) {
    const decision = this.policy.getOneWhere(user, ticketId);
    assertAllowed(decision);

    const ticket = await this.prisma.ticket.findFirst({
      where: decision.where,
      select: { id: true },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
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
    } satisfies Prisma.TicketAttachmentSelect;
  }

  private assertImageFile(file: any) {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    if (!file.mimetype || !String(file.mimetype).startsWith('image/')) {
      throw new BadRequestException('Only image uploads are supported');
    }

    if (!file.buffer || !file.size) {
      throw new BadRequestException('Uploaded file is empty');
    }
  }

  private async persistFile(file: any) {
    await mkdir(this.uploadsDir, { recursive: true });

    const ext = extname(file.originalname || '') || '.bin';
    const storageKey = `${randomUUID()}${ext}`;
    const absolutePath = join(this.uploadsDir, storageKey);

    await writeFile(absolutePath, file.buffer);

    return {
      storageKey,
      url: `/uploads/ticket-attachments/${storageKey}`,
    };
  }

  private async removeStoredFile(storageKey: string) {
    if (!storageKey) return;
    await rm(join(this.uploadsDir, storageKey), { force: true });
  }
}
