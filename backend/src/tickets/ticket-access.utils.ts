import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { Prisma, UserRole } from '@prisma/client'

import { assertAllowed, isPlatformObserverScope, resolveObserverScopeCompanyId } from '../policy/policy.utils'
import { TicketsPolicy, type UserCtx } from '../policy/tickets.policy'
import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'

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
  UserRole.CLIENT,
  UserRole.TERRITORIAL_MANAGER,
  UserRole.NETWORK_DIRECTOR,
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

  console.log('LOCATION_SCOPE_DEBUG', {
    actorCompanyId: params.actor.companyId,
    scopeCompanyId,
  })

  if (!scopeCompanyId) {
    return { mode: 'tenant_wide', locationIds: [] }
  }

  if (!LOCATION_SCOPED_ROLES.includes(params.actor.role)) {
    return { mode: 'tenant_wide', locationIds: [] }
  }

  // For non-technician roles, linked-client scope stays tenant-wide by design.
  if (params.actor.role !== UserRole.TECHNICIAN && scopeCompanyId !== params.actor.companyId) {
    return { mode: 'tenant_wide', locationIds: [] }
  }

  const bindings = await params.prisma.userLocationBinding.findMany({
    where: {
      userId: params.actor.id,
      companyId: scopeCompanyId,
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
export async function wasTicketCreatedByActor(params: {
  prisma: PrismaService
  companyIds: string[]
  ticketId: string
  actorUserId: string
}) {
  if (params.companyIds.length === 0) return false

  const createdEvent = await params.prisma.domainEvent.findFirst({
    where: {
      companyId: params.companyIds.length === 1 ? params.companyIds[0] : { in: params.companyIds },
      entityType: 'Ticket',
      entityId: params.ticketId,
      type: 'ticket.created',
      actorUserId: params.actorUserId,
    },
    select: { entityId: true },
  })

  return !!createdEvent
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

export async function resolveTechnicianOperationalScope(params: {
  prisma: PrismaService
  serviceContractsService: ServiceContractsService
  actor: TicketAccessActor
  linkedClientCompanyId?: string
}) {
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

  const technician = await params.prisma.user.findFirst({
    where: {
      id: params.actor.id,
      companyId: params.actor.companyId,
      role: UserRole.TECHNICIAN,
    },
    select: {
      id: true,
      technicianSpecializations: {
        select: { specializationId: true },
      },
    },
  })

  if (!technician) {
    throw new NotFoundException('Technician not found')
  }

  const linkedClientIds = await resolvePrimaryLinkedClientIds({
    serviceContractsService: params.serviceContractsService,
    actor: params.actor,
    linkedClientCompanyId: params.linkedClientCompanyId,
    allowedRoles: [UserRole.TECHNICIAN],
  })

  const companyIds = Array.from(new Set([params.actor.companyId, ...linkedClientIds]))
  const specializationIds = technician.technicianSpecializations.map((item) => item.specializationId)
  const linkedScopeSelected = !!params.linkedClientCompanyId && params.linkedClientCompanyId !== params.actor.companyId
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

async function resolvePrimaryLinkedClientIds(params: {
  serviceContractsService: ServiceContractsService
  actor: TicketAccessActor
  linkedClientCompanyId?: string
  allowedRoles?: UserRole[]
}) {
  const allowedRoles = params.allowedRoles ?? PROVIDER_LINKED_OPERATION_ROLES

  if (params.linkedClientCompanyId && params.linkedClientCompanyId !== params.actor.companyId) {
    if (!allowedRoles.includes(params.actor.role)) {
      throw new ForbiddenException('Role cannot access linked client tickets')
    }

    await params.serviceContractsService.assertPrimaryLinkedClientAccess(
      params.actor.companyId,
      params.linkedClientCompanyId,
    )

    return [params.linkedClientCompanyId]
  }

  if (!allowedRoles.includes(params.actor.role)) {
    return []
  }

  return params.serviceContractsService.listPrimaryLinkedClientIds(params.actor.companyId)
}

export async function resolveTicketReadScope(params: {
  prisma: PrismaService
  serviceContractsService: ServiceContractsService
  actorCompanyId: string
  role: UserRole
  linkedClientCompanyId?: string
  observerCompanyId?: string
  allowedLinkedClientRoles?: UserRole[]
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

  const linkedClientIds = await resolvePrimaryLinkedClientIds({
    serviceContractsService: params.serviceContractsService,
    actor: {
      id: '',
      role: params.role,
      companyId: params.actorCompanyId,
    },
    linkedClientCompanyId: params.linkedClientCompanyId,
    allowedRoles: params.allowedLinkedClientRoles ?? PROVIDER_LINKED_OVERVIEW_ROLES,
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

  if (params.actor.role === UserRole.TECHNICIAN) {
    const technicianScope = await resolveTechnicianOperationalScope({
      prisma: params.prisma,
      serviceContractsService: params.serviceContractsService,
      actor: params.actor,
      linkedClientCompanyId: params.linkedClientCompanyId,
    })

    const createdByActor = await params.prisma.domainEvent.findFirst({
      where: {
        companyId:
          technicianScope.companyIds.length === 1
            ? technicianScope.companyIds[0]
            : { in: technicianScope.companyIds },
        entityType: 'Ticket',
        entityId: params.ticketId,
        type: 'ticket.created',
        actorUserId: params.actor.id,
      },
      select: { entityId: true },
    })

    if (createdByActor) {
      const createdTicket = await params.prisma.ticket.findFirst({
        where: {
          id: params.ticketId,
          companyId:
            technicianScope.companyIds.length === 1
              ? technicianScope.companyIds[0]
              : { in: technicianScope.companyIds },
        },
        select: {
          id: true,
          companyId: true,
          locationId: true,
          assignedTechnicianId: true,
        },
      })

      if (
        createdTicket &&
        isTechnicianLocationAllowed({
          companyId: createdTicket.companyId,
          locationId: createdTicket.locationId,
          locationScopeByCompany: technicianScope.locationScopeByCompany,
        })
      ) {
        return {
          ticket: createdTicket,
          scopeCompanyId: createdTicket.companyId,
          visibilityMode:
            createdTicket.companyId === params.actor.companyId
              ? ('tenant' as TicketVisibilityMode)
              : ('provider_primary' as TicketVisibilityMode),
        }
      }
    }

    const visibilityOr: any[] = [
      {
        assignedTechnicianId: params.actor.id,
      },
    ]

    if (technicianScope.allowTechnicianClaim) {
      if (technicianScope.specializationIds.length > 0) {
        visibilityOr.push({
          status: 'NEW',
          assignedTechnicianId: null,
          problemCategory: {
            specializationLinks: {
              some: {
                specializationId: { in: technicianScope.specializationIds },
              },
            },
          },
        })
      }

      visibilityOr.push({
        status: 'NEW',
        assignedTechnicianId: null,
        problemCategory: {
          specializationLinks: {
            none: {},
          },
        },
      })
    }

    const technicianTicket = await params.prisma.ticket.findFirst({
      where: {
        AND: [
          {
            id: params.ticketId,
            OR: visibilityOr,
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

    if (technicianTicket) {
      return {
        ticket: technicianTicket,
        scopeCompanyId: technicianTicket.companyId,
        visibilityMode:
          technicianTicket.companyId === params.actor.companyId
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

  const linkedClientIds = await resolvePrimaryLinkedClientIds({
    serviceContractsService: params.serviceContractsService,
    actor: params.actor,
    linkedClientCompanyId: params.linkedClientCompanyId,
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
      await params.serviceContractsService.assertPrimaryLinkedClientAccess(
        params.actor.companyId,
        directTicket.companyId,
      )

      return {
        ticket: directTicket,
        scopeCompanyId: directTicket.companyId,
        visibilityMode: 'provider_primary' as TicketVisibilityMode,
      }
    }

    if (params.actor.role === UserRole.TECHNICIAN && directTicket.companyId !== params.actor.companyId) {
      const technicianScope = await resolveTechnicianOperationalScope({
        prisma: params.prisma,
        serviceContractsService: params.serviceContractsService,
        actor: params.actor,
        linkedClientCompanyId: directTicket.companyId,
      })

      const categorySpecializationIds =
        directTicket.problemCategory?.specializationLinks?.map((item) => item.specializationId) ?? []
      const locationAllowed = isTechnicianLocationAllowed({
        companyId: directTicket.companyId,
        locationId: directTicket.locationId,
        locationScopeByCompany: technicianScope.locationScopeByCompany,
      })
      const technicianCanClaim =
        technicianScope.allowTechnicianClaim &&
        directTicket.status === 'NEW' &&
        !directTicket.assignedTechnicianId &&
        locationAllowed &&
        (categorySpecializationIds.length === 0 ||
          categorySpecializationIds.some((id) => technicianScope.specializationIds.includes(id)))

      const technicianCanReadLinked =
        (directTicket.assignedTechnicianId === params.actor.id && locationAllowed) || technicianCanClaim

      if (technicianCanReadLinked) {
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

