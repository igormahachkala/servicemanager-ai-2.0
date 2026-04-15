import { Injectable, NotFoundException } from '@nestjs/common'
import { TicketStatus, UserRole } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'

import { TicketsPolicy, type BoardQueryInput } from '../policy/tickets.policy'
import { assertAllowed } from '../policy/policy.utils'
import {
  PROVIDER_LINKED_OVERVIEW_ROLES,
  resolveReadableTicketAccess,
  resolveTechnicianOperationalScope,
  resolveTicketReadScope,
} from './ticket-access.utils'
import { TicketMetaBuilder } from './ticket-meta.builder'

type AccessFlags = {
  canTechnicianViewAllCompanyTickets?: boolean
}

@Injectable()
export class TicketsQueryService {
  private readonly ticketMetaBuilder: TicketMetaBuilder

  constructor(
    private readonly prisma: PrismaService,
    private readonly timelineService: TimelineService,
    private readonly serviceContractsService: ServiceContractsService,
  ) {
    this.ticketMetaBuilder = new TicketMetaBuilder(this.prisma, this.serviceContractsService)
  }

  private readonly policy = new TicketsPolicy()

  private applyContextFilters(where: any, params: { locationId?: string; equipmentId?: string }) {
    const extraAnd: any[] = []
    if (params.locationId && params.locationId.trim().length > 0) {
      extraAnd.push({ locationId: params.locationId.trim() })
    }
    if (params.equipmentId && params.equipmentId.trim().length > 0) {
      extraAnd.push({ equipmentId: params.equipmentId.trim() })
    }
    if (!extraAnd.length) return where
    return this.normalizeAnd(where, extraAnd)
  }

  private normalizeAnd(where: any, extra: any[]) {
    const base = where.AND
    const baseArr = Array.isArray(base) ? base : base ? [base] : []
    return { ...where, AND: [...baseArr, ...extra] }
  }

  private buildTechnicianBoardQuery(params: {
    companyIds: string[]
    userId: string
    specializationIds: string[]
    allowTechnicianClaim: boolean
    input: BoardQueryInput
  }) {
    const atRiskThresholdMinutes = 60
    const limitedToLast = Math.min(Math.max(params.input.take ?? 500, 1), 500)
    const companyScope =
      params.companyIds.length === 1 ? { companyId: params.companyIds[0] } : { companyId: { in: params.companyIds } }

    const visibilityOr: any[] = [{ ...companyScope, assignedTechnicianId: params.userId }]

    if (params.allowTechnicianClaim) {
      if (params.specializationIds.length > 0) {
        visibilityOr.push({
          ...companyScope,
          status: TicketStatus.NEW,
          assignedTechnicianId: null,
          problemCategory: {
            specializationLinks: {
              some: {
                specializationId: { in: params.specializationIds },
              },
            },
          },
        })
      }

      visibilityOr.push({
        ...companyScope,
        status: TicketStatus.NEW,
        assignedTechnicianId: null,
        problemCategory: {
          specializationLinks: {
            none: {},
          },
        },
      })
    }

    let where: any = visibilityOr.length === 1 ? visibilityOr[0] : { OR: visibilityOr }
    const extraAnd: any[] = []

    if (params.input.statuses && params.input.statuses.length > 0) {
      extraAnd.push({ status: { in: params.input.statuses } })
    }

    if (typeof params.input.assigneeId === 'string' && params.input.assigneeId.length > 0) {
      extraAnd.push({ assignedTechnicianId: params.input.assigneeId })
    } else if (params.input.assigneeId === null) {
      extraAnd.push({ assignedTechnicianId: null })
    }

    if (params.input.q && params.input.q.trim().length > 0) {
      const q = params.input.q.trim()
      extraAnd.push({
        OR: [
          { problemText: { contains: q, mode: 'insensitive' } },
          { problemCategory: { name: { contains: q, mode: 'insensitive' } } },
        ],
      })
    }

    if (params.input.locationId && params.input.locationId.trim().length > 0) {
      extraAnd.push({ locationId: params.input.locationId.trim() })
    }
    if (params.input.equipmentId && params.input.equipmentId.trim().length > 0) {
      extraAnd.push({ equipmentId: params.input.equipmentId.trim() })
    }

    const now = new Date()
    const threshold = new Date(now.getTime() + atRiskThresholdMinutes * 60_000)

    if (params.input.sla === 'breached') {
      extraAnd.push({
        OR: [{ slaBreachedAt: { not: null } }, { slaDueAt: { lt: now } }],
      })
    }

    if (params.input.sla === 'atRisk') {
      extraAnd.push({
        AND: [
          { slaBreachedAt: null },
          { slaDueAt: { not: null } },
          { slaDueAt: { gte: now } },
          { slaDueAt: { lte: threshold } },
        ],
      })
    }

    if (params.input.sla === 'ok') {
      extraAnd.push({
        AND: [
          { OR: [{ slaDueAt: null }, { slaDueAt: { gt: threshold } }] },
          { slaBreachedAt: null },
          { OR: [{ slaDueAt: null }, { slaDueAt: { gte: now } }] },
        ],
      })
    }

    if (extraAnd.length > 0) {
      where = this.normalizeAnd(where, extraAnd)
    }

    return {
      where,
      take: limitedToLast,
      meta: { atRiskThresholdMinutes, limitedToLast },
    }
  }

