import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import {
  InspectionCheckpointResponseType,
  InspectionReportStatus,
  InspectionRunItemStatus,
  InspectionRunStatus,
  Prisma,
  TicketUrgency,
} from '@prisma/client'
import { mkdir, rm, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { extname, join } from 'path'

import { assertAllowed } from '../policy/policy.utils'
import { InspectionPolicy, type InspectionUserCtx } from '../policy/inspection.policy'
import { PrismaService } from '../prisma/prisma.service'
import { IdempotencyService } from '../common/idempotency/idempotency.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { TicketsService } from '../tickets/tickets.service'
import { assertActorCanUseLocation, assertActorCanUseProblemCategory } from '../tickets/ticket-access.utils'
import { TimelineService } from '../timeline/timeline.service'
import { ShiftPolicyService } from '../workforce/shift-policy.service'

import {
  assertInspectionLocationAccess,
  resolveInspectionLocationAccess,
  type InspectionLocationRef,
} from './inspection-location-scope'

import { InspectionExportService } from './inspection.export.service'
import { CreateTemplateDto } from './dto/create-template.dto'
import { UpdateTemplateDto } from './dto/update-template.dto'
import { ListRunsDto } from './dto/list-runs.dto'
import { StartRunDto } from './dto/start-run.dto'
import { UpdateRunItemDto } from './dto/update-run-item.dto'
import { CreateTicketFromItemDto } from './dto/create-ticket-from-item.dto'
import { ReviewRunReportDto } from './dto/review-run-report.dto'
import {
  buildInspectionDocumentDate,
  buildInspectionReportNumber,
  buildInspectionRunSummary,
} from './inspection.report.mapper'

/**
 * SMA-PLANNER-SCHEDULE-RUN-LINK-HARDENING-119T — ключ идемпотентности запуска по плану.
 *
 * Ключ обязан различать две разные вещи: повтор одного и того же запуска и
 * законный следующий визит по тому же плану. Одного scheduleId для этого мало —
 * он одинаков и там, и там, и повтор через сутки вернул бы вчерашний обход.
 *
 * Различителем служит lastRunId: до первого визита он пуст, после каждого
 * успешного запуска указывает на созданный обход. Значит все попытки одного
 * визита видят одно и то же значение и схлопываются в один обход, а следующий
 * визит приходит уже с другим ключом и выполняется заново.
 *
 * Чего этот ключ не закрывает: запись идемпотентности уникальна в пределах
 * (companyId, userId, operationType, key), то есть защищает одного актора.
 * Одновременный запуск двумя разными акторами (техник и менеджер) ключами не
 * пересекается; его ловит проверка незакрытого обхода внутри транзакции, но
 * полностью закрыть эту гонку без частичного уникального индекса в БД нельзя.
 * Такой миграции в этой задаче намеренно нет — она относится к слайсу
 * генератора, где столкновение акторов становится вероятным.
 */
function scheduledStartKey(schedule: { id: string; lastRunId: string | null }): string {
  return `${schedule.id}:${schedule.lastRunId ?? 'initial'}`
}

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
    /** 113B: optional so existing unit tests constructing this service directly keep working. */
    private readonly idempotency?: IdempotencyService,
    /** 117B: optional in direct unit construction; runtime wires the canonical policy service. */
    private readonly shiftPolicy?: ShiftPolicyService,
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

    const name = this.normalizeTemplateName(dto.name)
    const description = this.normalizeTemplateDescription(dto.description)
    const items = this.normalizeTemplateItems(dto.items)

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

  async updateTemplate(user: InspectionUserCtx, templateId: string, dto: UpdateTemplateDto) {
    assertAllowed(this.policy.canCreateTemplate(user))

    const data: Prisma.InspectionTemplateUpdateInput = {}
    const items = dto.items === undefined ? undefined : this.normalizeTemplateItems(dto.items)
    if (dto.name !== undefined) data.name = this.normalizeTemplateName(dto.name)
    if (dto.description !== undefined) {
      data.description = this.normalizeTemplateDescription(dto.description)
    }

    if (Object.keys(data).length === 0 && items === undefined) {
      throw new BadRequestException('At least one template field must be provided')
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.inspectionTemplate.findFirst({
        where: { id: templateId, companyId: user.companyId, isActive: true },
        select: {
          id: true,
          updatedAt: true,
          items: { select: { id: true } },
        },
      })
      if (!existing) throw new NotFoundException('Inspection template not found')

      if (dto.updatedAt) {
        const expected = new Date(dto.updatedAt)
        if (Number.isNaN(expected.getTime())) {
          throw new BadRequestException('updatedAt is invalid')
        }
        if (existing.updatedAt.getTime() !== expected.getTime()) {
          throw new ConflictException('Template has been changed. Refresh the page and try again')
        }
      }

      if (items !== undefined) {
        const existingItemIds = new Set(existing.items.map((item) => item.id))
        const providedItemIds = items.map((item) => item.id).filter((id): id is string => Boolean(id))
        if (new Set(providedItemIds).size !== providedItemIds.length) {
          throw new BadRequestException('Template item ids must be unique')
        }
        const foreignItemId = providedItemIds.find((id) => !existingItemIds.has(id))
        if (foreignItemId) {
          throw new BadRequestException('Template item does not belong to template')
        }

        await tx.inspectionTemplateItem.deleteMany({
          where: {
            templateId: existing.id,
            id: providedItemIds.length ? { notIn: providedItemIds } : undefined,
          },
        })

        for (const item of items) {
          const { id, ...itemData } = item
          if (id) {
            await tx.inspectionTemplateItem.update({
              where: { id },
              data: itemData,
            })
          } else {
            await tx.inspectionTemplateItem.create({
              data: {
                ...itemData,
                templateId: existing.id,
              },
            })
          }
        }
      }

      return tx.inspectionTemplate.update({
        where: { id: existing.id },
        data: Object.keys(data).length > 0 ? data : { updatedAt: new Date() },
        select: templateSelect(),
      })
    })
  }

  async listRuns(user: InspectionUserCtx, filters: ListRunsDto = {}) {
    assertAllowed(this.policy.canStartRun(user))

    /**
     * 116F: фильтры истории. Каждое условие опирается на существующее поле записи
     * и существующий индекс; ничего нового в домен ради фильтрации не вводится.
     * Окно по времени берётся от createdAt — это и есть момент старта обхода,
     * отдельного startedAt в модели нет.
     */
    const createdAt: Prisma.DateTimeFilter = {}
    if (filters.from) createdAt.gte = new Date(filters.from)
    if (filters.to) createdAt.lte = new Date(filters.to)

    const runs = await this.prisma.inspectionRun.findMany({
      where: {
        companyId: user.companyId,
        ...(filters.locationId ? { locationId: filters.locationId } : {}),
        ...(filters.performedByUserId ? { performedByUserId: filters.performedByUserId } : {}),
        ...(filters.templateId ? { templateId: filters.templateId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.reportStatus ? { reportStatus: filters.reportStatus } : {}),
        ...(Object.keys(createdAt).length ? { createdAt } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: filters.limit ?? 50,
      select: runListSelect(),
    })

    /**
     * 097: `companyId` is the executing company, so this list already excludes other tenants'
     * runs. What it cannot express is a provider run whose authorising contract has since
     * lapsed or had the location removed from its scope. Those are dropped here so the list
     * fails closed the same way the single-run paths do. Runs at the actor's own locations
     * skip the check entirely, so the client-owned path issues no extra queries.
     */
    const scoped = await this.filterRunsByLocationScope(user, runs)
    return scoped.map((run) => summarizeRunItems(run))
  }

  async startRun(user: InspectionUserCtx, dto: StartRunDto) {
    assertAllowed(this.policy.canStartRun(user))

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
            defaultCategoryId: true,
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

    await assertActorCanUseLocation({
      prisma: this.prisma,
      actor: user,
      scopeCompanyId: locationAccess.clientCompanyId,
      locationId: location.id,
    })
    await this.assertActiveShiftForRoundMutation(user)

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

    const schedule = await this.resolveScheduleForRun(user, dto, {
      templateId: template.id,
      locationId: location.id,
      equipmentId: equipment?.id ?? null,
    })
    const categorySnapshots = await this.resolveDefaultCategorySnapshots(
      user,
      locationAccess.clientCompanyId,
      template.items,
    )

    const data: Prisma.InspectionRunUncheckedCreateInput = {
      companyId: user.companyId,
      templateId: template.id,
      locationId: location.id,
      equipmentId: equipment?.id ?? null,
      performedByUserId: user.id,
      title: dto.title?.trim() || template.name,
      status: InspectionRunStatus.IN_PROGRESS,
      /**
       * 119K: план и исполнение связываются здесь, полями, которые в схеме уже есть.
       * Без расписания оба поля остаются пустыми — ровно как до этой задачи.
       */
      scheduleId: schedule?.id ?? null,
      dueAt: schedule?.nextDueAt ?? null,
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
          defaultCategoryId: categorySnapshots.get(item.id)?.id ?? null,
          defaultCategoryName: categorySnapshots.get(item.id)?.name ?? null,
          isRequired: item.isRequired,
          status: InspectionRunItemStatus.PENDING,
          requiresRepair: false,
        })),
      },
    }

    if (!schedule) {
      return this.prisma.inspectionRun.create({ data, select: runSelect() })
    }

    const resolved = {
      templateId: template.id,
      locationId: location.id,
      equipmentId: equipment?.id ?? null,
    }

    /**
     * 119T: повтор того же запуска не должен создавать второй обход.
     *
     * Механизм переиспользуется существующий — IdempotencyService (113B), уже
     * внедрённый в этот сервис для вложений и заявок. Второго механизма здесь
     * не заводится: ключ и отпечаток строятся по тем же правилам, что и там.
     */
    if (!this.idempotency) {
      return this.createScheduledRun(user, schedule, data, resolved)
    }

    const outcome = await this.idempotency.run<any>(
      {
        companyId: user.companyId,
        userId: user.id,
        operationType: 'inspection.start_run',
        key: scheduledStartKey(schedule),
      },
      /**
       * Отпечаток — разрешённый смысл операции, а не присланный запрос. Если
       * план успели отредактировать между попытками, шаблон/локация/оборудование
       * изменятся, и повтор будет отклонён как другая операция, а не угадан.
       */
      IdempotencyService.fingerprint(resolved),
      {
        execute: async () => {
          const created = await this.createScheduledRun(user, schedule, data, resolved)
          return { result: created, entityType: 'InspectionRun', entityId: created.id }
        },
        /**
         * Повтор возвращает тот же обход и не порождает ни второй строки, ни
         * второго inspection.run_generated: событие живёт внутри execute.
         */
        replay: async (entityId) =>
          this.prisma.inspectionRun.findUnique({ where: { id: entityId }, select: runSelect() }),
      },
    )

    return outcome.result
  }

  /**
   * SMA-PLANNER-SCHEDULE-RUN-LINK-HARDENING-119T — запись запланированного обхода.
   *
   * Всё, что делает визит состоявшимся, лежит здесь: проверка занятости, сама
   * строка обхода со снимком шаблона, отметка в расписании и событие. Вызов
   * происходит не более одного раза на ключ идемпотентности.
   */
  private async createScheduledRun(
    user: InspectionUserCtx,
    schedule: { id: string; nextDueAt: Date | null },
    data: Prisma.InspectionRunUncheckedCreateInput,
    resolved: { templateId: string; locationId: string; equipmentId: string | null },
  ) {
    /**
     * Обход, отметка в расписании и проверка занятости идут одной транзакцией.
     * Проверка внутри неё, а не перед ней: снаружи между чтением и вставкой
     * оставалось окно, в которое помещался второй обход того же визита.
     */
    const run = await this.prisma.$transaction(async (tx) => {
      const active = await tx.inspectionRun.findFirst({
        where: { scheduleId: schedule.id, status: InspectionRunStatus.IN_PROGRESS },
        select: { id: true },
      })
      if (active) {
        /**
         * Признак занятости — именно незакрытый обход. Завершённый не блокирует:
         * следующий визит по тому же плану законен и у периодических расписаний
         * ожидаем. Ответ называет уже начатый обход, чтобы клиент открыл его, а
         * не показал тупиковую ошибку.
         */
        throw new ConflictException({
          code: 'INSPECTION_SCHEDULE_RUN_IN_PROGRESS',
          message: 'Обход по этому плану уже начат.',
          runId: active.id,
        })
      }

      const created = await tx.inspectionRun.create({ data, select: runSelect() })
      await tx.inspectionSchedule.update({
        where: { id: schedule.id },
        data: { lastRunId: created.id, lastGeneratedAt: new Date() },
      })
      return created
    })

    /**
     * Событие описывает появление обхода из плана — именно это и произошло.
     * Отличить запуск человеком от будущего автогенератора можно по actorUserId
     * и по полю trigger: у генератора актора нет.
     */
    await this.timeline.recordLegacy({
      type: 'inspection.run_generated',
      companyId: user.companyId,
      entityType: 'InspectionRun',
      entityId: run.id,
      actorUserId: user.id,
      payload: {
        runId: run.id,
        scheduleId: schedule.id,
        templateId: resolved.templateId,
        locationId: resolved.locationId,
        equipmentId: resolved.equipmentId,
        dueAt: schedule.nextDueAt,
        trigger: 'technician_start',
      },
    })

    return run
  }

  /**
   * SMA-PLANNER-V1-SCHEDULE-TO-RUN-LINK-119K — проверка плана перед исполнением.
   *
   * Расписание не даёт доступа. Доступ к шаблону, локации и оборудованию уже
   * решён выше каноническим порядком 097, и эта проверка его не переоткрывает:
   * она лишь убеждается, что начинаемый обход — тот самый запланированный визит.
   * Поэтому сверка идёт с уже разрешёнными значениями, а не с тем, что прислал
   * клиент: подмена locationId в запросе иначе прошла бы сверку с расписанием.
   */
  private async resolveScheduleForRun(
    user: InspectionUserCtx,
    dto: StartRunDto,
    resolved: { templateId: string; locationId: string; equipmentId: string | null },
  ) {
    if (!dto.scheduleId) return null

    const schedule = await this.prisma.inspectionSchedule.findFirst({
      // Компания актора: расписание чужого провайдера не существует для него,
      // тем же фильтром, что и в самом сервисе расписаний.
      where: { id: dto.scheduleId, companyId: user.companyId },
      select: {
        id: true,
        isActive: true,
        templateId: true,
        locationId: true,
        equipmentId: true,
        assignedToUserId: true,
        nextDueAt: true,
        /** 119T: отметка предыдущего визита — по ней строится ключ идемпотентности. */
        lastRunId: true,
      },
    })
    if (!schedule) throw new NotFoundException('Inspection schedule not found')

    /**
     * Техник видит и выполняет только назначенное ему. Отказ — «не найдено»,
     * как и в InspectionScheduleService.get: существование чужого плана
     * не является информацией, на которую техник имеет право.
     */
    if (
      !this.policy.canManageSchedule(user).allowed &&
      schedule.assignedToUserId !== user.id
    ) {
      throw new NotFoundException('Inspection schedule not found')
    }

    if (!schedule.isActive) {
      throw new BadRequestException('Inspection schedule is not active')
    }
    if (schedule.templateId !== resolved.templateId) {
      throw new BadRequestException('Inspection schedule has a different template')
    }
    if (schedule.locationId !== resolved.locationId) {
      throw new BadRequestException('Inspection schedule has a different location')
    }
    if ((schedule.equipmentId ?? null) !== resolved.equipmentId) {
      throw new BadRequestException('Inspection schedule has different equipment')
    }

    /**
     * 119T: проверка «визит уже начат» переехала внутрь транзакции создания
     * (createScheduledRun). Здесь остаётся только сверка плана: чем ближе
     * проверка к записи, тем уже окно между ней и вставкой строки.
     */
    return schedule
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
        /**
         * 116F: `title` — снимок названия, сделанный при запуске обхода
         * (startRun: `dto.title || template.name`). Исторический акт обязан
         * показывать его, а не `template.name`: шаблон редактируемый, и правка
         * задним числом переписала бы то, что написано про завершённый обход.
         * Живая связь с шаблоном остаётся рядом — она нужна для перехода
         * к текущему шаблону, но не для описания истории.
         */
        title: run.title,
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

  async uploadRunItemAttachment(
    user: InspectionUserCtx,
    runId: string,
    itemId: string,
    file: any,
    idempotencyKey?: string | null,
  ) {
    /**
     * SMA-OFFLINE-IDEMPOTENCY-113B — a round photo queued offline may be replayed after a lost
     * response. Policy and run-item access are re-checked inside the internal path on every
     * call, so a key never grants reach.
     */
    const key = IdempotencyService.normalizeKey(idempotencyKey)
    if (key && this.idempotency) {
      const fingerprint = IdempotencyService.fingerprint({
        runId,
        itemId,
        originalName: file?.originalname,
        size: file?.size,
        mimeType: file?.mimetype,
      })
      const outcome = await this.idempotency.run<any>(
        {
          companyId: user.companyId,
          userId: user.id,
          operationType: 'inspection_run_item_attachment',
          key,
        },
        fingerprint,
        {
          execute: async (ctx) => {
            const created = await this.uploadRunItemAttachmentInternal(user, runId, itemId, file, ctx)
            return { result: created, entityType: 'InspectionRunItemAttachment', entityId: created.id }
          },
          replay: async (entityId) =>
            this.prisma.inspectionRunItemAttachment.findUnique({
              where: { id: entityId },
              select: { id: true, url: true, mimeType: true, originalName: true, createdAt: true },
            }),
          discardOrphan: async (storageKey) => this.removeStoredInspectionFile(storageKey),
        },
      )
      return outcome.result
    }

    return this.uploadRunItemAttachmentInternal(user, runId, itemId, file)
  }

  private async uploadRunItemAttachmentInternal(
    user: InspectionUserCtx,
    runId: string,
    itemId: string,
    file: any,
    ctx?: { noteStorageKey: (k: string) => Promise<void> },
  ) {
    assertAllowed(this.policy.canUploadAttachment(user))

    const { item } = await this.getMutableRunItem(user, runId, itemId)
    this.assertImageFile(file)

    const stored = await this.persistFile(file)
    // Record the binary before the row exists, so a retry can clean this exact orphan.
    if (ctx) await ctx.noteStorageKey(stored.storageKey)

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

  async createTicketFromItem(
    user: InspectionUserCtx,
    runId: string,
    itemId: string,
    dto: CreateTicketFromItemDto,
    idempotencyKey?: string | null,
  ) {
    assertAllowed(this.policy.canCreateTicket(user))
    const categoryId = await this.resolveTicketCategoryFromRunSnapshot(user, runId, itemId, dto.categoryId)

    /**
     * SMA-OFFLINE-IDEMPOTENCY-113B — 113A left this blocked, and the key is what unblocks it.
     *
     * InspectionRunItem.ticketId is @unique and the internal path refuses a second ticket for
     * the same item, so duplication was never the risk. The risk was ambiguity: offline, the
     * client could not tell "my earlier attempt succeeded" from "a colleague raised it", and
     * the refusal looks identical either way. A key owned by this actor removes that — a replay
     * returns the ticket this actor created, and the refusal keeps its original meaning.
     */
    const key = IdempotencyService.normalizeKey(idempotencyKey)
    if (key && this.idempotency) {
      const fingerprint = IdempotencyService.fingerprint({
        runId,
        itemId,
        categoryId,
        title: dto.title,
        description: dto.description,
        urgency: dto.urgency,
      })
      const outcome = await this.idempotency.run<any>(
        { companyId: user.companyId, userId: user.id, operationType: 'inspection_ticket_from_item', key },
        fingerprint,
        {
          execute: async () => {
            const created = await this.createTicketFromItemInternal(user, runId, itemId, dto, categoryId)
            return { result: created, entityType: 'Ticket', entityId: created.ticket.id }
          },
          replay: async (entityId) => {
            const ticket = await this.prisma.ticket.findUnique({
              where: { id: entityId },
              select: { id: true, ticketNumber: true, status: true, companyId: true },
            })
            if (!ticket) return null
            const item = await this.prisma.inspectionRunItem.findFirst({
              where: { id: itemId, ticketId: entityId },
              select: runItemSelect(),
            })
            return { item, ticket, generated: null, autoAssigned: null }
          },
        },
      )
      return outcome.result
    }

    return this.createTicketFromItemInternal(user, runId, itemId, dto, categoryId)
  }

  private async resolveTicketCategoryFromRunSnapshot(
    user: InspectionUserCtx,
    runId: string,
    itemId: string,
    explicitCategoryId?: string,
  ) {
    const explicit = explicitCategoryId?.trim()
    if (explicit) return explicit

    const item = await this.prisma.inspectionRunItem.findFirst({
      where: { id: itemId, runId, run: { companyId: user.companyId } },
      select: { defaultCategoryId: true },
    })
    if (!item) throw new NotFoundException('Inspection run item not found')
    const snapshotCategoryId = item.defaultCategoryId?.trim()
    if (!snapshotCategoryId) {
      throw new BadRequestException('Выберите категорию заявки')
    }
    return snapshotCategoryId
  }

  private async createTicketFromItemInternal(
    user: InspectionUserCtx,
    runId: string,
    itemId: string,
    dto: CreateTicketFromItemDto,
    categoryId: string,
  ) {
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
      categoryId,
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
    await this.assertActiveShiftForRoundMutation(user)

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

  private normalizeTemplateName(value: string) {
    const name = value.trim()
    if (!name) throw new BadRequestException('Template name is required')
    return name
  }

  private async assertActiveShiftForRoundMutation(user: InspectionUserCtx) {
    await this.shiftPolicy?.assertActiveShiftForOperationalWork(user)
  }

  private normalizeTemplateDescription(value?: string | null) {
    return value?.trim() || null
  }

  private normalizeTemplateItems(
    source: Array<{
      title: string
      description?: string | null
      sortOrder?: number
      zoneName?: string | null
      zoneSortOrder?: number
      checkpointSortOrder?: number
      defaultCategoryId?: string | null
      responseType?: InspectionCheckpointResponseType
      numericMin?: number | null
      numericMax?: number | null
      numericUnit?: string | null
      isRequired?: boolean
      id?: string | null
    }>,
  ) {
    const items = source
      .map((item, index) => ({
        id: item.id?.trim() || undefined,
        title: item.title.trim(),
        description: item.description?.trim() || null,
        sortOrder: item.sortOrder ?? index,
        zoneName: item.zoneName?.trim() || null,
        zoneSortOrder: item.zoneSortOrder ?? 0,
        checkpointSortOrder: item.checkpointSortOrder ?? item.sortOrder ?? index,
        defaultCategoryId: item.defaultCategoryId?.trim() || null,
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

    return items
  }

  private async resolveDefaultCategorySnapshots(
    user: InspectionUserCtx,
    clientCompanyId: string,
    items: Array<{ id: string; defaultCategoryId?: string | null }>,
  ) {
    const resolvedByHint = new Map<string, { id: string; name: string } | null>()

    for (const item of items) {
      const hint = item.defaultCategoryId?.trim()
      if (!hint || resolvedByHint.has(hint)) continue

      try {
        const category = await assertActorCanUseProblemCategory({
          prisma: this.prisma,
          actor: user,
          scopeCompanyId: clientCompanyId,
          problemCategoryId: hint,
        })
        resolvedByHint.set(hint, { id: category.id, name: category.name })
      } catch (error) {
        if (!(error instanceof NotFoundException) && !(error instanceof ForbiddenException)) {
          throw error
        }
        resolvedByHint.set(hint, null)
      }
    }

    return new Map(
      items.map((item) => {
        const hint = item.defaultCategoryId?.trim()
        return [item.id, hint ? resolvedByHint.get(hint) ?? null : null] as const
      }),
    )
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
        defaultCategoryId: true,
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

  /** 113B: delete a binary left behind by an attempt that died before committing its row. */
  private async removeStoredInspectionFile(storageKey: string) {
    if (!storageKey) return
    const target = join(this.uploadsDir, storageKey)
    await rm(target, { force: true }).catch(() => undefined)
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
        defaultCategoryId: true,
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
    defaultCategoryId: true,
    defaultCategoryName: true,
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
    /**
     * 116F: исполнителю нужно видеть итог проверки акта на телефоне, не заходя
     * в десктопное управление. Поля уже есть в записи — отдаём их в той же
     * выдаче обхода, а не отдельной ручкой и не вторым резолвером доступа.
     */
    reportReviewComment: true,
    reportReviewedBy: {
      select: { id: true, email: true, firstName: true, lastName: true },
    },
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
    /** 116F: снимок названия обхода на момент запуска — см. runReport ниже. */
    title: true,
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
            ticketNumber: true,
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
    reportReviewedAt: true,
    completedAt: true,
    createdAt: true,
    updatedAt: true,
    template: { select: { id: true, name: true } },
    location: { select: { id: true, clientCompanyId: true, name: true, city: true } },
    equipment: { select: { id: true, name: true } },
    performedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
    reportReviewedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
    /**
     * 116F: статусы пунктов и признак заявки тянутся строкой, а не отдельными
     * запросами. Prisma не умеет несколько именованных _count по одной связи,
     * а мобильная история до этого добирала те же числа отдельным запросом
     * на каждый обход — N+1 на клиенте. Поля узкие, строк на обход десятки.
     */
    items: { select: { status: true, ticketId: true } },
    _count: { select: { items: true } },
  } satisfies Prisma.InspectionRunSelect
}

type RunListRow = { items?: Array<{ status: InspectionRunItemStatus; ticketId: string | null }> | null }

/**
 * 116F: итог обхода считается из снимка пунктов самого обхода, а не из шаблона.
 * Шаблон могли отредактировать после завершения — на историю это влиять не должно.
 */
function summarizeRunItems<T extends RunListRow>(run: T) {
  const { items: loaded, ...rest } = run
  // Связь может не прийти, если строку собрал не runListSelect; итог тогда пустой,
  // а не падение на всём списке.
  const items = loaded ?? []
  return {
    ...rest,
    summary: {
      totalItems: items.length,
      okCount: items.filter((item) => item.status === InspectionRunItemStatus.OK).length,
      issueCount: items.filter((item) => item.status === InspectionRunItemStatus.ISSUE).length,
      criticalCount: items.filter((item) => item.status === InspectionRunItemStatus.CRITICAL).length,
      skippedCount: items.filter((item) => item.status === InspectionRunItemStatus.SKIPPED).length,
      pendingCount: items.filter((item) => item.status === InspectionRunItemStatus.PENDING).length,
      createdTicketsCount: items.filter((item) => !!item.ticketId).length,
    },
  }
}
