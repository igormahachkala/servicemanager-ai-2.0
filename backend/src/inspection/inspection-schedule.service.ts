import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InspectionFrequency, Prisma } from '@prisma/client'

import { isExecutorEligible } from '../common/executor.utils'
import { assertAllowed } from '../policy/policy.utils'
import { InspectionPolicy, type InspectionUserCtx } from '../policy/inspection.policy'
import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'

import { CreateScheduleDto } from './dto/create-schedule.dto'
import { ListSchedulesDto } from './dto/list-schedules.dto'
import { UpdateScheduleDto } from './dto/update-schedule.dto'
import {
  assertInspectionLocationAccess,
  resolveInspectionLocationAccess,
  type InspectionLocationRef,
} from './inspection-location-scope'

/**
 * SMA-ROUNDS-V1-SCHEDULE-CRUD-098 — the plan, not the execution.
 *
 * A manager picks a template, a client site, a technician and a date; this service stores that
 * as an InspectionSchedule. It deliberately does NOT create InspectionRun rows: turning due
 * schedules into runs idempotently is a separate task, and building half of it here would make
 * that task harder, not easier. `nextDueAt` is therefore seeded from `startDate` and left alone
 * — there is no recurrence arithmetic in 098, and pretending otherwise would put wrong dates in
 * the database that a future generator would have to distrust.
 *
 * Access is not re-decided here. Provider→client authorisation comes from 097's composition of
 * the canonical contract primitives, template ownership from the same actor-company filter the
 * template endpoints already use, and executor eligibility from common/executor.utils.
 */
@Injectable()
export class InspectionScheduleService {
  private readonly policy = new InspectionPolicy()

  constructor(
    private readonly prisma: PrismaService,
    private readonly serviceContracts: ServiceContractsService,
  ) {}

  // ── read ───────────────────────────────────────────────────────────────────

  async list(user: InspectionUserCtx, filters: ListSchedulesDto = {}) {
    assertAllowed(this.policy.canViewSchedules(user))

    const where: Prisma.InspectionScheduleWhereInput = { companyId: user.companyId }

    /**
     * A technician sees the rounds planned for them and nothing else. The narrowing is applied
     * before any caller-supplied filter so an assignedToUserId query parameter cannot widen it.
     */
    const managing = this.policy.canManageSchedule(user).allowed
    if (managing) {
      if (filters.assignedToUserId) where.assignedToUserId = filters.assignedToUserId
    } else {
      where.assignedToUserId = user.id
    }

    if (filters.locationId) where.locationId = filters.locationId
    if (filters.frequency) where.frequency = filters.frequency
    if (filters.active !== undefined) where.isActive = filters.active === 'true'

    const dueWindow = this.buildDueWindow(filters)
    if (dueWindow) where.nextDueAt = dueWindow

    const schedules = await this.prisma.inspectionSchedule.findMany({
      where,
      orderBy: [{ nextDueAt: 'asc' }, { createdAt: 'asc' }],
      take: 200,
      select: scheduleSelect(),
    })

    // Same reasoning as 097's run list: the company filter cannot notice a contract that
    // lapsed after the plan was made, so out-of-scope sites are dropped here.
    return this.filterByLocationScope(user, schedules)
  }

  async get(user: InspectionUserCtx, scheduleId: string) {
    assertAllowed(this.policy.canViewSchedules(user))

    const schedule = await this.prisma.inspectionSchedule.findFirst({
      where: { id: scheduleId, companyId: user.companyId },
      select: scheduleSelect(),
    })
    if (!schedule) throw new NotFoundException('Inspection schedule not found')

    if (!this.policy.canManageSchedule(user).allowed && schedule.assignedTo?.id !== user.id) {
      throw new NotFoundException('Inspection schedule not found')
    }

    await this.assertScheduleLocationStillInScope(user, schedule)
    return schedule
  }

  // ── write ──────────────────────────────────────────────────────────────────

  async create(user: InspectionUserCtx, dto: CreateScheduleDto) {
    assertAllowed(this.policy.canManageSchedule(user))

    const template = await this.requireOwnedTemplate(user, dto.templateId)
    const location = await this.requireAccessibleLocation(user, dto.locationId)
    const equipmentId = await this.resolveEquipmentId(dto.equipmentId, location)
    const assignedToUserId = await this.resolveAssigneeId(user, dto.assignedToUserId)

    const startDate = this.parseStartDate(dto.startDate)
    const intervalDays = this.resolveIntervalDays(dto.frequency, dto.intervalDays)

    return this.prisma.inspectionSchedule.create({
      data: {
        companyId: user.companyId,
        templateId: template.id,
        locationId: location.id,
        equipmentId,
        assignedToUserId,
        createdByUserId: user.id,
        name: dto.name?.trim() || template.name,
        frequency: dto.frequency,
        intervalDays,
        startDate,
        // No generator in 098: the first due moment is the planned moment, unchanged.
        nextDueAt: startDate,
        leadTimeDays: dto.leadTimeDays ?? 0,
        graceDays: dto.graceDays ?? 0,
        isActive: dto.isActive ?? true,
      },
      select: scheduleSelect(),
    })
  }

