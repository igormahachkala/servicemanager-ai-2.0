import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  Prisma,
  UserRole,
  WorkLogStatus,
  WorkShiftStatus,
} from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { resolveTicketOperationAccess, type TicketAccessActor } from '../tickets/ticket-access.utils'
import { ShiftPolicyService } from './shift-policy.service'
import { CreateShiftCorrectionDto } from './dto/create-shift-correction.dto'
import {
  latestCorrection,
  resolveEffectiveShiftTime,
  type EffectiveShiftTime,
} from './workforce-effective-time'
import {
  elapsedMinutes,
  isWorkShiftAutoCloseDue,
  parseShiftCloseTime,
  resolveWorkShiftAutoCloseAt,
} from './workforce-time'

type WorkforceActor = TicketAccessActor

const correctionSelect = {
  id: true,
  correctedOpenedAt: true,
  correctedClosedAt: true,
  reason: true,
  createdAt: true,
  correctedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const

const shiftInclude = {
  user: {
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
  },
  // 106B: newest first, so latestCorrection() and any consumer reading [0] agree.
  corrections: { orderBy: { createdAt: 'desc' as const }, select: correctionSelect },
  workLogs: {
    orderBy: { startedAt: 'desc' as const },
    include: {
      ticket: {
        select: {
          id: true,
          ticketNumber: true,
          companyId: true,
          problemText: true,
          status: true,
          location: { select: { id: true, name: true } },
          problemCategory: { select: { id: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.WorkShiftInclude

@Injectable()
export class WorkforceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serviceContractsService: ServiceContractsService,
    private readonly shiftPolicyService?: ShiftPolicyService,
  ) {}

  async getMyState(actor: WorkforceActor) {
    await this.assertActiveActor(actor)
    const [company, openShift, recentShifts] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: actor.companyId },
        select: {
          id: true,
          name: true,
          type: true,
          timezone: true,
          shiftAutoCloseTime: true,
          requireActiveShiftForWork: true,
        },
      }),
      this.prisma.workShift.findFirst({
        where: { companyId: actor.companyId, userId: actor.id, status: WorkShiftStatus.OPEN },
        include: shiftInclude,
      }),
      this.prisma.workShift.findMany({
        where: { companyId: actor.companyId, userId: actor.id, status: { not: WorkShiftStatus.OPEN } },
        orderBy: { openedAt: 'desc' },
        take: 5,
        include: shiftInclude,
      }),
    ])

    if (!company) throw new NotFoundException('Company not found')

    return {
      company,
      shift: openShift,
      runningWorkLog: openShift?.workLogs.find((row) => row.status === WorkLogStatus.RUNNING) ?? null,
      recentShifts,
      serverNow: new Date(),
    }
  }

  async openShift(actor: WorkforceActor) {
    await this.assertActiveActor(actor)
    const existing = await this.prisma.workShift.findFirst({
      where: { companyId: actor.companyId, userId: actor.id, status: WorkShiftStatus.OPEN },
    })
    if (existing) return this.getMyState(actor)

    try {
      await this.prisma.$transaction(async (tx) => {
        const shift = await tx.workShift.create({
          data: { companyId: actor.companyId, userId: actor.id },
        })
        await tx.domainEvent.create({
          data: {
            companyId: actor.companyId,
            entityType: 'WorkShift',
            entityId: shift.id,
            type: 'workforce.shift_opened',
            actorUserId: actor.id,
            payload: { openedAt: shift.openedAt.toISOString() },
          },
        })
      })
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
    }

    return this.getMyState(actor)
  }

  async closeShift(actor: WorkforceActor, comment?: string) {
    await this.assertActiveActor(actor)
    const shift = await this.prisma.workShift.findFirst({
      where: { companyId: actor.companyId, userId: actor.id, status: WorkShiftStatus.OPEN },
      select: { id: true },
    })
    if (!shift) throw new BadRequestException('Рабочая смена не открыта')

    await this.closeShiftById(shift.id, WorkShiftStatus.CLOSED, actor.id, comment?.trim() || 'MANUAL_CLOSE')
    return this.getMyState(actor)
  }

  async startTicketWork(actor: WorkforceActor, ticketId: string, linkedClientCompanyId?: string) {
    await this.assertActiveActor(actor)
    await this.shiftPolicyService?.assertActiveShiftForOperationalWork(actor)
    const shift = await this.prisma.workShift.findFirst({
      where: { companyId: actor.companyId, userId: actor.id, status: WorkShiftStatus.OPEN },
      select: { id: true },
    })
    if (!shift) throw new BadRequestException('Сначала откройте рабочую смену')

    const access = await resolveTicketOperationAccess({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor,
      ticketId,
      linkedClientCompanyId,
    })
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, companyId: access.ticket.companyId },
      select: { id: true, companyId: true, assignedTechnicianId: true, ticketNumber: true },
    })
    if (!ticket) throw new NotFoundException('Ticket not found')
    if (ticket.assignedTechnicianId !== actor.id) {
      throw new ForbiddenException('Учитывать работу можно только по назначенной вам заявке')
    }

    const existing = await this.prisma.workLog.findFirst({
      where: { companyId: actor.companyId, userId: actor.id, status: WorkLogStatus.RUNNING },
      include: { ticket: { select: { ticketNumber: true } } },
    })
    if (existing?.ticketId === ticket.id) return this.getMyState(actor)
    if (existing) {
      throw new BadRequestException(`Сначала завершите учёт времени по заявке #${existing.ticket.ticketNumber}`)
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const workLog = await tx.workLog.create({
          data: {
            companyId: actor.companyId,
            userId: actor.id,
            shiftId: shift.id,
            ticketId: ticket.id,
          },
        })
        await tx.domainEvent.create({
          data: {
            companyId: ticket.companyId,
            entityType: 'Ticket',
            entityId: ticket.id,
            type: 'ticket.work_started',
            actorUserId: actor.id,
            payload: { workLogId: workLog.id, shiftId: shift.id },
          },
        })
      })
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
    }

    return this.getMyState(actor)
  }

  async stopTicketWork(actor: WorkforceActor, ticketId: string) {
    await this.assertActiveActor(actor)
    const running = await this.prisma.workLog.findFirst({
      where: {
        companyId: actor.companyId,
        userId: actor.id,
        ticketId,
        status: WorkLogStatus.RUNNING,
      },
      include: { ticket: { select: { companyId: true } } },
    })
    if (!running) throw new BadRequestException('Активный учёт времени по этой заявке не найден')

    const now = new Date()
    await this.prisma.$transaction(async (tx) => {
      await tx.workLog.update({
        where: { id: running.id },
        data: {
          status: WorkLogStatus.STOPPED,
          endedAt: now,
          durationMinutes: elapsedMinutes(running.startedAt, now),
        },
      })
      await tx.domainEvent.create({
        data: {
          companyId: running.ticket.companyId,
          entityType: 'Ticket',
          entityId: ticketId,
          type: 'ticket.work_stopped',
          actorUserId: actor.id,
          payload: {
            workLogId: running.id,
            durationMinutes: elapsedMinutes(running.startedAt, now),
          },
        },
      })
    })

    return this.getMyState(actor)
  }

  async listWorkforce(params: {
    actor: WorkforceActor
    observerCompanyId?: string
    from?: string
    to?: string
    userId?: string
  }) {
    const targetCompanyId =
      params.actor.role === UserRole.PLATFORM_ADMIN && params.observerCompanyId
        ? params.observerCompanyId
        : params.actor.companyId
    const from = this.parseDate(params.from, 'from', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    const to = this.parseDate(params.to, 'to', new Date())
    if (from > to) throw new BadRequestException('from must be before to')

    const [company, shifts] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: targetCompanyId },
        select: { id: true, name: true, timezone: true, shiftAutoCloseTime: true },
      }),
      this.prisma.workShift.findMany({
        where: {
          companyId: targetCompanyId,
          ...(params.userId ? { userId: params.userId } : {}),
          openedAt: { gte: from, lte: to },
        },
        orderBy: { openedAt: 'desc' },
        take: 500,
        include: shiftInclude,
      }),
    ])
    if (!company) throw new NotFoundException('Company not found')

    const now = new Date()
    const employeeMap = new Map<string, {
      user: (typeof shifts)[number]['user']
      shifts: number
      shiftMinutes: number
      workMinutes: number
      tickets: Set<string>
    }>()
    // 106B: shifts carry their resolved effective time, and the aggregate is built from it —
    // a corrected shift must contribute its corrected hours, not the recorded ones.
    const decorated = shifts.map((shift) => this.withEffectiveTime(shift))

    for (const shift of decorated) {
      const row = employeeMap.get(shift.userId) ?? {
        user: shift.user,
        shifts: 0,
        shiftMinutes: 0,
        workMinutes: 0,
        tickets: new Set<string>(),
      }
      row.shifts += 1
      row.shiftMinutes +=
        shift.effective.effectiveDurationMinutes ??
        elapsedMinutes(shift.effective.effectiveOpenedAt, now)
      for (const log of shift.workLogs) {
        row.workMinutes += log.durationMinutes ?? elapsedMinutes(log.startedAt, log.endedAt ?? now)
        row.tickets.add(log.ticketId)
      }
      employeeMap.set(shift.userId, row)
    }

    const employees = [...employeeMap.values()].map((row) => ({
      user: row.user,
      shifts: row.shifts,
      shiftMinutes: row.shiftMinutes,
      workMinutes: row.workMinutes,
      tickets: row.tickets.size,
    }))

    return {
      company,
      period: { from, to },
      summary: {
        shifts: shifts.length,
        employees: employees.length,
        shiftMinutes: employees.reduce((sum, row) => sum + row.shiftMinutes, 0),
        workMinutes: employees.reduce((sum, row) => sum + row.workMinutes, 0),
      },
      employees,
      shifts: decorated,
      serverNow: now,
    }
  }

  /**
   * SMA-SHIFT-LABOR-LEDGER-INTEGRITY-106B — record a manager's correction to a shift.
   *
   * Appends to WorkShiftCorrection. The WorkShift row itself is never touched: openedAt,
   * closedAt, status and closeReason stay exactly as the system recorded them, so a report can
   * always show observed-versus-corrected. Superseding a wrong correction means appending
   * another one, never editing or deleting the first.
   */
  async createShiftCorrection(
    actor: WorkforceActor,
    shiftId: string,
    dto: CreateShiftCorrectionDto,
  ) {
    await this.assertActiveActor(actor)

    const reason = dto.reason?.trim()
    if (!reason) throw new BadRequestException('Причина исправления обязательна')

    const correctedOpenedAt = this.parseCorrectionDate(dto.correctedOpenedAt, 'correctedOpenedAt')
    const correctedClosedAt = this.parseCorrectionDate(dto.correctedClosedAt, 'correctedClosedAt')
    if (!correctedOpenedAt && !correctedClosedAt) {
      throw new BadRequestException('Укажите исправленное время начала или окончания смены')
    }

    // Tenant isolation: a shift of another company is simply not found, exactly as elsewhere.
    const shift = await this.prisma.workShift.findFirst({
      where: { id: shiftId, companyId: actor.companyId },
      select: { id: true, companyId: true, status: true, openedAt: true, closedAt: true },
    })
    if (!shift) throw new NotFoundException('Смена не найдена')

    const nextOpenedAt = correctedOpenedAt ?? shift.openedAt
    const nextClosedAt = correctedClosedAt ?? shift.closedAt

    if (correctedClosedAt && shift.status === WorkShiftStatus.OPEN) {
      // Closing a shift is an operational act with its own rules; a correction records what
      // already happened and must not become a second way to end a running shift.
      throw new BadRequestException('Нельзя исправить время окончания у открытой смены')
    }

    if (nextClosedAt && nextClosedAt.getTime() <= nextOpenedAt.getTime()) {
      throw new BadRequestException('Окончание смены должно быть позже начала')
    }

    const now = new Date()
    if (nextOpenedAt.getTime() > now.getTime()) {
      throw new BadRequestException('Начало смены не может быть в будущем')
    }
    if (nextClosedAt && nextClosedAt.getTime() > now.getTime()) {
      throw new BadRequestException('Окончание смены не может быть в будущем')
    }

    await this.prisma.$transaction(async (tx) => {
      const correction = await tx.workShiftCorrection.create({
        data: {
          companyId: shift.companyId,
          shiftId: shift.id,
          correctedByUserId: actor.id,
          correctedOpenedAt,
          correctedClosedAt,
          reason,
        },
      })
      await tx.domainEvent.create({
        data: {
          companyId: shift.companyId,
          entityType: 'WorkShift',
          entityId: shift.id,
          type: 'workforce.shift_corrected',
          actorUserId: actor.id,
          payload: {
            correctionId: correction.id,
            reason,
            recordedOpenedAt: shift.openedAt.toISOString(),
            recordedClosedAt: shift.closedAt?.toISOString() ?? null,
            correctedOpenedAt: correctedOpenedAt?.toISOString() ?? null,
            correctedClosedAt: correctedClosedAt?.toISOString() ?? null,
          },
        },
      })
    })

    return this.getShiftWithCorrections(actor, shift.id)
  }

  /** The shift plus its full correction history and the resolved effective time. */
  async getShiftWithCorrections(actor: WorkforceActor, shiftId: string) {
    const shift = await this.prisma.workShift.findFirst({
      where: { id: shiftId, companyId: actor.companyId },
      include: shiftInclude,
    })
    if (!shift) throw new NotFoundException('Смена не найдена')
    return this.withEffectiveTime(shift)
  }

  /**
   * Attaches the resolved effective time to a shift row. Single entry point on purpose: no
   * consumer may re-derive it, or two screens will disagree about the same shift.
   */
  private withEffectiveTime<T extends {
    openedAt: Date
    closedAt: Date | null
    corrections?: Array<{ correctedOpenedAt: Date | null; correctedClosedAt: Date | null; createdAt: Date }>
  }>(shift: T): T & { effective: EffectiveShiftTime } {
    const applied = latestCorrection(shift.corrections ?? [])
    return { ...shift, effective: resolveEffectiveShiftTime(shift, applied) }
  }

  private parseCorrectionDate(value: string | undefined, field: string): Date | null {
    if (value === undefined) return null
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException(`Invalid ${field}`)
    return parsed
  }

  /**
   * Company-level workforce settings.
   *
   * SMA-PROVIDER-SHIFT-POLICY-FOUNDATION-078 added `requireActiveShiftForWork` here rather
   * than behind a new endpoint, so authorization stays exactly where it already is
   * (ADMIN + COMPANY_SETTINGS_EDIT on the controller) and there is one settings surface
   * rather than two to keep in sync.
   *
   * Both fields are optional: an omitted field is left untouched, so a caller updating one
   * setting cannot accidentally reset the other.
   */
  async updateSettings(
    companyId: string,
    settings: { shiftAutoCloseTime?: string; requireActiveShiftForWork?: boolean },
  ) {
    const data: Prisma.CompanyUpdateInput = {}

    if (settings.shiftAutoCloseTime !== undefined) {
      if (!parseShiftCloseTime(settings.shiftAutoCloseTime)) {
        throw new BadRequestException('shiftAutoCloseTime must use HH:mm')
      }
      data.shiftAutoCloseTime = settings.shiftAutoCloseTime
    }

    if (settings.requireActiveShiftForWork !== undefined) {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { type: true },
      })
      if (!company) throw new NotFoundException('Company not found')

      // Refuse rather than store an inert value: on a CLIENT company the policy could never
      // take effect, and a setting that reads as configured but does nothing is a trap.
      if (
        settings.requireActiveShiftForWork &&
        !ShiftPolicyService.canCompanyUseShiftPolicy(company.type)
      ) {
        throw new BadRequestException(
          'requireActiveShiftForWork доступен только для компаний-подрядчиков',
        )
      }
      data.requireActiveShiftForWork = settings.requireActiveShiftForWork
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No settings provided')
    }

    return this.prisma.company.update({
      where: { id: companyId },
      data,
      select: {
        id: true,
        name: true,
        timezone: true,
        shiftAutoCloseTime: true,
        requireActiveShiftForWork: true,
      },
    })
  }

  async autoCloseDueShifts(now = new Date()): Promise<number> {
    const openShifts = await this.prisma.workShift.findMany({
      where: { status: WorkShiftStatus.OPEN },
      take: 500,
      select: {
        id: true,
        openedAt: true,
        company: { select: { timezone: true, shiftAutoCloseTime: true } },
      },
    })
    const due = openShifts.filter((shift) =>
      isWorkShiftAutoCloseDue({
        now,
        openedAt: shift.openedAt,
        timezone: shift.company.timezone,
        closeTime: shift.company.shiftAutoCloseTime,
      }),
    )
    let closed = 0
    for (const shift of due) {
      /**
       * 106A: close at the configured boundary, not at the moment this loop reached the row.
       * A null boundary means existing configuration does not justify one — see
       * resolveWorkShiftAutoCloseAt — and the pre-106A behaviour (`now`) is kept unchanged
       * rather than replaced by an invented rule.
       */
      const boundary = resolveWorkShiftAutoCloseAt({
        now,
        openedAt: shift.openedAt,
        timezone: shift.company.timezone,
        closeTime: shift.company.shiftAutoCloseTime,
      })

      const didClose = await this.closeShiftById(
        shift.id,
        WorkShiftStatus.AUTO_CLOSED,
        null,
        `AUTO_CLOSE_${shift.company.shiftAutoCloseTime}`,
        boundary ?? now,
        { sweptAt: now, boundaryResolved: boundary !== null },
      )
      if (didClose) closed += 1
    }
    return closed
  }

  /**
   * 106A: `closedAt` is now the effective close instant supplied by the caller, not
   * unconditionally "right now".
   *
   * Manual close still passes the current time, so nothing changes there. Auto-close passes
   * the configured boundary. The claim stays an OPEN-guarded updateMany, so a second sweeper
   * pass over the same row still finds count 0 and returns false — idempotency is unchanged
   * and does not depend on the timestamp.
   */
  private async closeShiftById(
    shiftId: string,
    status: WorkShiftStatus,
    actorUserId: string | null,
    reason: string,
    closedAt = new Date(),
    audit?: { sweptAt: Date; boundaryResolved: boolean },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.workShift.updateMany({
        where: { id: shiftId, status: WorkShiftStatus.OPEN },
        data: { status, closedAt, closeReason: reason },
      })
      if (claimed.count === 0) return false

      const shift = await tx.workShift.findUnique({
        where: { id: shiftId },
        include: {
          workLogs: {
            where: { status: WorkLogStatus.RUNNING },
            include: { ticket: { select: { companyId: true } } },
          },
        },
      })
      if (!shift) throw new NotFoundException('Work shift not found after close claim')

      for (const log of shift.workLogs) {
        /**
         * 106A: a running log ends with its shift. Pulling the shift's end back to the
         * configured boundary must not drag a log's end before its own start, which can happen
         * for a log begun in the window between the boundary and the sweeper pass — the shift
         * was still OPEN then, so starting work was legal. Such a log ends at its start
         * instant (one minute by elapsedMinutes' floor) rather than being given a negative
         * duration or being silently discarded.
         */
        const logEndedAt = log.startedAt > closedAt ? log.startedAt : closedAt
        const durationMinutes = elapsedMinutes(log.startedAt, logEndedAt)
        await tx.workLog.update({
          where: { id: log.id },
          data: {
            status: status === WorkShiftStatus.AUTO_CLOSED ? WorkLogStatus.AUTO_STOPPED : WorkLogStatus.STOPPED,
            endedAt: logEndedAt,
            durationMinutes,
          },
        })
        await tx.domainEvent.create({
          data: {
            companyId: log.ticket.companyId,
            entityType: 'Ticket',
            entityId: log.ticketId,
            type: status === WorkShiftStatus.AUTO_CLOSED ? 'ticket.work_auto_stopped' : 'ticket.work_stopped',
            actorUserId,
            payload: { workLogId: log.id, durationMinutes, shiftId },
          },
        })
      }

      await tx.domainEvent.create({
        data: {
          companyId: shift.companyId,
          entityType: 'WorkShift',
          entityId: shift.id,
          type: status === WorkShiftStatus.AUTO_CLOSED ? 'workforce.shift_auto_closed' : 'workforce.shift_closed',
          actorUserId,
          payload: {
            closedAt: closedAt.toISOString(),
            reason,
            // 106A: keeps the sweeper's own clock visible for audit without moving closedAt.
            ...(audit
              ? { sweptAt: audit.sweptAt.toISOString(), boundaryResolved: audit.boundaryResolved }
              : {}),
          },
        },
      })
      return true
    })
  }

  private async assertActiveActor(actor: WorkforceActor) {
    const user = await this.prisma.user.findFirst({
      where: { id: actor.id, companyId: actor.companyId, isActive: true, deletedAt: null },
      select: { id: true },
    })
    if (!user) throw new ForbiddenException('Active employee account required')
  }

  private parseDate(value: string | undefined, field: string, fallback: Date) {
    if (!value) return fallback
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException(`${field} must be an ISO date`)
    return parsed
  }
}