  private buildTechnicianListWhere(params: {
    companyIds: string[]
    userId: string
    specializationIds: string[]
    allowTechnicianClaim: boolean
    status?: TicketStatus
  }) {
    const companyScope =
      params.companyIds.length === 1 ? { companyId: params.companyIds[0] } : { companyId: { in: params.companyIds } }

    const visibilityOr: any[] = [{ ...companyScope, assignedTechnicianId: params.userId }]

    if (params.allowTechnicianClaim) {
      if (params.specializationIds.length > 0) {
        visibilityOr.push({
          ...companyScope,
          status: TicketStatus.NEW,
          assignedTechnicianId: null,
          problemCategory: {
            specializationLinks: {
              some: {
                specializationId: { in: params.specializationIds },
              },
            },
          },
        })
      }

      visibilityOr.push({
        ...companyScope,
        status: TicketStatus.NEW,
        assignedTechnicianId: null,
        problemCategory: {
          specializationLinks: {
            none: {},
          },
        },
      })
    }

    const baseWhere: any = visibilityOr.length === 1 ? visibilityOr[0] : { OR: visibilityOr }
    if (params.status === undefined) return baseWhere
    return this.normalizeAnd(baseWhere, [{ status: params.status }])
  }
  async board(
    companyId: string,
    userId: string,
    role: UserRole,
    input: BoardQueryInput,
    accessFlags?: AccessFlags,
    linkedClientCompanyId?: string,
    observerCompanyId?: string,
  ) {
    const technicianScope = role === UserRole.TECHNICIAN && !observerCompanyId
      ? await resolveTechnicianOperationalScope({
          prisma: this.prisma,
          serviceContractsService: this.serviceContractsService,
          actor: { id: userId, role, companyId, accessFlags },
          linkedClientCompanyId,
        })
      : null

    const scope = technicianScope
      ? {
          scopeCompanyId: technicianScope.scopeCompanyId,
          visibilityMode: technicianScope.visibilityMode,
        }
      : await resolveTicketReadScope({
          prisma: this.prisma,
          serviceContractsService: this.serviceContractsService,
          actorCompanyId: companyId,
          role,
          linkedClientCompanyId,
          observerCompanyId,
          allowedLinkedClientRoles: PROVIDER_LINKED_OVERVIEW_ROLES,
        })

    const decision = technicianScope
      ? this.buildTechnicianBoardQuery({
          companyIds: technicianScope.companyIds,
          userId,
          specializationIds: technicianScope.specializationIds,
          allowTechnicianClaim: technicianScope.allowTechnicianClaim,
          input,
        })
      : (() => {
          const ownTenantScopeCompanyId =
            !observerCompanyId && !linkedClientCompanyId && (role === UserRole.CLIENT || role === UserRole.ADMIN)
              ? companyId
              : scope.scopeCompanyId

          const policyDecision = this.policy.boardWhere({ id: userId, role, companyId: ownTenantScopeCompanyId, accessFlags }, input)
          assertAllowed(policyDecision)
          return policyDecision.where
        })()

    const nowMs = Date.now()
    const atRiskThresholdMs = decision.meta.atRiskThresholdMinutes * 60_000

    const tickets = await this.prisma.ticket.findMany({
      where: decision.where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        companyId: true,
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
      take: decision.take,
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
        companyId: t.companyId,
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
        atRiskThresholdMinutes: decision.meta.atRiskThresholdMinutes,
        limitedToLast: decision.meta.limitedToLast,
        scopeCompanyId: scope.scopeCompanyId,
        visibilityMode: scope.visibilityMode,
      },
    }
  }

