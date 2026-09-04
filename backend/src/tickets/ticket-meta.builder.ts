import { TicketStatus, UserRole } from '@prisma/client'

import { TicketsPolicy } from '../policy/tickets.policy'
import { isExecutorEligible } from '../common/executor.utils'
import { PrismaService } from '../prisma/prisma.service'
import { ContractContextService } from '../service-contracts/contract-context.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { decideTicketTransition } from '../workflow/ticket.workflow'
import {
  resolveTicketOperationAccess,
  type TicketVisibilityMode,
} from './ticket-access.utils'
import { canAcceptTicket } from './ticket-acceptance-access'
import { resolveTicketClaimCapability, type TicketClaimCapability } from './ticket-claim-eligibility'
import {
  resolveTicketSelfAssignCapability,
  type TicketSelfAssignCapability,
} from './ticket-self-assign-capability'
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
    private readonly contractContextService: ContractContextService,
  ) {}

  async buildForGetOne(params: TicketMetaBuildParams) {
    const claimAvailability = await this.resolveClaimAvailability(params)
    const selfAssignAvailability = await this.resolveSelfAssignAvailability(params)
    const availableStatusTransitions = await this.resolveAvailableStatusTransitions(params)
    const assignmentRequestedByCurrentUser = await this.resolveAssignmentRequestedByCurrentUser(params)
    const acceptanceAvailable = await this.resolveAcceptanceAvailability(params)
    const { availableActions, availableActionHints } = this.deriveAvailableActions(
      params,
      claimAvailability,
      availableStatusTransitions,
      acceptanceAvailable,
      selfAssignAvailability,
    )

    return {
      scopeCompanyId: params.scopeCompanyId,
      visibilityMode: params.visibilityMode,
      canClaim: claimAvailability.canClaim,
      canClaimByCurrentUser: claimAvailability.canClaim,
      canRequestAssignment: claimAvailability.canRequestAssignment,
      canAssignSelf: selfAssignAvailability.canAssignSelf,
      assignSelfAvailabilityReason: selfAssignAvailability.assignSelfAvailabilityReason,
      claimAvailabilityReason: claimAvailability.claimAvailabilityReason,
      requestAssignmentAvailabilityReason: claimAvailability.requestAssignmentAvailabilityReason,
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
    claim: TicketClaimCapability,
    transitions: TicketStatus[],
    acceptanceAvailable: boolean,
    selfAssign: TicketSelfAssignCapability,
  ): {
    availableActions: {
      canClaim: boolean
      canAssignSelf: boolean
      canStart: boolean
      canComplete: boolean
      canClose: boolean
      canAccept: boolean
      canReject: boolean
      canRequestAssignment: boolean
    }
    availableActionHints?: Partial<Record<'canClaim' | 'canAssignSelf' | 'canRequestAssignment' | 'canStart' | 'canComplete' | 'canClose' | 'canAccept' | 'canReject', string | null>>
  } {
    const isExec = isExecutorEligible({ role: params.role, isExecutor: params.isExecutor })
    const hints: Partial<Record<'canClaim' | 'canAssignSelf' | 'canRequestAssignment' | 'canStart' | 'canComplete' | 'canClose' | 'canAccept' | 'canReject', string | null>> = {}

    const canClaim =
      isExec &&
      claim.canClaim &&
      params.ticketStatus === TicketStatus.NEW &&
      !params.assignedTechnicianId
    const canRequestAssignment =
      isExec &&
      claim.canRequestAssignment &&
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

    if (!selfAssign.canAssignSelf && selfAssign.assignSelfAvailabilityReason) {
      hints.canAssignSelf = selfAssign.assignSelfAvailabilityReason
    }

    const preferClaimOverDirectInProgress =
      isExec &&
      params.ticketStatus === TicketStatus.NEW &&
      claim.canClaim &&
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
        canAssignSelf: selfAssign.canAssignSelf,
        canStart,
        canComplete,
        canClose,
        canAccept: acceptanceAvailable,
        canReject: acceptanceAvailable,
        canRequestAssignment,
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

  private async resolveClaimAvailability(params: TicketMetaBuildParams): Promise<TicketClaimCapability> {
    const effectiveLinkedClientCompanyId =
      params.linkedClientCompanyId ??
      (params.ticketCompanyId !== params.actorCompanyId ? params.ticketCompanyId : undefined)

    return resolveTicketClaimCapability({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      policy: this.policy,
      actor: {
        id: params.userId,
        role: params.role,
        companyId: params.actorCompanyId,
        isExecutor: params.isExecutor,
        accessFlags: params.accessFlags,
      },
      ticketId: params.ticketId,
      linkedClientCompanyId: effectiveLinkedClientCompanyId,
    })
  }

  /**
   * «Назначить на себя» для управляющих ролей подрядчика. Отдельная capability:
   * claim (086) отвечает за исполнителей, здесь — управленческое действие,
   * и путать их нельзя ни в UI, ни в правах.
   */
  private async resolveSelfAssignAvailability(
    params: TicketMetaBuildParams,
  ): Promise<TicketSelfAssignCapability> {
    const effectiveLinkedClientCompanyId =
      params.linkedClientCompanyId ??
      (params.ticketCompanyId !== params.actorCompanyId ? params.ticketCompanyId : undefined)

    try {
      return await resolveTicketSelfAssignCapability(
        {
          prisma: this.prisma,
          serviceContractsService: this.serviceContractsService,
          contractContextService: this.contractContextService,
          policy: this.policy,
        },
        {
          actor: {
            id: params.userId,
            role: params.role,
            companyId: params.actorCompanyId,
            accessFlags: params.accessFlags,
          },
          ticketId: params.ticketId,
          linkedClientCompanyId: effectiveLinkedClientCompanyId,
        },
      )
    } catch {
      // Необязательная capability не должна ронять карточку заявки; отказ закрытый.
      return { canAssignSelf: false, assignSelfAvailabilityReason: null }
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
