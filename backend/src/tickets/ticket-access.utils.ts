import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Prisma, ServiceContractRole, UserRole } from '@prisma/client'

import { assertAllowed, isPlatformObserverScope, resolveObserverScopeCompanyId } from '../policy/policy.utils'
import { TicketsPolicy, type UserCtx } from '../policy/tickets.policy'
import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { isServiceContractEffective } from '../service-contracts/service-contract-window'
import { isExecutorCapableRole, isExecutorEligible } from '../common/executor.utils'
import {
  interpretUserAccessLocationScope,
  RESTRICTED_EMPTY_LOCATION_SENTINEL,
  uniqueLocationIds,
} from '../common/user-access-scope-mode.utils'
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
  | { mode: 'restricted_empty'; locationIds: string[] }

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

function noAccessWhere(): Prisma.TicketWhereInput {
  return { id: { equals: '__no_access__' } }
}

export function isLocationScopeClosed(locationScope: LocationScope): boolean {
  return locationScope.mode === 'restricted_empty' ||
    (locationScope.mode === 'bound_locations' && locationScope.locationIds.length === 0)
}

export function isLocationAllowedByLocationScope(
  locationScope: LocationScope,
  locationId: string | null | undefined,
) {
  if (locationScope.mode === 'tenant_wide') return true
  if (isLocationScopeClosed(locationScope)) return false
  return !!locationId && locationScope.locationIds.includes(locationId)
}

export function applyLocationScopeToTicketWhere(
  where: Prisma.TicketWhereInput,
  locationScope: LocationScope,
): Prisma.TicketWhereInput {
  if (locationScope.mode === 'tenant_wide') return where
  if (isLocationScopeClosed(locationScope)) {
    return normalizeAnd(where, [noAccessWhere()])
  }
  return normalizeAnd(where, [{ locationId: { in: locationScope.locationIds } }])
}

function applyLocationScopeToLinkedClientWhere(
  where: Prisma.TicketWhereInput,
  locationScope: LocationScope,
): Prisma.TicketWhereInput {
  if (locationScope.mode === 'tenant_wide') return where
  if (isLocationScopeClosed(locationScope)) {
    return normalizeAnd(where, [noAccessWhere()])
  }
  return normalizeAnd(where, [{ locationId: { in: locationScope.locationIds } }])
}

