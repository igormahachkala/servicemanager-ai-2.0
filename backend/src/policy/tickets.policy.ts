import { Prisma, TicketStatus, UserRole } from '@prisma/client';

import { buildSpecializationLinksSomeWhereInput } from '../tickets/ticket-specialization-match.utils'
import { allow, deny, PolicyDecision } from './policy.types';

export type UserCtx = {
  id: string;
  role: UserRole;
  companyId: string;

  accessFlags?: {
    canTechnicianViewAllCompanyTickets?: boolean;
  };
};

const ASSIGN_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MASTER,
  UserRole.DISPATCHER,
  UserRole.NETWORK_DIRECTOR,
  UserRole.TERRITORIAL_MANAGER,
  UserRole.STAFF,
];

const MANAGEMENT_STATUS_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MASTER,
  UserRole.DISPATCHER,
  UserRole.NETWORK_DIRECTOR,
  UserRole.STAFF,
];

export type SlaBucket = 'ok' | 'atRisk' | 'breached';

export type BoardQueryInput = {
  statuses?: TicketStatus[];
  assigneeId?: string | null;
  sla?: SlaBucket;
  q?: string;
  take?: number;
  locationId?: string;
  equipmentId?: string;
};

export type BoardQuery = {
  where: Prisma.TicketWhereInput;
  take: number;
  meta: {
    atRiskThresholdMinutes: number;
    limitedToLast: number;
  };
};

/** Вход claimWhere: id + имена специализаций техника (кросс-тенантный матч с категорией заявки). */
export type TicketsClaimWhereParams = {
  user: { id: string; role: UserRole; companyId: string };
  ticketId: string;
  specializationIds: string[];
  specializationNames?: string[];
  allowTechnicianClaim: boolean;
  companyIds?: string[];
};

function normalizeAnd(where: Prisma.TicketWhereInput, extra: Prisma.TicketWhereInput[]): Prisma.TicketWhereInput {
  const base = where.AND;
  const baseArr: Prisma.TicketWhereInput[] = Array.isArray(base) ? base : base ? [base] : [];
  return { ...where, AND: [...baseArr, ...extra] };
}

function baseReadScope(user: UserCtx): Prisma.TicketWhereInput {
  if (user.role === UserRole.CLIENT || user.role === UserRole.TERRITORIAL_MANAGER) {
    return { companyId: user.companyId };
  }

  if (user.role !== UserRole.TECHNICIAN) {
    return { companyId: user.companyId };
  }

  const canSeeAll = !!user.accessFlags?.canTechnicianViewAllCompanyTickets;
  if (canSeeAll) return { companyId: user.companyId };

  return {
    companyId: user.companyId,
    assignedTechnicianId: user.id,
  };
}

export class TicketsPolicy {
  listWhere(user: UserCtx, status?: TicketStatus): PolicyDecision<Prisma.TicketWhereInput> {
    const scope = baseReadScope(user);
    return allow({
      ...scope,
      status: status ?? undefined,
    });
  }

  getOneWhere(user: UserCtx, ticketId: string): PolicyDecision<Prisma.TicketWhereInput> {
    const scope = baseReadScope(user);
    return allow({
      ...scope,
      id: ticketId,
    });
  }

