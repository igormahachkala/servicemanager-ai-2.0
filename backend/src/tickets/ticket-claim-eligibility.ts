import { ForbiddenException } from '@nestjs/common'
import { Prisma, ServiceContractRole, TicketStatus, UserRole } from '@prisma/client'

import { isExecutorEligible } from '../common/executor.utils'
import { assertAllowed } from '../policy/policy.utils'
import { TicketsPolicy, type TicketsClaimWhereParams } from '../policy/tickets.policy'
import type { DenyCode } from '../policy/policy.types'
import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import {
  buildSecondaryOperationalRestrictionWhere,
  buildTechnicianLocationRestrictionWhere,
  isTechnicianLocationAllowed,
  resolveReadableTicketAccess,
  resolveTechnicianOperationalScope,
  type TechnicianOperationalScope,
  technicianMatchesCategorySpecializationLinks,
} from './ticket-access.utils'

export const CLAIM_REQUEST_ASSIGNMENT_REASON =
  'Субподрядчик может запросить назначение; прямое взятие доступно только для собственных заявок.'

const CLAIM_SCOPE_REASON = 'Claim доступен только для новых неназначенных заявок в вашем operational scope'

export type ClaimActor = {
  id: string
  role: UserRole
  companyId: string
  isExecutor: boolean
  accessFlags?: Record<string, any>
}

export type ClaimTicketIdentity = {
  id: string
  companyId: string
  createdByUserId?: string | null
  status?: TicketStatus | null
  assignedTechnicianId?: string | null
}

export type TicketClaimCapability = {
  canClaim: boolean
  canRequestAssignment: boolean
  claimAvailabilityReason: string | null
  requestAssignmentAvailabilityReason: string | null
}

type ClaimEligibilityDenied = {
  allowed: false
  reason: string
  denyCode?: DenyCode
  technicianScope?: TechnicianOperationalScope
  effectiveLinkedClientCompanyId?: string
  linkedClientContractRole: ServiceContractRole | null
}

export type ClaimEligibilityAllowed = {
  allowed: true
  technicianScope: TechnicianOperationalScope
  where: Prisma.TicketWhereInput
  effectiveLinkedClientCompanyId?: string
  linkedClientContractRole: ServiceContractRole | null
}

export type ClaimEligibilityResolution = ClaimEligibilityAllowed | ClaimEligibilityDenied

function normalizeAnd(where: Prisma.TicketWhereInput, extra: Prisma.TicketWhereInput[]) {
  const base = where.AND
  const baseArr = Array.isArray(base) ? base : base ? [base] : []
  return { ...where, AND: [...baseArr, ...extra] }
}

function deniedClaim(reason: string | null = null): TicketClaimCapability {
  return {
    canClaim: false,
    canRequestAssignment: false,
    claimAvailabilityReason: reason,
    requestAssignmentAvailabilityReason: null,
  }
}

function requestAssignmentAvailable(): TicketClaimCapability {
  return {
    canClaim: false,
    canRequestAssignment: true,
    claimAvailabilityReason: CLAIM_REQUEST_ASSIGNMENT_REASON,
    requestAssignmentAvailabilityReason: null,
  }
}

function claimAvailable(): TicketClaimCapability {
  return {
    canClaim: true,
    canRequestAssignment: false,
    claimAvailabilityReason: null,
    requestAssignmentAvailabilityReason: null,
  }
}

export function deriveClaimCapabilityForRelationship(params: {
  actorCompanyId: string
  actorUserId: string
  ticketCompanyId: string
  ticketCreatedByUserId?: string | null
  linkedClientContractRole?: ServiceContractRole | null
}): TicketClaimCapability {
  if (params.ticketCompanyId === params.actorCompanyId) return claimAvailable()
  if (params.linkedClientContractRole === ServiceContractRole.PRIMARY) return claimAvailable()
  if (params.linkedClientContractRole === ServiceContractRole.SECONDARY) {
    return params.ticketCreatedByUserId === params.actorUserId
      ? claimAvailable()
      : requestAssignmentAvailable()
  }
  return deniedClaim('Linked client access is not available')
}

