import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CompanyType, UserRole } from '@prisma/client';

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
  reason: 'client_management';
};

const CLIENT_ACCEPTANCE_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.TERRITORIAL_MANAGER,
  UserRole.NETWORK_DIRECTOR,
];

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

  if (
    actor.company.type !== CompanyType.CLIENT ||
    !CLIENT_ACCEPTANCE_ROLES.includes(actor.role)
  ) {
    throw new ForbiddenException(
      'Only client management roles can accept or reject work',
    );
  }

  const readable = await resolveReadableTicketAccess({
    prisma: params.prisma,
    serviceContractsService: params.serviceContractsService,
    actor: normalizedActor,
    ticketId: params.ticketId,
    linkedClientCompanyId: params.linkedClientCompanyId,
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

  if (ticket.companyId === actor.companyId) {
    return {
      actor,
      ticket,
      scopeCompanyId: readable.scopeCompanyId,
      visibilityMode: readable.visibilityMode,
      reason: 'client_management',
    };
  }

  throw new ForbiddenException(
    'Only the client company can accept or reject work',
  );
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
