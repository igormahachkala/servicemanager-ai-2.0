import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import {
  InspectionReportStatus,
  InspectionRunItemStatus,
  InspectionRunStatus,
  Prisma,
  TicketUrgency,
} from '@prisma/client'
import { mkdir, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { extname, join } from 'path'

import { assertAllowed } from '../policy/policy.utils'
import { InspectionPolicy, type InspectionUserCtx } from '../policy/inspection.policy'
import { PrismaService } from '../prisma/prisma.service'
import { TicketsService } from '../tickets/tickets.service'
import { TimelineService } from '../timeline/timeline.service'

import { InspectionExportService } from './inspection.export.service'
import { CreateTemplateDto } from './dto/create-template.dto'
import { StartRunDto } from './dto/start-run.dto'
import { UpdateRunItemDto } from './dto/update-run-item.dto'
import { CreateTicketFromItemDto } from './dto/create-ticket-from-item.dto'
import { ReviewRunReportDto } from './dto/review-run-report.dto'
import {
  buildInspectionDocumentDate,
  buildInspectionReportNumber,
  buildInspectionRunSummary,
} from './inspection.report.mapper'

@Injectable()
export class InspectionService {
  private readonly policy = new InspectionPolicy()
  private readonly uploadsDir = join(process.cwd(), 'uploads', 'inspection-run-items')

  constructor(
    private readonly prisma: PrismaService,
    private readonly tickets: TicketsService,
    private readonly timeline: TimelineService,
    private readonly exporter: InspectionExportService,
  ) {}

  async listTemplates(user: InspectionUserCtx) {
    assertAllowed(this.policy.canStartRun(user))

    return this.prisma.inspectionTemplate.findMany({
      where: {
        companyId: user.companyId,
        isActive: true,
      },
      orderBy: [{ name: 'asc' }],
      select: templateSelect(),
    })
  }

  async createTemplate(user: InspectionUserCtx, dto: CreateTemplateDto) {
    assertAllowed(this.policy.canCreateTemplate(user))

    const name = dto.name.trim()
    const description = dto.description?.trim() || null
    if (!name) throw new BadRequestException('Template name is required')

    const items = dto.items
      .map((item, index) => ({
        title: item.title.trim(),
        description: item.description?.trim() || null,
        sortOrder: item.sortOrder ?? index,
        isRequired: item.isRequired ?? true,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder)

    if (items.length === 0) throw new BadRequestException('Template must contain at least one item')
    if (items.some((item) => !item.title)) {
      throw new BadRequestException('Template item title is required')
    }

    return this.prisma.inspectionTemplate.create({
      data: {
        companyId: user.companyId,
        name,
        description,
        items: { create: items },
      },
      select: templateSelect(),
    })
  }

  async listRuns(user: InspectionUserCtx) {
    assertAllowed(this.policy.canStartRun(user))

    return this.prisma.inspectionRun.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ createdAt: 'desc' }],
      take: 50,
      select: runListSelect(),
    })
  }

  async startRun(user: InspectionUserCtx, dto: StartRunDto) {
    assertAllowed(this.policy.canStartRun(user))

    const template = await this.prisma.inspectionTemplate.findFirst({
      where: { id: dto.templateId, companyId: user.companyId, isActive: true },
      select: {
        id: true,
        name: true,
        items: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            title: true,
            description: true,
            sortOrder: true,
            isRequired: true,
          },
        },
      },
    })
    if (!template) throw new NotFoundException('Inspection template not found')

    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, clientCompanyId: user.companyId },
      select: { id: true, name: true },
    })
    if (!location) throw new NotFoundException('Location not found')

    const equipment = dto.equipmentId
      ? await this.prisma.equipment.findFirst({
          where: { id: dto.equipmentId, companyId: user.companyId, locationId: location.id },
          select: { id: true },
        })
      : null

    if (dto.equipmentId && !equipment) {
      throw new NotFoundException('Equipment not found')
    }

    return this.prisma.inspectionRun.create({
      data: {
        companyId: user.companyId,
        templateId: template.id,
        locationId: location.id,
        equipmentId: equipment?.id ?? null,
        performedByUserId: user.id,
        title: dto.title?.trim() || template.name,
        status: InspectionRunStatus.IN_PROGRESS,
        items: {
          create: template.items.map((item) => ({
            templateItemId: item.id,
            title: item.title,
            description: item.description,
            sortOrder: item.sortOrder,
            isRequired: item.isRequired,
            status: InspectionRunItemStatus.PENDING,
            requiresRepair: false,
          })),
        },
      },
      select: runSelect(),
    })
  }

  async getRun(user: InspectionUserCtx, runId: string) {
    assertAllowed(this.policy.canStartRun(user))

    const run = await this.prisma.inspectionRun.findFirst({
      where: { id: runId, companyId: user.companyId },
      select: runSelect(),
    })

    if (!run) throw new NotFoundException('Inspection run not found')
    return run
  }

  async getRunReport(user: InspectionUserCtx, runId: string) {
    assertAllowed(this.policy.canStartRun(user))

    const run = await this.prisma.inspectionRun.findFirst({
      where: { id: runId, companyId: user.companyId },
      select: reportSelect(),
    })

    if (!run) throw new NotFoundException('Inspection run not found')

    return {
      run: {
        id: run.id,
        status: run.status,
        startedAt: run.createdAt,
        completedAt: run.completedAt,
        performedBy: run.performedBy,
        template: run.template,
        location: run.location,
        equipment: run.equipment,
      },
      document: {
        title: run.documentTitle || '\u0410\u043a\u0442 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043d\u044b\u0445 \u0440\u0430\u0431\u043e\u0442',
        number: run.reportNumber || buildInspectionReportNumber(run.createdAt, run.id),
        date: buildInspectionDocumentDate(run.reportDate || run.reportReviewedAt || run.reportSubmittedAt || run.completedAt || run.createdAt),
        executorCompany: {
          id: run.company.id,
          name: run.company.brandName || run.company.name,
          legalName: run.company.legalName,
          address: run.company.address,
          phone: run.company.phone,
          email: run.company.email,
          logoUrl: run.company.logoUrl,
          taxId: run.company.taxId,
          registrationNumber: run.company.registrationNumber,
          signatureLineName: run.company.signatureLineName,
          signatureLineTitle: run.company.signatureLineTitle,
        },
        clientCompany: {
          id: run.company.id,
          name: run.company.name,
          legalName: run.company.legalName,
          address: run.company.address,
          phone: run.company.phone,
          email: run.company.email,
        },
      },
      reportMeta: {
        status: run.reportStatus,
        submittedAt: run.reportSubmittedAt,
        submittedBy: run.reportSubmittedBy,
        reviewedAt: run.reportReviewedAt,
        reviewedBy: run.reportReviewedBy,
        reviewComment: run.reportReviewComment,
        approvedAt: run.reportStatus === InspectionReportStatus.APPROVED ? run.reportReviewedAt : null,
      },
      items: run.items,
      summary: buildInspectionRunSummary(
        run.items.map((item) => ({
          status: item.status,
          requiresRepair: item.requiresRepair,
          ticketId: item.ticket?.id ?? item.ticketId ?? null,
        })),
      ),
    }
  }

  async exportRunReport(user: InspectionUserCtx, runId: string, format?: string) {
    const report = await this.getRunReport(user, runId)
    return this.exporter.exportReport(report as any, format)
  }

  async submitRunReport(user: InspectionUserCtx, runId: string) {
    assertAllowed(this.policy.canSubmitReport(user))

    const run = await this.prisma.inspectionRun.findFirst({
      where: { id: runId, companyId: user.companyId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        reportStatus: true,
        reportNumber: true,
        reportDate: true,
        documentTitle: true,
      },
    })

    if (!run) throw new NotFoundException('Inspection run not found')
    if (run.status !== InspectionRunStatus.COMPLETED) {
      throw new BadRequestException('Only completed inspection runs can be submitted')
    }
    if (run.reportStatus === InspectionReportStatus.APPROVED) {
      throw new BadRequestException('Approved report cannot be submitted again')
    }
    if (run.reportStatus === InspectionReportStatus.SUBMITTED) {
      throw new BadRequestException('Inspection report is already submitted')
    }

    await this.prisma.inspectionRun.update({
      where: { id: run.id },
      data: {
        reportStatus: InspectionReportStatus.SUBMITTED,
        reportSubmittedAt: new Date(),
        reportSubmittedByUserId: user.id,
        reportReviewedAt: null,
        reportReviewedByUserId: null,
        reportReviewComment: null,
        reportNumber: run.reportNumber ?? buildInspectionReportNumber(run.createdAt, run.id),
        reportDate: run.reportDate ?? new Date(),
        documentTitle: run.documentTitle ?? '\u0410\u043a\u0442 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043d\u044b\u0445 \u0440\u0430\u0431\u043e\u0442',
      },
    })

    await this.timeline.recordLegacy({
      type: 'inspection.report_submitted',
      companyId: user.companyId,
      entityType: 'InspectionRun',
      entityId: run.id,
      actorUserId: user.id,
      payload: {
        runId: run.id,
        reportStatus: InspectionReportStatus.SUBMITTED,
      },
    })

    return this.getRunReport(user, run.id)
  }

  async reviewRunReport(user: InspectionUserCtx, runId: string, dto: ReviewRunReportDto) {
    assertAllowed(this.policy.canReviewReport(user))

    const run = await this.prisma.inspectionRun.findFirst({
      where: { id: runId, companyId: user.companyId },
      select: {
        id: true,
        status: true,
        reportStatus: true,
        reportDate: true,
        documentTitle: true,
      },
    })

    if (!run) throw new NotFoundException('Inspection run not found')
    if (run.status !== InspectionRunStatus.COMPLETED) {
      throw new BadRequestException('Only completed inspection runs can be reviewed')
    }
    if (run.reportStatus !== InspectionReportStatus.SUBMITTED) {
      throw new BadRequestException('Only submitted inspection reports can be reviewed')
    }

    const decision = dto.decision as 'APPROVED' | 'REJECTED'
    const comment = dto.comment?.trim() || null

    if (decision === InspectionReportStatus.REJECTED && !comment) {
      throw new BadRequestException('Comment is required when returning the report')
    }

    await this.prisma.inspectionRun.update({
      where: { id: run.id },
      data: {
        reportStatus: decision,
        reportReviewedAt: new Date(),
        reportReviewedByUserId: user.id,
        reportReviewComment: comment,
        reportDate:
          decision === InspectionReportStatus.APPROVED
            ? run.reportDate ?? new Date()
            : run.reportDate,
        documentTitle: run.documentTitle ?? '\u0410\u043a\u0442 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043d\u044b\u0445 \u0440\u0430\u0431\u043e\u0442',
      },
    })

    await this.timeline.recordLegacy({
      type: 'inspection.report_reviewed',
      companyId: user.companyId,
      entityType: 'InspectionRun',
      entityId: run.id,
      actorUserId: user.id,
      payload: {
        runId: run.id,
        decision,
        comment,
      },
    })

    return this.getRunReport(user, run.id)
  }

  async updateRunItem(user: InspectionUserCtx, runId: string, itemId: string, dto: UpdateRunItemDto) {
    assertAllowed(this.policy.canUpdateRunItem(user))

    if (dto.status === undefined && dto.comment === undefined && dto.requiresRepair === undefined) {
      throw new BadRequestException('At least one field must be provided')
    }

    const { item } = await this.getMutableRunItem(user.companyId, runId, itemId)

    const nextStatus = (dto.status as InspectionRunItemStatus | undefined) ?? item.status
    let nextRequiresRepair = dto.requiresRepair ?? item.requiresRepair

    if (nextStatus === InspectionRunItemStatus.OK && dto.requiresRepair === undefined) {
      nextRequiresRepair = false
    }

    if (
      nextRequiresRepair &&
      nextStatus !== InspectionRunItemStatus.ISSUE &&
      nextStatus !== InspectionRunItemStatus.CRITICAL
    ) {
      throw new BadRequestException('requiresRepair is allowed only for ISSUE or CRITICAL items')
    }

    return this.prisma.inspectionRunItem.update({
      where: { id: item.id },
      data: {
        status: nextStatus,
        requiresRepair: nextRequiresRepair,
        comment: dto.comment?.trim() || null,
      },
      select: runItemSelect(),
    })
  }

  async uploadRunItemAttachment(user: InspectionUserCtx, runId: string, itemId: string, file: any) {
    assertAllowed(this.policy.canUploadAttachment(user))

    const { item } = await this.getMutableRunItem(user.companyId, runId, itemId)
    this.assertImageFile(file)

    const stored = await this.persistFile(file)

    return this.prisma.inspectionRunItemAttachment.create({
      data: {
        companyId: user.companyId,
        runItemId: item.id,
        originalName: file.originalname,
        storageKey: stored.storageKey,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        url: stored.url,
      },
      select: attachmentSelect(),
    })
  }

  async createTicketFromItem(user: InspectionUserCtx, runId: string, itemId: string, dto: CreateTicketFromItemDto) {
    assertAllowed(this.policy.canCreateTicket(user))

    const { run, item } = await this.getMutableRunItem(user.companyId, runId, itemId)

    if (
      item.status !== InspectionRunItemStatus.ISSUE &&
      item.status !== InspectionRunItemStatus.CRITICAL
    ) {
      throw new BadRequestException('Ticket can be created only for ISSUE or CRITICAL items')
    }

    if (item.ticketId) {
      throw new BadRequestException('Ticket has already been created for this inspection item')
    }

    const created = await this.tickets.create(user.companyId, user.role, {
      locationId: run.locationId,
      equipmentId: run.equipmentId ?? undefined,
      categoryId: dto.categoryId,
      title: dto.title?.trim() || item.title,
      description: dto.description?.trim() || item.comment || item.description || item.title,
      urgency:
        dto.urgency ??
        (item.status === InspectionRunItemStatus.CRITICAL ? TicketUrgency.URGENT : TicketUrgency.NOT_URGENT),
    })

    const ticketId = created.ticket.id

    const updatedItem = await this.prisma.inspectionRunItem.update({
      where: { id: item.id },
      data: {
        ticketId,
        requiresRepair: true,
      },
      select: runItemSelect(),
    })

    await this.timeline.recordLegacy({
      type: 'inspection.item_ticket_created',
      companyId: user.companyId,
      entityType: 'InspectionRunItem',
      entityId: item.id,
      actorUserId: user.id,
      payload: {
        runId: run.id,
        itemId: item.id,
        templateItemId: item.templateItemId,
        ticketId,
        status: item.status,
        requiresRepair: true,
      },
    })

    return {
      item: updatedItem,
      ticket: created.ticket,
      generated: created.generated,
      autoAssigned: created.autoAssigned,
    }
  }

  async completeRun(user: InspectionUserCtx, runId: string) {
    assertAllowed(this.policy.canCompleteRun(user))

    const run = await this.prisma.inspectionRun.findFirst({
      where: { id: runId, companyId: user.companyId },
      select: {
        id: true,
        status: true,
      },
    })

    if (!run) throw new NotFoundException('Inspection run not found')
    if (run.status === InspectionRunStatus.COMPLETED) {
      throw new BadRequestException('Inspection run is already completed')
    }

    const updated = await this.prisma.inspectionRun.update({
      where: { id: run.id },
      data: { status: InspectionRunStatus.COMPLETED, completedAt: new Date() },
      select: runSelect(),
    })

    return {
      run: updated,
      summary: buildInspectionRunSummary(updated.items),
    }
  }

  private async getMutableRunItem(companyId: string, runId: string, itemId: string) {
    const run = await this.prisma.inspectionRun.findFirst({
      where: { id: runId, companyId },
      select: {
        id: true,
        locationId: true,
        equipmentId: true,
        status: true,
      },
    })

    if (!run) throw new NotFoundException('Inspection run not found')
    if (run.status === InspectionRunStatus.COMPLETED) {
      throw new BadRequestException('Inspection run is already completed')
    }

    const item = await this.prisma.inspectionRunItem.findFirst({
      where: { id: itemId, runId: run.id, run: { companyId } },
      select: {
        id: true,
        templateItemId: true,
        title: true,
        description: true,
        status: true,
        requiresRepair: true,
        comment: true,
        ticketId: true,
      },
    })

    if (!item) throw new NotFoundException('Inspection run item not found')
    return { run, item }
  }

  private assertImageFile(file: any) {
    if (!file) throw new BadRequestException('file is required')
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
    await writeFile(join(this.uploadsDir, storageKey), file.buffer)

    return {
      storageKey,
      url: `/uploads/inspection-run-items/${storageKey}`,
    }
  }
}