export async function resolveExecutorClaimEligibility(params: {
  prisma: PrismaService
  serviceContractsService: ServiceContractsService
  actor: ClaimActor
  ticketId?: string
  linkedClientCompanyId?: string
  requireReadableTicket?: boolean
  policy?: TicketsPolicy
}): Promise<ClaimEligibilityResolution> {
  let effectiveLinkedClientCompanyId = params.linkedClientCompanyId
  const accessActor = {
    id: params.actor.id,
    role: params.actor.role,
    companyId: params.actor.companyId,
    accessFlags: params.actor.accessFlags,
  }

  if (params.ticketId && params.requireReadableTicket) {
    const readable = await resolveReadableTicketAccess({
      prisma: params.prisma,
      serviceContractsService: params.serviceContractsService,
      actor: accessActor,
      ticketId: params.ticketId,
      linkedClientCompanyId: params.linkedClientCompanyId,
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    })
    effectiveLinkedClientCompanyId =
      readable.ticket.companyId !== params.actor.companyId
        ? readable.ticket.companyId
        : params.linkedClientCompanyId
  }

  let linkedClientContractRole: ServiceContractRole | null = null
  if (effectiveLinkedClientCompanyId && effectiveLinkedClientCompanyId !== params.actor.companyId) {
    const access = await params.serviceContractsService.getLinkedClientAccess(
      params.actor.companyId,
      effectiveLinkedClientCompanyId,
    )
    if (!access) {
      throw new ForbiddenException('Linked client access is not available')
    }
    linkedClientContractRole = access.role
  }

  const technicianScope = await resolveTechnicianOperationalScope({
    prisma: params.prisma,
    serviceContractsService: params.serviceContractsService,
    actor: accessActor,
    linkedClientCompanyId: effectiveLinkedClientCompanyId,
  })

  const decision = (params.policy ?? new TicketsPolicy()).claimWhere({
    user: {
      id: params.actor.id,
      role: params.actor.role,
      isExecutor: params.actor.isExecutor,
      companyId: params.actor.companyId,
    },
    ticketId: params.ticketId,
    specializationIds: technicianScope.specializationIds,
    specializationNames: technicianScope.specializationNames,
    allowTechnicianClaim: technicianScope.allowTechnicianClaim,
    companyIds: technicianScope.companyIds,
  } satisfies TicketsClaimWhereParams)

  if (!decision.allowed) {
    return {
      allowed: false,
      reason: decision.reason,
      denyCode: decision.denyCode,
      technicianScope,
      effectiveLinkedClientCompanyId,
      linkedClientContractRole,
    }
  }

  const locationRestriction = buildTechnicianLocationRestrictionWhere({
    companyIds: technicianScope.companyIds,
    locationScopeByCompany: technicianScope.locationScopeByCompany,
  })
  const secondaryOperationalRestriction = await buildSecondaryOperationalRestrictionWhere({
    prisma: params.prisma,
    serviceContractsService: params.serviceContractsService,
    providerCompanyId: params.actor.companyId,
    linkedClientCompanyId: effectiveLinkedClientCompanyId,
    scopeCompanyIds: technicianScope.companyIds,
    actor: accessActor,
  })
  const extraWhere: Prisma.TicketWhereInput[] = [locationRestriction]
  if (secondaryOperationalRestriction) {
    extraWhere.push(secondaryOperationalRestriction)
  }

  return {
    allowed: true,
    technicianScope,
    where: normalizeAnd(decision.where as Prisma.TicketWhereInput, extraWhere),
    effectiveLinkedClientCompanyId,
    linkedClientContractRole,
  }
}

export function assertExecutorClaimEligibilityAllowed(
  eligibility: ClaimEligibilityResolution,
): asserts eligibility is ClaimEligibilityAllowed {
  if (eligibility.allowed) return
  assertAllowed({
    allowed: false,
    reason: eligibility.reason,
    denyCode: eligibility.denyCode,
  })
}

export async function resolveEligibleTicketClaimCapability(params: {
  serviceContractsService: ServiceContractsService
  actor: Pick<ClaimActor, 'id' | 'companyId'>
  ticket: ClaimTicketIdentity
  linkedClientContractRole?: ServiceContractRole | null
}): Promise<TicketClaimCapability> {
  if (params.ticket.status && params.ticket.status !== TicketStatus.NEW) {
    return deniedClaim('Заявка не в статусе NEW: claim доступен только для новых заявок')
  }
  if (params.ticket.assignedTechnicianId) {
    return deniedClaim('Заявка уже назначена: claim только для заявок без исполнителя')
  }

  let linkedClientContractRole = params.linkedClientContractRole ?? null
  if (params.ticket.companyId !== params.actor.companyId && !linkedClientContractRole) {
    const access = await params.serviceContractsService.getLinkedClientAccess(
      params.actor.companyId,
      params.ticket.companyId,
    )
    linkedClientContractRole = access?.role ?? null
  }

  return deriveClaimCapabilityForRelationship({
    actorCompanyId: params.actor.companyId,
    actorUserId: params.actor.id,
    ticketCompanyId: params.ticket.companyId,
    ticketCreatedByUserId: params.ticket.createdByUserId,
    linkedClientContractRole,
  })
}

