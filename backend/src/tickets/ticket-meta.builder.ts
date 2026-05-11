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
    const { availableActions, availableActionHints } = this.deriveAvailableActions(
      params,
      claimAvailability,
      availableStatusTransitions,
    )

    return {
      scopeCompanyId: params.scopeCompanyId,
      visibilityMode: params.visibilityMode,
      canClaimByCurrentUser: claimAvailability.canClaimByCurrentUser,
      claimAvailabilityReason: claimAvailability.claimAvailabilityReason,
      assignmentRequestedByCurrentUser,
      availableStatusTransitions,
      availableActions,
      ...(availableActionHints ? { availableActionHints } : {}),
    }
  }

  /**
   * Единый источник правды для UI: какие операционные действия разрешены политикой/воркфлоу.
   * Техник: при NEW с доступным claim не подсвечиваем «Начать» через переход NEW→IN_PROGRESS — сначала claim/назначение.
   */
  private deriveAvailableActions(
    params: TicketMetaBuildParams,
    claim: { canClaimByCurrentUser: boolean; claimAvailabilityReason: string | null },
    transitions: TicketStatus[],
  ): {
    availableActions: {
      canClaim: boolean
      canStart: boolean
      canComplete: boolean
      canClose: boolean
    }
    availableActionHints?: Partial<Record<'canClaim' | 'canStart' | 'canComplete' | 'canClose', string | null>>
  } {
    const isTechnician = params.role === UserRole.TECHNICIAN
    const hints: Partial<Record<'canClaim' | 'canStart' | 'canComplete' | 'canClose', string | null>> = {}

    const canClaim =
      isTechnician &&
      claim.canClaimByCurrentUser &&
      params.ticketStatus === TicketStatus.NEW &&
      !params.assignedTechnicianId

    if (
      isTechnician &&
      params.ticketStatus === TicketStatus.NEW &&
      !params.assignedTechnicianId &&
      !canClaim &&
      claim.claimAvailabilityReason
    ) {
      hints.canClaim = claim.claimAvailabilityReason
    }

    const preferClaimOverDirectInProgress =
      isTechnician &&
      params.ticketStatus === TicketStatus.NEW &&
      claim.canClaimByCurrentUser &&
      !params.assignedTechnicianId

    const canStart =
      transitions.includes(TicketStatus.IN_PROGRESS) && !preferClaimOverDirectInProgress

    if (!canStart && transitions.includes(TicketStatus.IN_PROGRESS) && preferClaimOverDirectInProgress) {
      hints.canStart = 'Сначала закрепите заявку за собой (самовзятие), затем можно начать работу.'
    } else if (!canStart && params.ticketStatus === TicketStatus.ASSIGNED) {
      hints.canStart = 'Перевод в «В работе» сейчас недоступен для вашей роли или назначения.'
    }

    const canComplete = transitions.includes(TicketStatus.DONE)
    if (!canComplete && params.ticketStatus === TicketStatus.IN_PROGRESS) {
      hints.canComplete = 'Завершение сейчас недоступно: проверьте права, назначение или требования к отчёту (комментарий и фото).'
    }

    const canClose = transitions.includes(TicketStatus.CANCELED)

    const outHints = Object.values(hints).some((v) => (v || '').length > 0) ? hints : undefined
    return {
      availableActions: { canClaim, canStart, canComplete, canClose },
      availableActionHints: outHints,
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
