import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CompanyType, Prisma, PublicRequestType, ServiceContractRole, TicketPriority, TicketSource, TicketStatus, TicketUrgency, UserAccessLocationMode, UserRole } from '@prisma/client';
import { EXECUTOR_CAPABLE_ROLES, isExecutorEligible } from '../common/executor.utils';
import {
  interpretUserAccessLocationScope,
  uniqueLocationIds,
} from '../common/user-access-scope-mode.utils';
import { randomUUID } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';

import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateChildTicketDto } from './dto/create-child-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

import { TicketsPolicy } from '../policy/tickets.policy';
import { assertAllowed } from '../policy/policy.utils';

import { decideTicketTransition } from '../workflow/ticket.workflow';
import { TimelineService } from '../timeline/timeline.service';

import { AssignmentEngine } from '../assignment/assignment.engine';
import { TicketsQueryService } from './tickets.query.service';
import { TicketAttachmentsService } from './ticket-attachments.service';
import { buildTicketDescription } from './ticket-description.builder';
import {
  assertActorCanUseLocation,
  assertActorCanUseProblemCategory,
  resolveReadableTicketAccess,
  resolveTechnicianOperationalScope,
  resolveTicketOperationAccess,
  type TicketAccessActor,
} from './ticket-access.utils';
import {
  assertExecutorClaimEligibilityAllowed,
  resolveEligibleTicketClaimCapability,
  resolveExecutorClaimEligibility,
} from './ticket-claim-eligibility';
import { matchCategorySpecializationLinks } from './ticket-specialization-match.utils';
import { ServiceContractsService } from '../service-contracts/service-contracts.service';
import {
  ContractContextService,
  type ContractContext,
} from '../service-contracts/contract-context.service';
import {
  isServiceContractLocationAllowed,
  resolveServiceContractLocationScope,
} from '../service-contracts/service-contract-location-scope';
import { TechniciansService } from '../technicians/technicians.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PERMISSIONS, type PermissionCode } from '../common/permissions.constants';
import {
  TICKET_ASSIGNMENT_REQUESTED_ENTITY,
  TICKET_ASSIGNMENT_REQUESTED_EVENT,
} from './ticket-domain-event.types';

const companyIdentitySelect = {
  id: true,
  name: true,
  legalName: true,
  brandName: true,
  type: true,
} as const;

type LocationBindingAccessClient = Pick<
  Prisma.TransactionClient,
  'user' | 'userAccessScope' | 'userLocationBinding'
>;

type CreatePostAction = 'leave_unassigned' | 'claim_self' | 'assign_employee';
type AssignmentHistoryOperation =
  | 'assign_technician'
  | 'reassign_technician'
  | 'provider_assignment'
  | 'unassign'
  | 'self_claim'
  | 'assignment_cancel'
  | 'auto_assignment';
