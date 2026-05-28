import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Prisma, ServiceContractRole, UserRole } from '@prisma/client'

import { assertAllowed, isPlatformObserverScope, resolveObserverScopeCompanyId } from '../policy/policy.utils'
import { TicketsPolicy, type UserCtx } from '../policy/tickets.policy'
import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { isExecutorCapableRole, isExecutorEligible } from '../common/executor.utils'
import {
  buildSpecializationLinksSomeWhereInput,
  normalizeSpecializationLabel,
  specializationNameMatchVariants,
  technicianMatchesCategorySpecializationLinks,
} from './ticket-specialization-match.utils'

type AccessFlags = {
  canTechnicianViewAllCompanyTickets?: boolean
}

export type TicketAccessActor = {
  id: string
  role: UserRole
  companyId: string
  accessFlags?: AccessFlags
}

export type TicketVisibilityMode = 'tenant' | 'provider_primary' | 'platform_observer'

export const LOCATION_SCOPED_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.DISPATCHER,
  UserRole.CLIENT,
  UserRole.TERRITORIAL_MANAGER,
  UserRole.NETWORK_DIRECTOR,
  UserRole.MASTER,
  UserRole.TECHNICIAN,
]

export type LocationScope =
  | { mode: 'tenant_wide'; locationIds: string[] }
  | { mode: 'bound_locations'; locationIds: string[] }

export const PROVIDER_LINKED_OVERVIEW_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MASTER,
  UserRole.DISPATCHER,
  UserRole.NETWORK_DIRECTOR,
  UserRole.TERRITORIAL_MANAGER,
  UserRole.STAFF,
]

export const PROVIDER_LINKED_OPERATION_ROLES: UserRole[] = [
  ...PROVIDER_LINKED_OVERVIEW_ROLES,
  UserRole.TECHNICIAN,
]

const ticketsPolicy = new TicketsPolicy()

function normalizeAnd(
  where: Prisma.TicketWhereInput,
  extra: Prisma.TicketWhereInput[],
): Prisma.TicketWhereInput {
  const base = where.AND
  const baseArr = Array.isArray(base) ? base : base ? [base] : []
  return { ...where, AND: [...baseArr, ...extra] }
}

export function applyLocationScopeToTicketWhere(
  where: Prisma.TicketWhereInput,
  locationScope: LocationScope,
): Prisma.TicketWhereInput {
  if (locationScope.mode !== 'bound_locations') return where
  if (locationScope.locationIds.length === 0) {
    return normalizeAnd(where, [{ id: { equals: '__no_access__' } }])
  }
  return normalizeAnd(where, [{ locationId: { in: locationScope.locationIds } }])
}

export async function resolveActorLocationScope(params: {
  prisma: PrismaService
  actor: TicketAccessActor
  scopeCompanyId?: string
}): Promise<LocationScope> {
  const rawScopeCompanyId = params.scopeCompanyId ?? params.actor.companyId
  const scopeCompanyId =
    typeof rawScopeCompanyId === 'string' && rawScopeCompanyId.trim().length > 0
      ? rawScopeCompanyId.trim()
      : null

  if (!scopeCompanyId) {
    return { mode: 'tenant_wide', locationIds: [] }
  }

  if (!LOCATION_SCOPED_ROLES.includes(params.actor.role)) {
    return { mode: 'tenant_wide', locationIds: [] }
  }

  if (
    scopeCompanyId !== params.actor.companyId &&
    !PROVIDER_LINKED_OPERATION_ROLES.includes(params.actor.role)
  ) {
    return { mode: 'tenant_wide', locationIds: [] }
  }

  /**
   * UserLocationBinding.companyId — компания сотрудника (провайдер).
   * У точки clientCompanyId = клиентский tenant.
   * Для контура linked client ищем привязки по employer companyId + локации клиента.
   */
  const linkedClientScope =
    scopeCompanyId !== params.actor.companyId &&
    PROVIDER_LINKED_OPERATION_ROLES.includes(params.actor.role)
  const bindingEmployerCompanyId = linkedClientScope ? params.actor.companyId : scopeCompanyId

  const bindings = await params.prisma.userLocationBinding.findMany({
    where: {
      userId: params.actor.id,
      companyId: bindingEmployerCompanyId,
      location: { clientCompanyId: scopeCompanyId },
    },
    select: { locationId: true },
  })

  const locationIds = Array.from(new Set(bindings.map((item) => item.locationId)))
  if (locationIds.length === 0) {
    return { mode: 'tenant_wide', locationIds: [] }
  }

  return {
    mode: 'bound_locations',
    locationIds,
  }
}

