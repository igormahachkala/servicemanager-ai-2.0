import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import {
  InspectionCheckpointResponseType,
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
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { TicketsService } from '../tickets/tickets.service'
import { TimelineService } from '../timeline/timeline.service'
import { ShiftPolicyService } from '../workforce/shift-policy.service'

import {
  assertInspectionLocationAccess,
  resolveInspectionLocationAccess,
  type InspectionLocationRef,
} from './inspection-location-scope'

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
    private readonly serviceContracts: ServiceContractsService,
    private readonly shiftPolicy: ShiftPolicyService,
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
        zoneName: item.zoneName?.trim() || null,
        zoneSortOrder: item.zoneSortOrder ?? 0,
        checkpointSortOrder: item.checkpointSortOrder ?? item.sortOrder ?? index,
        responseType: item.responseType ?? InspectionCheckpointResponseType.NORMAL_PROBLEM,
        numericMin: item.numericMin ?? null,
        numericMax: item.numericMax ?? null,
        numericUnit: item.numericUnit?.trim() || null,
        isRequired: item.isRequired ?? true,
      }))
      .sort(
        (a, b) =>
          a.zoneSortOrder - b.zoneSortOrder ||
          a.checkpointSortOrder - b.checkpointSortOrder ||
          a.sortOrder - b.sortOrder,
      )

    if (items.length === 0) throw new BadRequestException('Template must contain at least one item')
    if (items.some((item) => !item.title)) {
      throw new BadRequestException('Template item title is required')
    }
    for (const item of items) {
      if (item.responseType !== InspectionCheckpointResponseType.NUMBER) {
        if (item.numericMin !== null || item.numericMax !== null || item.numericUnit !== null) {
          throw new BadRequestException('Numeric limits are allowed only for NUMBER checkpoints')
        }
      }
      if (item.numericMin !== null && item.numericMax !== null && item.numericMin > item.numericMax) {
        throw new BadRequestException('numericMin cannot be greater than numericMax')
      }
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

    const runs = await this.prisma.inspectionRun.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ createdAt: 'desc' }],
      take: 50,
      select: runListSelect(),
    })

    /**
     * 097: `companyId` is the executing company, so this list already excludes other tenants'
     * runs. What it cannot express is a provider run whose authorising contract has since
     * lapsed or had the location removed from its scope. Those are dropped here so the list
     * fails closed the same way the single-run paths do. Runs at the actor's own locations
     * skip the check entirely, so the client-owned path issues no extra queries.
     */
    return this.filterRunsByLocationScope(user, runs)
  }

  async startRun(user: InspectionUserCtx, dto: StartRunDto) {
    assertAllowed(this.policy.canStartRun(user))
    await this.shiftPolicy.assertActiveShiftForOperationalWork(user)

    const template = await this.prisma.inspectionTemplate.findFirst({
      where: { id: dto.templateId, companyId: user.companyId, isActive: true },
      select: {
        id: true,
        name: true,
        items: {
          orderBy: [
            { zoneSortOrder: 'asc' },
            { checkpointSortOrder: 'asc' },
            { sortOrder: 'asc' },
            { createdAt: 'asc' },
          ],
          select: {
            id: true,
            title: true,
            description: true,
            sortOrder: true,
            zoneName: true,
            zoneSortOrder: true,
            checkpointSortOrder: true,
            responseType: true,
            numericMin: true,
            numericMax: true,
            numericUnit: true,
            isRequired: true,
          },
        },
      },
    })
    if (!template) throw new NotFoundException('Inspection template not found')

    /**
     * 097: the location is no longer required to belong to the actor's own company. It is
     * looked up on its own and then authorised through the canonical contract primitives, so
     * a provider can run its template at a permitted client location. For a client acting on
     * its own location the check short-circuits to tenant-wide self-access and the outcome is
     * identical to the pre-097 `clientCompanyId: user.companyId` filter.
     */
    let location = await this.prisma.location.findFirst({
      where: { id: dto.locationId },
      select: { id: true, name: true, clientCompanyId: true },
    })
    if (!location) throw new NotFoundException('Location not found')
    if (!location.clientCompanyId) {
      const ownCompanyLocation = await this.prisma.location.findFirst({
        where: { id: dto.locationId, clientCompanyId: user.companyId },
        select: { id: true, name: true, clientCompanyId: true },
      })
      if (ownCompanyLocation) {
        location = {
          ...ownCompanyLocation,
          clientCompanyId: ownCompanyLocation.clientCompanyId || user.companyId,
        }
      }
    }

    const locationAccess = await assertInspectionLocationAccess({
      serviceContracts: this.serviceContracts,
      actorCompanyId: user.companyId,
      location,
      notFoundMessage: 'Location not found',
    })

    /**
     * Equipment belongs to the company that owns the site, not to the executing company.
     * Scoping it by the resolved client company keeps the equipment tenant correct in both
     * the client-owned and the provider-executed case.
     */
    const equipment = dto.equipmentId
      ? await this.prisma.equipment.findFirst({
          where: {
            id: dto.equipmentId,
            companyId: locationAccess.clientCompanyId,
            locationId: location.id,
          },
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
            zoneName: item.zoneName,
            zoneSortOrder: item.zoneSortOrder,
            checkpointSortOrder: item.checkpointSortOrder,
            responseType: item.responseType,
            numericMin: item.numericMin,
            numericMax: item.numericMax,
            numericUnit: item.numericUnit,
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
    await this.assertRunLocationStillInScope(user, run)
    return run
  }

  async getRunReport(user: InspectionUserCtx, runId: string) {
    assertAllowed(this.policy.canStartRun(user))

    const run = await this.prisma.inspectionRun.findFirst({
      where: { id: runId, companyId: user.companyId },
      select: reportSelect(),
    })

    if (!run) throw new NotFoundException('Inspection run not found')
    await this.assertRunLocationStillInScope(user, run)

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
        /**
         * 097: the client of the act is the company that owns the site, not the company that
         * performed the round. They coincide for a client-owned run — the pre-097 case — and
         * differ when a provider inspects a client location. Reading it off the location keeps
         * the document correct in both.
         */
        clientCompany: {
          id: run.location?.clientCompany?.id ?? run.company.id,
          name: run.location?.clientCompany?.name ?? run.company.name,
          legalName: run.location?.clientCompany?.legalName ?? run.company.legalName,
          address: run.location?.clientCompany?.address ?? run.company.address,
          phone: run.location?.clientCompany?.phone ?? run.company.phone,
          email: run.location?.clientCompany?.email ?? run.company.email,
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
        location: { select: { id: true, clientCompanyId: true } },
      },
    })

    if (!run) throw new NotFoundException('Inspection run not found')
    await this.assertRunLocationStillInScope(user, run)
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
        location: { select: { id: true, clientCompanyId: true } },
      },
    })

    if (!run) throw new NotFoundException('Inspection run not found')
    await this.assertRunLocationStillInScope(user, run)
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

    if (
      dto.status === undefined &&
      dto.comment === undefined &&
      dto.requiresRepair === undefined &&
      dto.booleanValue === undefined &&
      dto.numberValue === undefined &&
      dto.textValue === undefined
    ) {
      throw new BadRequestException('At least one field must be provided')
    }

    const { item } = await this.getMutableRunItem(user, runId, itemId)

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
    if (dto.booleanValue !== undefined && item.responseType !== InspectionCheckpointResponseType.YES_NO) {
      throw new BadRequestException('booleanValue is allowed only for YES_NO checkpoints')
    }
    if (dto.numberValue !== undefined) {
      if (item.responseType !== InspectionCheckpointResponseType.NUMBER) {
        throw new BadRequestException('numberValue is allowed only for NUMBER checkpoints')
      }
      if (item.numericMin !== null && dto.numberValue < item.numericMin) {
        throw new BadRequestException('numberValue is below checkpoint minimum')
      }
      if (item.numericMax !== null && dto.numberValue > item.numericMax) {
        throw new BadRequestException('numberValue is above checkpoint maximum')
      }
    }
    if (dto.textValue !== undefined && item.responseType !== InspectionCheckpointResponseType.TEXT) {
      throw new BadRequestException('textValue is allowed only for TEXT checkpoints')
    }

    return this.prisma.inspectionRunItem.update({
      where: { id: item.id },
      data: {
        status: nextStatus,
        requiresRepair: nextRequiresRepair,
        comment: dto.comment === undefined ? undefined : dto.comment.trim() || null,
        booleanValue: dto.booleanValue,
        numberValue: dto.numberValue,
        textValue: dto.textValue === undefined ? undefined : dto.textValue.trim() || null,
      },
      select: runItemSelect(),
    })
  }

  async uploadRunItemAttachment(user: InspectionUserCtx, runId: string, itemId: string, file: any) {
    assertAllowed(this.policy.canUploadAttachment(user))

    const { item } = await this.getMutableRunItem(user, runId, itemId)
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

    const { run, item } = await this.getMutableRunItem(user, runId, itemId)

    if (
      item.status !== InspectionRunItemStatus.ISSUE &&
      item.status !== InspectionRunItemStatus.CRITICAL
    ) {
      throw new BadRequestException('Ticket can be created only for ISSUE or CRITICAL items')
    }

    if (item.ticketId) {
      throw new BadRequestException('Ticket has already been created for this inspection item')
    }

    const created = await this.tickets.create(user.companyId, { id: user.id, role: user.role }, {
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
        location: { select: { id: true, clientCompanyId: true } },
      },
    })

    if (!run) throw new NotFoundException('Inspection run not found')
    await this.assertRunLocationStillInScope(user, run)
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

  /**
   * 097: re-checks that the actor may still work at the run's location.
   *
   * Creation-time authorisation is not enough: a contract can expire, be revoked, or have the
   * location dropped from a SELECTED_LOCATIONS scope after the run was started. Runs at the
   * actor's own locations return immediately, so nothing changes for client-owned Rounds.
   */
  private async assertRunLocationStillInScope(
    user: InspectionUserCtx,
    run: { location?: InspectionLocationRef | null },
  ) {
    const location = run.location
    if (!location || location.clientCompanyId === user.companyId) return

    await assertInspectionLocationAccess({
      serviceContracts: this.serviceContracts,
      actorCompanyId: user.companyId,
      location,
      notFoundMessage: 'Inspection run not found',
    })
  }

  private async filterRunsByLocationScope<T extends { location?: InspectionLocationRef | null }>(
    user: InspectionUserCtx,
    runs: T[],
  ): Promise<T[]> {
    // One decision per distinct client location, not per run: a page of 50 rounds at the same
    // site must not turn into 50 identical contract lookups.
    const decisions = new Map<string, boolean>()
    const visible: T[] = []

    for (const run of runs) {
      const location = run.location
      if (!location || location.clientCompanyId === user.companyId) {
        visible.push(run)
        continue
      }

      const key = `${location.clientCompanyId}:${location.id}`
      let allowed = decisions.get(key)
      if (allowed === undefined) {
        allowed = !!(await resolveInspectionLocationAccess({
          serviceContracts: this.serviceContracts,
          actorCompanyId: user.companyId,
          location,
        }))
        decisions.set(key, allowed)
      }

      if (allowed) visible.push(run)
    }

    return visible
  }

  private async getMutableRunItem(user: InspectionUserCtx, runId: string, itemId: string) {
    const companyId = user.companyId
    const run = await this.prisma.inspectionRun.findFirst({
      where: { id: runId, companyId },
      select: {
        id: true,
        locationId: true,
        equipmentId: true,
        status: true,
        location: { select: { id: true, clientCompanyId: true } },
      },
    })

    if (!run) throw new NotFoundException('Inspection run not found')
    await this.assertRunLocationStillInScope(user, run)
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
        responseType: true,
        numericMin: true,
        numericMax: true,
        status: true,
        requiresRepair: true,
        comment: true,
        ticketId: true,
      },
    })

    if (!item) throw new NotFoundException('Inspection run item not found')
    return { run, item }
  }

  private static readonly ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ])

  private assertImageFile(file: any) {
    if (!file) throw new BadRequestException('file is required')
    const mime = String(file.mimetype || '').toLowerCase()
    if (!InspectionService.ALLOWED_MIME_TYPES.has(mime)) {
      throw new BadRequestException('Only JPEG, PNG, WebP, HEIC and HEIF images are supported')
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
      orderBy: [
        { zoneSortOrder: 'asc' as const },
        { checkpointSortOrder: 'asc' as const },
        { sortOrder: 'asc' as const },
        { createdAt: 'asc' as const },
      ],
      select: {
        id: true,
        title: true,
        description: true,
        sortOrder: true,
        zoneName: true,
        zoneSortOrder: true,
        checkpointSortOrder: true,
        responseType: true,
        numericMin: true,
        numericMax: true,
        numericUnit: true,
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
    zoneName: true,
    zoneSortOrder: true,
    checkpointSortOrder: true,
    responseType: true,
    numericMin: true,
    numericMax: true,
    numericUnit: true,
    booleanValue: true,
    numberValue: true,
    textValue: true,
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
        // Номер заявки нужен обходу, чтобы показать связь «пункт → заявка»
        // человеку: id — uuid, по нему в разговоре заявку не назовёшь.
        // Берётся из канонического Ticket, второй нумерации не заводится.
        ticketNumber: true,
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
      select: { id: true, clientCompanyId: true, name: true, city: true, address: true, platformCode: true },
    },
    equipment: {
      select: { id: true, name: true, type: true, status: true },
    },
    items: {
      orderBy: [
        { zoneSortOrder: 'asc' as const },
        { checkpointSortOrder: 'asc' as const },
        { sortOrder: 'asc' as const },
        { createdAt: 'asc' as const },
      ],
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
        clientCompanyId: true,
        name: true,
        platformCode: true,
        city: true,
        address: true,
        // 097: the act's client party comes from the site owner, not from the executing company.
        clientCompany: {
          select: {
            id: true,
            name: true,
            legalName: true,
            address: true,
            phone: true,
            email: true,
          },
        },
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
      orderBy: [
        { zoneSortOrder: 'asc' as const },
        { checkpointSortOrder: 'asc' as const },
        { sortOrder: 'asc' as const },
        { createdAt: 'asc' as const },
      ],
      select: {
        id: true,
        title: true,
        description: true,
        zoneName: true,
        zoneSortOrder: true,
        checkpointSortOrder: true,
        responseType: true,
        numericMin: true,
        numericMax: true,
        numericUnit: true,
        booleanValue: true,
        numberValue: true,
        textValue: true,
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
    location: { select: { id: true, clientCompanyId: true, name: true, city: true } },
    equipment: { select: { id: true, name: true } },
    _count: { select: { items: true } },
  } satisfies Prisma.InspectionRunSelect
}
