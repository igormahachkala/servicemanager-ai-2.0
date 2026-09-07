import { NotFoundException } from '@nestjs/common';
import { ServiceContractRole } from '@prisma/client';

import {
  ContractContextService,
  type ContractContext,
} from '../service-contracts/contract-context.service';
import { ServiceContractsService } from '../service-contracts/service-contracts.service';
import { matchCategorySpecializationLinks } from './ticket-specialization-match.utils';

/**
 * Полномочия на назначение по заявке: кто вообще может быть назначен и от чьего
 * лица. Вынесено из TicketsAssignmentService, чтобы у решения был один
 * экземпляр: тем же контекстом пользуется и сам assign, и вычисление
 * capability для UI (ticket-self-assign-capability.ts). Иначе появился бы
 * второй резолвер доступа, расходящийся с первым при первой же правке.
 */

export type AssignmentRequiredSpecialization = { id: string; name: string; isActive: boolean };

export type AssignmentAuthorityTicket = {
  id: string;
  companyId: string;
  locationId: string;
  assignedTechnicianId?: string | null;
  assignedTechnician?: { companyId: string | null } | null;
  problemCategory?: {
    specializationLinks?: Array<{
      specializationId: string;
      specialization: { id?: string; name: string; isActive: boolean };
    }>;
  } | null;
};

export type AssignmentAuthorityContext = {
  ticketId: string;
  ticketCompanyId: string;
  ticketLocationId: string;
  currentAssigneeCompanyId: string | null;
  roleInContract: ServiceContractRole;
  contractId: string | null;
  requiredSpecializations: AssignmentRequiredSpecialization[];
  candidateCompanyIds: string[];
  directAssignmentAllowed: boolean;
  blockReason: string | null;
};

export type AssignmentAuthorityDeps = {
  contractContextService: ContractContextService;
  serviceContractsService: ServiceContractsService;
};

export function ticketRequiredSpecializations(
  ticket: AssignmentAuthorityTicket,
): AssignmentRequiredSpecialization[] {
  return (ticket.problemCategory?.specializationLinks ?? []).map((link) => ({
    id: link.specialization?.id ?? link.specializationId,
    name: link.specialization?.name ?? '',
    isActive: link.specialization?.isActive ?? true,
  }));
}

export function contractContextAllowsLocation(
  context: ContractContext,
  locationId: string | null | undefined,
) {
  if (context.contractLocationScope.mode === 'tenant_wide') return true;
  if (context.contractLocationScope.mode === 'restricted_empty') return false;
  return !!locationId && context.contractLocationScope.locationIds.includes(locationId);
}

export function contractContextAllowsSpecializations(
  context: ContractContext,
  requiredSpecializations: AssignmentRequiredSpecialization[],
) {
  if (requiredSpecializations.length === 0) return true;
  if (context.contractSpecializationScope.mode === 'UNCONFIGURED') return false;

  const matched = matchCategorySpecializationLinks({
    categoryLinks: requiredSpecializations.map((specialization) => ({
      specializationId: specialization.id,
      specialization: { name: specialization.name },
    })),
    technicianSpecializationIds: context.contractSpecializationScope.specializationIds,
    technicianSpecializationNames: context.contractSpecializationScope.specializationNames,
  });

  return matched.length > 0;
}

export function contractContextAllowsTicket(
  context: ContractContext,
  params: {
    ticketLocationId: string;
    requiredSpecializations: AssignmentRequiredSpecialization[];
  },
) {
  return (
    contractContextAllowsLocation(context, params.ticketLocationId) &&
    contractContextAllowsSpecializations(context, params.requiredSpecializations)
  );
}

export async function resolveEligibleSecondaryProviderCompanyIds(
  deps: AssignmentAuthorityDeps,
  params: {
    clientCompanyId: string;
    ticketLocationId: string;
    requiredSpecializations: AssignmentRequiredSpecialization[];
  },
) {
  const secondaryProviderIds = await deps.serviceContractsService.listSecondaryProviderCompanyIds(
    params.clientCompanyId,
  );
  const eligible: string[] = [];
  for (const providerCompanyId of secondaryProviderIds) {
    const context = await deps.contractContextService.getContractContext({
      providerCompanyId,
      clientCompanyId: params.clientCompanyId,
    });
    if (!context || context.roleInContract !== ServiceContractRole.SECONDARY) {
      continue;
    }
    if (
      contractContextAllowsTicket(context, {
        ticketLocationId: params.ticketLocationId,
        requiredSpecializations: params.requiredSpecializations,
      })
    ) {
      eligible.push(providerCompanyId);
    }
  }
  return Array.from(new Set(eligible));
}

