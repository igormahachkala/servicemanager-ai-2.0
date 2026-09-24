import { ForbiddenException } from '@nestjs/common';
import { CompanyType, ServiceContractRole, TicketStatus, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TicketsPolicy } from '../policy/tickets.policy';
import { ContractContextService } from '../service-contracts/contract-context.service';
import { ServiceContractsService } from '../service-contracts/service-contracts.service';
import {
  resolveAssignmentAuthorityContext,
  type AssignmentAuthorityContext,
} from './ticket-assignment-authority';
import { resolveTicketOperationAccess } from './ticket-access.utils';

/**
 * «Назначить на себя» — управленческое действие, а не claim.
 *
 * Claim (086, ticket-claim-eligibility.ts) отвечает на вопрос «может ли
 * исполнитель взять свободную заявку»: он привязан к признаку isExecutor,
 * к специализациям и к привязкам локаций исполнителя. Руководитель площадки
 * исполнителем не является и в этот пул не попадает — отсюда и берётся
 * 404 «Technician not found» при попытке назначить ADMIN на самого себя
 * через обычный поток назначения.
 *
 * Здесь описано отдельное решение: провайдерские ADMIN и MASTER могут
 * назначить на себя заявку, которая уже находится в их канонической области
 * назначения. Область берётся из существующей архитектуры (доступ к операции,
 * PBAC-политика назначения, Contract Context), второго резолвера не заводится.
 *
 * Чего здесь намеренно нет:
 *  - SLA и просрочки: срок не является входом разрешения;
 *  - смены: назначить на себя можно и без открытой смены, ShiftPolicyService
 *    продолжает решать вопрос об операционном исполнении отдельно;
 *  - роли TECHNICIAN: у неё остаётся прежний claim;
 *  - клиентских компаний: назначение — операция подрядчика.
 */

/** Роли, для которых самоназначение является управленческим действием. */
export const SELF_ASSIGN_MANAGEMENT_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.ADMIN,
  UserRole.MASTER,
]);

export const SELF_ASSIGN_DENY_REASONS = {
  role: 'Самоназначение доступно только ролям ADMIN и MASTER подрядчика',
  clientCompany: 'Назначение выполняет подрядчик: клиентская компания не назначает исполнителей',
  policy: 'Роль не имеет права назначать исполнителей',
  terminalStatus: 'Заявку нельзя назначить в текущем статусе',
  alreadyMine: 'Заявка уже назначена на вас',
  outOfScope: 'Заявка вне вашей области назначения',
} as const;

export type TicketSelfAssignCapability = {
  canAssignSelf: boolean;
  assignSelfAvailabilityReason: string | null;
};

export type SelfAssignActor = {
  id: string;
  role: UserRole;
  companyId: string;
  accessFlags?: Record<string, any>;
};

export type SelfAssignTicketState = {
  status: TicketStatus;
  assignedTechnicianId: string | null;
};

function denied(reason: string): TicketSelfAssignCapability {
  return { canAssignSelf: false, assignSelfAvailabilityReason: reason };
}

function allowed(): TicketSelfAssignCapability {
  return { canAssignSelf: true, assignSelfAvailabilityReason: null };
}

/**
 * Чистое решение поверх уже вычисленных входов. Держится отдельно, чтобы
 * и endpoint, и capability для UI отвечали одним и тем же правилом, а тесты
 * могли проверять само правило без похода в базу.
 */
export function deriveTicketSelfAssignCapability(params: {
  actor: Pick<SelfAssignActor, 'id' | 'role' | 'companyId'>;
  actorCompanyType: CompanyType;
  policyAllowsAssign: boolean;
  ticket: SelfAssignTicketState;
  authority: Pick<AssignmentAuthorityContext, 'directAssignmentAllowed' | 'candidateCompanyIds'>;
}): TicketSelfAssignCapability {
  if (!SELF_ASSIGN_MANAGEMENT_ROLES.has(params.actor.role)) {
    return denied(SELF_ASSIGN_DENY_REASONS.role);
  }
  if (params.actorCompanyType !== CompanyType.PROVIDER) {
    return denied(SELF_ASSIGN_DENY_REASONS.clientCompany);
  }
  if (!params.policyAllowsAssign) {
    return denied(SELF_ASSIGN_DENY_REASONS.policy);
  }
  if (params.ticket.status === TicketStatus.DONE || params.ticket.status === TicketStatus.CANCELED) {
    return denied(SELF_ASSIGN_DENY_REASONS.terminalStatus);
  }
  if (params.ticket.assignedTechnicianId === params.actor.id) {
    return denied(SELF_ASSIGN_DENY_REASONS.alreadyMine);
  }
  if (
    !params.authority.directAssignmentAllowed ||
    !params.authority.candidateCompanyIds.includes(params.actor.companyId)
  ) {
    return denied(SELF_ASSIGN_DENY_REASONS.outOfScope);
  }
  return allowed();
}

