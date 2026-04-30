import { TicketStatus, UserRole } from '@prisma/client'

import { TicketsPolicy } from '../policy/tickets.policy'
import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { decideTicketTransition } from '../workflow/ticket.workflow'
import { buildTechnicianLocationRestrictionWhere, resolveTechnicianOperationalScope, resolveTicketOperationAccess, type TicketVisibilityMode, wasTicketCreatedByActor } from './ticket-access.utils'

export type TicketMetaBuildParams = {
  actorCompanyId: string
  userId: string
  role: UserRole
  ticketId: string
  ticketStatus: TicketStatus
  assignedTechnicianId: string | null
  scopeCompanyId: string
  visibilityMode: TicketVisibilityMode
  linkedClientCompanyId?: string
}

export class TicketMetaBuilder {
  private readonly policy = new TicketsPolicy()

  constructor(
    private readonly prisma: PrismaService,
    private readonly serviceContractsService: ServiceContractsService,
  ) {}

  async buildForGetOne(params: TicketMetaBuildParams) {
    const claimAvailability = await this.resolveClaimAvailability(params)
    const availableStatusTransitions = await this.resolveAvailableStatusTransitions(params)

    return {
      scopeCompanyId: params.scopeCompanyId,
      visibilityMode: params.visibilityMode,
      canClaimByCurrentUser: claimAvailability.canClaimByCurrentUser,
      claimAvailabilityReason: claimAvailability.claimAvailabilityReason,
      availableStatusTransitions,
    }
  }

  private async resolveClaimAvailability(params: TicketMetaBuildParams): Promise<{ canClaimByCurrentUser: boolean; claimAvailabilityReason: string | null }> {
    if (params.role !== UserRole.TECHNICIAN) {
      return { canClaimByCurrentUser: false, claimAvailabilityReason: null }
    }

    const technicianScope = await resolveTechnicianOperationalScope({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor: {
        id: params.userId,
        role: params.role,
        companyId: params.actorCompanyId,
      },
      linkedClientCompanyId: params.linkedClientCompanyId,
    })

    if (!technicianScope.allowTechnicianClaim) {
      return {
        canClaimByCurrentUser: false,
        claimAvailabilityReason: 'Claim отключен настройками компании',
      }
    }

    const decision = this.policy.claimWhere({
      user: {
        id: params.userId,
        role: UserRole.TECHNICIAN,
        companyId: params.actorCompanyId,
      },
      ticketId: params.ticketId,
      specializationIds: technicianScope.specializationIds,
      allowTechnicianClaim: technicianScope.allowTechnicianClaim,
      companyIds: technicianScope.companyIds,
    })
    const locationRestriction = buildTechnicianLocationRestrictionWhere({
      companyIds: technicianScope.companyIds,
      locationScopeByCompany: technicianScope.locationScopeByCompany,
    })

    if (!decision.allowed) {
      return {
        canClaimByCurrentUser: false,
        claimAvailabilityReason: decision.reason || 'Claim недоступен',
      }
    }

    const claimableTicket = await this.prisma.ticket.findFirst({
      where: {
        AND: [decision.where, locationRestriction],
      },
      select: { id: true },
    })

    if (claimableTicket) {
      return { canClaimByCurrentUser: true, claimAvailabilityReason: null }
    }

    const selfCreatedByCurrentUser = await wasTicketCreatedByActor({
      prisma: this.prisma,
      companyIds: technicianScope.companyIds,
      ticketId: params.ticketId,
      actorUserId: params.userId,
    })

    if (selfCreatedByCurrentUser) {
      const selfCreatedTicket = await this.prisma.ticket.findFirst({
        where: {
          AND: [
            {
              id: params.ticketId,
              companyId:
                technicianScope.companyIds.length === 1
                  ? technicianScope.companyIds[0]
                  : { in: technicianScope.companyIds },
              status: TicketStatus.NEW,
              assignedTechnicianId: null,
            },
            locationRestriction,
          ],
        },
        select: { id: true },
      })

      if (selfCreatedTicket) {
        return { canClaimByCurrentUser: true, claimAvailabilityReason: null }
      }
    }

    return {
      canClaimByCurrentUser: false,
      claimAvailabilityReason: 'Claim доступен только для новых неназначенных заявок в вашем operational scope',
    }
  }

  private async resolveAvailableStatusTransitions(params: TicketMetaBuildParams): Promise<TicketStatus[]> {
    try {
      const access = await resolveTicketOperationAccess({
        prisma: this.prisma,
        serviceContractsService: this.serviceContractsService,
        actor: {
          id: params.userId,
          role: params.role,
          companyId: params.actorCompanyId,
        },
        ticketId: params.ticketId,
        linkedClientCompanyId: params.linkedClientCompanyId,
      })

      const decision = this.policy.canChangeStatus({
        user: {
          id: params.userId,
          role: params.role,
          companyId: access.operationCompanyId,
        },
        ticket: {
          companyId: access.operationCompanyId,
          assignedTechnicianId: params.assignedTechnicianId,
        },
      })

      if (!decision.allowed) return []
    } catch {
      return []
    }

    const allStatuses: TicketStatus[] = [
      TicketStatus.NEW,
      TicketStatus.ASSIGNED,
      TicketStatus.IN_PROGRESS,
      TicketStatus.DONE,
      TicketStatus.CANCELED,
    ]

    return allStatuses.filter((nextStatus) => decideTicketTransition(params.ticketStatus, nextStatus).allowed)
  }
}
