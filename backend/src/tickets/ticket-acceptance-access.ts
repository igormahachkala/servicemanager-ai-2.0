import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CompanyType, ServiceContractRole, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ServiceContractsService } from '../service-contracts/service-contracts.service';
import {
  resolveReadableTicketAccess,
  type TicketVisibilityMode,
} from './ticket-access.utils';

export type TicketAcceptanceActor = {
  id: string;
  role: UserRole;
  companyId: string;
  accessFlags?: Record<string, any>;
};

type AcceptanceActorRecord = {
  id: string;
  companyId: string;
  role: UserRole;
  isActive: boolean;
  company: { id: string; type: CompanyType };
};

export type TicketAcceptanceAccess = {
  actor: AcceptanceActorRecord;
  ticket: {
    id: string;
    companyId: string;
    assignedTechnicianId: string | null;
    createdByUserId: string | null;
    assignedTechnician: { id: string; companyId: string } | null;
  };
  scopeCompanyId: string;
  visibilityMode: TicketVisibilityMode;
  reason:
    | 'client_management'
    | 'assigned_technician'
    | 'contractor_creator'
    | 'contractor_assignee_company'
    | 'contractor_linked_scope';
};

const CLIENT_ACCEPTANCE_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.TERRITORIAL_MANAGER,
  UserRole.NETWORK_DIRECTOR,
];

const CONTRACTOR_ACCEPTANCE_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MASTER,
];

function isAcceptedContractRole(role: ServiceContractRole) {
  return (
    role === ServiceContractRole.PRIMARY ||
    role === ServiceContractRole.SECONDARY
  );
}

async function loadActiveAcceptanceActor(
  prisma: PrismaService,
  actor: TicketAcceptanceActor,
): Promise<AcceptanceActorRecord> {
  const actorUser = await prisma.user.findFirst({
    where: { id: actor.id, companyId: actor.companyId },
    select: {
      id: true,
      companyId: true,
      role: true,
      isActive: true,
      company: { select: { id: true, type: true } },
    },
  });

  if (!actorUser) {
    throw new NotFoundException('User not found');
  }
  if (!actorUser.isActive) {
    throw new ForbiddenException('Inactive user cannot accept or reject work');
  }

  return actorUser;
}

export async function resolveTicketAcceptanceAccess(params: {
  prisma: PrismaService;
  serviceContractsService: ServiceContractsService;
  actor: TicketAcceptanceActor;
  ticketId: string;
  linkedClientCompanyId?: string;
}): Promise<TicketAcceptanceAccess> {
  const actor = await loadActiveAcceptanceActor(params.prisma, params.actor);
  const normalizedActor = {
    id: actor.id,
    role: actor.role,
    companyId: actor.companyId,
    accessFlags: params.actor.accessFlags,
  };

  const readable = await resolveReadableTicketAccess({
    prisma: params.prisma,
    serviceContractsService: params.serviceContractsService,
    actor: normalizedActor,
    ticketId: params.ticketId,
    linkedClientCompanyId: params.linkedClientCompanyId,
    allowedLinkedClientContractRoles: [
      ServiceContractRole.PRIMARY,
      ServiceContractRole.SECONDARY,
    ],
  });

  const ticket = await params.prisma.ticket.findFirst({
    where: { id: params.ticketId, companyId: readable.ticket.companyId },
    select: {
      id: true,
      companyId: true,
      assignedTechnicianId: true,
      createdByUserId: true,
      assignedTechnician: { select: { id: true, companyId: true } },
    },
  });

  if (!ticket) {
    throw new NotFoundException('Ticket not found');
  }

  if (
    actor.company.type === CompanyType.CLIENT &&
    CLIENT_ACCEPTANCE_ROLES.includes(actor.role) &&
    ticket.companyId === actor.companyId
  ) {
    return {
      actor,
      ticket,
      scopeCompanyId: readable.scopeCompanyId,
      visibilityMode: readable.visibilityMode,
      reason: 'client_management',
    };
  }

  if (
    actor.role === UserRole.TECHNICIAN &&
    ticket.assignedTechnicianId === actor.id
  ) {
    return {
      actor,
      ticket,
      scopeCompanyId: readable.scopeCompanyId,
      visibilityMode: readable.visibilityMode,
      reason: 'assigned_technician',
    };
  }

  if (
    actor.company.type === CompanyType.PROVIDER &&
    CONTRACTOR_ACCEPTANCE_ROLES.includes(actor.role)
  ) {
    if (ticket.createdByUserId === actor.id) {
      return {
        actor,
        ticket,
        scopeCompanyId: readable.scopeCompanyId,
        visibilityMode: readable.visibilityMode,
        reason: 'contractor_creator',
      };
    }

    if (ticket.assignedTechnician?.companyId === actor.companyId) {
      return {
        actor,
        ticket,
        scopeCompanyId: readable.scopeCompanyId,
        visibilityMode: readable.visibilityMode,
        reason: 'contractor_assignee_company',
      };
    }

    const linkedAccess =
      await params.serviceContractsService.getLinkedClientAccess(
        actor.companyId,
        ticket.companyId,
      );
    if (linkedAccess && isAcceptedContractRole(linkedAccess.role)) {
      return {
        actor,
        ticket,
        scopeCompanyId: readable.scopeCompanyId,
        visibilityMode: readable.visibilityMode,
        reason: 'contractor_linked_scope',
      };
    }
  }

  throw new ForbiddenException('Role cannot accept or reject work');
}

export async function canAcceptTicket(params: {
  prisma: PrismaService;
  serviceContractsService: ServiceContractsService;
  actor: TicketAcceptanceActor;
  ticketId: string;
  linkedClientCompanyId?: string;
}): Promise<boolean> {
  try {
    await resolveTicketAcceptanceAccess(params);
    return true;
  } catch {
    return false;
  }
}
