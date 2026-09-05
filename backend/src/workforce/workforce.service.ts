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
import { elapsedMinutes, isWorkShiftAutoCloseDue, parseShiftCloseTime } from './workforce-time'

type WorkforceActor = TicketAccessActor

const shiftInclude = {
  user: {
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
  },
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
        select: { id: true, name: true, timezone: true, shiftAutoCloseTime: true },
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
    for (const shift of shifts) {
      const row = employeeMap.get(shift.userId) ?? {
        user: shift.user,
        shifts: 0,
        shiftMinutes: 0,
        workMinutes: 0,
        tickets: new Set<string>(),
      }
      row.shifts += 1
      row.shiftMinutes += elapsedMinutes(shift.openedAt, shift.closedAt ?? now)
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
      shifts,
      serverNow: now,
    }
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
      const didClose = await this.closeShiftById(
        shift.id,
        WorkShiftStatus.AUTO_CLOSED,
        null,
        `AUTO_CLOSE_${shift.company.shiftAutoCloseTime}`,
        now,
      )
      if (didClose) closed += 1
    }
    return closed
  }

  private async closeShiftById(
    shiftId: string,
    status: WorkShiftStatus,
    actorUserId: string | null,
    reason: string,
    now = new Date(),
  ) {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.workShift.updateMany({
        where: { id: shiftId, status: WorkShiftStatus.OPEN },
        data: { status, closedAt: now, closeReason: reason },
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
        const durationMinutes = elapsedMinutes(log.startedAt, now)
        await tx.workLog.update({
          where: { id: log.id },
          data: {
            status: status === WorkShiftStatus.AUTO_CLOSED ? WorkLogStatus.AUTO_STOPPED : WorkLogStatus.STOPPED,
            endedAt: now,
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
          payload: { closedAt: now.toISOString(), reason },
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
