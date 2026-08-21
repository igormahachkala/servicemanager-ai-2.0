import { ServiceContractRole, TicketStatus, UserRole } from '@prisma/client'

import { TicketsPolicy, type TicketsClaimWhereParams } from '../policy/tickets.policy'
import { isExecutorEligible } from '../common/executor.utils'
import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { decideTicketTransition } from '../workflow/ticket.workflow'
import {
  buildSecondaryOperationalRestrictionWhere,
  buildTechnicianLocationRestrictionWhere,
  isTechnicianLocationAllowed,
  resolveTechnicianOperationalScope,
  resolveTicketOperationAccess,
  type TicketVisibilityMode,
  technicianMatchesCategorySpecializationLinks,
} from './ticket-access.utils'
import { canAcceptTicket } from './ticket-acceptance-access'
import { TICKET_ASSIGNMENT_REQUESTED_ENTITY, TICKET_ASSIGNMENT_REQUESTED_EVENT } from './ticket-domain-event.types'

export type TicketMetaBuildParams = {
  actorCompanyId: string
  userId: string
  role: UserRole
  isExecutor: boolean
  ticketId: string
  /** companyId тенанта заявки (DomainEvent.companyId при запросе назначения). */
  ticketCompanyId: string
  ticketCreatedByUserId?: string | null
  ticketStatus: TicketStatus
  assignedTechnicianId: string | null
  scopeCompanyId: string
  visibilityMode: TicketVisibilityMode
  linkedClientCompanyId?: string
  accessFlags?: Record<string, any>
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
    const acceptanceAvailable = await this.resolveAcceptanceAvailability(params)
    const { availableActions, availableActionHints } = this.deriveAvailableActions(
      params,
      claimAvailability,
      availableStatusTransitions,
      acceptanceAvailable,
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
    acceptanceAvailable: boolean,
  ): {
    availableActions: {
      canClaim: boolean
      canStart: boolean
      canComplete: boolean
      canClose: boolean
      canAccept: boolean
      canReject: boolean
    }
    availableActionHints?: Partial<Record<'canClaim' | 'canStart' | 'canComplete' | 'canClose' | 'canAccept' | 'canReject', string | null>>
  } {
    const isExec = isExecutorEligible({ role: params.role, isExecutor: params.isExecutor })
    const hints: Partial<Record<'canClaim' | 'canStart' | 'canComplete' | 'canClose' | 'canAccept' | 'canReject', string | null>> = {}

    const canClaim =
      isExec &&
      claim.canClaimByCurrentUser &&
      params.ticketStatus === TicketStatus.NEW &&
      !params.assignedTechnicianId

    if (
      isExec &&
      params.ticketStatus === TicketStatus.NEW &&
      !params.assignedTechnicianId &&
      !canClaim &&
      claim.claimAvailabilityReason
    ) {
      hints.canClaim = claim.claimAvailabilityReason
    }

    const preferClaimOverDirectInProgress =
      isExec &&
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
      availableActions: {
        canClaim,
        canStart,
        canComplete,
        canClose,
        canAccept: acceptanceAvailable,
        canReject: acceptanceAvailable,
      },
      availableActionHints: outHints,
    }
  }

  private async resolveAcceptanceAvailability(params: TicketMetaBuildParams): Promise<boolean> {
    if (params.ticketStatus !== TicketStatus.AWAITING_ACCEPTANCE) return false
    return canAcceptTicket({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor: {
        id: params.userId,
        role: params.role,
        companyId: params.actorCompanyId,
        accessFlags: params.accessFlags,
      },
      ticketId: params.ticketId,
      linkedClientCompanyId: params.linkedClientCompanyId,
    })
  }

  private async resolveAssignmentRequestedByCurrentUser(params: TicketMetaBuildParams): Promise<boolean> {
    if (!isExecutorEligible({ role: params.role, isExecutor: params.isExecutor })) return false
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
    if (!isExecutorEligible({ role: params.role, isExecutor: params.isExecutor })) {
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
        role: params.role,
        isExecutor: params.isExecutor,
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
    const secondaryOperationalRestriction = await buildSecondaryOperationalRestrictionWhere({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      providerCompanyId: params.actorCompanyId,
      linkedClientCompanyId: params.linkedClientCompanyId,
      scopeCompanyIds: technicianScope.companyIds,
      actor: {
        id: params.userId,
        role: params.role,
        companyId: params.actorCompanyId,
        accessFlags: params.accessFlags,
      },
    })
    const claimWhereExtras = secondaryOperationalRestriction
      ? [locationRestriction, secondaryOperationalRestriction]
      : [locationRestriction]

    if (!decision.allowed) {
      return {
        canClaimByCurrentUser: false,
        claimAvailabilityReason: decision.reason || 'Claim недоступен',
      }
    }

    const claimableTicket = await this.prisma.ticket.findFirst({
      where: {
        AND: [decision.where, ...claimWhereExtras],
      },
      select: { id: true, companyId: true, createdByUserId: true },
    })

    if (claimableTicket) {
      if (
        !(await this.canDirectClaimInRelationship({
          actorCompanyId: params.actorCompanyId,
          actorUserId: params.userId,
          ticketCompanyId: claimableTicket.companyId,
          ticketCreatedByUserId: claimableTicket.createdByUserId,
        }))
      ) {
        return {
          canClaimByCurrentUser: false,
          claimAvailabilityReason: 'Субподрядчик может запросить назначение; прямое взятие доступно только для собственных заявок.',
        }
      }
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

    return {
      canClaimByCurrentUser: false,
      claimAvailabilityReason: 'Claim доступен только для новых неназначенных заявок в вашем operational scope',
    }
  }

  private async canDirectClaimInRelationship(params: {
    actorCompanyId: string
    actorUserId: string
    ticketCompanyId: string
    ticketCreatedByUserId?: string | null
  }) {
    if (params.ticketCompanyId === params.actorCompanyId) return true
    const access = await this.serviceContractsService.getLinkedClientAccess(
      params.actorCompanyId,
      params.ticketCompanyId,
    )
    if (!access) return false
    if (access.role === ServiceContractRole.PRIMARY) return true
    if (access.role === ServiceContractRole.SECONDARY) {
      return params.ticketCreatedByUserId === params.actorUserId
    }
    return false
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
          isExecutor: params.isExecutor,
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

    const transitions = allStatuses.filter((nextStatus) => decideTicketTransition(params.ticketStatus, nextStatus).allowed)
    if (params.ticketStatus === TicketStatus.AWAITING_ACCEPTANCE) {
      return transitions.filter((nextStatus) => nextStatus !== TicketStatus.DONE)
    }
    return transitions
  }
}