export async function resolveTicketClaimCapability(params: {
  prisma: PrismaService
  serviceContractsService: ServiceContractsService
  actor: ClaimActor
  ticketId: string
  linkedClientCompanyId?: string
  requireReadableTicket?: boolean
  policy?: TicketsPolicy
}): Promise<TicketClaimCapability> {
  if (!isExecutorEligible(params.actor)) {
    return deniedClaim(null)
  }

  const eligibility = await resolveExecutorClaimEligibility(params)
  if (!eligibility.allowed) {
    return deniedClaim(eligibility.reason || 'Claim недоступен')
  }

  const claimableTicket = await params.prisma.ticket.findFirst({
    where: eligibility.where,
    select: {
      id: true,
      companyId: true,
      createdByUserId: true,
      status: true,
      assignedTechnicianId: true,
    },
  })

  if (claimableTicket) {
    return resolveEligibleTicketClaimCapability({
      serviceContractsService: params.serviceContractsService,
      actor: params.actor,
      ticket: claimableTicket,
      linkedClientContractRole: eligibility.linkedClientContractRole,
    })
  }

  const ticketForClaimDiag = await params.prisma.ticket.findFirst({
    where: { id: params.ticketId },
    select: {
      status: true,
      assignedTechnicianId: true,
      companyId: true,
      locationId: true,
      problemCategory: {
        select: {
          specializationLinks: {
            select: {
              specializationId: true,
              specialization: { select: { name: true } },
            },
          },
        },
      },
    },
  })

  if (ticketForClaimDiag) {
    if (ticketForClaimDiag.status !== TicketStatus.NEW) {
      return deniedClaim('Заявка не в статусе NEW: claim доступен только для новых заявок')
    }
    if (ticketForClaimDiag.assignedTechnicianId) {
      return deniedClaim('Заявка уже назначена: claim только для заявок без исполнителя')
    }
    const locationAllowed = isTechnicianLocationAllowed({
      companyId: ticketForClaimDiag.companyId,
      locationId: ticketForClaimDiag.locationId,
      locationScopeByCompany: eligibility.technicianScope.locationScopeByCompany,
    })
    if (!locationAllowed) {
      return deniedClaim(
        'Локация заявки недоступна: нет привязки UserLocationBinding к этой точке в текущем scope',
      )
    }
    const categoryLinks = ticketForClaimDiag.problemCategory?.specializationLinks ?? []
    if (
      categoryLinks.length > 0 &&
      !technicianMatchesCategorySpecializationLinks({
        categoryLinks,
        technicianSpecializationIds: eligibility.technicianScope.specializationIds,
        technicianSpecializationNames: eligibility.technicianScope.specializationNames,
      })
    ) {
      return deniedClaim(
        'Нет совпадения по специализации: категория заявки не связана с вашими активными специализациями (по id или по нормализованному имени)',
      )
    }
  }

  return deniedClaim(CLAIM_SCOPE_REASON)
}

export async function resolveClaimCapabilitiesForVisibleTickets(params: {
  prisma: PrismaService
  serviceContractsService: ServiceContractsService
  actor: ClaimActor
  ticketIds: string[]
  linkedClientCompanyId?: string
  policy?: TicketsPolicy
}): Promise<Map<string, TicketClaimCapability>> {
  const uniqueTicketIds = Array.from(new Set(params.ticketIds.filter((id) => id.trim().length > 0)))
  const out = new Map<string, TicketClaimCapability>()
  if (uniqueTicketIds.length === 0 || !isExecutorEligible(params.actor)) {
    return out
  }

  const eligibility = await resolveExecutorClaimEligibility({
    prisma: params.prisma,
    serviceContractsService: params.serviceContractsService,
    actor: params.actor,
    linkedClientCompanyId: params.linkedClientCompanyId,
    policy: params.policy,
  })

  if (!eligibility.allowed) {
    for (const ticketId of uniqueTicketIds) {
      out.set(ticketId, deniedClaim(eligibility.reason || 'Claim недоступен'))
    }
    return out
  }

  for (const ticketId of uniqueTicketIds) {
    out.set(ticketId, deniedClaim(CLAIM_SCOPE_REASON))
  }

  const eligibleTickets = await params.prisma.ticket.findMany({
    where: {
      AND: [eligibility.where, { id: { in: uniqueTicketIds } }],
    },
    select: {
      id: true,
      companyId: true,
      createdByUserId: true,
      status: true,
      assignedTechnicianId: true,
    },
  })

  for (const ticket of eligibleTickets) {
    out.set(
      ticket.id,
      await resolveEligibleTicketClaimCapability({
        serviceContractsService: params.serviceContractsService,
        actor: params.actor,
        ticket,
        linkedClientContractRole:
          eligibility.effectiveLinkedClientCompanyId === ticket.companyId
            ? eligibility.linkedClientContractRole
            : null,
      }),
    )
  }

  return out
}