function templateSelect() {
  return {
    id: true,
    companyId: true,
    name: true,
    description: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    items: {
      orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
      select: {
        id: true,
        title: true,
        description: true,
        sortOrder: true,
        isRequired: true,
        createdAt: true,
        updatedAt: true,
      },
    },
  } satisfies Prisma.InspectionTemplateSelect
}

function attachmentSelect() {
  return {
    id: true,
    runItemId: true,
    originalName: true,
    mimeType: true,
    sizeBytes: true,
    url: true,
    createdAt: true,
  } satisfies Prisma.InspectionRunItemAttachmentSelect
}

function runItemSelect() {
  return {
    id: true,
    runId: true,
    templateItemId: true,
    title: true,
    description: true,
    sortOrder: true,
    isRequired: true,
    status: true,
    requiresRepair: true,
    comment: true,
    ticketId: true,
    createdAt: true,
    updatedAt: true,
    ticket: {
      select: {
        id: true,
        status: true,
        urgency: true,
        createdAt: true,
      },
    },
    attachments: {
      orderBy: [{ createdAt: 'asc' as const }],
      select: attachmentSelect(),
    },
  } satisfies Prisma.InspectionRunItemSelect
}

function runSelect() {
  return {
    id: true,
    companyId: true,
    templateId: true,
    locationId: true,
    equipmentId: true,
    title: true,
    status: true,
    reportStatus: true,
    reportSubmittedAt: true,
    reportReviewedAt: true,
    completedAt: true,
    createdAt: true,
    updatedAt: true,
    performedBy: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    },
    template: { select: { id: true, name: true } },
    location: {
      select: { id: true, name: true, city: true, address: true, platformCode: true },
    },
    equipment: {
      select: { id: true, name: true, type: true, status: true },
    },
    items: {
      orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
      select: runItemSelect(),
    },
  } satisfies Prisma.InspectionRunSelect
}

