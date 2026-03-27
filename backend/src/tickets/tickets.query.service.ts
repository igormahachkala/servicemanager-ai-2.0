import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { TicketStatus, UserRole } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'

import { TicketsPolicy, type BoardQueryInput } from '../policy/tickets.policy'
import { assertAllowed } from '../policy/policy.utils'

type AccessFlags = {
  canTechnicianViewAllCompanyTickets?: boolean
}

const PROVIDER_MANAGEMENT_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MASTER,
  UserRole.DISPATCHER,
  UserRole.NETWORK_DIRECTOR,
]

@Injectable()
export class TicketsQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timelineService: TimelineService,
    private readonly serviceContractsService: ServiceContractsService,
  ) {}

  private readonly policy = new TicketsPolicy()

  private ensureProviderLinkedClientRole(role: UserRole) {
    if (!PROVIDER_MANAGEMENT_ROLES.includes(role)) {
      throw new ForbiddenException('Role cannot access linked client tickets')
    }
  }

  private async resolveScopedCompanyId(companyId: string, role: UserRole, linkedClientCompanyId?: string) {
    if (!linkedClientCompanyId || linkedClientCompanyId === companyId) {
      return companyId
    }

    this.ensureProviderLinkedClientRole(role)
    await this.serviceContractsService.assertPrimaryLinkedClientAccess(companyId, linkedClientCompanyId)
    return linkedClientCompanyId
  }

  async board(
    companyId: string,
    userId: string,
    role: UserRole,
    input: BoardQueryInput,
    accessFlags?: AccessFlags,
    linkedClientCompanyId?: string,
  ) {
    const scopedCompanyId = await this.resolveScopedCompanyId(companyId, role, linkedClientCompanyId)
    const decision = this.policy.boardWhere({ id: userId, role, companyId: scopedCompanyId, accessFlags }, input)
    assertAllowed(decision)

    const nowMs = Date.now()
    const atRiskThresholdMs = decision.where.meta.atRiskThresholdMinutes * 60_000

    const tickets = await this.prisma.ticket.findMany({
      where: decision.where.where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        urgency: true,
        createdAt: true,
        slaDueAt: true,
        slaBreachedAt: true,
        problemText: true,
        pointName: true,
        location: {
          select: {
            id: true,
            name: true,
            platformCode: true,
            externalCode: true,
            city: true,
            address: true,
          },
        },
        problemCategory: { select: { id: true, name: true } },
        equipment: { select: { id: true, name: true, type: true, status: true } },
        assignedTechnician: { select: { id: true, email: true } },
        parentId: true,
      },
      take: decision.where.take,
    })

    const allStatuses: TicketStatus[] = [
      TicketStatus.NEW,
      TicketStatus.ASSIGNED,
      TicketStatus.IN_PROGRESS,
      TicketStatus.DONE,
      TicketStatus.CANCELED,
    ]

    const columns = allStatuses.map((st) => {
      const byStatus = tickets.filter((t) => t.status === st)

      let breached = 0
      let atRisk = 0

      for (const t of byStatus) {
        const due = t.slaDueAt ? t.slaDueAt.getTime() : null
        const isBreached = !!t.slaBreachedAt || (due !== null && nowMs > due)
        const isAtRisk = !isBreached && due !== null && nowMs > due - atRiskThresholdMs

        if (isBreached) breached += 1
        else if (isAtRisk) atRisk += 1
      }

      const cards = byStatus.map((t) => ({
        id: t.id,
        title: t.problemCategory.name,
        description: t.problemText,
        status: t.status,
        urgency: t.urgency,
        createdAt: t.createdAt,
        slaDueAt: t.slaDueAt,
        slaBreached: !!t.slaBreachedAt || (t.slaDueAt ? nowMs > t.slaDueAt.getTime() : false),
        isChild: !!t.parentId,
        pointName: t.pointName,
        location: t.location,
        category: t.problemCategory,
        assignedTechnician: t.assignedTechnician,
      }))

      return {
        status: st,
        total: byStatus.length,
        sla: { breached, atRisk },
        cards,
      }
    })

    return {
      columns,
      meta: {
        totalTickets: tickets.length,
        atRiskThresholdMinutes: decision.where.meta.atRiskThresholdMinutes,
        limitedToLast: decision.where.meta.limitedToLast,
        scopeCompanyId: scopedCompanyId,
        visibilityMode: scopedCompanyId === companyId ? 'tenant' : 'provider_primary',
      },
    }
  }

  async list(
    companyId: string,
    userId: string,
    role: UserRole,
    status?: TicketStatus,
    accessFlags?: AccessFlags,
    linkedClientCompanyId?: string,
  ) {
    const scopedCompanyId = await this.resolveScopedCompanyId(companyId, role, linkedClientCompanyId)
    const decision = this.policy.listWhere({ id: userId, role, companyId: scopedCompanyId, accessFlags }, status)
    assertAllowed(decision)

    return this.prisma.ticket.findMany({
      where: decision.where,
      orderBy: { createdAt: 'desc' },
      include: {
        location: {
          select: {
            id: true,
            name: true,
            platformCode: true,
            externalCode: true,
            city: true,
            region: true,
            address: true,
          },
        },
        problemCategory: { select: { id: true, name: true } },
        assignedTechnician: { select: { id: true, email: true } },
      },
    })
  }

  async getOne(companyId: string, userId: string, role: UserRole, ticketId: string, accessFlags?: AccessFlags) {
    const ownDecision = this.policy.getOneWhere({ id: userId, role, companyId, accessFlags }, ticketId)
    assertAllowed(ownDecision)

    const include = {
      location: {
        select: {
          id: true,
          name: true,
          platformCode: true,
          externalCode: true,
          city: true,
          region: true,
          address: true,
          latitude: true,
          longitude: true,
          isActive: true,
        },
      },
      problemCategory: { select: { id: true, name: true, instructions: true } },
      equipment: { select: { id: true, name: true, type: true, status: true } },
      assignedTechnician: { select: { id: true, email: true } },
      statusHistory: { orderBy: { createdAt: 'asc' as const } },
      parent: {
        select: {
          id: true,
          problemText: true,
          status: true,
          createdAt: true,
          location: {
            select: {
              id: true,
              name: true,
              platformCode: true,
              city: true,
              address: true,
            },
          },
        },
      },
      children: {
        orderBy: { createdAt: 'asc' as const },
        include: {
          location: {
            select: {
              id: true,
              name: true,
              platformCode: true,
              city: true,
              address: true,
            },
          },
          problemCategory: { select: { id: true, name: true } },
          assignedTechnician: { select: { id: true, email: true } },
        },
      },
    }

    let ticket = await this.prisma.ticket.findFirst({
      where: ownDecision.where,
      include,
    })

    if (!ticket && PROVIDER_MANAGEMENT_ROLES.includes(role)) {
      const linkedClientIds = await this.serviceContractsService.listPrimaryLinkedClientIds(companyId)
      if (linkedClientIds.length > 0) {
        ticket = await this.prisma.ticket.findFirst({
          where: {
            id: ticketId,
            companyId: { in: linkedClientIds },
          },
          include,
        })
      }
    }

    if (!ticket) throw new NotFoundException('Ticket not found')
    return {
      ...ticket,
      title: ticket.problemCategory?.name || 'Ticket',
      description: ticket.problemText,
    }
  }

  async timeline(companyId: string, userId: string, role: UserRole, ticketId: string, accessFlags?: AccessFlags) {
    return this.timelineService.getTicketTimeline({ id: userId, role, companyId, accessFlags }, ticketId)
  }
}