function isTicketAllowedByLocationScope(
  ticket: { locationId: string | null },
  locationScope: LocationScope,
) {
  return isLocationAllowedByLocationScope(locationScope, ticket.locationId)
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
    return { mode: 'restricted_empty', locationIds: [] }
  }

  const linkedClientScope =
    scopeCompanyId !== params.actor.companyId &&
    PROVIDER_LINKED_OPERATION_ROLES.includes(params.actor.role)

  /**
   * UserLocationBinding.companyId — компания сотрудника (провайдер).
   * У точки clientCompanyId = клиентский tenant.
   * Для контура linked client ищем привязки по employer companyId + локации клиента.
   */
  const bindingEmployerCompanyId = linkedClientScope ? params.actor.companyId : scopeCompanyId

  const actorState = params.prisma.user?.findFirst
    ? await params.prisma.user.findFirst({
        where: {
          id: params.actor.id,
          companyId: params.actor.companyId,
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      })
    : { id: params.actor.id }

  if (!actorState) {
    return { mode: 'restricted_empty', locationIds: [] }
  }

  const [accessScope, bindings] = await Promise.all([
    params.prisma.userAccessScope?.findUnique
      ? params.prisma.userAccessScope.findUnique({
          where: {
            userId_companyId: {
              userId: params.actor.id,
              companyId: bindingEmployerCompanyId,
            },
          },
          select: { locationMode: true },
        })
      : Promise.resolve(null),
    params.prisma.userLocationBinding.findMany({
      where: {
        userId: params.actor.id,
        companyId: bindingEmployerCompanyId,
        location: { clientCompanyId: scopeCompanyId },
      },
      select: { locationId: true },
    }),
  ])

  const interpreted = interpretUserAccessLocationScope({
    explicitLocationMode: accessScope?.locationMode,
    locationIds: bindings.map((item) => item.locationId),
  })

  if (scopeCompanyId !== params.actor.companyId && !linkedClientScope) {
    return { mode: 'restricted_empty', locationIds: [] }
  }

  if (linkedClientScope) {
    const contractDelegate = (params.prisma as any).serviceContract
    if (contractDelegate?.findUnique) {
      const contract = await contractDelegate.findUnique({
        where: {
          clientCompanyId_providerCompanyId: {
            clientCompanyId: scopeCompanyId,
            providerCompanyId: params.actor.companyId,
          },
        },
        select: {
          status: true,
          startsAt: true,
          endsAt: true,
          locations: { select: { locationId: true } },
        },
      })
      if (!contract || !isServiceContractEffective(contract)) {
        return { mode: 'restricted_empty', locationIds: [] }
      }

      const contractLocationIds = uniqueLocationIds(
        contract.locations?.map((row: { locationId: string }) => row.locationId) ?? [],
      )
      if (contractLocationIds.length > 0) {
        if (interpreted.runtimeMode === 'restricted_empty') {
          return { mode: 'restricted_empty', locationIds: [] }
        }
        if (interpreted.runtimeMode === 'tenant_wide') {
          return { mode: 'bound_locations', locationIds: contractLocationIds }
        }
        const allowed = interpreted.locationIds.filter((id) => contractLocationIds.includes(id))
        return { mode: 'bound_locations', locationIds: allowed }
      }
    }
  }

  return {
    mode: interpreted.runtimeMode,
    locationIds: interpreted.locationIds,
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

  if (!isLocationAllowedByLocationScope(locationScope, params.locationId)) {
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
      isActive: true,
      deletedAt: null,
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
  const accessScope = params.prisma.userAccessScope?.findUnique
    ? await params.prisma.userAccessScope.findUnique({
        where: {
          userId_companyId: {
            userId: params.actor.id,
            companyId: params.actor.companyId,
          },
        },
        select: { locationMode: true },
      })
    : null
  const bindingCompanyIds = accessScope?.locationMode ? [params.actor.companyId] : companyIds
  const bindings = await params.prisma.userLocationBinding.findMany({
    where: {
      userId: params.actor.id,
      companyId: { in: bindingCompanyIds },
      location: { clientCompanyId: { in: companyIds } },
    },
    select: {
      companyId: true,
      locationId: true,
      location: { select: { clientCompanyId: true } },
    },
  })
  const locationScopeByCompany: Record<string, string[]> = {}
  for (const companyId of companyIds) {
    locationScopeByCompany[companyId] = []
  }
  for (const binding of bindings) {
    const scopeCompanyId = binding.location?.clientCompanyId ?? binding.companyId
    if (!locationScopeByCompany[scopeCompanyId]) {
      locationScopeByCompany[scopeCompanyId] = []
    }
    locationScopeByCompany[scopeCompanyId].push(binding.locationId)
  }
  for (const companyId of Object.keys(locationScopeByCompany)) {
    const interpreted = interpretUserAccessLocationScope({
      explicitLocationMode: accessScope?.locationMode,
      locationIds: locationScopeByCompany[companyId],
    })
    locationScopeByCompany[companyId] = interpreted.locationIds
    if (
      interpreted.runtimeMode === 'restricted_empty' ||
      (interpreted.locationIds.length === 0 && interpreted.locationMode === 'SELECTED_LOCATIONS')
    ) {
      locationScopeByCompany[companyId] = [RESTRICTED_EMPTY_LOCATION_SENTINEL]
    }
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

/**
 * Operational-scope WHERE for a SECONDARY provider on a given client, ignoring the
 * contract role (callers must have already established the contract is SECONDARY).
 * Scope = tickets assigned to the provider's executor users OR at locations the
 * provider's users are bound to for that client. No scope ⇒ deny-all sentinel.
 */
async function buildSecondaryOperationalScopeWhere(params: {
  prisma: PrismaService
  providerCompanyId: string
  linkedClientCompanyId: string
  actor?: TicketAccessActor
}): Promise<Prisma.TicketWhereInput> {
  const actorLocationScope = params.actor
    ? await resolveActorLocationScope({
        prisma: params.prisma,
        actor: params.actor,
        scopeCompanyId: params.linkedClientCompanyId,
      })
    : ({ mode: 'tenant_wide', locationIds: [] } as LocationScope)
  if (actorLocationScope.mode === 'restricted_empty') {
    return noAccessWhere()
  }
  const selectedLocationIds =
    actorLocationScope.mode === 'bound_locations'
      ? uniqueLocationIds(actorLocationScope.locationIds)
      : null
  if (selectedLocationIds && selectedLocationIds.length === 0) {
    return noAccessWhere()
  }

  const executors = await params.prisma.user.findMany({
    where: { companyId: params.providerCompanyId, isExecutor: true },
    select: { id: true },
  })
  const executorIds = executors.map((u) => u.id)

  const locationBindings = await params.prisma.userLocationBinding.findMany({
    where: {
      companyId: params.providerCompanyId,
      location: { clientCompanyId: params.linkedClientCompanyId },
    },
    select: { locationId: true },
  })
  const providerBoundLocationIds = uniqueLocationIds(locationBindings.map((b) => b.locationId))
  const boundLocationIds = selectedLocationIds
    ? providerBoundLocationIds.filter((locationId) => selectedLocationIds.includes(locationId))
    : providerBoundLocationIds

  const orClauses: Prisma.TicketWhereInput[] = []
  if (executorIds.length > 0) {
    const executorWhere: Prisma.TicketWhereInput = { assignedTechnicianId: { in: executorIds } }
    orClauses.push(
      selectedLocationIds
        ? { AND: [executorWhere, { locationId: { in: selectedLocationIds } }] }
        : executorWhere,
    )
  }
  if (boundLocationIds.length > 0) {
    orClauses.push({ locationId: { in: boundLocationIds } })
  }

  if (orClauses.length === 0) {
    return noAccessWhere()
  }
  return { OR: orClauses }
}

/**
 * SECONDARY operational restriction shared by board/list and readable-ticket access.
 * Returns null when the (provider → client) contract is NOT SECONDARY (no restriction),
 * otherwise the operational-scope WHERE. Keeps board, list, detail and attachments aligned.
 */
export async function buildSecondaryOperationalTicketWhere(params: {
  prisma: PrismaService
  serviceContractsService: ServiceContractsService
  providerCompanyId: string
  linkedClientCompanyId: string
  actor?: TicketAccessActor
}): Promise<Prisma.TicketWhereInput | null> {
  const access = await params.serviceContractsService.getLinkedClientAccess(
    params.providerCompanyId,
    params.linkedClientCompanyId,
  )
  if (!access || access.role !== ServiceContractRole.SECONDARY) {
    return null
  }
  return buildSecondaryOperationalScopeWhere({
    prisma: params.prisma,
    providerCompanyId: params.providerCompanyId,
    linkedClientCompanyId: params.linkedClientCompanyId,
    actor: params.actor,
  })
}

export async function buildSecondaryOperationalRestrictionWhere(params: {
  prisma: PrismaService
  serviceContractsService: ServiceContractsService
  providerCompanyId: string
  linkedClientCompanyId?: string
  scopeCompanyIds?: string[]
  actor?: TicketAccessActor
}): Promise<Prisma.TicketWhereInput | null> {
  if (params.linkedClientCompanyId && params.linkedClientCompanyId !== params.providerCompanyId) {
    return buildSecondaryOperationalTicketWhere({
      prisma: params.prisma,
      serviceContractsService: params.serviceContractsService,
      providerCompanyId: params.providerCompanyId,
      linkedClientCompanyId: params.linkedClientCompanyId,
      actor: params.actor,
    })
  }

  const scopeCompanyIds = params.scopeCompanyIds ?? []
  if (scopeCompanyIds.length === 0) return null

  const secondaryClientIds = await params.serviceContractsService.listSecondaryLinkedClientIds(params.providerCompanyId)
  const scopedSecondaryClientIds = secondaryClientIds.filter((id) => scopeCompanyIds.includes(id))
  if (scopedSecondaryClientIds.length === 0) return null

  const secondaryClauses: Prisma.TicketWhereInput[] = []
  for (const clientId of scopedSecondaryClientIds) {
    const secondaryWhere = await buildSecondaryOperationalTicketWhere({
      prisma: params.prisma,
      serviceContractsService: params.serviceContractsService,
      providerCompanyId: params.providerCompanyId,
      linkedClientCompanyId: clientId,
      actor: params.actor,
    })
    if (secondaryWhere) {
      secondaryClauses.push({
        AND: [{ companyId: clientId }, secondaryWhere],
      })
    }
  }

  if (secondaryClauses.length === 0) return null

  return {
    OR: [
      { companyId: { notIn: scopedSecondaryClientIds } },
      ...secondaryClauses,
    ],
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

    const executorBaseWhere: Prisma.TicketWhereInput = {
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
    }
    const secondaryOperationalWhere = await buildSecondaryOperationalRestrictionWhere({
      prisma: params.prisma,
      serviceContractsService: params.serviceContractsService,
      providerCompanyId: params.actor.companyId,
      linkedClientCompanyId: params.linkedClientCompanyId,
      scopeCompanyIds: technicianScope.companyIds,
      actor: params.actor,
    })
    const executorWhere = secondaryOperationalWhere
      ? { AND: [executorBaseWhere, secondaryOperationalWhere] }
      : executorBaseWhere

    const executorTicket = await params.prisma.ticket.findFirst({
      where: executorWhere,
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
        locationId: true,
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
        locationId: true,
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
    // Build one clause per linked client. PRIMARY clients stay unrestricted; SECONDARY
    // clients are narrowed to their operational scope (assigned executor / bound location)
    // so detail access matches the board/list restriction and never leaks unrelated tickets.
    const perClientClauses: Prisma.TicketWhereInput[] = []
    for (const clientId of linkedClientIds) {
      const actorClientLocationScope = await resolveActorLocationScope({
        prisma: params.prisma,
        actor: params.actor,
        scopeCompanyId: clientId,
      })
      let clause: Prisma.TicketWhereInput = applyLocationScopeToLinkedClientWhere(
        { companyId: clientId },
        actorClientLocationScope,
      )
      if (params.actor.role === UserRole.TECHNICIAN) {
        clause = normalizeAnd(clause, [{ assignedTechnicianId: params.actor.id }])
      } else {
        const secondaryWhere = await buildSecondaryOperationalTicketWhere({
          prisma: params.prisma,
          serviceContractsService: params.serviceContractsService,
          providerCompanyId: params.actor.companyId,
          linkedClientCompanyId: clientId,
          actor: params.actor,
        })
        if (secondaryWhere) {
          clause = normalizeAnd(clause, [secondaryWhere])
        }
      }
      perClientClauses.push(clause)
    }

    const providerTicket = await params.prisma.ticket.findFirst({
      where: { id: params.ticketId, OR: perClientClauses },
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
      (locationScope.mode === 'restricted_empty' ||
        (locationScope.mode === 'bound_locations' && !locationScope.locationIds.includes(directTicket.locationId))) &&
      directTicket.companyId === params.actor.companyId
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

      const linkedLocationScope = await resolveActorLocationScope({
        prisma: params.prisma,
        actor: params.actor,
        scopeCompanyId: directTicket.companyId,
      })
      if (!isTicketAllowedByLocationScope(directTicket, linkedLocationScope)) {
        throw new NotFoundException('Ticket not found')
      }

      // SECONDARY providers only get detail access inside their operational scope
      // (assigned executor / bound location) — same restriction as board/list.
      if (access.role === ServiceContractRole.SECONDARY) {
        const secondaryScopeWhere = await buildSecondaryOperationalScopeWhere({
          prisma: params.prisma,
          providerCompanyId: params.actor.companyId,
          linkedClientCompanyId: directTicket.companyId,
          actor: params.actor,
        })
        const inScope = await params.prisma.ticket.findFirst({
          where: { AND: [{ id: params.ticketId, companyId: directTicket.companyId }, secondaryScopeWhere] },
          select: { id: true },
        })
        if (!inScope) {
          throw new NotFoundException('Ticket not found')
        }
      }

      return {
        ticket: directTicket,
        scopeCompanyId: directTicket.companyId,
        visibilityMode: 'provider_primary' as TicketVisibilityMode,
      }
    }

    if (isExecutorCapableRole(params.actor.role) && directTicket.companyId !== params.actor.companyId) {
      try {
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
        const canReadAssigned = directTicket.assignedTechnicianId === params.actor.id && locationAllowed
        const secondaryScopeWhere = await buildSecondaryOperationalTicketWhere({
          prisma: params.prisma,
          serviceContractsService: params.serviceContractsService,
          providerCompanyId: params.actor.companyId,
          linkedClientCompanyId: directTicket.companyId,
          actor: params.actor,
        })
        const secondaryScopedTicket =
          secondaryScopeWhere && directTicket.status === 'NEW' && !directTicket.assignedTechnicianId
            ? await params.prisma.ticket.findFirst({
                where: { AND: [{ id: params.ticketId, companyId: directTicket.companyId }, secondaryScopeWhere] },
                select: { id: true },
              })
            : null
        const canReadNew =
          directTicket.status === 'NEW' &&
          !directTicket.assignedTechnicianId &&
          (secondaryScopeWhere ? !!secondaryScopedTicket : locationAllowed)

        if (canReadAssigned || canReadNew) {
          return {
            ticket: directTicket,
            scopeCompanyId: directTicket.companyId,
            visibilityMode: 'provider_primary' as TicketVisibilityMode,
          }
        }
      } catch (err) {
        // No contractual relationship with this company: actor has no access.
        // Any non-Forbidden error is unexpected and must propagate.
        if (!(err instanceof ForbiddenException)) throw err
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
  allowedLinkedClientContractRoles?: ServiceContractRole[]
}) {
  const readable = await resolveReadableTicketAccess({
    prisma: params.prisma,
    serviceContractsService: params.serviceContractsService,
    actor: params.actor,
    ticketId: params.ticketId,
    linkedClientCompanyId: params.linkedClientCompanyId,
    allowedLinkedClientContractRoles: params.allowedLinkedClientContractRoles,
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