function reportSelect() {
  return {
    id: true,
    status: true,
    reportStatus: true,
    reportNumber: true,
    reportDate: true,
    documentTitle: true,
    reportSubmittedAt: true,
    reportReviewedAt: true,
    reportReviewComment: true,
    completedAt: true,
    createdAt: true,
    performedBy: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    },
    reportSubmittedBy: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    },
    reportReviewedBy: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    },
    template: {
      select: {
        id: true,
        name: true,
      },
    },
    company: {
      select: {
        id: true,
        name: true,
        brandName: true,
        legalName: true,
        address: true,
        phone: true,
        email: true,
        logoUrl: true,
        taxId: true,
        registrationNumber: true,
        signatureLineName: true,
        signatureLineTitle: true,
      },
    },
    location: {
      select: {
        id: true,
        name: true,
        platformCode: true,
        city: true,
        address: true,
      },
    },
    equipment: {
      select: {
        id: true,
        name: true,
        type: true,
      },
    },
    items: {
      orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        comment: true,
        requiresRepair: true,
        ticketId: true,
        attachments: {
          orderBy: [{ createdAt: 'asc' as const }],
          select: {
            id: true,
            url: true,
            mimeType: true,
            originalName: true,
          },
        },
        ticket: {
          select: {
            id: true,
            status: true,
            problemText: true,
          },
        },
      },
    },
  } satisfies Prisma.InspectionRunSelect
}

function runListSelect() {
  return {
    id: true,
    title: true,
    status: true,
    reportStatus: true,
    completedAt: true,
    createdAt: true,
    updatedAt: true,
    template: { select: { id: true, name: true } },
    location: { select: { id: true, name: true, city: true } },
    equipment: { select: { id: true, name: true } },
    _count: { select: { items: true } },
  } satisfies Prisma.InspectionRunSelect
}