export type SelfAssignDeps = {
  prisma: PrismaService;
  serviceContractsService: ServiceContractsService;
  contractContextService: ContractContextService;
  policy?: TicketsPolicy;
};

/**
 * Полное разрешение по заявке: доступ к операции, политика назначения и
 * контекст полномочий. Недоступность возвращается причиной, а не исключением —
 * тот же ответ нужен UI, чтобы объяснить отсутствие действия.
 */
export async function resolveTicketSelfAssignCapability(
  deps: SelfAssignDeps,
  params: {
    actor: SelfAssignActor;
    ticketId: string;
    linkedClientCompanyId?: string;
  },
): Promise<TicketSelfAssignCapability> {
  if (!SELF_ASSIGN_MANAGEMENT_ROLES.has(params.actor.role)) {
    return denied(SELF_ASSIGN_DENY_REASONS.role);
  }

  const actorCompany = await deps.prisma.company.findUnique({
    where: { id: params.actor.companyId },
    select: { type: true },
  });
  if (!actorCompany || actorCompany.type !== CompanyType.PROVIDER) {
    return denied(SELF_ASSIGN_DENY_REASONS.clientCompany);
  }

  let access: Awaited<ReturnType<typeof resolveTicketOperationAccess>>;
  try {
    access = await resolveTicketOperationAccess({
      prisma: deps.prisma,
      serviceContractsService: deps.serviceContractsService,
      actor: {
        id: params.actor.id,
        role: params.actor.role,
        companyId: params.actor.companyId,
        accessFlags: params.actor.accessFlags,
      },
      ticketId: params.ticketId,
      linkedClientCompanyId: params.linkedClientCompanyId,
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    });
  } catch {
    // Заявка недоступна актору — самоназначение закрыто вместе с доступом.
    return denied(SELF_ASSIGN_DENY_REASONS.outOfScope);
  }

  const policyDecision = (deps.policy ?? new TicketsPolicy()).canAssign({
    id: params.actor.id,
    role: params.actor.role,
    companyId: access.operationCompanyId,
  });

  const ticket = await deps.prisma.ticket.findFirst({
    where: { id: params.ticketId, companyId: access.ticket.companyId },
    select: {
      id: true,
      companyId: true,
      locationId: true,
      status: true,
      assignedTechnicianId: true,
      assignedTechnician: { select: { companyId: true } },
      problemCategory: {
        select: {
          specializationLinks: {
            select: {
              specializationId: true,
              specialization: { select: { id: true, name: true, isActive: true } },
            },
          },
        },
      },
    },
  });
  if (!ticket) {
    return denied(SELF_ASSIGN_DENY_REASONS.outOfScope);
  }

  let authority: AssignmentAuthorityContext;
  try {
    authority = await resolveAssignmentAuthorityContext(
      {
        contractContextService: deps.contractContextService,
        serviceContractsService: deps.serviceContractsService,
      },
      {
        actor: { companyId: params.actor.companyId },
        ticket,
        linkedClientCompanyId: params.linkedClientCompanyId,
      },
    );
  } catch {
    return denied(SELF_ASSIGN_DENY_REASONS.outOfScope);
  }

  return deriveTicketSelfAssignCapability({
    actor: params.actor,
    actorCompanyType: actorCompany.type,
    policyAllowsAssign: policyDecision.allowed,
    ticket: { status: ticket.status, assignedTechnicianId: ticket.assignedTechnicianId },
    authority,
  });
}

export function assertTicketSelfAssignAllowed(capability: TicketSelfAssignCapability): void {
  if (capability.canAssignSelf) return;
  throw new ForbiddenException({
    code: 'PERMISSION_DENIED',
    message: capability.assignSelfAvailabilityReason ?? SELF_ASSIGN_DENY_REASONS.outOfScope,
  });
}
