import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, ServiceContractRole, TicketStatus, UserRole } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'

import { TicketsPolicy, type BoardQueryInput } from '../policy/tickets.policy'
import { assertAllowed } from '../policy/policy.utils'
import {
  applyLocationScopeToTicketWhere,
  buildSecondaryOperationalRestrictionWhere,
  buildSpecializationLinksSomeWhereInput,
  buildTechnicianLocationRestrictionWhere,
  PROVIDER_LINKED_OVERVIEW_ROLES,
  resolveActorLocationScope,
  resolveReadableTicketAccess,
  resolveTechnicianOperationalScope,
  resolveTicketReadScope,
  isTechnicianLocationAllowed,
  technicianMatchesCategorySpecializationLinks,
} from './ticket-access.utils'
import { TicketMetaBuilder } from './ticket-meta.builder'
import { TICKET_ASSIGNMENT_REQUESTED_ENTITY, TICKET_ASSIGNMENT_REQUESTED_EVENT } from './ticket-domain-event.types'
import { isExecutorCapableRole } from '../common/executor.utils'
import { loadBoardImageAttachmentSummaries } from './board-attachment-summary'

const companyIdentitySelect = {
  id: true,
  name: true,
  legalName: true,
  brandName: true,
  type: true,
} as const

const userIdentitySelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  companyId: true,
  company: { select: companyIdentitySelect },
} as const