  async update(user: InspectionUserCtx, scheduleId: string, dto: UpdateScheduleDto) {
    assertAllowed(this.policy.canManageSchedule(user))

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field must be provided')
    }

    const current = await this.requireManagedSchedule(user, scheduleId)
    const data: Prisma.InspectionScheduleUpdateInput = {}

    if (dto.templateId !== undefined) {
      const template = await this.requireOwnedTemplate(user, dto.templateId)
      data.template = { connect: { id: template.id } }
    }

    // The location decides which equipment is legal, so resolve it first even when only the
    // equipment is being changed.
    const location =
      dto.locationId !== undefined
        ? await this.requireAccessibleLocation(user, dto.locationId)
        : { id: current.location.id, clientCompanyId: current.location.clientCompanyId }

    if (dto.locationId !== undefined) {
      data.location = { connect: { id: location.id } }
      // Equipment belongs to a site. Moving the round to another site without saying what to
      // do with the equipment would leave a link into the previous location, so it is cleared
      // unless the same request supplies a replacement.
      if (dto.equipmentId === undefined) data.equipment = { disconnect: true }
    }

    if (dto.equipmentId !== undefined) {
      const equipmentId = await this.resolveEquipmentId(dto.equipmentId ?? undefined, location)
      data.equipment = equipmentId ? { connect: { id: equipmentId } } : { disconnect: true }
    }

    if (dto.assignedToUserId !== undefined) {
      const assignedToUserId = await this.resolveAssigneeId(user, dto.assignedToUserId ?? undefined)
      data.assignedTo = assignedToUserId ? { connect: { id: assignedToUserId } } : { disconnect: true }
    }

    if (dto.name !== undefined) {
      const name = dto.name.trim()
      if (!name) throw new BadRequestException('Schedule name is required')
      data.name = name
    }

    if (dto.frequency !== undefined || dto.intervalDays !== undefined) {
      const frequency = dto.frequency ?? current.frequency
      const intervalDays =
        dto.intervalDays !== undefined ? dto.intervalDays ?? undefined : current.intervalDays ?? undefined
      if (dto.frequency !== undefined) data.frequency = frequency
      data.intervalDays = this.resolveIntervalDays(frequency, intervalDays)
    }

    if (dto.startDate !== undefined) {
      const startDate = this.parseStartDate(dto.startDate)
      data.startDate = startDate
      /**
       * Moving the planned moment moves the next due moment — but only while nothing has been
       * generated from this schedule yet. Once a generator has produced runs, `nextDueAt` is
       * its cursor, and 098 has no business rewinding it.
       */
      if (!current.lastGeneratedAt) data.nextDueAt = startDate
    }

    if (dto.leadTimeDays !== undefined) data.leadTimeDays = dto.leadTimeDays
    if (dto.graceDays !== undefined) data.graceDays = dto.graceDays
    if (dto.isActive !== undefined) data.isActive = dto.isActive