export function buildTechnicianLocationRestrictionWhere(params: {
  companyIds: string[]
  locationScopeByCompany: Record<string, string[]>
}): Prisma.TicketWhereInput {
  const companyConditions = params.companyIds.map((companyId) => {
    const locationIds = params.locationScopeByCompany[companyId] ?? []
    if (locationIds.length === 0) {
      return { companyId }
    }
    return {
      companyId,
      locationId: { in: locationIds },
    }
  })
  if (companyConditions.length === 1) {
    return companyConditions[0]
  }
  return { OR: companyConditions }
}

export function isTechnicianLocationAllowed(params: {
  companyId: string
  locationId: string
  locationScopeByCompany: Record<string, string[]>
}): boolean {
  const locationIds = params.locationScopeByCompany[params.companyId] ?? []
  if (locationIds.length === 0) {
    return true
  }
  return locationIds.includes(params.locationId)
}

export async function assertActorCanUseLocation(params: {
  prisma: PrismaService
  actor: TicketAccessActor
  scopeCompanyId: string
  locationId: string
}) {
  const locationScope = await resolveActorLocationScope({
    prisma: params.prisma,
    actor: params.actor,
    scopeCompanyId: params.scopeCompanyId,
  })

  if (locationScope.mode === 'bound_locations' && !locationScope.locationIds.includes(params.locationId)) {
    throw new ForbiddenException('Location is not available in current user scope')
  }

  return locationScope
}

export function canAccessOwnTicket(
  ctx: Pick<TicketAccessActor, 'companyId'>,
  ticket: { companyId: string },
) {
  return ticket.companyId === ctx.companyId
}

export {
  normalizeSpecializationLabel,
  specializationNameMatchVariants,
  buildSpecializationLinksSomeWhereInput,
  technicianMatchesCategorySpecializationLinks,
} from './ticket-specialization-match.utils'

export type TechnicianOperationalScope = {
  companyIds: string[]
  specializationIds: string[]
  specializationNames: string[]
  locationScopeByCompany: Record<string, string[]>
  allowTechnicianClaim: boolean
  scopeCompanyId: string
  visibilityMode: TicketVisibilityMode
}

