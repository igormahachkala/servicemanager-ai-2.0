import { TicketStatus, UserRole } from '@prisma/client';
import { Prisma } from '@prisma/client';
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

const EDIT_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER];

export class TicketsPolicy {
  /**
   * Scope для списка и чтения: везде companyId — инвариант.
   * IMPORTANT: TECHNICIAN может читать любые тикеты внутри company (официальное решение).
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
   * Write scoped rules
   */

  canAssign(user: UserCtx): PolicyDecision {
    if (ASSIGN_ROLES.includes(user.role)) return allow();
    return deny('Role cannot assign tickets');
  }

  canClaim(params: {
    user: UserCtx;
    ticket: { companyId: string; status: TicketStatus; assignedTechnicianId: string | null };
  }): PolicyDecision {
    const { user, ticket } = params;

    if (user.role !== UserRole.TECHNICIAN) return deny('Only TECHNICIAN can claim');
    if (ticket.companyId !== user.companyId) return deny('Cross-company access');
    if (ticket.status !== TicketStatus.NEW) return deny('Only NEW tickets can be claimed');
    if (ticket.assignedTechnicianId !== null) return deny('Ticket already assigned');

    return allow();
  }

  canChangeStatus(params: {
    user: UserCtx;
    ticket: { companyId: string; assignedTechnicianId: string | null; status: TicketStatus };
    nextStatus: TicketStatus;
  }): PolicyDecision {
    const { user, ticket } = params;

    if (ticket.companyId !== user.companyId) return deny('Cross-company access');

    // TECHNICIAN: строго только свои (assigned to self)
    if (user.role === UserRole.TECHNICIAN) {
      if (ticket.assignedTechnicianId !== user.id) {
        return deny('Technician can change status only for own assigned tickets');
      }
      return allow();
    }

    // Управленческие роли — можно
    if (MANAGEMENT_STATUS_ROLES.includes(user.role)) return allow();

    return deny('Role cannot change ticket status');
  }

  canEdit(user: UserCtx): PolicyDecision {
    if (EDIT_ROLES.includes(user.role)) return allow();
    return deny('Role cannot edit ticket');
  }
}