  boardWhere(user: UserCtx, input: BoardQueryInput): PolicyDecision<BoardQuery> {
    const atRiskThresholdMinutes = 60;
    const limitedToLast = Math.min(Math.max(input.take ?? 500, 1), 500);

    let where: Prisma.TicketWhereInput =
      user.role === UserRole.CLIENT
        ? { companyId: user.companyId }
        : baseReadScope(user);

    const extraAnd: Prisma.TicketWhereInput[] = [];

    if (input.statuses && input.statuses.length > 0) {
      extraAnd.push({ status: { in: input.statuses } });
    }

    if (typeof input.assigneeId === 'string' && input.assigneeId.length > 0) {
      extraAnd.push({ assignedTechnicianId: input.assigneeId });
    } else if (input.assigneeId === null) {
      extraAnd.push({ assignedTechnicianId: null });
    }

    if (input.q && input.q.trim().length > 0) {
      const q = input.q.trim();
      extraAnd.push({
        OR: [
          { problemText: { contains: q, mode: 'insensitive' } },
          { problemCategory: { name: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }

    if (input.locationId && input.locationId.trim().length > 0) {
      extraAnd.push({ locationId: input.locationId.trim() });
    }

    if (input.equipmentId && input.equipmentId.trim().length > 0) {
      extraAnd.push({ equipmentId: input.equipmentId.trim() });
    }

    const now = new Date();
    const threshold = new Date(now.getTime() + atRiskThresholdMinutes * 60_000);

    if (input.sla === 'breached') {
      extraAnd.push({
        OR: [{ slaBreachedAt: { not: null } }, { slaDueAt: { lt: now } }],
      });
    }

    if (input.sla === 'atRisk') {
      extraAnd.push({
        AND: [
          { slaBreachedAt: null },
          { slaDueAt: { not: null } },
          { slaDueAt: { gte: now } },
          { slaDueAt: { lte: threshold } },
        ],
      });
    }

    if (input.sla === 'ok') {
      extraAnd.push({
        AND: [
          { OR: [{ slaDueAt: null }, { slaDueAt: { gt: threshold } }] },
          { slaBreachedAt: null },
          { OR: [{ slaDueAt: null }, { slaDueAt: { gte: now } }] },
        ],
      });
    }

    if (extraAnd.length > 0) {
      where = normalizeAnd(where, extraAnd);
    }

    return allow({
      where,
      take: limitedToLast,
      meta: { atRiskThresholdMinutes, limitedToLast },
    });
  }

  canAssign(user: { id: string; role: UserRole; companyId: string }): PolicyDecision {
    if (ASSIGN_ROLES.includes(user.role)) return allow();
    return deny('Role cannot assign tickets');
  }

  claimWhere(params: TicketsClaimWhereParams): PolicyDecision<Prisma.TicketWhereInput> {
    const { user, ticketId, specializationIds, specializationNames, allowTechnicianClaim, companyIds } = params;

    if (user.role !== UserRole.TECHNICIAN) return deny('Only TECHNICIAN can claim tickets');
    if (!allowTechnicianClaim) {
      return deny('Technician claim is disabled for this company', 'precondition');
    }

    const effectiveCompanyIds = Array.from(new Set((companyIds ?? [user.companyId]).filter(Boolean)));
    const categoryScopeOr: Prisma.TicketWhereInput[] = [];

    const specSome = buildSpecializationLinksSomeWhereInput({
      specializationIds: specializationIds ?? [],
      specializationNames: specializationNames ?? [],
    })

    if (specSome) {
      categoryScopeOr.push({
        problemCategory: {
          specializationLinks: {
            some: specSome,
          },
        },
      })
    }

    categoryScopeOr.push({
      problemCategory: {
        specializationLinks: {
          none: {},
        },
      },
    });

    return allow({
      id: ticketId,
      companyId: effectiveCompanyIds.length === 1 ? effectiveCompanyIds[0] : { in: effectiveCompanyIds },
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
      OR: categoryScopeOr,
    });
  }

  canChangeStatus(params: {
    user: { id: string; role: UserRole; companyId: string };
    ticket: { companyId: string; assignedTechnicianId: string | null };
  }): PolicyDecision {
    const { user, ticket } = params;

    if (ticket.companyId !== user.companyId) return deny('Cross-company access');

    if (user.role === UserRole.TECHNICIAN) {
      if (ticket.assignedTechnicianId !== user.id) {
        return deny('Technician can change status only for own assigned tickets');
      }
      return allow();
    }

    if (MANAGEMENT_STATUS_ROLES.includes(user.role)) return allow();

    return deny('Role cannot change ticket status');
  }
}