export async function resolveTechnicianOperationalScope(params: {
  prisma: PrismaService
  serviceContractsService: ServiceContractsService
  actor: TicketAccessActor
  linkedClientCompanyId?: string
}): Promise<TechnicianOperationalScope> {
  const company = await params.prisma.company.findUnique({
    where: { id: params.actor.companyId },
    select: {
      id: true,
      allowTechnicianClaim: true,
    },
  })

  if (!company) {
    throw new NotFoundException('Company not found')
  }

  const executor = await params.prisma.user.findFirst({
    where: {
      id: params.actor.id,
      companyId: params.actor.companyId,
    },
    select: {
      id: true,
      role: true,
      isExecutor: true,
      technicianSpecializations: {
        where: { specialization: { isActive: true } },
        select: {
          specializationId: true,
          specialization: { select: { name: true } },
        },
      },
    },
  })

  if (!executor) {
    throw new NotFoundException('Executor not found')
  }

  // PRIMARY contracts: TECHNICIAN role only (management roles use the management path)
  // SECONDARY contracts: any executor-capable role
  const requestedLinked =
    params.linkedClientCompanyId && params.linkedClientCompanyId !== params.actor.companyId
      ? params.linkedClientCompanyId
      : null

  let linkedClientIds: string[]

  if (requestedLinked) {
    const access = await params.serviceContractsService.getLinkedClientAccess(
      params.actor.companyId,
      requestedLinked,
    )
    if (!access) {
      throw new ForbiddenException('Linked client access is not available')
    }
    const isPrimary = access.role === ServiceContractRole.PRIMARY
    const isSecondary = access.role === ServiceContractRole.SECONDARY
    if (isPrimary && !isExecutorEligible({ role: params.actor.role, isExecutor: !!executor.isExecutor })) {
      throw new ForbiddenException('Role cannot access primary-linked client tickets via executor scope')
    }
    if (!isPrimary && !isSecondary) {
      throw new ForbiddenException('Linked client access is not available')
    }
    linkedClientIds = [requestedLinked]
  } else {
    const primaryIds =
      params.actor.role === UserRole.TECHNICIAN
        ? await params.serviceContractsService.listPrimaryLinkedClientIds(params.actor.companyId)
        : []
    const secondaryIds = isExecutorCapableRole(params.actor.role)
      ? await params.serviceContractsService.listSecondaryLinkedClientIds(params.actor.companyId)
      : []
    linkedClientIds = [...new Set([...primaryIds, ...secondaryIds])]
  }

  const companyIds = Array.from(new Set([params.actor.companyId, ...linkedClientIds]))
  const specializationIds = executor.technicianSpecializations.map((item) => item.specializationId)
  const specializationNames = Array.from(
    new Set(
      executor.technicianSpecializations.flatMap((item) => {
        const raw = item.specialization?.name?.trim() ?? ''
        if (!raw) return []
        const out: string[] = [raw, ...specializationNameMatchVariants(raw)]
        const norm = normalizeSpecializationLabel(raw)
        if (norm) out.push(norm)
        return out
      }),
    ),
  ).filter((name) => name.length > 0)
  const linkedScopeSelected = !!requestedLinked
  const hasLinkedCompanies = linkedClientIds.some((id) => id !== params.actor.companyId)
  const bindings = await params.prisma.userLocationBinding.findMany({
    where: {
      userId: params.actor.id,
      companyId: { in: companyIds },
      location: { clientCompanyId: { in: companyIds } },
    },
    select: {
      companyId: true,
      locationId: true,
    },
  })
  const locationScopeByCompany: Record<string, string[]> = {}
  for (const companyId of companyIds) {
    locationScopeByCompany[companyId] = []
  }
  for (const binding of bindings) {
    if (!locationScopeByCompany[binding.companyId]) {
      locationScopeByCompany[binding.companyId] = []
    }
    locationScopeByCompany[binding.companyId].push(binding.locationId)
  }
  for (const companyId of Object.keys(locationScopeByCompany)) {
    locationScopeByCompany[companyId] = Array.from(new Set(locationScopeByCompany[companyId]))
  }

  return {
    companyIds,
    specializationIds,
    specializationNames,
    locationScopeByCompany,
    allowTechnicianClaim: !!company.allowTechnicianClaim,
    scopeCompanyId: linkedScopeSelected ? params.linkedClientCompanyId! : params.actor.companyId,
    visibilityMode: hasLinkedCompanies ? ('provider_primary' as TicketVisibilityMode) : ('tenant' as TicketVisibilityMode),
  }
}
async function ensureCompanyExists(prisma: PrismaService, companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  })

  if (!company) {
    throw new NotFoundException('Company not found')
  }
}

async function resolveLinkedClientIds(params: {
  serviceContractsService: ServiceContractsService
  actor: TicketAccessActor
  linkedClientCompanyId?: string
  allowedRoles?: UserRole[]
  allowedContractRoles?: ServiceContractRole[]
}) {
  const allowedRoles = params.allowedRoles ?? PROVIDER_LINKED_OPERATION_ROLES
  const allowedContractRoles = params.allowedContractRoles ?? [ServiceContractRole.PRIMARY]

  if (params.linkedClientCompanyId && params.linkedClientCompanyId !== params.actor.companyId) {
    if (!allowedRoles.includes(params.actor.role)) {
      throw new ForbiddenException('Role cannot access linked client tickets')
    }

    const access = await params.serviceContractsService.getLinkedClientAccess(
      params.actor.companyId,
      params.linkedClientCompanyId,
    )
    if (!access) {
      throw new ForbiddenException('Linked client access is not available')
    }
    if (!allowedContractRoles.includes(access.role)) {
      throw new BadRequestException('Linked client visibility is restricted for SECONDARY provider')
    }

    return [params.linkedClientCompanyId]
  }

  if (!allowedRoles.includes(params.actor.role)) {
    return []
  }

  const contracts = await params.serviceContractsService.listLinkedClients(params.actor.companyId)
  return contracts
    .filter((contract) => allowedContractRoles.includes(contract.role))
    .map((contract) => contract.linkedClientCompanyId)
}

