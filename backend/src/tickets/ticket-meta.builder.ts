import { TicketStatus, UserRole } from '@prisma/client'

import { TicketsPolicy, type TicketsClaimWhereParams } from '../policy/tickets.policy'
import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { decideTicketTransition } from '../workflow/ticket.workflow'
import {
  buildTechnicianLocationRestrictionWhere,
  isTechnicianLocationAllowed,
  resolveTechnicianOperationalScope,
  resolveTicketOperationAccess,
  type TicketVisibilityMode,
  technicianMatchesCategorySpecializationLinks,
  wasTicketCreatedByActor,
} from './ticket-access.utils'
import { TICKET_ASSIGNMENT_REQUESTED_ENTITY, TICKET_ASSIGNMENT_REQUESTED_EVENT } from './ticket-domain-event.types'

export type TicketMetaBuildParams = {
  actorCompanyId: string
  userId: string
  role: UserRole
  ticketId: string
  /** companyId тенанта заявки (DomainEvent.companyId при запросе назначения). */
  ticketCompanyId: string
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
    const assignmentRequestedByCurrentUser = await this.resolveAssignmentRequestedByCurrentUser(params)

    return {
      scopeCompanyId: params.scopeCompanyId,
      visibilityMode: params.visibilityMode,
      canClaimByCurrentUser: claimAvailability.canClaimByCurrentUser,
      claimAvailabilityReason: claimAvailability.claimAvailabilityReason,
      assignmentRequestedByCurrentUser,
      availableStatusTransitions,
    }
  }

  private async resolveAssignmentRequestedByCurrentUser(params: TicketMetaBuildParams): Promise<boolean> {
    if (params.role !== UserRole.TECHNICIAN) return false
    if (params.ticketStatus !== TicketStatus.NEW || params.assignedTechnicianId) return false
    const ev = await this.prisma.domainEvent.findFirst({
      where: {
        type: TICKET_ASSIGNMENT_REQUESTED_EVENT,
        entityType: TICKET_ASSIGNMENT_REQUESTED_ENTITY,
        entityId: params.ticketId,
        companyId: params.ticketCompanyId,
        actorUserId: params.userId,
      },
      select: { id: true },
    })
    return !!ev
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
      specializationNames: technicianScope.specializationNames,
      allowTechnicianClaim: technicianScope.allowTechnicianClaim,
      companyIds: technicianScope.companyIds,
    } satisfies TicketsClaimWhereParams)
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

    const ticketForClaimDiag = await this.prisma.ticket.findFirst({
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
        return {
          canClaimByCurrentUser: false,
          claimAvailabilityReason: 'Заявка не в статусе NEW: claim доступен только для новых заявок',
        }
      }
      if (ticketForClaimDiag.assignedTechnicianId) {
        return {
          canClaimByCurrentUser: false,
          claimAvailabilityReason: 'Заявка уже назначена: claim только для заявок без исполнителя',
        }
      }
      const locationAllowed = isTechnicianLocationAllowed({
        companyId: ticketForClaimDiag.companyId,
        locationId: ticketForClaimDiag.locationId,
        locationScopeByCompany: technicianScope.locationScopeByCompany,
      })
      if (!locationAllowed) {
        return {
          canClaimByCurrentUser: false,
          claimAvailabilityReason:
            'Локация заявки недоступна: нет привязки UserLocationBinding к этой точке в текущем scope',
        }
      }
      const categoryLinks = ticketForClaimDiag.problemCategory?.specializationLinks ?? []
      if (
        categoryLinks.length > 0 &&
        !technicianMatchesCategorySpecializationLinks({
          categoryLinks,
          technicianSpecializationIds: technicianScope.specializationIds,
          technicianSpecializationNames: technicianScope.specializationNames,
        })
      ) {
        return {
          canClaimByCurrentUser: false,
          claimAvailabilityReason:
            'Нет совпадения по специализации: категория заявки не связана с вашими активными специализациями (по id или по нормализованному имени)',
        }
      }
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