type CreateCandidate = {
  id: string;
  email: string;
  role?: UserRole | null;
  companyId?: string | null;
  matched?: boolean;
  matchedBy?: string[];
  matchReason?: string;
  specializations?: { id: string; name: string; isActive: boolean }[];
};
type AssignmentRequiredSpecialization = { id: string; name: string; isActive: boolean };
type AssignmentAuthorityTicket = {
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
type AssignmentAuthorityContext = {
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

function locationAccessKey(userId: string, companyId: string) {
  return `${userId}:${companyId}`;
}

function computeSlaFromPriorityOrExplicitMinutes(params: {
  priority: TicketPriority;
  explicitSlaMinutes?: number | null;
}): { slaMinutes: number; slaDueAt: Date } {
  const explicit = params.explicitSlaMinutes;
  if (typeof explicit === 'number' && explicit > 0) {
    return { slaMinutes: explicit, slaDueAt: new Date(Date.now() + explicit * 60_000) };
  }
  const mins = params.priority === TicketPriority.URGENT ? 120 : 24 * 60;
  return { slaMinutes: mins, slaDueAt: new Date(Date.now() + mins * 60_000) };
}

@Injectable()
export class TicketsAssignmentService {
  private readonly logger = new Logger(TicketsAssignmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly assignmentEngine: AssignmentEngine,
    private readonly query: TicketsQueryService,
    private readonly timelineService: TimelineService,
    private readonly attachments: TicketAttachmentsService,
    private readonly serviceContractsService: ServiceContractsService,
    private readonly techniciansService: TechniciansService,
    private readonly notifications: NotificationsService,
    contractContextService?: ContractContextService,
  ) {
    this.contractContextService = contractContextService ?? new ContractContextService(prisma);
  }

  private readonly policy = new TicketsPolicy();
  private readonly contractContextService: ContractContextService;

  private async recordAssignmentHistoryTx(
    tx: Prisma.TransactionClient,
    params: {
      companyId: string;
      ticketId: string;
      actorUserId?: string | null;
      previousAssignedTechnicianId?: string | null;
      assignedTechnicianId?: string | null;
      operationType: AssignmentHistoryOperation;
      timestamp?: Date;
      mode?: string | null;
      reason?: string | null;
      operationCompanyId?: string | null;
    },
  ) {
    const previousValue = params.previousAssignedTechnicianId ?? null;
    const newValue = params.assignedTechnicianId ?? null;
    if (previousValue === newValue) return null;

    const timestamp = params.timestamp ?? new Date();
    return this.timelineService.recordTx(tx, {
      event: 'TICKET_ASSIGNMENT_CHANGED',
      companyId: params.companyId,
      ticketId: params.ticketId,
      actorUserId: params.actorUserId ?? null,
      createdAt: timestamp,
      payload: {
        operationType: params.operationType,
        previousValue,
        newValue,
        previousAssignedTechnicianId: previousValue,
        assignedTechnicianId: newValue,
        timestamp: timestamp.toISOString(),
        mode: params.mode ?? params.operationType,
        reason: params.reason ?? null,
        operationCompanyId: params.operationCompanyId ?? null,
      },
    });
  }

  private requireAccessActor(actor: any, companyId: string): TicketAccessActor {
    if (!actor?.id || !actor?.role) {
      throw new Error('Actor is required for ticket access check');
    }
    return {
      id: actor.id,
      role: actor.role as UserRole,
      companyId,
      accessFlags: actor?.accessFlags,
    };
  }

  private async getCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        type: true,
        autoAssignEnabled: true,
        allowTechnicianClaim: true,
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  private async resolveTicketOwnerCompanyId(params: {
    actorCompanyId: string;
    locationId: string;
    requestedClientCompanyId?: string | null;
  }) {
    const actorCompany = await this.prisma.company.findUnique({
      where: { id: params.actorCompanyId },
      select: {
        id: true,
        type: true,
      },
    });
    if (!actorCompany) {
      throw new NotFoundException('Company not found');
    }

    const location = await this.prisma.location.findFirst({
      where: {
        id: params.locationId,
        isActive: true,
      },
      select: {
        id: true,
        clientCompanyId: true,
      },
    });
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    if (actorCompany.type === CompanyType.CLIENT) {
      if (params.requestedClientCompanyId && params.requestedClientCompanyId !== params.actorCompanyId) {
        throw new ForbiddenException('Client companies can create tickets only for their own company');
      }
      if (location.clientCompanyId !== params.actorCompanyId) {
        throw new NotFoundException('Location not found');
      }
      return params.actorCompanyId;
    }

    const resolvedClientCompanyId = params.requestedClientCompanyId?.trim() || location.clientCompanyId;
    if (!resolvedClientCompanyId) {
      throw new NotFoundException('Client company not found');
    }

    const access = await this.serviceContractsService.getLinkedClientAccess(
      params.actorCompanyId,
      resolvedClientCompanyId,
    );
    if (!access) {
      throw new NotFoundException('Linked client not found');
    }
    if (!isServiceContractLocationAllowed(access, location.id)) {
      throw new NotFoundException('Location not found');
    }

    if (location.clientCompanyId !== resolvedClientCompanyId) {
      throw new NotFoundException('Location not found');
    }

    return resolvedClientCompanyId;
  }

  private async assertExecutorOperationsAllowed(actorCompanyId: string) {
    const actorCompany = await this.prisma.company.findUnique({
      where: { id: actorCompanyId },
      select: { id: true, type: true },
    });
    if (!actorCompany) {
      throw new NotFoundException('Company not found');
    }
    if (actorCompany.type === CompanyType.CLIENT) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Client companies cannot perform assignment operations',
      });
    }
  }

  private async assertActorCanUseLocationForScope(params: {
    actor: { id: string; role: UserRole; companyId: string; accessFlags?: any }
    scopeCompanyId: string
    locationId: string
  }) {
    await assertActorCanUseLocation({
      prisma: this.prisma,
      actor: params.actor,
      scopeCompanyId: params.scopeCompanyId,
      locationId: params.locationId,
    });
  }

  private async getCategory(companyId: string, problemCategoryId: string) {
    const category = await this.prisma.problemCategory.findFirst({
      where: { id: problemCategoryId, companyId, isActive: true },
      include: {
        specializationLinks: {
          select: {
            specializationId: true,
            specialization: true,
          },
        },
      },
    });
    if (!category) throw new NotFoundException('Problem category not found');
    return category;
  }

  private async getLocation(companyId: string, locationId: string) {
    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        clientCompanyId: companyId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        region: true,
        platformCode: true,
        externalCode: true,
      },
    });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return location;
  }

  private async getEquipment(companyId: string, locationId: string, equipmentId: string) {
    const equipment = await this.prisma.equipment.findFirst({
      where: {
        id: equipmentId,
        companyId: companyId,
        locationId,
      },
      select: {
        id: true,
        locationId: true,
        name: true,
        type: true,
        status: true,
      },
    });

    if (!equipment) {
      throw new NotFoundException('Equipment not found');
    }

    return equipment;
  }

  private async findCandidateTechnicians(companyId: string, specializationIds: string[]) {
    if (specializationIds.length === 0) return [];

    const techs = await this.prisma.user.findMany({
      where: {
        companyId: companyId,
        isExecutor: true,
        isActive: true,
        deletedAt: null,
        role: { in: Array.from(EXECUTOR_CAPABLE_ROLES) },
        technicianSpecializations: {
          some: { specializationId: { in: specializationIds } },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        companyId: true,
        company: { select: companyIdentitySelect },
        technicianSpecializations: {
          where: { specializationId: { in: specializationIds } },
          include: { specialization: true },
        },
        assignedTickets: {
          where: {
            status: {
              in: [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS],
            },
          },
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return techs.map((t) => {
      const assignedCount = t.assignedTickets.filter((x) => x.status === TicketStatus.ASSIGNED).length;
      const inProgressCount = t.assignedTickets.filter((x) => x.status === TicketStatus.IN_PROGRESS).length;
      const matchedSpecializationsCount = t.technicianSpecializations.length;

      return {
        id: t.id,
        email: t.email,
        firstName: t.firstName,
        lastName: t.lastName,
        role: t.role,
        companyId: t.companyId,
        company: t.company,
        matchedBy: t.technicianSpecializations.map((x) => x.specialization.name),
        matchReason: 'category_specialization' as const,
        matchedSpecializationsCount,
        assignedCount,
        inProgressCount,
        activeLoad: assignedCount + inProgressCount,
      };
    });
  }

  private candidateMatchesRequiredSpecializations(
    candidate: {
      matched?: boolean;
      specializations?: { id: string; name: string | null; isActive?: boolean | null }[];
      technicianSpecializations?: {
        specializationId: string;
        specialization?: { id?: string; name: string | null; isActive?: boolean | null } | null;
      }[];
    },
    requiredSpecializations: { id: string; name: string; isActive: boolean }[],
  ) {
    if (requiredSpecializations.length === 0) return true;
    if (candidate.matched === true) return true;

    const candidateSpecializations =
      candidate.specializations ??
      candidate.technicianSpecializations?.map((link) => ({
        id: link.specialization?.id ?? link.specializationId,
        name: link.specialization?.name ?? '',
        isActive: link.specialization?.isActive ?? true,
      })) ??
      [];

    const matched = matchCategorySpecializationLinks({
      categoryLinks: requiredSpecializations.map((specialization) => ({
        specializationId: specialization.id,
        specialization: { name: specialization.name },
      })),
      technicianSpecializationIds: candidateSpecializations.map((specialization) => specialization.id),
      technicianSpecializationNames: candidateSpecializations.map((specialization) => specialization.name ?? ''),
    });

    return matched.length > 0;
  }

  private ticketRequiredSpecializations(
    ticket: AssignmentAuthorityTicket,
  ): AssignmentRequiredSpecialization[] {
    return (ticket.problemCategory?.specializationLinks ?? []).map((link) => ({
      id: link.specialization?.id ?? link.specializationId,
      name: link.specialization?.name ?? '',
      isActive: link.specialization?.isActive ?? true,
    }));
  }

  private contractContextAllowsLocation(
    context: ContractContext,
    locationId: string | null | undefined,
  ) {
    if (context.contractLocationScope.mode === 'tenant_wide') return true;
    if (context.contractLocationScope.mode === 'restricted_empty') return false;
    return !!locationId && context.contractLocationScope.locationIds.includes(locationId);
  }

  private contractContextAllowsSpecializations(
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

  private contractContextAllowsTicket(
    context: ContractContext,
    params: {
      ticketLocationId: string;
      requiredSpecializations: AssignmentRequiredSpecialization[];
    },
  ) {
    return (
      this.contractContextAllowsLocation(context, params.ticketLocationId) &&
      this.contractContextAllowsSpecializations(context, params.requiredSpecializations)
    );
  }

  private async resolveProviderTicketContractContext(params: {
    providerCompanyId: string;
    ticket: AssignmentAuthorityTicket;
    linkedClientCompanyId?: string | null;
  }) {
    if (params.providerCompanyId === params.ticket.companyId) {
      return null;
    }

    const context = await this.contractContextService.getContractContext({
      providerCompanyId: params.providerCompanyId,
      clientCompanyId: params.ticket.companyId,
      linkedClientCompanyId: params.linkedClientCompanyId,
    });
    if (!context) {
      throw new NotFoundException('Linked client not found');
    }
    return context;
  }

  private assertContractContextCoversTicket(params: {
    context: ContractContext;
    ticket: AssignmentAuthorityTicket;
  }) {
    const requiredSpecializations = this.ticketRequiredSpecializations(params.ticket);
    if (
      !this.contractContextAllowsTicket(params.context, {
        ticketLocationId: params.ticket.locationId,
        requiredSpecializations,
      })
    ) {
      throw new NotFoundException('Ticket not found');
    }
  }

  private async resolveLinkedClientContractRole(params: {
    providerCompanyId: string;
    clientCompanyId?: string | null;
  }): Promise<ServiceContractRole | null> {
    const clientCompanyId = params.clientCompanyId?.trim();
    if (!clientCompanyId || clientCompanyId === params.providerCompanyId) {
      return null;
    }

    const context = await this.contractContextService.getContractContext({
      providerCompanyId: params.providerCompanyId,
      clientCompanyId,
    });
    if (!context) {
      throw new ForbiddenException('Linked client access is not available');
    }
    return context.roleInContract;
  }

  private async resolveEligibleSecondaryProviderCompanyIds(params: {
    clientCompanyId: string;
    ticketLocationId: string;
    requiredSpecializations: AssignmentRequiredSpecialization[];
  }) {
    const secondaryProviderIds = await this.serviceContractsService.listSecondaryProviderCompanyIds(
      params.clientCompanyId,
    );
    const eligible: string[] = [];
    for (const providerCompanyId of secondaryProviderIds) {
      const context = await this.contractContextService.getContractContext({
        providerCompanyId,
        clientCompanyId: params.clientCompanyId,
      });
      if (!context || context.roleInContract !== ServiceContractRole.SECONDARY) {
        continue;
      }
      if (
        this.contractContextAllowsTicket(context, {
          ticketLocationId: params.ticketLocationId,
          requiredSpecializations: params.requiredSpecializations,
        })
      ) {
        eligible.push(providerCompanyId);
      }
    }
    return Array.from(new Set(eligible));
  }

  private async resolveAssignmentAuthorityContext(params: {
    actor: TicketAccessActor;
    ticket: AssignmentAuthorityTicket;
    linkedClientCompanyId?: string | null;
  }): Promise<AssignmentAuthorityContext> {
    const requiredSpecializations = this.ticketRequiredSpecializations(params.ticket);
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

    const context = await this.contractContextService.getContractContext({
      providerCompanyId: params.actor.companyId,
      clientCompanyId: params.ticket.companyId,
      linkedClientCompanyId: params.linkedClientCompanyId,
    });
    if (!context) {
      throw new NotFoundException('Linked client not found');
    }

    if (
      !this.contractContextAllowsTicket(context, {
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
      const secondaryProviderIds = await this.resolveEligibleSecondaryProviderCompanyIds({
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

  private async listAssignableTechnicians(
    context: AssignmentAuthorityContext,
    accessClient: Pick<Prisma.TransactionClient, 'user' | 'userAccessScope' | 'userLocationBinding'> = this.prisma,
  ) {
    if (!context.directAssignmentAllowed || context.candidateCompanyIds.length === 0) {
      return [];
    }

    const candidates = await this.listAllTechnicians(
      context.candidateCompanyIds,
      context.requiredSpecializations,
      { fallbackToAllWhenNoSpecializations: true },
      accessClient,
    );
    const locationAllowed = await this.filterTechniciansByLocationBindings(
      candidates,
      context.ticketCompanyId,
      context.ticketLocationId,
      accessClient,
    );

    return locationAllowed.filter(
      (candidate) =>
        candidate.matched !== false &&
        !!candidate.companyId &&
        context.candidateCompanyIds.includes(candidate.companyId),
    );
  }

  private async assertTechnicianAssignable(
    context: AssignmentAuthorityContext,
    technicianId: string,
    accessClient: Pick<Prisma.TransactionClient, 'user' | 'userAccessScope' | 'userLocationBinding'>,
  ) {
    if (!context.directAssignmentAllowed) {
      throw new ForbiddenException('Direct assignment is not allowed for this ticket');
    }

    const candidates = await this.listAssignableTechnicians(context, accessClient);
    const candidate = candidates.find((item) => item.id === technicianId);
    if (!candidate) {
      throw new NotFoundException('Technician not found');
    }
    return candidate;
  }

  private async listAllTechnicians(
    companyIds: string | string[],
    requiredSpecializations: { id: string; name: string; isActive: boolean }[],
    options?: { fallbackToAllWhenNoSpecializations?: boolean },
    accessClient: Pick<Prisma.TransactionClient, 'user'> = this.prisma,
  ) {
    const companyIdsArray = Array.isArray(companyIds) ? companyIds : [companyIds];
    const requiredIds = requiredSpecializations.map((x) => x.id);
    const fallbackToAllWhenNoSpecializations =
      !!options?.fallbackToAllWhenNoSpecializations && requiredIds.length === 0;

    const techs = await accessClient.user.findMany({
      where: {
        companyId: companyIdsArray.length === 1 ? companyIdsArray[0] : { in: companyIdsArray },
        isExecutor: true,
        isActive: true,
        deletedAt: null,
        role: { in: Array.from(EXECUTOR_CAPABLE_ROLES) },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        companyId: true,
        company: { select: companyIdentitySelect },
        technicianSpecializations: {
          include: { specialization: true },
        },
        assignedTickets: {
          where: {
            status: {
              in: [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS],
            },
          },
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return techs.map((t) => {
      const matchedLabels = matchCategorySpecializationLinks({
        categoryLinks: requiredSpecializations.map((s) => ({
          specializationId: s.id,
          specialization: { name: s.name },
        })),
        technicianSpecializationIds: t.technicianSpecializations.map((x) => x.specializationId),
        technicianSpecializationNames: t.technicianSpecializations.map((x) => x.specialization.name),
      });

      const assignedCount = t.assignedTickets.filter((x) => x.status === TicketStatus.ASSIGNED).length;
      const inProgressCount = t.assignedTickets.filter((x) => x.status === TicketStatus.IN_PROGRESS).length;

      return {
        id: t.id,
        email: t.email,
        firstName: t.firstName,
        lastName: t.lastName,
        role: t.role,
        companyId: t.companyId,
        company: t.company,
        matched: fallbackToAllWhenNoSpecializations || matchedLabels.length > 0,
        matchedBy: matchedLabels,
        matchReason: fallbackToAllWhenNoSpecializations
          ? ('fallback_no_category_specializations' as const)
          : matchedLabels.length > 0
            ? ('category_specialization' as const)
            : ('no_match' as const),
        assignedCount,
        inProgressCount,
        activeLoad: assignedCount + inProgressCount,
        specializations: t.technicianSpecializations.map((x) => ({
          id: x.specialization.id,
          name: x.specialization.name,
          isActive: x.specialization.isActive,
        })),
      };
    });
  }

  private async filterTechniciansByLocationBindings<T extends { id: string }>(
    technicians: T[],
    scopeCompanyId: string,
    locationId: string,
    accessClient: LocationBindingAccessClient = this.prisma,
  ): Promise<T[]> {
    if (technicians.length === 0) {
      return technicians;
    }
    const technicianIds = Array.from(new Set(technicians.map((item) => item.id)));

    const activeUsers = await accessClient.user.findMany({
      where: {
        id: { in: technicianIds },
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        companyId: true,
      },
    });
    const employerCompanyByUserId = new Map(activeUsers.map((item) => [item.id, item.companyId]));
    const activeTechnicianIds = technicianIds.filter((id) => employerCompanyByUserId.has(id));
    if (activeTechnicianIds.length === 0) {
      return [];
    }

    const contractLocationsByEmployer = new Map<string, Set<string> | null>();
    const providerCompanyIds = uniqueLocationIds(
      activeUsers
        .map((item) => item.companyId)
        .filter((companyId) => companyId !== scopeCompanyId),
    );
    await Promise.all(providerCompanyIds.map(async (providerCompanyId) => {
      const access = await this.serviceContractsService.getLinkedClientAccess(providerCompanyId, scopeCompanyId);
      if (!access) {
        contractLocationsByEmployer.set(providerCompanyId, new Set());
        return;
      }
      const contractLocationScope = access.effectiveLocationScope ?? resolveServiceContractLocationScope({
        locationMode: access.locationMode,
        locationIds: access.locations?.map((row) => row.locationId) ?? [],
      });
      contractLocationsByEmployer.set(
        providerCompanyId,
        contractLocationScope.mode === 'tenant_wide'
          ? null
          : new Set(contractLocationScope.locationIds),
      );
    }));

    const employerCompanyIds = uniqueLocationIds(activeUsers.map((item) => item.companyId));
    const bindingCompanyIds = uniqueLocationIds([...employerCompanyIds, scopeCompanyId]);
    const [accessScopes, bindings] = await Promise.all([
      accessClient.userAccessScope.findMany({
        where: {
          userId: { in: activeTechnicianIds },
          companyId: { in: employerCompanyIds },
        },
        select: {
          userId: true,
          companyId: true,
          locationMode: true,
        },
      }),
      accessClient.userLocationBinding.findMany({
        where: {
          userId: { in: activeTechnicianIds },
          companyId: { in: bindingCompanyIds },
          location: {
            clientCompanyId: scopeCompanyId,
            isActive: true,
            deletedAt: null,
          },
        },
        select: {
          userId: true,
          companyId: true,
          locationId: true,
        },
      }),
    ]);

    const explicitScopeByTechnicianCompany = new Map<string, UserAccessLocationMode>();
    for (const scope of accessScopes) {
      explicitScopeByTechnicianCompany.set(
        locationAccessKey(scope.userId, scope.companyId),
        scope.locationMode,
      );
    }

    const bindingsByTechnicianCompany = new Map<string, Set<string>>();
    for (const binding of bindings) {
      const key = locationAccessKey(binding.userId, binding.companyId);
      if (!bindingsByTechnicianCompany.has(key)) {
        bindingsByTechnicianCompany.set(key, new Set<string>());
      }
      bindingsByTechnicianCompany.get(key)!.add(binding.locationId);
    }

    return technicians.filter((technician) => {
      const employerCompanyId = employerCompanyByUserId.get(technician.id);
      if (!employerCompanyId) {
        return false;
      }
      if (employerCompanyId !== scopeCompanyId) {
        const contractLocations = contractLocationsByEmployer.get(employerCompanyId);
        if (contractLocations === undefined || (contractLocations !== null && !contractLocations.has(locationId))) {
          return false;
        }
      }

      const explicitLocationMode =
        explicitScopeByTechnicianCompany.get(locationAccessKey(technician.id, employerCompanyId)) ?? null;
      const candidateBindingCompanyIds = explicitLocationMode
        ? [employerCompanyId]
        : uniqueLocationIds([employerCompanyId, scopeCompanyId]);
      const locationIds = uniqueLocationIds(
        candidateBindingCompanyIds.flatMap((companyId) =>
          Array.from(bindingsByTechnicianCompany.get(locationAccessKey(technician.id, companyId)) ?? []),
        ),
      );
      const interpreted = interpretUserAccessLocationScope({
        explicitLocationMode,
        locationIds,
      });

      if (interpreted.runtimeMode === 'tenant_wide') {
        return true;
      }
      if (interpreted.runtimeMode === 'restricted_empty') {
        return false;
      }
      return interpreted.locationIds.includes(locationId);
    });
  }

  private async writeStatusHistoryTx(
    tx: Prisma.TransactionClient,
    params: {
      ticketId: string;
      fromStatus: TicketStatus | null;
      toStatus: TicketStatus;
      changedByUserId: string | null;
      comment?: string | null;
    },
  ) {
    const { ticketId, fromStatus, toStatus, changedByUserId, comment } = params;

    await tx.ticketStatusHistory.create({
      data: {
        ticketId,
        fromStatus,
        toStatus,
        comment: comment ?? null,
        changedByUserId: changedByUserId ?? null,
      },
    });
  }

  private normalizeCreateInput(dto: CreateTicketDto) {
    const categoryId = (dto.categoryId ?? dto.problemCategoryId ?? '').trim();
    if (!categoryId) {
      throw new BadRequestException('categoryId is required');
    }
    const locationId = (dto.locationId ?? '').trim();
    if (!locationId) {
      throw new BadRequestException('locationId is required');
    }

    return {
      parentId: dto.parentId ?? null,
      clientCompanyId: dto.clientCompanyId?.trim() || null,
      locationId,
      equipmentId: dto.equipmentId ?? null,
      categoryId,
      title: dto.title?.trim() || null,
      description: dto.description?.trim() || dto.problemText?.trim() || null,
      comment: dto.comment?.trim() || null,
      createMode: dto.createMode === 'full' ? 'full' : 'quick',
      attachmentIds: [...new Set((dto.attachmentIds ?? []).filter(Boolean))],
      requesterName: dto.requesterName?.trim() || null,
      requesterPhone: dto.requesterPhone?.trim() || null,
      address: dto.address?.trim() || null,
      pointName: dto.pointName?.trim() || null,
      urgency: dto.urgency,
      urgencyReason: dto.urgencyReason?.trim() || null,
      slaMinutes: dto.slaMinutes ?? null,
      priority: dto.priority === TicketPriority.URGENT ? TicketPriority.URGENT : TicketPriority.NORMAL,
      postCreateAction: dto.postCreateAction ?? null,
      assignTechnicianId: dto.assignTechnicianId?.trim() || null,
    };
  }

  private async actorHasPermission(params: {
    userId: string;
    role: UserRole;
    companyId: string;
    permission: PermissionCode;
  }) {
    const blocksCount = await this.prisma.permissionBlock.count();
    if (blocksCount === 0) return true;

    const company = await this.prisma.company.findUnique({
      where: { id: params.companyId },
      select: { type: true },
    });

    const [roleHit, userHit] = await Promise.all([
      this.prisma.rolePermission.findFirst({
        where: {
          role: params.role,
          OR: [{ companyType: company?.type ?? null }, { companyType: null }],
          permissionBlock: { code: params.permission },
        },
        select: { id: true },
      }),
      this.prisma.userPermission.findFirst({
        where: {
          userId: params.userId,
          permissionBlock: { code: params.permission },
        },
        select: { id: true },
      }),
    ]);

    return !!roleHit || !!userHit;
  }

  private async assertActorHasPermission(params: {
    userId: string;
    role: UserRole;
    companyId: string;
    permission: PermissionCode;
  }) {
    if (await this.actorHasPermission(params)) return;
    throw new ForbiddenException({
      code: 'PERMISSION_DENIED',
      message: `Missing permission: ${params.permission}`,
    });
  }

  private async resolveCreateCandidates(params: {
    providerCompanyIds: string[];
    clientCompanyId: string;
    locationId: string;
    requiredSpecializations: { id: string; name: string; isActive: boolean }[];
  }): Promise<CreateCandidate[]> {
    const raw = await this.listAllTechnicians(params.providerCompanyIds, params.requiredSpecializations, {
      fallbackToAllWhenNoSpecializations: true,
    });

    return this.filterTechniciansByLocationBindings(
      raw,
      params.clientCompanyId,
      params.locationId,
    );
  }

  private resolveCreatePostAction(params: {
    requestedAction: CreatePostAction | null;
    assignTechnicianId: string | null;
    shouldAutoAssign: boolean;
  }) {
    if (!params.requestedAction) {
      return {
        action: params.shouldAutoAssign ? null : ('leave_unassigned' as const),
        technicianId: null,
        autoAssignAllowed: params.shouldAutoAssign,
      };
    }

    if (params.requestedAction === 'assign_employee' && !params.assignTechnicianId) {
      throw new BadRequestException('assignTechnicianId is required for assign_employee');
    }

    return {
      action: params.requestedAction,
      technicianId: params.assignTechnicianId,
      autoAssignAllowed: false,
    };
  }

  private async assertCreatePostActionAllowed(params: {
    actorCompanyId: string;
    actorUserId: string;
    actorRole: UserRole;
    action: CreatePostAction | null;
    technicianId: string | null;
    candidates: CreateCandidate[];
    providerCompanyIds: string[];
  }) {
    if (!params.action || params.action === 'leave_unassigned') {
      return null;
    }

    const eligibleCandidates = params.candidates.filter((candidate) => candidate.matched !== false);
    const candidateById = new Map(eligibleCandidates.map((candidate) => [candidate.id, candidate]));

    if (params.action === 'claim_self') {
      await this.assertActorHasPermission({
        userId: params.actorUserId,
        role: params.actorRole,
        companyId: params.actorCompanyId,
        permission: PERMISSIONS.TICKETS_CLAIM,
      });
      const self = candidateById.get(params.actorUserId);
      if (!self || !self.companyId || !params.providerCompanyIds.includes(self.companyId)) {
        throw new ForbiddenException('Current user is not available for this ticket location/category');
      }
      return params.actorUserId;
    }

    await this.assertActorHasPermission({
      userId: params.actorUserId,
      role: params.actorRole,
      companyId: params.actorCompanyId,
      permission: PERMISSIONS.TICKETS_ASSIGN,
    });
    const candidate = params.technicianId ? candidateById.get(params.technicianId) : null;
    if (!candidate || !candidate.companyId || !params.providerCompanyIds.includes(candidate.companyId)) {
      throw new NotFoundException('Technician not found');
    }
    return candidate.id;
  }

  private async resolveCreateCandidateCompanyIds(params: {
    actorCompanyId: string;
    targetCompanyId: string;
  }) {
    if (params.targetCompanyId === params.actorCompanyId) {
      return [params.targetCompanyId];
    }

    const access = await this.serviceContractsService.getLinkedClientAccess(
      params.actorCompanyId,
      params.targetCompanyId,
    );
    if (access?.role === ServiceContractRole.PRIMARY) {
      const secondaryProviderIds = await this.serviceContractsService.listSecondaryProviderCompanyIds(
        params.targetCompanyId,
      );
      return [...new Set([params.actorCompanyId, ...secondaryProviderIds])];
    }

    return [params.actorCompanyId];
  }

  private resolveCreateAssignmentCompanyId(params: {
    actorCompanyId: string;
    targetCompanyId: string;
  }) {
    return params.targetCompanyId !== params.actorCompanyId ? params.actorCompanyId : params.targetCompanyId;
  }

  async create(actorCompanyId: string, creatorUserId: string, creatorRole: UserRole, dto: CreateTicketDto) {
    const input = this.normalizeCreateInput(dto);
    let targetCompanyId = await this.resolveTicketOwnerCompanyId({
      actorCompanyId,
      locationId: input.locationId,
      requestedClientCompanyId: input.clientCompanyId,
    });

    if (creatorRole === UserRole.TECHNICIAN && targetCompanyId !== actorCompanyId) {
      targetCompanyId = (
        await this.techniciansService.resolveBoundCreateScope(
          actorCompanyId,
          creatorUserId,
          targetCompanyId,
          input.locationId,
        )
      ).companyId;
    }
    const assignmentCompanyId = this.resolveCreateAssignmentCompanyId({
      actorCompanyId,
      targetCompanyId,
    });
    const candidateCompanyIds = await this.resolveCreateCandidateCompanyIds({
      actorCompanyId,
      targetCompanyId,
    });
    await this.assertActorCanUseLocationForScope({
      actor: {
        id: creatorUserId,
        role: creatorRole,
        companyId: actorCompanyId,
      },
      scopeCompanyId: targetCompanyId,
      locationId: input.locationId,
    });
    const company = await this.getCompany(targetCompanyId);
    if (company.type !== CompanyType.CLIENT) {
      throw new BadRequestException('Ticket owner company must be a CLIENT company');
    }
    const category = await this.getCategory(targetCompanyId, input.categoryId);
    await assertActorCanUseProblemCategory({
      prisma: this.prisma,
      actor: {
        id: creatorUserId,
        role: creatorRole,
        companyId: actorCompanyId,
      },
      scopeCompanyId: targetCompanyId,
      problemCategoryId: input.categoryId,
    });
    const location = await this.getLocation(targetCompanyId, input.locationId);
    const equipment = input.equipmentId
      ? await this.getEquipment(targetCompanyId, location.id, input.equipmentId)
      : null;
    const generated = buildTicketDescription({
      category,
      location,
      title: input.title,
      description: input.description,
    });

    const requiredSpecializations = category.specializationLinks.map((x) => ({
      id: x.specializationId,
      name: x.specialization.name,
      isActive: x.specialization.isActive,
    }));
    const candidates = await this.resolveCreateCandidates({
      providerCompanyIds: candidateCompanyIds,
      clientCompanyId: targetCompanyId,
      locationId: location.id,
      requiredSpecializations,
    });
    const shouldAutoAssign = company.autoAssignEnabled;
    const postAction = this.resolveCreatePostAction({
      requestedAction: input.postCreateAction,
      assignTechnicianId: input.assignTechnicianId,
      shouldAutoAssign,
    });
    const postActionTechnicianId = await this.assertCreatePostActionAllowed({
      actorCompanyId,
      actorUserId: creatorUserId,
      actorRole: creatorRole,
      action: postAction.action,
      technicianId: postAction.technicianId,
      candidates,
      providerCompanyIds: candidateCompanyIds,
    });

    const ticketId = randomUUID();

    const { slaMinutes, slaDueAt } = computeSlaFromPriorityOrExplicitMinutes({
      priority: input.priority,
      explicitSlaMinutes: input.slaMinutes,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const selected = postAction.autoAssignAllowed
        ? await this.assignmentEngine.selectTechnicianForTicket({
            ticketId,
            companyId: assignmentCompanyId,
            locationId: location.id,
            categoryId: input.categoryId,
          })
        : null;
      const assignedTechnicianId = postActionTechnicianId ?? selected?.technicianId ?? null;

      let ticket = await tx.ticket.create({
        data: {
          id: ticketId,
          companyId: targetCompanyId,
          locationId: location.id,
          equipmentId: equipment?.id ?? null,
          parentId: input.parentId,

          requesterName: input.requesterName,
          requesterPhone: input.requesterPhone,
          address: location.address ?? input.address,
          pointName: location.name ?? input.pointName,

          problemCategoryId: input.categoryId,
          problemText: generated.description,

          urgency: input.urgency ?? TicketUrgency.NOT_URGENT,
          priority: input.priority,
          urgencyReason: input.urgencyReason ?? null,
          slaMinutes,
          slaDueAt,

          status: TicketStatus.NEW,
          assignedTechnicianId: null,
          createdByUserId: creatorUserId,
        },
      });

      await this.writeStatusHistoryTx(tx, {
        ticketId: ticket.id,
        fromStatus: null,
        toStatus: TicketStatus.NEW,
        changedByUserId: null,
        comment: 'Ticket created',
      });

      const boundAttachments = await this.attachments.bindAttachmentsToTicketTx(tx, {
        companyId: targetCompanyId,
        ticketId: ticket.id,
        attachmentIds: input.attachmentIds ?? [],
        actorCompanyId,
        uploadedByUserId: creatorUserId,
      });

      const createdEvent = await this.timelineService.recordTx(tx, {
        event: 'TICKET_CREATED',
        companyId: targetCompanyId,
        ticketId: ticket.id,
        actorUserId: creatorUserId,
        payload: {
          parentId: ticket.parentId,
          locationId: location.id,
          categoryId: input.categoryId,
          equipmentId: equipment?.id ?? null,
          title: generated.title,
          description: generated.description,
          status: TicketStatus.NEW,
          urgency: ticket.urgency,
          autoAssigned: !!assignedTechnicianId,
          attachmentCount: boundAttachments.length,
          createMode: input.createMode,
        },
      });

      const commentEvent = input.comment
        ? await this.timelineService.recordLegacyTx(tx, {
          type: 'ticket.comment_added',
          companyId: targetCompanyId,
          entityType: 'Ticket',
          entityId: ticket.id,
          actorUserId: creatorUserId ?? null,
          payload: {
            comment: input.comment,
            source: 'create_flow',
            createMode: input.createMode,
          },
        })
        : null;

      let assignedEventId: string | null = null;

      if (assignedTechnicianId) {
        const wf = decideTicketTransition(TicketStatus.NEW, TicketStatus.ASSIGNED);
        if (!wf.allowed) throw new BadRequestException(wf.reason);

        const now = new Date();

        ticket = await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: TicketStatus.ASSIGNED,
            statusUpdatedAt: now,
            assignedTechnicianId,
          },
        });

        await this.writeStatusHistoryTx(tx, {
          ticketId: ticket.id,
          fromStatus: TicketStatus.NEW,
          toStatus: TicketStatus.ASSIGNED,
          changedByUserId: null,
          comment: postAction.action === 'claim_self'
            ? 'Claimed by creator'
            : postAction.action === 'assign_employee'
              ? 'Assigned during creation'
              : 'Auto assigned',
        });

        await this.recordAssignmentHistoryTx(tx, {
          companyId: targetCompanyId,
          ticketId: ticket.id,
          actorUserId: postAction.action ? creatorUserId : null,
          previousAssignedTechnicianId: null,
          assignedTechnicianId,
          operationType: postAction.action === 'claim_self'
            ? 'self_claim'
            : postAction.action === 'assign_employee'
              ? 'provider_assignment'
              : 'auto_assignment',
          mode: postAction.action === 'claim_self'
            ? 'claim'
            : postAction.action === 'assign_employee'
              ? 'manual'
              : 'auto',
          reason: postAction.action ?? 'assignment_engine_v1',
        });

        const assignedEvent = await this.timelineService.recordTx(tx, {
          event: postAction.action === 'claim_self' ? 'TICKET_CLAIMED' : 'TICKET_ASSIGNED',
          companyId: targetCompanyId,
          ticketId: ticket.id,
          actorUserId: postAction.action ? creatorUserId : null,
          payload: {
            assignedTechnicianId,
            mode: postAction.action === 'claim_self'
              ? 'claim'
              : postAction.action === 'assign_employee'
                ? 'manual'
                : 'auto',
            strategy: postAction.action ? 'create_flow_v1' : 'contextual_v1',
            reason: postAction.action ?? 'assignment_engine_v1',
          },
        });

        return { ticket, assignedTechnicianId, generated, createdEventId: createdEvent.id, commentEventId: commentEvent?.id ?? null, assignedEventId: assignedEvent.id };
      }

      return { ticket, assignedTechnicianId, generated, createdEventId: createdEvent.id, commentEventId: commentEvent?.id ?? null, assignedEventId: null };
    });

    this.notifications.onTicketCreated({
      actorCompanyId,
      creatorUserId,
      targetCompanyId,
      locationId: location.id,
      locationName: location.name,
      locationAddress: location.address,
      categoryName: category.name,
      urgency: input.urgency ?? TicketUrgency.NOT_URGENT,
      requesterName: input.requesterName ?? null,
      requesterPhone: input.requesterPhone ?? null,
      description: input.comment?.trim() || input.description?.trim() || input.title?.trim() || null,
      ticketId: created.ticket.id,
      ticketNumber: created.ticket.ticketNumber,
      summary: created.generated.title,
      assignedTechnicianId: created.assignedTechnicianId,
      sourceEventId: created.createdEventId,
    });

    if (created.commentEventId) {
      const assignee = created.assignedTechnicianId
        ? await this.prisma.user.findUnique({
            where: { id: created.assignedTechnicianId },
            select: { companyId: true },
          })
        : null;
      this.notifications.scheduleTicketCommentAdded({
        ticketCompanyId: created.ticket.companyId,
        ticketId: created.ticket.id,
        ticketNumber: created.ticket.ticketNumber,
        summary: input.comment!.trim(),
        actorUserId: creatorUserId,
        assigneeUserId: created.assignedTechnicianId,
        assigneeCompanyId: assignee?.companyId ?? null,
        sourceEventId: created.commentEventId,
      });
    }

    if (created.assignedTechnicianId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: created.assignedTechnicianId },
        select: { companyId: true, email: true },
      });
      if (assignee && assignee.companyId !== created.ticket.companyId) {
        this.notifications.onTicketAssigned({
          ticketCompanyId: created.ticket.companyId,
          assigneeUserId: created.assignedTechnicianId,
          assigneeEmail: (assignee.email || '').trim(),
          actorUserId: creatorUserId,
          ticketId: created.ticket.id,
          ticketNumber: created.ticket.ticketNumber,
          summary: created.generated.title,
          sourceEventId: created.assignedEventId || created.createdEventId,
        });
      }
    }

    return {
      ticket: { ...created.ticket, title: created.generated.title, description: created.generated.description },
      generated: created.generated,
      instructions: category.instructions || null,
      candidates,
      autoAssigned: !!created.assignedTechnicianId,
    };
  }

  async listCreateAssignmentCandidates(
    actorCompanyId: string,
    actor: { id?: string; role?: UserRole; accessFlags?: any },
    params: { clientCompanyId?: string; locationId?: string; categoryId?: string },
  ) {
    await this.assertExecutorOperationsAllowed(actorCompanyId);
    const actorRole = actor.role as UserRole;
    const actorUserId = (actor.id || '').trim();
    if (!actorUserId || !actorRole) {
      throw new ForbiddenException('Actor context is required');
    }
    const locationId = (params.locationId || '').trim();
    const categoryId = (params.categoryId || '').trim();
    if (!locationId) throw new BadRequestException('locationId is required');
    if (!categoryId) throw new BadRequestException('categoryId is required');

    await this.assertActorHasPermission({
      userId: actorUserId,
      role: actorRole,
      companyId: actorCompanyId,
      permission: PERMISSIONS.TICKETS_ASSIGN,
    });

    const targetCompanyId = await this.resolveTicketOwnerCompanyId({
      actorCompanyId,
      locationId,
      requestedClientCompanyId: params.clientCompanyId,
    });
    const candidateCompanyIds = await this.resolveCreateCandidateCompanyIds({
      actorCompanyId,
      targetCompanyId,
    });
    await this.assertActorCanUseLocationForScope({
      actor: {
        id: actorUserId,
        role: actorRole,
        companyId: actorCompanyId,
        accessFlags: actor?.accessFlags,
      },
      scopeCompanyId: targetCompanyId,
      locationId,
    });

    const category = await this.getCategory(targetCompanyId, categoryId);
    const location = await this.getLocation(targetCompanyId, locationId);
    const requiredSpecializations = category.specializationLinks.map((x) => ({
      id: x.specializationId,
      name: x.specialization.name,
      isActive: x.specialization.isActive,
    }));
    const candidates = await this.resolveCreateCandidates({
      providerCompanyIds: candidateCompanyIds,
      clientCompanyId: targetCompanyId,
      locationId: location.id,
      requiredSpecializations,
    });
    const matched = candidates.filter((candidate) => candidate.matched !== false);
    const others = candidates.filter((candidate) => candidate.matched === false);

    return {
      ticketId: null,
      category: { id: category.id, name: category.name },
      location,
      currentAssigneeId: null,
      requiredSpecializations,
      matched,
      others,
      meta: {
        matchingMode: requiredSpecializations.length === 0
          ? 'fallback_no_category_specializations'
          : 'category_specializations',
        scopeCompanyId: targetCompanyId,
        visibilityMode: 'provider_primary',
        workforceCompanyId: actorCompanyId,
        workforceCompanyIds: candidateCompanyIds,
      },
    };
  }

  async createChild(
    companyId: string,
    creatorUserId: string | null,
    creatorRole: UserRole,
    parentId: string,
    dto: CreateChildTicketDto,
  ) {
    const parent = await this.prisma.ticket.findFirst({
      where: { id: parentId, companyId },
      select: {
        id: true,
        locationId: true,
        requesterName: true,
        requesterPhone: true,
        address: true,
        pointName: true,
      },
    });

    if (!parent) throw new NotFoundException('Parent ticket not found');

    const company = await this.getCompany(companyId);
    if (company.type !== CompanyType.CLIENT) {
      throw new BadRequestException('Ticket owner company must be a CLIENT company');
    }
    const category = await this.getCategory(companyId, dto.problemCategoryId);

    const specializationIds = category.specializationLinks.map((x) => x.specializationId);
    const allCandidates = await this.findCandidateTechnicians(companyId, specializationIds);
    const candidates = await this.filterTechniciansByLocationBindings(
      allCandidates,
      companyId,
      parent.locationId,
    );

    const shouldAutoAssign = company.autoAssignEnabled;

    const ticketId = randomUUID();

    const childPriority = dto.priority === TicketPriority.URGENT ? TicketPriority.URGENT : TicketPriority.NORMAL;
    const { slaMinutes, slaDueAt } = computeSlaFromPriorityOrExplicitMinutes({
      priority: childPriority,
      explicitSlaMinutes: dto.slaMinutes ?? null,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const selected = shouldAutoAssign
        ? await this.assignmentEngine.selectTechnicianForTicket({
            ticketId,
            companyId,
            locationId: parent.locationId,
            categoryId: dto.problemCategoryId,
          })
        : null;
      const assignedTechnicianId = selected?.technicianId ?? null;

      let ticket = await tx.ticket.create({
        data: {
          id: ticketId,
          companyId: companyId,
          locationId: parent.locationId,
          parentId: parent.id,

          requesterName: parent.requesterName,
          requesterPhone: parent.requesterPhone,
          address: parent.address,
          pointName: parent.pointName,

          problemCategoryId: dto.problemCategoryId,
          problemText: dto.problemText?.trim(),

          urgency: dto.urgency ?? TicketUrgency.NOT_URGENT,
          priority: childPriority,
          slaMinutes,
          slaDueAt,

          status: TicketStatus.NEW,
          assignedTechnicianId: null,
          createdByUserId: creatorUserId,
        },
      });

      await this.writeStatusHistoryTx(tx, {
        ticketId: ticket.id,
        fromStatus: null,
        toStatus: TicketStatus.NEW,
        changedByUserId: null,
        comment: 'Child ticket created',
      });

      const createdEvent = await this.timelineService.recordTx(tx, {
        event: 'TICKET_CREATED',
        companyId: companyId,
        ticketId: ticket.id,
        actorUserId: null,
        payload: {
          parentId: parent.id,
          locationId: parent.locationId,
          status: TicketStatus.NEW,
          urgency: ticket.urgency,
          autoAssigned: !!assignedTechnicianId,
          isChild: true,
        },
      });

      let assignedEventId: string | null = null;

      if (assignedTechnicianId) {
        const wf = decideTicketTransition(TicketStatus.NEW, TicketStatus.ASSIGNED);
        if (!wf.allowed) throw new BadRequestException(wf.reason);

        const now = new Date();

        ticket = await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: TicketStatus.ASSIGNED,
            statusUpdatedAt: now,
            assignedTechnicianId,
          },
        });

        await this.writeStatusHistoryTx(tx, {
          ticketId: ticket.id,
          fromStatus: TicketStatus.NEW,
          toStatus: TicketStatus.ASSIGNED,
          changedByUserId: null,
          comment: 'Auto assigned',
        });

        await this.recordAssignmentHistoryTx(tx, {
          companyId,
          ticketId: ticket.id,
          actorUserId: null,
          previousAssignedTechnicianId: null,
          assignedTechnicianId,
          operationType: 'auto_assignment',
          mode: 'auto',
          reason: 'assignment_engine_v1',
        });

        const assignedEvent = await this.timelineService.recordTx(tx, {
          event: 'TICKET_ASSIGNED',
          companyId: companyId,
          ticketId: ticket.id,
          actorUserId: null,
          payload: {
            assignedTechnicianId,
            mode: 'auto',
            strategy: 'contextual_v1',
            reason: 'assignment_engine_v1',
          },
        });

        return { ticket, assignedTechnicianId, createdEventId: createdEvent.id, assignedEventId: assignedEvent.id };
      }

      return { ticket, assignedTechnicianId, createdEventId: createdEvent.id, assignedEventId: null };
    });

    this.notifications.scheduleTicketCreatedChild({
      companyId,
      creatorUserId,
      locationId: parent.locationId,
      locationName: parent.pointName || null,
      locationAddress: parent.address || null,
      categoryName: category.name,
      urgency: childPriority,
      requesterName: parent.requesterName ?? null,
      requesterPhone: parent.requesterPhone ?? null,
      description: dto.problemText?.trim() || null,
      ticketId: created.ticket.id,
      ticketNumber: created.ticket.ticketNumber,
      summary: (created.ticket.problemText || '').trim() || 'Дочерняя заявка',
      assignedTechnicianId: created.assignedTechnicianId,
      sourceEventId: created.createdEventId,
    });

    return {
      ticket: created.ticket,
      instructions: category.instructions || null,
      candidates,
      autoAssigned: !!created.assignedTechnicianId,
      parentId: parent.id,
    };
  }

  async listAssignmentCandidates(companyId: string, actor: any, ticketId: string, linkedClientCompanyId?: string) {
    await this.assertExecutorOperationsAllowed(companyId);
    const accessActor = this.requireAccessActor(actor, companyId);
    const access = await resolveTicketOperationAccess({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor: accessActor,
      ticketId,
      linkedClientCompanyId,
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    });

    const decision = this.policy.canAssign({
      id: accessActor.id,
      role: accessActor.role,
      companyId: access.operationCompanyId,
    });
    assertAllowed(decision);

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, companyId: access.ticket.companyId },
      include: {
        location: {
          select: {
            id: true,
            name: true,
            platformCode: true,
            externalCode: true,
            city: true,
            address: true,
          },
        },
        problemCategory: {
          include: {
            specializationLinks: {
              include: {
                specialization: true,
              },
            },
          },
        },
        assignedTechnician: {
          select: { companyId: true },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const assignmentContext = await this.resolveAssignmentAuthorityContext({
      actor: accessActor,
      ticket,
      linkedClientCompanyId,
    });
    const requiredSpecializations = assignmentContext.requiredSpecializations;
    const fallbackMode = requiredSpecializations.length === 0;
    const matched = await this.listAssignableTechnicians(assignmentContext);
    const others: CreateCandidate[] = [];

    return {
      ticketId: ticket.id,
      category: {
        id: ticket.problemCategory.id,
        name: ticket.problemCategory.name,
      },
      location: ticket.location,
      currentAssigneeId: ticket.assignedTechnicianId,
      requiredSpecializations,
      matched,
      others,
      meta: {
        matchingMode: fallbackMode ? 'fallback_no_category_specializations' : 'category_specializations',
        explanation: fallbackMode
          ? '? ????????? ??? ??????????? ?????????????. ??????? ???????? ??? ??????? ???????? ??? ?????????? fallback.'
          : matched.length > 0
            ? '??????? ???????? ???????, ??????? ???????? ?? ?????????????? ?????????. ???? ? ????????? ??????? ????????.'
            : '? ????????? ???? ?????????? ?? ??????????????, ?? ?????? ??? ?????????? ????????. ???? ???????? ????????? ??????? ????????.',
        scopeCompanyId: access.ticket.companyId,
        visibilityMode: access.visibilityMode,
        workforceCompanyId: access.operationCompanyId,
        workforceCompanyIds: assignmentContext.candidateCompanyIds,
        roleInContract: assignmentContext.roleInContract,
        serviceContractId: assignmentContext.contractId,
        directAssignmentAllowed: assignmentContext.directAssignmentAllowed,
        blockReason: assignmentContext.blockReason,
      },
    };
  }

  async assign(companyId: string, actor: any, ticketId: string, technicianId: string, linkedClientCompanyId?: string) {
    await this.assertExecutorOperationsAllowed(companyId);
    const accessActor = this.requireAccessActor(actor, companyId);
    const access = await resolveTicketOperationAccess({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor: accessActor,
      ticketId,
      linkedClientCompanyId,
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    });

    const decision = this.policy.canAssign({
      id: accessActor.id,
      role: accessActor.role,
      companyId: access.operationCompanyId,
    });
    assertAllowed(decision);

    const assignResult = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id: ticketId, companyId: access.ticket.companyId },
        include: {
          problemCategory: {
            include: {
              specializationLinks: {
                include: { specialization: true },
              },
            },
          },
          assignedTechnician: {
            select: { companyId: true },
          },
        },
      });

      if (!ticket) throw new NotFoundException('Ticket not found');

      if (ticket.status === TicketStatus.DONE || ticket.status === TicketStatus.CANCELED) {
        throw new BadRequestException(`Ticket cannot be assigned in status ${ticket.status}`);
      }

      const assignmentContext = await this.resolveAssignmentAuthorityContext({
        actor: accessActor,
        ticket,
        linkedClientCompanyId,
      });
      const tech = await this.assertTechnicianAssignable(assignmentContext, technicianId, tx);

      const previousAssigneeId = ticket.assignedTechnicianId;
      const isReassign = !!previousAssigneeId && previousAssigneeId !== technicianId;
      const isFirstAssign = !previousAssigneeId;
      const now = new Date();

      if (ticket.status === TicketStatus.NEW) {
        const wf = decideTicketTransition(TicketStatus.NEW, TicketStatus.ASSIGNED);
        if (!wf.allowed) throw new BadRequestException(wf.reason);

        await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            assignedTechnicianId: technicianId,
            status: TicketStatus.ASSIGNED,
            statusUpdatedAt: now,
          },
        });

        await this.writeStatusHistoryTx(tx, {
          ticketId: ticket.id,
          fromStatus: TicketStatus.NEW,
          toStatus: TicketStatus.ASSIGNED,
          changedByUserId: actor?.id ?? null,
          comment: 'Manual assigned',
        });
      } else {
        await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            assignedTechnicianId: technicianId,
          },
        });
      }

      let assignmentTimelineRecorded = false;
      let assignmentEventId: string | null = null;
      let assignMode: 'manual' | 'reassign' = 'manual';
      const assignmentOperation: AssignmentHistoryOperation = isReassign
        ? 'reassign_technician'
        : tech.companyId !== ticket.companyId
          ? 'provider_assignment'
          : 'assign_technician';

      if (isReassign) {
        assignMode = 'reassign';
        assignmentTimelineRecorded = true;
        await this.recordAssignmentHistoryTx(tx, {
          companyId: ticket.companyId,
          ticketId: ticket.id,
          actorUserId: actor?.id ?? null,
          previousAssignedTechnicianId: previousAssigneeId,
          assignedTechnicianId: technicianId,
          operationType: assignmentOperation,
          timestamp: now,
          mode: 'reassign',
          reason: 'manual_reassign',
          operationCompanyId: access.operationCompanyId,
        });
        const assignmentEvent = await this.timelineService.recordTx(tx, {
          event: 'TICKET_ASSIGNED',
          companyId: ticket.companyId,
          ticketId: ticket.id,
          actorUserId: actor?.id ?? null,
          payload: {
            previousAssignedTechnicianId: previousAssigneeId,
            assignedTechnicianId: technicianId,
            assignerUserId: actor?.id ?? null,
            mode: 'reassign',
          },
        });
        assignmentEventId = assignmentEvent.id;
      } else if (isFirstAssign || ticket.status === TicketStatus.NEW) {
        assignmentTimelineRecorded = true;
        await this.recordAssignmentHistoryTx(tx, {
          companyId: ticket.companyId,
          ticketId: ticket.id,
          actorUserId: actor?.id ?? null,
          previousAssignedTechnicianId: previousAssigneeId ?? null,
          assignedTechnicianId: technicianId,
          operationType: assignmentOperation,
          timestamp: now,
          mode: 'manual',
          reason: 'manual_select',
          operationCompanyId: access.operationCompanyId,
        });
        const assignmentEvent = await this.timelineService.recordTx(tx, {
          event: 'TICKET_ASSIGNED',
          companyId: ticket.companyId,
          ticketId: ticket.id,
          actorUserId: actor?.id ?? null,
          payload: {
            previousAssignedTechnicianId: previousAssigneeId ?? null,
            assignedTechnicianId: technicianId,
            assignerUserId: actor?.id ?? null,
            mode: 'manual',
          },
        });
        assignmentEventId = assignmentEvent.id;
      }

      return { ticketId: ticket.id, assignmentTimelineRecorded, assignMode, assignmentEventId };
    });

    const meta = await this.prisma.ticket.findUnique({
      where: { id: assignResult.ticketId },
      select: { companyId: true, locationId: true, ticketNumber: true, problemText: true },
    });

    if (assignResult.assignmentTimelineRecorded && meta) {
      await this.prisma.assignmentDecision.create({
        data: {
          ticketId: assignResult.ticketId,
          technicianId,
          candidatesCount: 1,
          reason: 'manual_select',
        },
      });
      this.notifications.scheduleTicketAssignedToTechnician({
        assigneeUserId: technicianId,
        ticketId: assignResult.ticketId,
        ticketCompanyId: meta.companyId,
        locationId: meta.locationId,
        ticketNumber: meta.ticketNumber,
        summary: (meta.problemText || '').trim() || `Заявка #${meta.ticketNumber}`,
        actorUserId: actor?.id ?? null,
        mode: assignResult.assignMode,
        sourceEventId: assignResult.assignmentEventId,
      });

      const assigneeCompany = await this.prisma.user.findUnique({
        where: { id: technicianId },
        select: { companyId: true, email: true },
      })
      if (assigneeCompany && assigneeCompany.companyId !== meta.companyId) {
        this.notifications.onTicketAssigned({
          ticketCompanyId: meta.companyId,
          assigneeUserId: technicianId,
          assigneeEmail: (assigneeCompany.email || '').trim(),
          actorUserId: actor?.id ?? null,
          ticketId: assignResult.ticketId,
          ticketNumber: meta.ticketNumber,
          summary: (meta.problemText || '').trim() || `Заявка #${meta.ticketNumber}`,
          sourceEventId: assignResult.assignmentEventId,
        })
      }
    }

    const ticket = await this.query.getOne(
      companyId,
      actor?.id,
      actor?.role as UserRole,
      assignResult.ticketId,
      actor?.accessFlags,
      undefined,
      linkedClientCompanyId,
    );

    const assignmentDecision = {
      ticketId: assignResult.ticketId,
      technicianId,
      reason: assignResult.assignMode === 'reassign' ? 'manual_reassign' : 'manual_select',
      createdAt: new Date().toISOString(),
    };
    this.logger.log({
      event: 'assignment_decision',
      ...assignmentDecision,
    });

    return {
      ...(ticket as Record<string, unknown>),
      technicianId,
      reason: assignmentDecision.reason,
      assignmentDecision,
    };
  }

  async assignSmart(
    companyId: string,
    actor: any,
    ticketId: string,
    linkedClientCompanyId?: string,
  ) {
    await this.assertExecutorOperationsAllowed(companyId);
    const accessActor = this.requireAccessActor(actor, companyId);
    const access = await resolveTicketOperationAccess({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor: accessActor,
      ticketId,
    });

    const decision = this.policy.canAssign({
      id: accessActor.id,
      role: accessActor.role,
      companyId: access.operationCompanyId,
    });
    assertAllowed(decision);

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, companyId: access.ticket.companyId },
      select: {
        id: true,
        locationId: true,
        problemCategoryId: true,
        assignedTechnicianId: true,
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const selected = await this.assignmentEngine.selectTechnicianForTicket({
      ticketId: ticket.id,
      companyId: access.operationCompanyId,
      locationId: ticket.locationId,
      locationCompanyId: access.ticket.companyId,
      categoryId: ticket.problemCategoryId,
      categoryCompanyId: access.ticket.companyId,
    });

    if (!selected) {
      return {
        assigned: false as const,
        technicianId: null,
        technicianName: null,
        reason: 'no_candidates_after_filters',
        candidatesCount: 0,
      };
    }

    const updated = await this.assign(
      companyId,
      actor,
      ticketId,
      selected.technicianId,
      linkedClientCompanyId,
    );

    const updatedTicket = (updated as any)?.ticket || updated;
    const techLabel =
      updatedTicket?.assignedTechnician?.email ||
      updatedTicket?.assignedTechnician?.id ||
      selected.technicianId;
    const decisionAt = new Date().toISOString();
    this.logger.log({
      event: 'assignment_decision',
      ticketId,
      technicianId: selected.technicianId,
      reason: selected.reason,
      createdAt: decisionAt,
    });

    return {
      assigned: true as const,
      technicianId: selected.technicianId,
      technicianName: techLabel,
      reason: selected.reason,
      candidatesCount: selected.candidatesCount,
      assignmentDecision: {
        ticketId,
        technicianId: selected.technicianId,
        reason: selected.reason,
        createdAt: decisionAt,
      },
      ticket: updatedTicket,
    };
  }


  /**
   * SMA-TICKET-HISTORY-AUDIT-001.
   * Строит карту изменений `{ поле: { from, to } }` для события ticket.updated.
   * Только реально изменённые поля (список приходит из changedFields).
   * Для связанных сущностей дополнительно резолвит человекочитаемые названия,
   * чтобы лента могла показать «Уфа 18 → Уфа 11», а не пару идентификаторов.
   */
  private async buildTicketUpdateChanges(
    tx: Prisma.TransactionClient,
    params: {
      changedFields: string[];
      before: {
        locationId: string | null;
        equipmentId: string | null;
        problemCategoryId: string | null;
        problemText: string | null;
        urgency: TicketUrgency | null;
        urgencyReason: string | null;
        requesterName: string | null;
        requesterPhone: string | null;
        address: string | null;
        pointName: string | null;
      };
      after: {
        problemCategoryId?: string;
        locationId?: string;
        equipmentId?: string | null;
        problemText?: string;
        urgency?: TicketUrgency;
        urgencyReason?: string | null;
        requesterName?: string | null;
        requesterPhone?: string | null;
        address?: string | null;
        pointName?: string | null;
      };
    },
  ): Promise<Record<string, { from: unknown; to: unknown; fromId?: string | null; toId?: string | null }>> {
    const { changedFields, before, after } = params;
    const changed = new Set(changedFields);

    const locationIds = new Set<string>();
    const categoryIds = new Set<string>();
    const equipmentIds = new Set<string>();
    const collect = (set: Set<string>, ...ids: (string | null | undefined)[]) => {
      for (const id of ids) if (id) set.add(id);
    };
    if (changed.has('locationId')) collect(locationIds, before.locationId, after.locationId);
    if (changed.has('problemCategoryId')) collect(categoryIds, before.problemCategoryId, after.problemCategoryId);
    if (changed.has('equipmentId')) collect(equipmentIds, before.equipmentId, after.equipmentId);

    const [locations, categories, equipment] = await Promise.all([
      locationIds.size
        ? tx.location.findMany({ where: { id: { in: [...locationIds] } }, select: { id: true, name: true } })
        : Promise.resolve([]),
      categoryIds.size
        ? tx.problemCategory.findMany({ where: { id: { in: [...categoryIds] } }, select: { id: true, name: true } })
        : Promise.resolve([]),
      equipmentIds.size
        ? tx.equipment.findMany({ where: { id: { in: [...equipmentIds] } }, select: { id: true, name: true } })
        : Promise.resolve([]),
    ]);

    const nameOf = (rows: { id: string; name: string }[], id?: string | null) =>
      id ? (rows.find((row) => row.id === id)?.name ?? null) : null;

    const changes: Record<string, { from: unknown; to: unknown; fromId?: string | null; toId?: string | null }> = {};

    const putScalar = (field: string, from: unknown, to: unknown) => {
      if (changed.has(field)) changes[field] = { from: from ?? null, to: to ?? null };
    };
    const putRef = (
      field: string,
      rows: { id: string; name: string }[],
      fromId: string | null,
      toId: string | null,
    ) => {
      if (!changed.has(field)) return;
      changes[field] = {
        from: nameOf(rows, fromId),
        to: nameOf(rows, toId),
        fromId: fromId ?? null,
        toId: toId ?? null,
      };
    };

    putRef('locationId', locations, before.locationId, after.locationId ?? before.locationId);
    putRef('problemCategoryId', categories, before.problemCategoryId, after.problemCategoryId ?? before.problemCategoryId);
    putRef('equipmentId', equipment, before.equipmentId, after.equipmentId === undefined ? before.equipmentId : after.equipmentId);

    putScalar('problemText', before.problemText, after.problemText);
    putScalar('urgency', before.urgency, after.urgency);
    putScalar('urgencyReason', before.urgencyReason, after.urgencyReason);
    putScalar('requesterName', before.requesterName, after.requesterName);
    putScalar('requesterPhone', before.requesterPhone, after.requesterPhone);
    putScalar('address', before.address, after.address);
    putScalar('pointName', before.pointName, after.pointName);

    return changes;
  }

  async update(companyId: string, actor: any, ticketId: string, dto: UpdateTicketDto, linkedClientCompanyId?: string) {
    if (!actor?.id || !actor?.companyId || !actor?.role) {
      throw new ForbiddenException('Actor context is required');
    }

    const actorRole = actor.role as UserRole;
    const isClientLikeActor = actorRole === UserRole.CLIENT || actorRole === UserRole.TERRITORIAL_MANAGER;
    const access = await resolveTicketOperationAccess({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor: {
        id: actor.id,
        role: actor.role,
        companyId: actor.companyId,
        accessFlags: actor?.accessFlags,
      },
      ticketId,
      linkedClientCompanyId,
    });

    if (!isClientLikeActor) {
      const decision = this.policy.canAssign({
        id: actor.id,
        role: actorRole as UserRole,
        companyId: actor.companyId,
      });
      assertAllowed(decision);
    } else {
      if (linkedClientCompanyId) {
        throw new ForbiddenException('Client cannot edit ticket in linked-client scope');
      }
      if (access.ticket.companyId !== companyId) {
        throw new ForbiddenException('Client can edit only own company tickets');
      }
    }

    const normalizedCategoryId = dto.problemCategoryId?.trim();
    const normalizedLocationId = dto.locationId?.trim();
    const normalizedEquipmentId =
      dto.equipmentId === undefined
        ? undefined
        : dto.equipmentId === null
          ? null
          : dto.equipmentId.trim();
    const normalizedProblemText = typeof dto.problemText === 'string' ? dto.problemText.trim() : undefined;
    const normalizedComment = typeof dto.comment === 'string' ? dto.comment.trim() : undefined;

    if (dto.problemText !== undefined && !normalizedProblemText) {
      throw new BadRequestException('problemText cannot be empty');
    }
    if (dto.comment !== undefined && !normalizedComment) {
      throw new BadRequestException('comment cannot be empty');
    }

    if (dto.problemCategoryId !== undefined && !normalizedCategoryId) {
      throw new BadRequestException('problemCategoryId cannot be empty');
    }

    if (dto.locationId !== undefined && !normalizedLocationId) {
      throw new BadRequestException('locationId cannot be empty');
    }
    if (dto.equipmentId !== undefined && normalizedEquipmentId === '') {
      throw new BadRequestException('equipmentId cannot be empty');
    }

    if (normalizedCategoryId) {
      await assertActorCanUseProblemCategory({
        prisma: this.prisma,
        actor: {
          id: actor.id,
          role: actor.role,
          companyId: actor.companyId,
          accessFlags: actor?.accessFlags,
        },
        scopeCompanyId: access.ticket.companyId,
        problemCategoryId: normalizedCategoryId,
      });
    }

    const updatedTicketId = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id: ticketId, companyId: access.ticket.companyId },
        select: {
          id: true,
          companyId: true,
          locationId: true,
          equipmentId: true,
          problemCategoryId: true,
          problemText: true,
          urgency: true,
          urgencyReason: true,
          requesterName: true,
          requesterPhone: true,
          address: true,
          pointName: true,
          status: true,
        },
      });

      if (!ticket) {
        throw new NotFoundException('Ticket not found');
      }

      if (ticket.status === TicketStatus.DONE || ticket.status === TicketStatus.CANCELED) {
        throw new BadRequestException(`Ticket cannot be edited in status ${ticket.status}`);
      }

      if (isClientLikeActor && ticket.status !== TicketStatus.NEW) {
        throw new ForbiddenException('Client can edit ticket fields only while ticket is NEW');
      }

      if (normalizedCategoryId) {
        const category = await tx.problemCategory.findFirst({
          where: {
            id: normalizedCategoryId,
            companyId: access.ticket.companyId,
            isActive: true,
          },
          select: { id: true },
        });

        if (!category) {
          throw new NotFoundException('Problem category not found');
        }
      }

      if (normalizedLocationId) {
        await this.assertActorCanUseLocationForScope({
          actor: {
            id: actor.id,
            role: actor.role,
            companyId: actor.companyId,
            accessFlags: actor?.accessFlags,
          },
          scopeCompanyId: access.ticket.companyId,
          locationId: normalizedLocationId,
        });
        const location = await tx.location.findFirst({
          where: {
            id: normalizedLocationId,
            clientCompanyId: access.ticket.companyId,
            isActive: true,
          },
          select: { id: true },
        });

        if (!location) {
          throw new NotFoundException('Location not found');
        }
      }

      const effectiveLocationId = normalizedLocationId || ticket.locationId;
      if (normalizedEquipmentId && normalizedEquipmentId !== ticket.equipmentId) {
        const equipment = await tx.equipment.findFirst({
          where: {
            id: normalizedEquipmentId,
            companyId: access.ticket.companyId,
            locationId: effectiveLocationId,
          },
          select: { id: true },
        });
        if (!equipment) {
          throw new NotFoundException('Equipment not found');
        }
      }

      const data: Prisma.TicketUpdateInput = {};
      const changedFields: string[] = [];

      if (normalizedCategoryId && normalizedCategoryId !== ticket.problemCategoryId) {
        data.problemCategory = { connect: { id: normalizedCategoryId } };
        changedFields.push('problemCategoryId');
      }

      if (normalizedLocationId && normalizedLocationId !== ticket.locationId) {
        data.location = { connect: { id: normalizedLocationId } };
        changedFields.push('locationId');
      }
      if (normalizedEquipmentId === null && ticket.equipmentId !== null) {
        data.equipment = { disconnect: true };
        changedFields.push('equipmentId');
      } else if (normalizedEquipmentId && normalizedEquipmentId !== ticket.equipmentId) {
        data.equipment = { connect: { id: normalizedEquipmentId } };
        changedFields.push('equipmentId');
      }

      if (normalizedProblemText !== undefined && normalizedProblemText !== ticket.problemText) {
        data.problemText = normalizedProblemText;
        changedFields.push('problemText');
      }

      if (dto.urgency !== undefined && dto.urgency !== ticket.urgency) {
        data.urgency = dto.urgency;
        changedFields.push('urgency');
      }

      const normalizeNullable = (value?: string | null) => {
        if (value === undefined) return undefined;
        if (value === null) return null;
        return value.trim() || null;
      };

      const urgencyReason = normalizeNullable(dto.urgencyReason);
      if (urgencyReason !== undefined && urgencyReason !== ticket.urgencyReason) {
        data.urgencyReason = urgencyReason;
        changedFields.push('urgencyReason');
      }

      const requesterName = normalizeNullable(dto.requesterName);
      if (requesterName !== undefined && requesterName !== ticket.requesterName) {
        data.requesterName = requesterName;
        changedFields.push('requesterName');
      }

      const requesterPhone = normalizeNullable(dto.requesterPhone);
      if (requesterPhone !== undefined && requesterPhone !== ticket.requesterPhone) {
        data.requesterPhone = requesterPhone;
        changedFields.push('requesterPhone');
      }

      const address = normalizeNullable(dto.address);
      if (address !== undefined && address !== ticket.address) {
        data.address = address;
        changedFields.push('address');
      }

      const pointName = normalizeNullable(dto.pointName);
      if (pointName !== undefined && pointName !== ticket.pointName) {
        data.pointName = pointName;
        changedFields.push('pointName');
      }

      if (changedFields.length === 0) {
        return ticket.id;
      }

      await tx.ticket.update({
        where: { id: ticket.id },
        data,
      });

      if (changedFields.includes('problemCategoryId')) {
        await this.timelineService.recordLegacyTx(tx, {
          type: 'ticket.category_changed',
          companyId: ticket.companyId,
          entityType: 'Ticket',
          entityId: ticket.id,
          actorUserId: actor?.id ?? null,
          payload: {
            previousProblemCategoryId: ticket.problemCategoryId,
            problemCategoryId: normalizedCategoryId,
          },
        });
      }

      // SMA-TICKET-HISTORY-AUDIT-001: до сих пор событие несло только имена изменённых
      // полей, поэтому в истории нельзя было увидеть, что именно поменялось. Добавляем
      // карту старое → новое к тому же событию; отдельной системы истории не заводим.
      const changes = await this.buildTicketUpdateChanges(tx, {
        changedFields,
        before: ticket,
        after: {
          problemCategoryId: normalizedCategoryId,
          locationId: normalizedLocationId,
          equipmentId: normalizedEquipmentId,
          problemText: normalizedProblemText,
          urgency: dto.urgency,
          urgencyReason,
          requesterName,
          requesterPhone,
          address,
          pointName,
        },
      });

      await this.timelineService.recordLegacyTx(tx, {
        type: 'ticket.updated',
        companyId: ticket.companyId,
        entityType: 'Ticket',
        entityId: ticket.id,
        actorUserId: actor?.id ?? null,
        payload: {
          changedFields,
          changes,
          operationCompanyId: access.operationCompanyId,
        },
      });

      if (normalizedComment) {
        await this.timelineService.recordLegacyTx(tx, {
          type: 'ticket.comment_added',
          companyId: ticket.companyId,
          entityType: 'Ticket',
          entityId: ticket.id,
          actorUserId: actor?.id ?? null,
          payload: {
            comment: normalizedComment,
            source: 'edit_flow',
          },
        });
      }

      return ticket.id;
    });

    return this.query.getOne(
      companyId,
      actor?.id,
      actor?.role as UserRole,
      updatedTicketId,
      actor?.accessFlags,
      undefined,
      linkedClientCompanyId,
    );
  }

  async getLatestAssignmentDecision(
    companyId: string,
    actor: { id?: string; role?: UserRole; accessFlags?: any },
    ticketId: string,
    linkedClientCompanyId?: string,
  ) {
    const accessActor = this.requireAccessActor(actor, companyId);
    await resolveReadableTicketAccess({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor: accessActor,
      ticketId,
      linkedClientCompanyId,
    });

    return this.prisma.assignmentDecision.findFirst({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
      select: {
        ticketId: true,
        technicianId: true,
        candidatesCount: true,
        reason: true,
        createdAt: true,
      },
    });
  }
  async updateCategory(companyId: string, actor: any, ticketId: string, problemCategoryId: string) {
    const decision = this.policy.canAssign({ id: actor?.id, role: actor?.role, companyId });
    assertAllowed(decision);

    const normalizedCategoryId = (problemCategoryId ?? '').trim();
    if (!normalizedCategoryId) {
      throw new BadRequestException('problemCategoryId cannot be empty');
    }

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, companyId },
      select: {
        id: true,
        status: true,
        problemCategoryId: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.status === TicketStatus.DONE || ticket.status === TicketStatus.CANCELED) {
      throw new BadRequestException(`Ticket cannot be edited in status ${ticket.status}`);
    }

    const category = await this.prisma.problemCategory.findFirst({
      where: {
        id: normalizedCategoryId,
        companyId: companyId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Problem category not found');
    }

    await assertActorCanUseProblemCategory({
      prisma: this.prisma,
      actor: {
        id: actor?.id,
        role: actor?.role as UserRole,
        companyId,
      },
      scopeCompanyId: companyId,
      problemCategoryId: normalizedCategoryId,
    });

    if (ticket.problemCategoryId === normalizedCategoryId) {
      return this.query.getOne(companyId, actor?.id, actor?.role as UserRole, ticket.id);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          problemCategoryId: normalizedCategoryId,
        },
      });

      await this.timelineService.recordLegacyTx(tx, {
        type: 'ticket.category_changed',
        companyId: companyId,
        entityType: 'Ticket',
        entityId: ticket.id,
        actorUserId: actor?.id ?? null,
        payload: {
          previousProblemCategoryId: ticket.problemCategoryId,
          problemCategoryId: normalizedCategoryId,
        },
      });

      await this.timelineService.recordLegacyTx(tx, {
        type: 'ticket.updated',
        companyId: companyId,
        entityType: 'Ticket',
        entityId: ticket.id,
        actorUserId: actor?.id ?? null,
        payload: {
          changedFields: ['problemCategoryId'],
        },
      });
    });

    return this.query.getOne(companyId, actor?.id, actor?.role as UserRole, ticket.id);
  }

  async availableForTechnician(companyId: string, executorUserId: string, linkedClientCompanyId?: string) {
    const executorUser = await this.prisma.user.findFirst({
      where: { id: executorUserId, companyId, isActive: true },
      select: { role: true, isExecutor: true },
    });
    if (!executorUser || !isExecutorEligible(executorUser)) {
      throw new ForbiddenException('User is not an eligible executor');
    }
    this.logger.log({
      event: 'executor_available_tickets_scope',
      executorUserId,
      executorRole: executorUser.role,
      isExecutor: executorUser.isExecutor,
      companyId,
    });

    const eligibility = await resolveExecutorClaimEligibility({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      policy: this.policy,
      actor: {
        id: executorUserId,
        role: executorUser.role,
        isExecutor: executorUser.isExecutor,
        companyId,
      },
      linkedClientCompanyId,
    });
    assertExecutorClaimEligibilityAllowed(eligibility);

    const tickets = await this.prisma.ticket.findMany({
      where: eligibility.where,
      include: {
        location: {
          select: {
            id: true,
            name: true,
            platformCode: true,
            externalCode: true,
            city: true,
            address: true,
          },
        },
        problemCategory: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const out: Array<(typeof tickets)[number] & {
      canClaim: boolean
      canClaimByCurrentUser: boolean
      canRequestAssignment: boolean
      claimAvailabilityReason: string | null
      requestAssignmentAvailabilityReason: string | null
    }> = []
    for (const ticket of tickets) {
      const capability = await resolveEligibleTicketClaimCapability({
        serviceContractsService: this.serviceContractsService,
        actor: { id: executorUserId, companyId },
        ticket,
        linkedClientContractRole:
          eligibility.effectiveLinkedClientCompanyId === ticket.companyId
            ? eligibility.linkedClientContractRole
            : null,
      })
      if (!capability.canClaim && !capability.canRequestAssignment) continue
      out.push({
        ...ticket,
        canClaim: capability.canClaim,
        canClaimByCurrentUser: capability.canClaim,
        canRequestAssignment: capability.canRequestAssignment,
        claimAvailabilityReason: capability.claimAvailabilityReason,
        requestAssignmentAvailabilityReason: capability.requestAssignmentAvailabilityReason,
      })
    }
    return out
  }

  async claim(companyId: string, executorUserId: string, ticketId: string, linkedClientCompanyId?: string) {
    await this.assertExecutorOperationsAllowed(companyId);

    const executorUser = await this.prisma.user.findFirst({
      where: { id: executorUserId, companyId, isActive: true },
      select: { role: true, isExecutor: true },
    });
    if (!executorUser || !isExecutorEligible(executorUser)) {
      throw new ForbiddenException('User is not an eligible executor');
    }

    const eligibility = await resolveExecutorClaimEligibility({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      policy: this.policy,
      actor: {
        id: executorUserId,
        role: executorUser.role,
        isExecutor: executorUser.isExecutor,
        companyId,
      },
      ticketId,
      linkedClientCompanyId,
      requireReadableTicket: true,
    });
    assertExecutorClaimEligibilityAllowed(eligibility);
    this.logger.log({
      event: 'executor_claim_decision',
      executorUserId,
      executorRole: executorUser.role,
      isExecutor: executorUser.isExecutor,
      ticketId,
      companyId,
      allowed: true,
      allowTechnicianClaim: eligibility.technicianScope.allowTechnicianClaim,
      scopeCompanyIds: eligibility.technicianScope.companyIds,
      specializationCount: eligibility.technicianScope.specializationIds.length,
    });
    const claimableTicket = await this.prisma.ticket.findFirst({
      where: eligibility.where,
      select: { id: true, companyId: true, createdByUserId: true },
    });
    if (!claimableTicket) {
      throw new NotFoundException('Ticket not found or not available for claim');
    }
    const capability = await resolveEligibleTicketClaimCapability({
      serviceContractsService: this.serviceContractsService,
      actor: { id: executorUserId, companyId },
      ticket: claimableTicket,
      linkedClientContractRole: eligibility.linkedClientContractRole,
    })
    if (!capability.canClaim) {
      throw new ForbiddenException('Subcontractor users must request assignment for this ticket');
    }

    const claimResult = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: eligibility.where,
      })

      if (!ticket) {
        throw new NotFoundException('Ticket not found or not available for claim')
      }

      const wf = decideTicketTransition(TicketStatus.NEW, TicketStatus.ASSIGNED)
      if (!wf.allowed) throw new BadRequestException(wf.reason)

      const now = new Date()

      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          assignedTechnicianId: executorUserId,
          status: TicketStatus.ASSIGNED,
          statusUpdatedAt: now,
        },
      })

      await this.writeStatusHistoryTx(tx, {
        ticketId: ticket.id,
        fromStatus: TicketStatus.NEW,
        toStatus: TicketStatus.ASSIGNED,
        changedByUserId: executorUserId,
        comment: 'Claimed by executor',
      })

      await this.recordAssignmentHistoryTx(tx, {
        companyId: ticket.companyId,
        ticketId: ticket.id,
        actorUserId: executorUserId,
        previousAssignedTechnicianId: null,
        assignedTechnicianId: executorUserId,
        operationType: 'self_claim',
        timestamp: now,
        mode: 'claim',
        reason: 'executor_claim',
        operationCompanyId: companyId,
      })

      const claimEvent = await this.timelineService.recordTx(tx, {
        event: 'TICKET_CLAIMED',
        companyId: ticket.companyId,
        ticketId: ticket.id,
        actorUserId: executorUserId,
        payload: {
          assignedTechnicianId: executorUserId,
          mode: 'claim',
          operationCompanyId: companyId,
        },
      })

      return {
        ticketId: ticket.id,
        ticketCompanyId: ticket.companyId,
        locationId: ticket.locationId,
        ticketNumber: ticket.ticketNumber,
        problemText: ticket.problemText,
        claimEventId: claimEvent.id,
      }
    })

    const linkedResolved =
      linkedClientCompanyId ||
      (claimResult.ticketCompanyId !== companyId ? claimResult.ticketCompanyId : null)
    this.notifications.scheduleTicketClaimedDispatchers({
      watcherCompanyId: companyId,
      ticketCompanyId: claimResult.ticketCompanyId,
      locationId: claimResult.locationId,
      ticketId: claimResult.ticketId,
      ticketNumber: claimResult.ticketNumber,
      summary: (claimResult.problemText || '').trim() || `Заявка #${claimResult.ticketNumber}`,
      excludeUserId: executorUserId,
      linkedHint: linkedResolved,
      sourceEventId: claimResult.claimEventId,
    })

    return this.query.getOne(companyId, executorUserId, executorUser.role, claimResult.ticketId, undefined, undefined, linkedClientCompanyId)
  }

  /**
   * Техник запрашивает ручное назначение.
   * Доступ синхронизирован с {@link resolveReadableTicketAccess} (как GET /tickets/:id), а не с урезанным ad-hoc OR из claim-пула.
   */
  async requestAssignment(
    providerCompanyId: string,
    requesterUserId: string,
    requesterRole: UserRole,
    ticketId: string,
    linkedClientCompanyId?: string,
    targetUserId?: string,
  ) {
    const requesterUser = await this.prisma.user.findFirst({
      where: { id: requesterUserId, companyId: providerCompanyId, isActive: true, deletedAt: null },
      select: { role: true, isExecutor: true },
    });
    if (!requesterUser) {
      throw new ForbiddenException('User is not active');
    }
    const requestedTargetUserId = (targetUserId || '').trim() || requesterUserId;
    const requestingSelf = requestedTargetUserId === requesterUserId;
    if (requestingSelf && !isExecutorEligible(requesterUser)) {
      throw new ForbiddenException('User is not an eligible executor');
    }
    this.logger.log({
      event: 'executor_request_assignment',
      requesterUserId,
      requesterRole: requesterUser.role,
      isRequesterExecutor: requesterUser.isExecutor,
      requestedTargetUserId,
      ticketId,
      providerCompanyId,
    });
    await this.assertExecutorOperationsAllowed(providerCompanyId);

    const readable = await resolveReadableTicketAccess({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor: {
        id: requesterUserId,
        role: requesterUser.role,
        companyId: providerCompanyId,
      },
      ticketId,
      linkedClientCompanyId,
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    });

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, companyId: readable.ticket.companyId },
      select: {
        id: true,
        status: true,
        assignedTechnicianId: true,
        ticketNumber: true,
        companyId: true,
        locationId: true,
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
      throw new NotFoundException('Ticket not found');
    }
    if (ticket.status !== TicketStatus.NEW || ticket.assignedTechnicianId) {
      throw new BadRequestException('Заявка уже назначена или недоступна для запроса');
    }

    const contractContext = await this.resolveProviderTicketContractContext({
      providerCompanyId,
      ticket,
      linkedClientCompanyId,
    });
    if (!contractContext || contractContext.roleInContract !== ServiceContractRole.SECONDARY) {
      throw new ForbiddenException('Request assignment is available only for SECONDARY provider contracts');
    }
    this.assertContractContextCoversTicket({
      context: contractContext,
      ticket,
    });

    const targetUser = await this.prisma.user.findFirst({
      where: {
        id: requestedTargetUserId,
        companyId: providerCompanyId,
        isActive: true,
        deletedAt: null,
        isExecutor: true,
        role: { in: Array.from(EXECUTOR_CAPABLE_ROLES) },
      },
      select: {
        id: true,
        role: true,
        isExecutor: true,
      },
    });
    if (!targetUser) {
      throw new NotFoundException('Technician not found');
    }

    const eligibility = await resolveExecutorClaimEligibility({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      policy: this.policy,
      actor: {
        id: requestedTargetUserId,
        role: targetUser.role,
        isExecutor: targetUser.isExecutor,
        companyId: providerCompanyId,
      },
      ticketId,
      linkedClientCompanyId,
      requireReadableTicket: true,
    });
    assertExecutorClaimEligibilityAllowed(eligibility);
    const eligibleTicket = await this.prisma.ticket.findFirst({
      where: eligibility.where,
      select: { id: true },
    })
    if (!eligibleTicket) {
      throw new NotFoundException('Ticket not found or not available for assignment request')
    }

    const createdAtIso = new Date().toISOString()
    const txResult = await this.prisma.$transaction(async (tx) => {
      const existingRequests = await tx.domainEvent.findMany({
        where: {
          type: TICKET_ASSIGNMENT_REQUESTED_EVENT,
          entityType: TICKET_ASSIGNMENT_REQUESTED_ENTITY,
          entityId: ticket.id,
          companyId: ticket.companyId,
          actorUserId: requesterUserId,
        },
        select: { id: true, payload: true },
      })
      const existingRequest = existingRequests.find((event) => {
        const target =
          event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
            ? ((event.payload as Record<string, unknown>).requestedTargetUserId as string | undefined)
            : undefined
        return (target || requesterUserId) === requestedTargetUserId
      })
      if (existingRequest) {
        return { alreadyRequested: true as const }
      }
      const requestEvent = await this.timelineService.recordLegacyTx(tx, {
        type: TICKET_ASSIGNMENT_REQUESTED_EVENT,
        companyId: ticket.companyId,
        entityType: TICKET_ASSIGNMENT_REQUESTED_ENTITY,
        entityId: ticket.id,
        actorUserId: requesterUserId,
        payload: {
          ticketId: ticket.id,
          requestedByUserId: requesterUserId,
          requestedByRole: requesterUser.role,
          requestedTargetUserId,
          requestedTargetRole: targetUser.role,
          requestedTargetCompanyId: providerCompanyId,
          linkedClientCompanyId: linkedClientCompanyId?.trim() || null,
          createdAt: createdAtIso,
        },
      })
      return { alreadyRequested: false as const, sourceEventId: requestEvent.id }
    })

    if (txResult.alreadyRequested) {
      return { ok: true as const, alreadyRequested: true as const, notified: 0 }
    }

    const notify = await this.notifications.notifyTicketAssignmentRequested({
      providerCompanyId,
      requesterUserId,
      technicianUserId: requestedTargetUserId,
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      ticketCompanyId: ticket.companyId,
      sourceEventId: txResult.sourceEventId,
    })
    return { ok: true as const, alreadyRequested: false as const, notified: notify.notified }
  }

  async createPublic(
    companyId: string,
    input: {
      locationId: string;
      equipmentId?: string | null;
      categoryId: string;
      publicRequestType: PublicRequestType;
      description: string;
      requesterName?: string | null;
      requesterPhone?: string | null;
      attachmentIds?: string[];
      urgency?: TicketUrgency;
      channel?: string | null;
      presetLocationId?: string | null;
      publicLinkVersion?: string | null;
      ipHash?: string | null;
      phoneNormalized?: string | null;
    },
  ) {
    const company = await this.getCompany(companyId);
    if (company.type !== CompanyType.CLIENT) {
      throw new BadRequestException('Ticket owner company must be a CLIENT company');
    }
    const category = await this.getCategory(companyId, input.categoryId);
    const location = await this.getLocation(companyId, input.locationId);
    const equipment = input.equipmentId
      ? await this.getEquipment(companyId, location.id, input.equipmentId)
      : null;

    const specializationIds = category.specializationLinks.map((x) => x.specializationId);
    const allCandidates = await this.findCandidateTechnicians(companyId, specializationIds);
    const candidates = await this.filterTechniciansByLocationBindings(
      allCandidates,
      companyId,
      location.id,
    );
    const shouldAutoAssign = company.autoAssignEnabled;
    const ticketId = randomUUID();

    const publicPriority = TicketPriority.NORMAL;
    const { slaMinutes: pubSlaMinutes, slaDueAt: pubSlaDueAt } = computeSlaFromPriorityOrExplicitMinutes({
      priority: publicPriority,
      explicitSlaMinutes: null,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const selected = shouldAutoAssign
        ? await this.assignmentEngine.selectTechnicianForTicket({
            ticketId,
            companyId,
            locationId: location.id,
            categoryId: input.categoryId,
          })
        : null;
      const assignedTechnicianId = selected?.technicianId ?? null;

      let ticket = await tx.ticket.create({
        data: {
          id: ticketId,
          companyId: companyId,
          locationId: location.id,
          equipmentId: equipment?.id ?? null,
          requesterName: input.requesterName ?? null,
          requesterPhone: input.requesterPhone ?? null,
          address: location.address ?? null,
          pointName: location.name,
          problemCategoryId: input.categoryId,
          problemText: input.description.trim(),
          urgency: input.urgency ?? TicketUrgency.NOT_URGENT,
          priority: publicPriority,
          slaMinutes: pubSlaMinutes,
          slaDueAt: pubSlaDueAt,
          status: TicketStatus.NEW,
          assignedTechnicianId: null,
          createdByUserId: null,
          source: TicketSource.PUBLIC_QUICK_REQUEST,
          publicRequestType: input.publicRequestType,
        },
      });

      await this.writeStatusHistoryTx(tx, {
        ticketId: ticket.id,
        fromStatus: null,
        toStatus: TicketStatus.NEW,
        changedByUserId: null,
        comment: 'Public quick request created',
      });

      const boundAttachments = await this.attachments.bindAttachmentsToTicketTx(tx, {
        companyId: companyId,
        ticketId: ticket.id,
        attachmentIds: input.attachmentIds ?? [],
      });

      const createdEvent = await this.timelineService.recordTx(tx, {
        event: 'TICKET_CREATED',
        companyId: companyId,
        ticketId: ticket.id,
        actorUserId: null,
        payload: {
          source: TicketSource.PUBLIC_QUICK_REQUEST,
          publicRequestType: input.publicRequestType,
          locationId: location.id,
          equipmentId: equipment?.id ?? null,
          requesterPhone: input.requesterPhone ?? null,
          requesterName: input.requesterName ?? null,
          phoneNormalized: input.phoneNormalized ?? null,
          status: TicketStatus.NEW,
          urgency: ticket.urgency,
          autoAssigned: !!assignedTechnicianId,
          attachmentCount: boundAttachments.length,
          intake: 'public_quick_request',
          channel: input.channel ?? 'direct_link',
          presetLocation: !!input.presetLocationId,
          publicLinkVersion: input.publicLinkVersion ?? 'v2',
          ipHash: input.ipHash ?? null,
        },
      });

      let assignedEventId: string | null = null;

      if (assignedTechnicianId) {
        const wf = decideTicketTransition(TicketStatus.NEW, TicketStatus.ASSIGNED);
        if (!wf.allowed) throw new BadRequestException(wf.reason);

        ticket = await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: TicketStatus.ASSIGNED,
            statusUpdatedAt: new Date(),
            assignedTechnicianId,
          },
        });

        await this.writeStatusHistoryTx(tx, {
          ticketId: ticket.id,
          fromStatus: TicketStatus.NEW,
          toStatus: TicketStatus.ASSIGNED,
          changedByUserId: null,
          comment: 'Auto assigned',
        });

        await this.recordAssignmentHistoryTx(tx, {
          companyId,
          ticketId: ticket.id,
          actorUserId: null,
          previousAssignedTechnicianId: null,
          assignedTechnicianId,
          operationType: 'auto_assignment',
          mode: 'auto',
          reason: 'assignment_engine_v1',
        });

        const assignedEvent = await this.timelineService.recordTx(tx, {
          event: 'TICKET_ASSIGNED',
          companyId: companyId,
          ticketId: ticket.id,
          actorUserId: null,
          payload: {
            assignedTechnicianId,
            mode: 'auto',
            strategy: 'contextual_v1',
            reason: 'assignment_engine_v1',
            source: TicketSource.PUBLIC_QUICK_REQUEST,
          },
        });
        assignedEventId = assignedEvent.id;
      }

      return { ticket, assignedTechnicianId, createdEventId: createdEvent.id, assignedEventId };
    });

    this.notifications.onTicketCreated({
      actorCompanyId: companyId,
      creatorUserId: null,
      targetCompanyId: companyId,
      locationId: location.id,
      locationName: location.name,
      locationAddress: location.address,
      categoryName: category.name,
      urgency: input.urgency ?? TicketUrgency.NOT_URGENT,
      requesterName: input.requesterName ?? null,
      requesterPhone: input.requesterPhone ?? null,
      description: input.description?.trim() || null,
      ticketId: created.ticket.id,
      ticketNumber: created.ticket.ticketNumber,
      summary: (created.ticket.problemText || '').trim() || `Заявка #${created.ticket.ticketNumber}`,
      assignedTechnicianId: created.assignedTechnicianId,
      sourceEventId: created.createdEventId,
    });

    if (created.assignedTechnicianId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: created.assignedTechnicianId },
        select: { companyId: true, email: true },
      });
      if (assignee && assignee.companyId !== created.ticket.companyId) {
        this.notifications.onTicketAssigned({
          ticketCompanyId: created.ticket.companyId,
          assigneeUserId: created.assignedTechnicianId,
          assigneeEmail: (assignee.email || '').trim(),
          actorUserId: null,
          ticketId: created.ticket.id,
          ticketNumber: created.ticket.ticketNumber,
          summary: (created.ticket.problemText || '').trim() || `Заявка #${created.ticket.ticketNumber}`,
          sourceEventId: created.assignedEventId || created.createdEventId,
        });
      }
    }

    return {
      ticket: created.ticket,
      autoAssigned: !!created.assignedTechnicianId,
    };
  }
}