const assignedTechnicianIdentitySelect = {
  ...userIdentitySelect,
  phone: true,
} as const

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

  private safeTicketWhereOrNull(where: unknown) {
    if (!where || typeof where !== 'object' || Array.isArray(where)) {
      return null
    }
    return where as Record<string, unknown>
  }

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

  private applyArchivedFilter(where: Prisma.TicketWhereInput, includeArchived?: boolean): Prisma.TicketWhereInput {
    if (includeArchived) return where
    const archiveThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    return this.normalizeAnd(where, [
      {
        OR: [
          { status: { not: TicketStatus.DONE } },
          { closedAt: { gte: archiveThreshold } },
          {
            AND: [{ closedAt: null }, { updatedAt: { gte: archiveThreshold } }],
          },
        ],
      },
    ]) as Prisma.TicketWhereInput
  }

  private buildTechnicianBoardQuery(params: {
    companyIds: string[]
    locationScopeByCompany: Record<string, string[]>
    userId: string
    specializationIds: string[]
    specializationNames: string[]
    allowTechnicianClaim: boolean
    input: BoardQueryInput
  }) {
    const atRiskThresholdMinutes = 60
    const limitedToLast = Math.min(Math.max(params.input.take ?? 500, 1), 500)
    const companyScope =
      params.companyIds.length === 1 ? { companyId: params.companyIds[0] } : { companyId: { in: params.companyIds } }

    const visibilityOr: any[] = [{ ...companyScope, assignedTechnicianId: params.userId }]

    // Board: NEW unassigned visibility follows company + location scope only (no category/specialization gate).
    // Claim/available endpoints keep specialization matching in assignment/ticket-access flows.
    if (params.allowTechnicianClaim) {
      visibilityOr.push({
        ...companyScope,
        status: TicketStatus.NEW,
        assignedTechnicianId: null,
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
    where = this.normalizeAnd(where, [
      buildTechnicianLocationRestrictionWhere({
        companyIds: params.companyIds,
        locationScopeByCompany: params.locationScopeByCompany,
      }),
    ])

    return {
      where,
      take: limitedToLast,
      meta: { atRiskThresholdMinutes, limitedToLast },
    }
  }

  private buildTechnicianListWhere(params: {
    companyIds: string[]
    locationScopeByCompany: Record<string, string[]>
    userId: string
    specializationIds: string[]
    specializationNames: string[]
    allowTechnicianClaim: boolean
    status?: TicketStatus
  }) {
    const companyScope =
      params.companyIds.length === 1 ? { companyId: params.companyIds[0] } : { companyId: { in: params.companyIds } }

    const visibilityOr: any[] = [{ ...companyScope, assignedTechnicianId: params.userId }]

    if (params.allowTechnicianClaim) {
      const specSome = buildSpecializationLinksSomeWhereInput({
        specializationIds: params.specializationIds,
        specializationNames: params.specializationNames,
      })
      if (specSome) {
        visibilityOr.push({
          ...companyScope,
          status: TicketStatus.NEW,
          assignedTechnicianId: null,
          problemCategory: {
            specializationLinks: {
              some: specSome,
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
    const withStatus = params.status === undefined ? baseWhere : this.normalizeAnd(baseWhere, [{ status: params.status }])
    return this.normalizeAnd(withStatus, [
      buildTechnicianLocationRestrictionWhere({
        companyIds: params.companyIds,
        locationScopeByCompany: params.locationScopeByCompany,
      }),
    ])
  }
  /**
   * Returns an additional WHERE clause that restricts the board to the
   * operational scope of a SECONDARY provider. Explicit linked-client scopes
   * are checked directly; aggregate technician scopes only narrow SECONDARY
   * client companies and leave own/PRIMARY companies unchanged.
   *
   * SECONDARY operational scope:
   *  – tickets assigned to an executor from the SECONDARY provider company
   *  – tickets at locations bound to any user of the SECONDARY provider for the client
   */
  private async resolveSecondaryOperationalWhere(params: {
    providerCompanyId: string
    linkedClientCompanyId?: string
    technicianScope: { companyIds: string[] } | null
    actor: { id: string; role: UserRole; companyId: string; accessFlags?: AccessFlags }
  }): Promise<Prisma.TicketWhereInput | null> {
    return buildSecondaryOperationalRestrictionWhere({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      providerCompanyId: params.providerCompanyId,
      linkedClientCompanyId: params.linkedClientCompanyId,
      scopeCompanyIds: params.technicianScope?.companyIds,
      actor: params.actor,
    })
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
    const technicianScope =
      role === UserRole.TECHNICIAN
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
          allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
        })

    const atRiskThresholdMinutes = 60
    const limitedToLast = Math.min(Math.max(input.take ?? 500, 1), 500)
    const decision = technicianScope
      ? this.buildTechnicianBoardQuery({
          companyIds: technicianScope.companyIds,
          locationScopeByCompany: technicianScope.locationScopeByCompany,
          userId,
          specializationIds: technicianScope.specializationIds,
          specializationNames: technicianScope.specializationNames,
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
          const policyQuery = this.safeTicketWhereOrNull(policyDecision.where)
          let prismaWhere = (policyQuery?.where ?? policyDecision.where) as any
          if (!prismaWhere || typeof prismaWhere !== 'object' || Array.isArray(prismaWhere)) {
            prismaWhere = {}
          }
          if ('where' in prismaWhere) {
            const nestedWhere = prismaWhere.where
            prismaWhere =
              nestedWhere && typeof nestedWhere === 'object' && !Array.isArray(nestedWhere) ? nestedWhere : {}
          }

          const take =
            typeof policyQuery?.take === 'number'
              ? policyQuery.take
              : typeof (policyDecision as any).take === 'number'
                ? (policyDecision as any).take
                : limitedToLast
          const queryMeta = this.safeTicketWhereOrNull(policyQuery?.meta ?? (policyDecision as any).meta)
          const meta = {
            atRiskThresholdMinutes:
              typeof queryMeta?.atRiskThresholdMinutes === 'number'
                ? queryMeta.atRiskThresholdMinutes
                : atRiskThresholdMinutes,
            limitedToLast:
              typeof queryMeta?.limitedToLast === 'number'
                ? queryMeta.limitedToLast
                : limitedToLast,
          }

          return { where: prismaWhere, take, meta }
        })()

    const locationScope = technicianScope
      ? { mode: 'tenant_wide' as const, locationIds: [] as string[] }
      : await resolveActorLocationScope({
          prisma: this.prisma,
          actor: { id: userId, role, companyId, accessFlags },
          scopeCompanyId: scope.scopeCompanyId,
        })
    const whereWithLocationScope = applyLocationScopeToTicketWhere(decision.where, locationScope)

    // SECONDARY providers must only see tickets within their operational scope:
    // assigned to their executors, at locations bound to their company, or (NEW/unassigned).
    // Without this restriction they would receive the full client management board.
    const secondaryOperationalWhere = await this.resolveSecondaryOperationalWhere({
      providerCompanyId: companyId,
      linkedClientCompanyId,
      technicianScope,
      actor: { id: userId, role, companyId, accessFlags },
    })
    const whereAfterSecondary =
      secondaryOperationalWhere !== null
        ? { AND: [whereWithLocationScope, secondaryOperationalWhere] }
        : whereWithLocationScope

    const whereWithArchiveFilter = this.applyArchivedFilter(whereAfterSecondary, input.includeArchived)

    const nowMs = Date.now()
    const atRiskThresholdMs = decision.meta.atRiskThresholdMinutes * 60_000

    let prismaWhere = whereWithArchiveFilter as any
    if (prismaWhere && typeof prismaWhere === 'object' && !Array.isArray(prismaWhere) && 'where' in prismaWhere) {
      const nestedWhere = prismaWhere.where
      prismaWhere =
        nestedWhere && typeof nestedWhere === 'object' && !Array.isArray(nestedWhere) ? nestedWhere : {}
    }
    const safeBoardWhere = this.safeTicketWhereOrNull(prismaWhere)
    const tickets = safeBoardWhere
      ? await this.prisma.ticket.findMany({
          where: safeBoardWhere,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            companyId: true,
            company: { select: companyIdentitySelect },
            ticketNumber: true,
            status: true,
            urgency: true,
            priority: true,
            urgencyReason: true,
            createdAt: true,
            slaDueAt: true,
            slaBreachedAt: true,
            problemText: true,
            requesterName: true,
            createdByUserId: true,
            createdByUser: { select: userIdentitySelect },
            pointName: true,
            locationId: true,
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
            problemCategory: {
              select: {
                id: true,
                name: true,
                specializationLinks: {
                  select: {
                    specializationId: true,
                    specialization: { select: { name: true } },
                  },
                },
              },
            },
            equipment: { select: { id: true, name: true, type: true, status: true } },
            assignedTechnicianId: true,
            assignedTechnician: { select: assignedTechnicianIdentitySelect },
            parentId: true,
          },
          take: decision.take,
        })
      : []

    const imageAttachmentSummaries = await loadBoardImageAttachmentSummaries(
      this.prisma,
      tickets.map((ticket) => ticket.id),
    )

    const assignmentRequestedByCurrentUserIds = new Set<string>()
    if (isExecutorCapableRole(role)) {
      const candidateTickets = tickets.filter((t) => t.status === TicketStatus.NEW && !t.assignedTechnician)
      const candidateIds = candidateTickets.map((t) => t.id)
      if (candidateIds.length) {
        const events = await this.prisma.domainEvent.findMany({
          where: {
            type: TICKET_ASSIGNMENT_REQUESTED_EVENT,
            entityType: TICKET_ASSIGNMENT_REQUESTED_ENTITY,
            entityId: { in: candidateIds },
            actorUserId: userId,
          },
          select: { entityId: true, companyId: true },
        })
        const tenantByTicketId = new Map(candidateTickets.map((t) => [t.id, t.companyId]))
        for (const ev of events) {
          if (tenantByTicketId.get(ev.entityId) === ev.companyId) {
            assignmentRequestedByCurrentUserIds.add(ev.entityId)
          }
        }
      }
    }

    const allStatuses: TicketStatus[] = [
      TicketStatus.NEW,
      TicketStatus.ASSIGNED,
      TicketStatus.IN_PROGRESS,
      TicketStatus.AWAITING_ACCEPTANCE,
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

      const cards = byStatus.map((t) => {
        const attachmentSummary = imageAttachmentSummaries.get(t.id)
        const base = {
          id: t.id,
          companyId: t.companyId,
          company: t.company,
          ticketNumber: t.ticketNumber,
          title: t.problemCategory.name,
          description: t.problemText,
          requesterName: t.requesterName ?? null,
          createdByUserId: t.createdByUserId ?? null,
          createdByUser: t.createdByUser ?? null,
          status: t.status,
          urgency: t.urgency,
          priority: t.priority,
          urgencyReason: t.urgencyReason ?? null,
          createdAt: t.createdAt,
          slaDueAt: t.slaDueAt,
          slaBreached: !!t.slaBreachedAt || (t.slaDueAt ? nowMs > t.slaDueAt.getTime() : false),
          isChild: !!t.parentId,
          pointName: t.pointName,
          location: t.location,
          category: { id: t.problemCategory.id, name: t.problemCategory.name },
          assignedTechnicianId: t.assignedTechnicianId ?? null,
          assignedTechnician: t.assignedTechnician,
          attachmentPreviewUrl: attachmentSummary?.previewUrl ?? null,
          imageAttachmentCount: attachmentSummary?.imageCount ?? 0,
        }
        if (role === UserRole.TECHNICIAN && technicianScope && t.status === TicketStatus.NEW && !t.assignedTechnician) {
          const links = t.problemCategory.specializationLinks ?? []
          const specOk =
            links.length === 0 ||
            technicianMatchesCategorySpecializationLinks({
              categoryLinks: links,
              technicianSpecializationIds: technicianScope.specializationIds,
              technicianSpecializationNames: technicianScope.specializationNames,
            })
          const locId = (t.locationId || t.location?.id || '').trim()
          const locationOk =
            !locId ||
            isTechnicianLocationAllowed({
              companyId: t.companyId,
              locationId: locId,
              locationScopeByCompany: technicianScope.locationScopeByCompany,
            })
          const canClaimByCurrentUser = technicianScope.allowTechnicianClaim && specOk && locationOk
          const assignmentRequestedByCurrentUser = assignmentRequestedByCurrentUserIds.has(t.id)
          return { ...base, canClaimByCurrentUser, assignmentRequestedByCurrentUser }
        }
        return base
      })

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
          allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
        })

    const baseWhere = technicianScope
      ? this.buildTechnicianBoardQuery({
          companyIds: technicianScope.companyIds,
          locationScopeByCompany: technicianScope.locationScopeByCompany,
          userId,
          specializationIds: technicianScope.specializationIds,
          specializationNames: technicianScope.specializationNames,
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
    const locationScope = technicianScope
      ? { mode: 'tenant_wide' as const, locationIds: [] as string[] }
      : await resolveActorLocationScope({
          prisma: this.prisma,
          actor: { id: userId, role, companyId, accessFlags },
          scopeCompanyId: scope.scopeCompanyId,
        })
    const scopedWhere = applyLocationScopeToTicketWhere(baseWhere, locationScope)
    const secondaryOperationalWhere = await this.resolveSecondaryOperationalWhere({
      providerCompanyId: companyId,
      linkedClientCompanyId,
      technicianScope,
      actor: { id: userId, role, companyId, accessFlags },
    })
    const whereAfterSecondary =
      secondaryOperationalWhere !== null
        ? { AND: [scopedWhere, secondaryOperationalWhere] }
        : scopedWhere
    const where = this.applyContextFilters(whereAfterSecondary, { locationId, equipmentId })

    const safeAnalyticsWhere = this.safeTicketWhereOrNull(where)
    const rows = safeAnalyticsWhere
      ? await this.prisma.ticket.findMany({
          where: safeAnalyticsWhere,
          select: {
            status: true,
            location: { select: { id: true, name: true } },
            equipment: { select: { id: true, name: true } },
          },
        })
      : []

    const ensureBucket = () => ({ total: 0, NEW: 0, IN_PROGRESS: 0, AWAITING_ACCEPTANCE: 0, DONE: 0 })
    const byLocation = new Map<string, { locationId: string; locationName: string; total: number; NEW: number; IN_PROGRESS: number; AWAITING_ACCEPTANCE: number; DONE: number }>()
    const byEquipment = new Map<string, { equipmentId: string; equipmentName: string; locationId: string | null; locationName: string | null; total: number; NEW: number; IN_PROGRESS: number; AWAITING_ACCEPTANCE: number; DONE: number }>()

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
        if (status === TicketStatus.AWAITING_ACCEPTANCE) current.AWAITING_ACCEPTANCE += 1
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
        if (status === TicketStatus.AWAITING_ACCEPTANCE) current.AWAITING_ACCEPTANCE += 1
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
          allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
        })

    const where = technicianScope
      ? this.buildTechnicianListWhere({
          companyIds: technicianScope.companyIds,
          locationScopeByCompany: technicianScope.locationScopeByCompany,
          userId,
          specializationIds: technicianScope.specializationIds,
          specializationNames: technicianScope.specializationNames,
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
    const locationScope = technicianScope
      ? { mode: 'tenant_wide' as const, locationIds: [] as string[] }
      : await resolveActorLocationScope({
          prisma: this.prisma,
          actor: { id: userId, role, companyId, accessFlags },
          scopeCompanyId: scope.scopeCompanyId,
        })
    const whereWithLocationScope = applyLocationScopeToTicketWhere(where, locationScope)
    const secondaryOperationalWhere = await this.resolveSecondaryOperationalWhere({
      providerCompanyId: companyId,
      linkedClientCompanyId,
      technicianScope,
      actor: { id: userId, role, companyId, accessFlags },
    })
    const whereAfterSecondary =
      secondaryOperationalWhere !== null
        ? { AND: [whereWithLocationScope, secondaryOperationalWhere] }
        : whereWithLocationScope
    const safeListWhere = this.safeTicketWhereOrNull(whereAfterSecondary)
    if (!safeListWhere) {
      return []
    }
    return this.prisma.ticket.findMany({
      where: safeListWhere,
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: companyIdentitySelect },
        createdByUser: { select: userIdentitySelect },
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
        assignedTechnician: { select: assignedTechnicianIdentitySelect },
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
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    })

    const include = {
      company: { select: companyIdentitySelect },
      createdByUser: { select: userIdentitySelect },
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
      assignedTechnician: { select: assignedTechnicianIdentitySelect },
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
          assignedTechnician: { select: assignedTechnicianIdentitySelect },
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

    const actorUserMeta = await this.prisma.user.findFirst({
      where: { id: userId, companyId },
      select: { isExecutor: true },
    })
    const meta = await this.ticketMetaBuilder.buildForGetOne({
      actorCompanyId: companyId,
      userId,
      role,
      isExecutor: actorUserMeta?.isExecutor ?? false,
      ticketId,
      ticketCompanyId: ticket.companyId,
      ticketStatus: ticket.status,
      assignedTechnicianId: ticket.assignedTechnicianId,
      scopeCompanyId: readable.scopeCompanyId,
      visibilityMode: readable.visibilityMode,
      linkedClientCompanyId,
      accessFlags,
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