/**
 * Кто может быть назначен на эту заявку и разрешено ли прямое назначение.
 * Контур доступа задаётся Contract Context: локация и специализации контракта,
 * роль PRIMARY/SECONDARY. SLA сюда не входит и входить не должно.
 */
export async function resolveAssignmentAuthorityContext(
  deps: AssignmentAuthorityDeps,
  params: {
    actor: { companyId: string };
    ticket: AssignmentAuthorityTicket;
    linkedClientCompanyId?: string | null;
  },
): Promise<AssignmentAuthorityContext> {
  const requiredSpecializations = ticketRequiredSpecializations(params.ticket);
  const currentAssigneeCompanyId = params.ticket.assignedTechnician?.companyId ?? null;

  if (params.actor.companyId === params.ticket.companyId) {
    return {
      ticketId: params.ticket.id,
      ticketCompanyId: params.ticket.companyId,
      ticketLocationId: params.ticket.locationId,
      currentAssigneeCompanyId,
      roleInContract: ServiceContractRole.PRIMARY,
      contractId: null,
      requiredSpecializations,
      candidateCompanyIds: [params.actor.companyId],
      directAssignmentAllowed: true,
      blockReason: null,
    };
  }

  const context = await deps.contractContextService.getContractContext({
    providerCompanyId: params.actor.companyId,
    clientCompanyId: params.ticket.companyId,
    linkedClientCompanyId: params.linkedClientCompanyId,
  });
  if (!context) {
    throw new NotFoundException('Linked client not found');
  }

  if (
    !contractContextAllowsTicket(context, {
      ticketLocationId: params.ticket.locationId,
      requiredSpecializations,
    })
  ) {
    return {
      ticketId: params.ticket.id,
      ticketCompanyId: params.ticket.companyId,
      ticketLocationId: params.ticket.locationId,
      currentAssigneeCompanyId,
      roleInContract: context.roleInContract,
      contractId: context.contractId,
      requiredSpecializations,
      candidateCompanyIds: [],
      directAssignmentAllowed: false,
      blockReason: 'contract_scope_excludes_ticket',
    };
  }

  if (context.roleInContract === ServiceContractRole.PRIMARY) {
    const secondaryProviderIds = await resolveEligibleSecondaryProviderCompanyIds(deps, {
      clientCompanyId: params.ticket.companyId,
      ticketLocationId: params.ticket.locationId,
      requiredSpecializations,
    });
    return {
      ticketId: params.ticket.id,
      ticketCompanyId: params.ticket.companyId,
      ticketLocationId: params.ticket.locationId,
      currentAssigneeCompanyId,
      roleInContract: context.roleInContract,
      contractId: context.contractId,
      requiredSpecializations,
      candidateCompanyIds: Array.from(new Set([params.actor.companyId, ...secondaryProviderIds])),
      directAssignmentAllowed: true,
      blockReason: null,
    };
  }

  if (context.roleInContract === ServiceContractRole.SECONDARY) {
    const directAssignmentAllowed = currentAssigneeCompanyId === params.actor.companyId;
    return {
      ticketId: params.ticket.id,
      ticketCompanyId: params.ticket.companyId,
      ticketLocationId: params.ticket.locationId,
      currentAssigneeCompanyId,
      roleInContract: context.roleInContract,
      contractId: context.contractId,
      requiredSpecializations,
      candidateCompanyIds: directAssignmentAllowed ? [params.actor.companyId] : [],
      directAssignmentAllowed,
      blockReason: directAssignmentAllowed ? null : 'secondary_requires_existing_assignment',
    };
  }

  return {
    ticketId: params.ticket.id,
    ticketCompanyId: params.ticket.companyId,
    ticketLocationId: params.ticket.locationId,
    currentAssigneeCompanyId,
    roleInContract: context.roleInContract,
    contractId: context.contractId,
    requiredSpecializations,
    candidateCompanyIds: [],
    directAssignmentAllowed: false,
    blockReason: 'unsupported_contract_role',
  };
}