    return this.prisma.inspectionSchedule.update({
      where: { id: current.id },
      data,
      select: scheduleSelect(),
    })
  }

  /**
   * Retire a schedule.
   *
   * 089 gives InspectionRun a nullable `scheduleId` with onDelete: SetNull, so deleting a
   * schedule that has already produced runs would silently sever the link between those runs
   * and the plan they came from — history that cannot be reconstructed. A schedule that has
   * never generated anything has no such history, so it is removed outright.
   *
   * `deleted` in the response says which of the two happened, matching the
   * `{ id, deleted }` shape the web client already expects.
   */
  async remove(user: InspectionUserCtx, scheduleId: string) {
    assertAllowed(this.policy.canManageSchedule(user))

    const current = await this.requireManagedSchedule(user, scheduleId)

    if (current._count.runs > 0 || current.lastGeneratedAt) {
      await this.prisma.inspectionSchedule.update({
        where: { id: current.id },
        data: { isActive: false },
      })
      return { id: current.id, deleted: false, isActive: false }
    }

    await this.prisma.inspectionSchedule.delete({ where: { id: current.id } })
    return { id: current.id, deleted: true, isActive: false }
  }

  // ── validation helpers ─────────────────────────────────────────────────────

  private async requireOwnedTemplate(user: InspectionUserCtx, templateId: string) {
    // Identical filter to the template endpoints: provider-owned, cross-provider denied, and
    // one template stays reusable across every client the provider is contracted for.
    const template = await this.prisma.inspectionTemplate.findFirst({
      where: { id: templateId, companyId: user.companyId, isActive: true },
      select: { id: true, name: true },
    })
    if (!template) throw new NotFoundException('Inspection template not found')
    return template
  }

  private async requireAccessibleLocation(user: InspectionUserCtx, locationId: string) {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId },
      select: { id: true, clientCompanyId: true },
    })
    if (!location) throw new NotFoundException('Location not found')

    await assertInspectionLocationAccess({
      serviceContracts: this.serviceContracts,
      actorCompanyId: user.companyId,
      location,
      notFoundMessage: 'Location not found',
    })

    return location
  }

  private async resolveEquipmentId(
    equipmentId: string | undefined,
    location: InspectionLocationRef,
  ): Promise<string | null> {
    if (!equipmentId) return null

    const equipment = await this.prisma.equipment.findFirst({
      // Equipment belongs to the company that owns the site, never to the executing provider.
      where: { id: equipmentId, companyId: location.clientCompanyId, locationId: location.id },
      select: { id: true },
    })
    if (!equipment) throw new NotFoundException('Equipment not found')
    return equipment.id
  }

  private async resolveAssigneeId(
    user: InspectionUserCtx,
    assignedToUserId: string | undefined,
  ): Promise<string | null> {
    if (!assignedToUserId) return null

    const candidate = await this.prisma.user.findFirst({
      // Same company as the manager: a provider plans work for its own people. A technician of
      // another provider is not a candidate even when both service the same client.
      where: { id: assignedToUserId, companyId: user.companyId, isActive: true, deletedAt: null },
      select: { id: true, role: true, isExecutor: true },
    })
    if (!candidate) throw new NotFoundException('Assignee not found')

    // Canonical executor rule, shared with ticket claiming and the assignment engine.
    if (!isExecutorEligible({ role: candidate.role, isExecutor: candidate.isExecutor })) {
      throw new BadRequestException('Assignee is not eligible to execute rounds')
    }

    return candidate.id
  }

  private parseStartDate(value: string) {
    const startDate = new Date(value)
    if (Number.isNaN(startDate.getTime())) throw new BadRequestException('Invalid startDate')
    return startDate
  }

  /**
   * intervalDays is the configuration a future generator will read for CUSTOM. Storing it on a
   * fixed frequency would be configuration nobody reads, so it is refused rather than silently
   * dropped.
   */
  private resolveIntervalDays(frequency: InspectionFrequency, intervalDays: number | undefined) {
    if (frequency === InspectionFrequency.CUSTOM) {
      if (!intervalDays) throw new BadRequestException('intervalDays is required for CUSTOM frequency')
      return intervalDays
    }
    if (intervalDays) throw new BadRequestException('intervalDays is allowed only for CUSTOM frequency')
    return null
  }

  private buildDueWindow(filters: ListSchedulesDto) {
    const from = filters.from ? new Date(filters.from) : null
    const to = filters.to ? new Date(filters.to) : null
    if (from && Number.isNaN(from.getTime())) throw new BadRequestException('Invalid from')
    if (to && Number.isNaN(to.getTime())) throw new BadRequestException('Invalid to')
    if (!from && !to) return null
    return { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
  }

  private async requireManagedSchedule(user: InspectionUserCtx, scheduleId: string) {
    const schedule = await this.prisma.inspectionSchedule.findFirst({
      where: { id: scheduleId, companyId: user.companyId },
      select: {
        id: true,
        frequency: true,
        intervalDays: true,
        lastGeneratedAt: true,
        location: { select: { id: true, clientCompanyId: true } },
        _count: { select: { runs: true } },
      },
    })
    if (!schedule) throw new NotFoundException('Inspection schedule not found')

    await this.assertScheduleLocationStillInScope(user, schedule)
    return schedule
  }

  private async assertScheduleLocationStillInScope(
    user: InspectionUserCtx,
    schedule: { location?: InspectionLocationRef | null },
  ) {
    const location = schedule.location
    if (!location || location.clientCompanyId === user.companyId) return

    await assertInspectionLocationAccess({
      serviceContracts: this.serviceContracts,
      actorCompanyId: user.companyId,
      location,
      notFoundMessage: 'Inspection schedule not found',
    })
  }

  private async filterByLocationScope<T extends { location?: InspectionLocationRef | null }>(
    user: InspectionUserCtx,
    schedules: T[],
  ): Promise<T[]> {
    const decisions = new Map<string, boolean>()
    const visible: T[] = []

    for (const schedule of schedules) {
      const location = schedule.location
      if (!location || location.clientCompanyId === user.companyId) {
        visible.push(schedule)
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

      if (allowed) visible.push(schedule)
    }

    return visible
  }
}

function scheduleSelect() {
  return {
    id: true,
    companyId: true,
    name: true,
    frequency: true,
    intervalDays: true,
    startDate: true,
    nextDueAt: true,
    leadTimeDays: true,
    graceDays: true,
    isActive: true,
    lastGeneratedAt: true,
    lastRunId: true,
    createdAt: true,
    updatedAt: true,
    template: { select: { id: true, name: true } },
    location: {
      select: { id: true, clientCompanyId: true, name: true, city: true, platformCode: true },
    },
    equipment: { select: { id: true, name: true, type: true } },
    assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
    _count: { select: { runs: true } },
  } satisfies Prisma.InspectionScheduleSelect
}