  async contextAnalytics(
    companyId: string,
    userId: string,
    role: UserRole,
    accessFlags?: AccessFlags,
    linkedClientCompanyId?: string,
    observerCompanyId?: string,
    locationId?: string,
    equipmentId?: string,
  ) {
    const technicianScope = role === UserRole.TECHNICIAN && !observerCompanyId
      ? await resolveTechnicianOperationalScope({
          prisma: this.prisma,
          serviceContractsService: this.serviceContractsService,
          actor: { id: userId, role, companyId, accessFlags },
          linkedClientCompanyId,
        })
      : null

    const scope = technicianScope
      ? {
          scopeCompanyId: technicianScope.scopeCompanyId,
          visibilityMode: technicianScope.visibilityMode,
        }
      : await resolveTicketReadScope({
          prisma: this.prisma,
          serviceContractsService: this.serviceContractsService,
          actorCompanyId: companyId,
          role,
          linkedClientCompanyId,
          observerCompanyId,
          allowedLinkedClientRoles: PROVIDER_LINKED_OVERVIEW_ROLES,
        })

    const baseWhere = technicianScope
      ? this.buildTechnicianBoardQuery({
          companyIds: technicianScope.companyIds,
          userId,
          specializationIds: technicianScope.specializationIds,
          allowTechnicianClaim: technicianScope.allowTechnicianClaim,
          input: {},
        }).where
      : (() => {
          const ownTenantScopeCompanyId =
            !observerCompanyId && !linkedClientCompanyId && (role === UserRole.CLIENT || role === UserRole.ADMIN)
              ? companyId
              : scope.scopeCompanyId
          const policyDecision = this.policy.listWhere({ id: userId, role, companyId: ownTenantScopeCompanyId, accessFlags })
          assertAllowed(policyDecision)
          const resolvedWhere = policyDecision.where as any
          if (
            resolvedWhere &&
            typeof resolvedWhere === 'object' &&
            'where' in resolvedWhere &&
            resolvedWhere.where &&
            typeof resolvedWhere.where === 'object'
          ) {
            return resolvedWhere.where
          }
          return resolvedWhere
        })()
    const where = this.applyContextFilters(baseWhere, { locationId, equipmentId })

    const rows = await this.prisma.ticket.findMany({
      where,
      select: {
        status: true,
        location: { select: { id: true, name: true } },
        equipment: { select: { id: true, name: true } },
      },
    })

    const ensureBucket = () => ({ total: 0, NEW: 0, IN_PROGRESS: 0, DONE: 0 })
    const byLocation = new Map<string, { locationId: string; locationName: string; total: number; NEW: number; IN_PROGRESS: number; DONE: number }>()
    const byEquipment = new Map<string, { equipmentId: string; equipmentName: string; locationId: string | null; locationName: string | null; total: number; NEW: number; IN_PROGRESS: number; DONE: number }>()

    for (const row of rows) {
      const status = row.status
      if (row.location?.id) {
        const current = byLocation.get(row.location.id) || {
          locationId: row.location.id,
          locationName: row.location.name,
          ...ensureBucket(),
        }
        current.total += 1
        if (status === TicketStatus.NEW) current.NEW += 1
        if (status === TicketStatus.IN_PROGRESS) current.IN_PROGRESS += 1
        if (status === TicketStatus.DONE) current.DONE += 1
        byLocation.set(row.location.id, current)
      }

      if (row.equipment?.id) {
        const current = byEquipment.get(row.equipment.id) || {
          equipmentId: row.equipment.id,
          equipmentName: row.equipment.name,
          locationId: row.location?.id || null,
          locationName: row.location?.name || null,
          ...ensureBucket(),
        }
        current.total += 1
        if (status === TicketStatus.NEW) current.NEW += 1
        if (status === TicketStatus.IN_PROGRESS) current.IN_PROGRESS += 1
        if (status === TicketStatus.DONE) current.DONE += 1
        byEquipment.set(row.equipment.id, current)
      }
    }

    return {
      byLocation: Array.from(byLocation.values()).sort((a, b) => b.total - a.total),
      byEquipment: Array.from(byEquipment.values()).sort((a, b) => b.total - a.total),
      meta: {
        totalTickets: rows.length,
        scopeCompanyId: scope.scopeCompanyId,
        visibilityMode: scope.visibilityMode,
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
    observerCompanyId?: string,
  ) {
    const technicianScope = role === UserRole.TECHNICIAN && !observerCompanyId
      ? await resolveTechnicianOperationalScope({
          prisma: this.prisma,
          serviceContractsService: this.serviceContractsService,
          actor: { id: userId, role, companyId, accessFlags },
          linkedClientCompanyId,
        })
      : null

    const scope = technicianScope
      ? {
          scopeCompanyId: technicianScope.scopeCompanyId,
          visibilityMode: technicianScope.visibilityMode,
        }
      : await resolveTicketReadScope({
          prisma: this.prisma,
          serviceContractsService: this.serviceContractsService,
          actorCompanyId: companyId,
          role,
          linkedClientCompanyId,
          observerCompanyId,
          allowedLinkedClientRoles: PROVIDER_LINKED_OVERVIEW_ROLES,
        })

    const where = technicianScope
      ? this.buildTechnicianListWhere({
          companyIds: technicianScope.companyIds,
          userId,
          specializationIds: technicianScope.specializationIds,
          allowTechnicianClaim: technicianScope.allowTechnicianClaim,
          status,
        })
      : (() => {
          const ownTenantScopeCompanyId =
            !observerCompanyId && !linkedClientCompanyId && (role === UserRole.CLIENT || role === UserRole.ADMIN)
              ? companyId
              : scope.scopeCompanyId

          const decision = this.policy.listWhere({ id: userId, role, companyId: ownTenantScopeCompanyId, accessFlags }, status)
          assertAllowed(decision)
          return decision.where
        })()
    return this.prisma.ticket.findMany({
      where,
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

  async getOne(
    companyId: string,
    userId: string,
    role: UserRole,
    ticketId: string,
    accessFlags?: AccessFlags,
    observerCompanyId?: string,
    linkedClientCompanyId?: string,
  ) {
    const readable = await resolveReadableTicketAccess({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor: { id: userId, role, companyId, accessFlags },
      ticketId,
      linkedClientCompanyId,
      observerCompanyId,
    })

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

    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        companyId: readable.ticket.companyId,
      },
      include,
    })

    if (!ticket) throw new NotFoundException('Ticket not found')

    const meta = await this.ticketMetaBuilder.buildForGetOne({
      actorCompanyId: companyId,
      userId,
      role,
      ticketId,
      ticketStatus: ticket.status,
      assignedTechnicianId: ticket.assignedTechnicianId,
      scopeCompanyId: readable.scopeCompanyId,
      visibilityMode: readable.visibilityMode,
      linkedClientCompanyId,
    })

    return {
      ...ticket,
      title: ticket.problemCategory?.name || 'Ticket',
      description: ticket.problemText,
      meta,
    }
  }

  async timeline(
    companyId: string,
    userId: string,
    role: UserRole,
    ticketId: string,
    accessFlags?: AccessFlags,
    linkedClientCompanyId?: string,
    observerCompanyId?: string,
  ) {
    return this.timelineService.getTicketTimeline(
      { id: userId, role, companyId, accessFlags },
      ticketId,
      linkedClientCompanyId,
      observerCompanyId,
    )
  }
}