export async function resolvePrimaryLinkedClientIds(params: {
  serviceContractsService: ServiceContractsService
  actor: TicketAccessActor
  linkedClientCompanyId?: string
  allowedRoles?: UserRole[]
}) {
  return resolveLinkedClientIds({
    ...params,
    allowedContractRoles: [ServiceContractRole.PRIMARY],
  })
}

export async function resolveTicketReadScope(params: {
  prisma: PrismaService
  serviceContractsService: ServiceContractsService
  actorCompanyId: string
  role: UserRole
  linkedClientCompanyId?: string
  observerCompanyId?: string
  allowedLinkedClientRoles?: UserRole[]
  allowedLinkedClientContractRoles?: ServiceContractRole[]
}): Promise<{ scopeCompanyId: string; visibilityMode: TicketVisibilityMode }> {
  const observerCompanyId = resolveObserverScopeCompanyId({
    actorCompanyId: params.actorCompanyId,
    actorRole: params.role,
    requestedCompanyId: params.observerCompanyId,
  })

  if (
    isPlatformObserverScope({
      actorCompanyId: params.actorCompanyId,
      actorRole: params.role,
      scopeCompanyId: observerCompanyId,
    })
  ) {
    await ensureCompanyExists(params.prisma, observerCompanyId)
    return {
      scopeCompanyId: observerCompanyId,
      visibilityMode: 'platform_observer',
    }
  }

  if (!params.linkedClientCompanyId || params.linkedClientCompanyId === params.actorCompanyId) {
    return {
      scopeCompanyId: params.actorCompanyId,
      visibilityMode: 'tenant',
    }
  }

  const linkedClientIds = await resolveLinkedClientIds({
    serviceContractsService: params.serviceContractsService,
    actor: {
      id: '',
      role: params.role,
      companyId: params.actorCompanyId,
    },
    linkedClientCompanyId: params.linkedClientCompanyId,
    allowedRoles: params.allowedLinkedClientRoles ?? PROVIDER_LINKED_OVERVIEW_ROLES,
    allowedContractRoles: params.allowedLinkedClientContractRoles ?? [ServiceContractRole.PRIMARY],
  })

  if (!linkedClientIds.includes(params.linkedClientCompanyId)) {
    throw new ForbiddenException('Linked client access is not available')
  }

  return {
    scopeCompanyId: params.linkedClientCompanyId,
    visibilityMode: 'provider_primary',
  }
}

