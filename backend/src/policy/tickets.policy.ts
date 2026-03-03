import { Prisma, TicketStatus, UserRole } from '@prisma/client';
import { allow, deny, PolicyDecision } from './policy.types';

export type UserCtx = {
  id: string;
  role: UserRole;
  companyId: string;
};

const ASSIGN_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER];
const MANAGEMENT_STATUS_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MASTER,
  UserRole.DISPATCHER,
  UserRole.NETWORK_DIRECTOR,
];

export class TicketsPolicy {
  /**
   * READ SCOPE
   * Официальное решение: TECHNICIAN может читать любые тикеты в рамках company.
   * Поэтому scope для list/get — одинаковый по companyId.
   */
  listWhere(user: UserCtx, status?: TicketStatus): PolicyDecision<Prisma.TicketWhereInput> {
    return allow({
      companyId: user.companyId,
      status: status ?? undefined,
    });
  }

  getOneWhere(user: UserCtx, ticketId: string): PolicyDecision<Prisma.TicketWhereInput> {
    return allow({
      id: ticketId,
      companyId: user.companyId,
    });
  }

  /**
   * WRITE RULES
   */
  canAssign(user: UserCtx): PolicyDecision {
    if (ASSIGN_ROLES.includes(user.role)) return allow();
    return deny('Role cannot assign tickets');
  }

  /**
   * Claim строго scoped:
   * - только TECHNICIAN
   * - ticket: NEW + unassigned
   * - specialization match (через problemCategory.specializationLinks)
   *
   * Возвращаем where для atomic updateMany.
   */
  claimWhere(params: {
    user: UserCtx;
    ticketId: string;
    specializationIds: string[];
  }): PolicyDecision<Prisma.TicketWhereInput> {
    const { user, ticketId, specializationIds } = params;

    if (user.role !== UserRole.TECHNICIAN) return deny('Only TECHNICIAN can claim tickets');
    if (!specializationIds || specializationIds.length === 0) return deny('Technician has no specializations');

    return allow({
      id: ticketId,
      companyId: user.companyId,
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
      problemCategory: {
        specializationLinks: {
          some: { specializationId: { in: specializationIds } },
        },
      },
    });
  }

  canChangeStatus(params: {
    user: UserCtx;
    ticket: { companyId: string; assignedTechnicianId: string | null };
  }): PolicyDecision {
    const { user, ticket } = params;

    if (ticket.companyId !== user.companyId) return deny('Cross-company access');

    // TECHNICIAN — строго только assigned-to-self
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
