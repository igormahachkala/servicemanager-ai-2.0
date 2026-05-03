import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { Prisma, UserRole } from '@prisma/client'

import { assertAllowed, isPlatformObserverScope, resolveObserverScopeCompanyId } from '../policy/policy.utils'
import { TicketsPolicy, type UserCtx } from '../policy/tickets.policy'
import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
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

  const technician = await params.prisma.user.findFirst({
    where: {
      id: params.actor.id,
      companyId: params.actor.companyId,
      role: UserRole.TECHNICIAN,
    },
    select: {
      id: true,
      technicianSpecializations: {
        where: { specialization: { isActive: true } },
        select: {
          specializationId: true,
          specialization: { select: { name: true } },
        },
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
  const specializationNames = Array.from(
    new Set(
      technician.technicianSpecializations.flatMap((item) => {
        const raw = item.specialization?.name?.trim() ?? ''
        if (!raw) return []
        const out: string[] = [raw, ...specializationNameMatchVariants(raw)]
        const norm = normalizeSpecializationLabel(raw)
        if (norm) out.push(norm)
        return out
      }),
    ),
  ).filter((name) => name.length > 0)
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

    const visibilityOr: any[] = [
      {
        assignedTechnicianId: params.actor.id,
      },
    ]

    if (technicianScope.allowTechnicianClaim) {
      const specSome = buildSpecializationLinksSomeWhereInput({
        specializationIds: technicianScope.specializationIds,
        specializationNames: technicianScope.specializationNames,
      })
      if (specSome) {
        visibilityOr.push({
          status: 'NEW',
          assignedTechnicianId: null,
          problemCategory: {
            specializationLinks: {
              some: specSome,
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

      const categoryLinks = directTicket.problemCategory?.specializationLinks ?? []
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
        technicianMatchesCategorySpecializationLinks({
          categoryLinks,
          technicianSpecializationIds: technicianScope.specializationIds,
          technicianSpecializationNames: technicianScope.specializationNames,
        })

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