export async function resolveReadableTicketAccess(params: {
  prisma: PrismaService
  serviceContractsService: ServiceContractsService
  actor: TicketAccessActor
  ticketId: string
  linkedClientCompanyId?: string
  observerCompanyId?: string
  allowedLinkedClientContractRoles?: ServiceContractRole[]
}) {
  const locationScope = await resolveActorLocationScope({
    prisma: params.prisma,
    actor: params.actor,
  })

  const tenantDecision = ticketsPolicy.getOneWhere(params.actor as UserCtx, params.ticketId)
  assertAllowed(tenantDecision)

  const tenantWhere = applyLocationScopeToTicketWhere(tenantDecision.where, locationScope)
  const tenantTicket = await params.prisma.ticket.findFirst({
    where: tenantWhere,
    select: {
      id: true,
      companyId: true,
      assignedTechnicianId: true,
    },
  })

  if (tenantTicket && canAccessOwnTicket(params.actor, tenantTicket)) {
    return {
      ticket: tenantTicket,
      scopeCompanyId: tenantTicket.companyId,
      visibilityMode: 'tenant' as TicketVisibilityMode,
    }
  }

  // When linkedClientCompanyId is explicitly provided and the role is a management role,
  // skip the executor scope entirely. Management roles (ADMIN, MASTER, DISPATCHER, etc.)
  // access linked-client tickets via the management path below (resolveLinkedClientIds).
  // resolveTechnicianOperationalScope correctly blocks PRIMARY contracts for non-TECHNICIAN roles,
  // which would cause a false 403 for PRIMARY_PROVIDER_ADMIN when linkedClientCompanyId is set.
  const skipExecutorScope =
    !!params.linkedClientCompanyId &&
    params.linkedClientCompanyId !== params.actor.companyId &&
    PROVIDER_LINKED_OVERVIEW_ROLES.includes(params.actor.role)

  if (isExecutorCapableRole(params.actor.role) && !skipExecutorScope) {
    const technicianScope = await resolveTechnicianOperationalScope({
      prisma: params.prisma,
      serviceContractsService: params.serviceContractsService,
      actor: params.actor,
      linkedClientCompanyId: params.linkedClientCompanyId,
    })

    const executorTicket = await params.prisma.ticket.findFirst({
      where: {
        AND: [
          {
            id: params.ticketId,
            OR: [
              { assignedTechnicianId: params.actor.id },
              { status: 'NEW', assignedTechnicianId: null },
            ],
          },
          buildTechnicianLocationRestrictionWhere({
            companyIds: technicianScope.companyIds,
            locationScopeByCompany: technicianScope.locationScopeByCompany,
          }),
        ],
      },
      select: {
        id: true,
        companyId: true,
        locationId: true,
        assignedTechnicianId: true,
      },
    })

    if (executorTicket) {
      return {
        ticket: executorTicket,
        scopeCompanyId: executorTicket.companyId,
        visibilityMode:
          executorTicket.companyId === params.actor.companyId
            ? ('tenant' as TicketVisibilityMode)
            : ('provider_primary' as TicketVisibilityMode),
      }
    }
  }

  const observerCompanyId = resolveObserverScopeCompanyId({
    actorCompanyId: params.actor.companyId,
    actorRole: params.actor.role,
    requestedCompanyId: params.observerCompanyId,
  })

  if (
    isPlatformObserverScope({
      actorCompanyId: params.actor.companyId,
      actorRole: params.actor.role,
      scopeCompanyId: observerCompanyId,
    })
  ) {
    const observerTicket = await params.prisma.ticket.findFirst({
      where: {
        id: params.ticketId,
        companyId: observerCompanyId,
      },
      select: {
        id: true,
        companyId: true,
        assignedTechnicianId: true,
      },
    })

    if (observerTicket) {
      return {
        ticket: observerTicket,
        scopeCompanyId: observerTicket.companyId,
        visibilityMode: 'platform_observer' as TicketVisibilityMode,
      }
    }
  }

  if (params.actor.role === UserRole.PLATFORM_ADMIN) {
    const platformTicket = await params.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      select: {
        id: true,
        companyId: true,
        assignedTechnicianId: true,
      },
    })

    if (platformTicket) {
      return {
        ticket: platformTicket,
        scopeCompanyId: platformTicket.companyId,
        visibilityMode: 'platform_observer' as TicketVisibilityMode,
      }
    }
  }

  const linkedClientIds = await resolveLinkedClientIds({
    serviceContractsService: params.serviceContractsService,
    actor: params.actor,
    linkedClientCompanyId: params.linkedClientCompanyId,
    allowedContractRoles: params.allowedLinkedClientContractRoles ?? [ServiceContractRole.PRIMARY],
  })

  if (linkedClientIds.length > 0) {
    const providerWhere: {
      id: string
      companyId: { in: string[] }
      assignedTechnicianId?: string
    } = {
      id: params.ticketId,
      companyId: { in: linkedClientIds },
    }

    if (params.actor.role === UserRole.TECHNICIAN) {
      providerWhere.assignedTechnicianId = params.actor.id
    }

    const providerTicket = await params.prisma.ticket.findFirst({
      where: providerWhere,
      select: {
        id: true,
        companyId: true,
        assignedTechnicianId: true,
      },
    })

    if (providerTicket) {
      return {
        ticket: providerTicket,
        scopeCompanyId: providerTicket.companyId,
        visibilityMode: 'provider_primary' as TicketVisibilityMode,
      }
    }
  }

  const directTicket = await params.prisma.ticket.findUnique({
    where: { id: params.ticketId },
    select: {
      id: true,
      companyId: true,
      locationId: true,
      assignedTechnicianId: true,
      status: true,
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

  if (directTicket) {
    if (
      locationScope.mode === 'bound_locations' &&
      directTicket.companyId === params.actor.companyId &&
      !locationScope.locationIds.includes(directTicket.locationId)
    ) {
      throw new NotFoundException('Ticket not found')
    }
    if (
      PROVIDER_LINKED_OVERVIEW_ROLES.includes(params.actor.role) &&
      directTicket.companyId !== params.actor.companyId
    ) {
      const access = await params.serviceContractsService.getLinkedClientAccess(
        params.actor.companyId,
        directTicket.companyId,
      )
      if (!access) {
        throw new NotFoundException('Ticket not found')
      }
      if (
        !(
          params.allowedLinkedClientContractRoles ?? [ServiceContractRole.PRIMARY]
        ).includes(access.role)
      ) {
        throw new NotFoundException('Ticket not found')
      }

      return {
        ticket: directTicket,
        scopeCompanyId: directTicket.companyId,
        visibilityMode: 'provider_primary' as TicketVisibilityMode,
      }
    }

    if (isExecutorCapableRole(params.actor.role) && directTicket.companyId !== params.actor.companyId) {
      const executorScope = await resolveTechnicianOperationalScope({
        prisma: params.prisma,
        serviceContractsService: params.serviceContractsService,
        actor: params.actor,
        linkedClientCompanyId: directTicket.companyId,
      })

      const locationAllowed = isTechnicianLocationAllowed({
        companyId: directTicket.companyId,
        locationId: directTicket.locationId,
        locationScopeByCompany: executorScope.locationScopeByCompany,
      })
      const canReadNew =
        directTicket.status === 'NEW' && !directTicket.assignedTechnicianId && locationAllowed
      const canReadAssigned =
        directTicket.assignedTechnicianId === params.actor.id && locationAllowed

      if (canReadAssigned || canReadNew) {
        return {
          ticket: directTicket,
          scopeCompanyId: directTicket.companyId,
          visibilityMode: 'provider_primary' as TicketVisibilityMode,
        }
      }
    }
  }

  throw new NotFoundException('Ticket not found')
}

export async function resolveTicketOperationAccess(params: {
  prisma: PrismaService
  serviceContractsService: ServiceContractsService
  actor: TicketAccessActor
  ticketId: string
  linkedClientCompanyId?: string
}) {
  const readable = await resolveReadableTicketAccess({
    prisma: params.prisma,
    serviceContractsService: params.serviceContractsService,
    actor: params.actor,
    ticketId: params.ticketId,
    linkedClientCompanyId: params.linkedClientCompanyId,
  })

  if (readable.visibilityMode === 'platform_observer') {
    throw new ForbiddenException('Platform observer mode is read-only')
  }

  return {
    ...readable,
    operationCompanyId:
      readable.visibilityMode === 'provider_primary'
        ? params.actor.companyId
        : readable.ticket.companyId,
  }
}

/**
 * Эвристика для meta/UI: пользователь участвовал в создании заявки
 * (вложение с uploadedByUserId или комментарий потока create).
 * При непустом companyIds — только tenant из этого списка (заявка, вложение, событие).
 */
export async function wasTicketCreatedByActor(params: {
  prisma: PrismaService
  ticketId: string
  userId?: string
  actorUserId?: string
  companyIds?: string[]
}): Promise<boolean> {
  const tid = (params.ticketId || '').trim()
  const uid = ((params.userId || params.actorUserId) ?? '').trim()
  if (!tid || !uid) return false
  const prisma = params.prisma

  const allowedCompanies = Array.from(
    new Set((params.companyIds || []).map((c) => (c || '').trim()).filter((c) => c.length > 0)),
  )
  const companyScope =
    allowedCompanies.length === 0
      ? null
      : allowedCompanies.length === 1
        ? { companyId: allowedCompanies[0] }
        : { companyId: { in: allowedCompanies } }

  if (companyScope) {
    const ticketInScope = await prisma.ticket.findFirst({
      where: { id: tid, ...companyScope },
      select: { id: true },
    })
    if (!ticketInScope) return false
  }

  const attachment = await prisma.ticketAttachment.findFirst({
    where: {
      ticketId: tid,
      uploadedByUserId: uid,
      ...(companyScope ?? {}),
    },
    select: { id: true },
  })
  if (attachment) return true

  const ev = await prisma.domainEvent.findFirst({
    where: {
      entityType: 'Ticket',
      entityId: tid,
      type: 'ticket.comment_added',
      actorUserId: uid,
      ...(companyScope ?? {}),
    },
    orderBy: { createdAt: 'asc' },
    select: { payload: true },
  })
  if (!ev?.payload || typeof ev.payload !== 'object' || ev.payload === null) return false
  const src = (ev.payload as Record<string, unknown>).source
  return src === 'create_flow'
}
