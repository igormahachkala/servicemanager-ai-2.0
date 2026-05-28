import { TicketStatus, UserRole } from '@prisma/client';
import { TicketsPolicy } from './tickets.policy';

describe('TicketsPolicy — executor-capability model', () => {
  const policy = new TicketsPolicy();

  // ── claimWhere ───────────────────────────────────────────────────────────

  describe('claimWhere', () => {
    const baseParams = {
      ticketId: 'ticket-1',
      specializationIds: [],
      specializationNames: [],
      allowTechnicianClaim: true,
      companyIds: ['company-1'],
    };

    it('TECHNICIAN with isExecutor=true is allowed', () => {
      const result = policy.claimWhere({
        ...baseParams,
        user: { id: 'user-1', role: UserRole.TECHNICIAN, isExecutor: true, companyId: 'company-1' },
      });
      expect(result.allowed).toBe(true);
    });

    it('TECHNICIAN with isExecutor=false is denied', () => {
      const result = policy.claimWhere({
        ...baseParams,
        user: { id: 'user-1', role: UserRole.TECHNICIAN, isExecutor: false, companyId: 'company-1' },
      });
      expect(result.allowed).toBe(false);
    });

    it('ADMIN with isExecutor=true is allowed', () => {
      const result = policy.claimWhere({
        ...baseParams,
        user: { id: 'user-1', role: UserRole.ADMIN, isExecutor: true, companyId: 'company-1' },
      });
      expect(result.allowed).toBe(true);
    });

    it('ADMIN with isExecutor=false is denied', () => {
      const result = policy.claimWhere({
        ...baseParams,
        user: { id: 'user-1', role: UserRole.ADMIN, isExecutor: false, companyId: 'company-1' },
      });
      expect(result.allowed).toBe(false);
    });

    it('CLIENT with isExecutor=true is still denied (role gate)', () => {
      const result = policy.claimWhere({
        ...baseParams,
        user: { id: 'user-1', role: UserRole.CLIENT, isExecutor: true, companyId: 'company-1' },
      });
      expect(result.allowed).toBe(false);
    });

    it('NETWORK_DIRECTOR with isExecutor=true is still denied', () => {
      const result = policy.claimWhere({
        ...baseParams,
        user: { id: 'user-1', role: UserRole.NETWORK_DIRECTOR, isExecutor: true, companyId: 'company-1' },
      });
      expect(result.allowed).toBe(false);
    });

    it('DISPATCHER with isExecutor=true is allowed', () => {
      const result = policy.claimWhere({
        ...baseParams,
        user: { id: 'user-1', role: UserRole.DISPATCHER, isExecutor: true, companyId: 'company-1' },
      });
      expect(result.allowed).toBe(true);
    });

    it('MASTER with isExecutor=true is allowed', () => {
      const result = policy.claimWhere({
        ...baseParams,
        user: { id: 'user-1', role: UserRole.MASTER, isExecutor: true, companyId: 'company-1' },
      });
      expect(result.allowed).toBe(true);
    });

    it('MASTER with isExecutor=false is denied', () => {
      const result = policy.claimWhere({
        ...baseParams,
        user: { id: 'user-1', role: UserRole.MASTER, isExecutor: false, companyId: 'company-1' },
      });
      expect(result.allowed).toBe(false);
    });

    it('DISPATCHER with isExecutor=false is denied', () => {
      const result = policy.claimWhere({
        ...baseParams,
        user: { id: 'user-1', role: UserRole.DISPATCHER, isExecutor: false, companyId: 'company-1' },
      });
      expect(result.allowed).toBe(false);
    });

    it('executor with claim disabled is denied', () => {
      const result = policy.claimWhere({
        ...baseParams,
        allowTechnicianClaim: false,
        user: { id: 'user-1', role: UserRole.TECHNICIAN, isExecutor: true, companyId: 'company-1' },
      });
      expect(result.allowed).toBe(false);
    });
  });

  // ── canChangeStatus ──────────────────────────────────────────────────────

  describe('canChangeStatus', () => {
    const ticket = { companyId: 'company-1', assignedTechnicianId: 'user-1' };

    it('TECHNICIAN (isExecutor=true) on own ticket: allowed', () => {
      expect(policy.canChangeStatus({
        user: { id: 'user-1', role: UserRole.TECHNICIAN, isExecutor: true, companyId: 'company-1' },
        ticket,
      }).allowed).toBe(true);
    });

    it('TECHNICIAN (isExecutor=true) on someone else ticket: denied', () => {
      expect(policy.canChangeStatus({
        user: { id: 'user-2', role: UserRole.TECHNICIAN, isExecutor: true, companyId: 'company-1' },
        ticket,
      }).allowed).toBe(false);
    });

    it('TECHNICIAN (isExecutor=false) is denied even on own ticket', () => {
      expect(policy.canChangeStatus({
        user: { id: 'user-1', role: UserRole.TECHNICIAN, isExecutor: false, companyId: 'company-1' },
        ticket,
      }).allowed).toBe(false);
    });

    it('ADMIN (isExecutor=false) gets full management access', () => {
      expect(policy.canChangeStatus({
        user: { id: 'user-2', role: UserRole.ADMIN, isExecutor: false, companyId: 'company-1' },
        ticket,
      }).allowed).toBe(true);
    });

    it('ADMIN (isExecutor=true) gets full management access on any ticket', () => {
      expect(policy.canChangeStatus({
        user: { id: 'user-2', role: UserRole.ADMIN, isExecutor: true, companyId: 'company-1' },
        ticket,
      }).allowed).toBe(true);
    });

    it('MASTER (isExecutor=true) gets full management access on any ticket', () => {
      expect(policy.canChangeStatus({
        user: { id: 'user-2', role: UserRole.MASTER, isExecutor: true, companyId: 'company-1' },
        ticket,
      }).allowed).toBe(true);
    });

    it('DISPATCHER (isExecutor=true) gets full management access on any ticket', () => {
      expect(policy.canChangeStatus({
        user: { id: 'user-2', role: UserRole.DISPATCHER, isExecutor: true, companyId: 'company-1' },
        ticket,
      }).allowed).toBe(true);
    });

    it('DISPATCHER gets full management access regardless of isExecutor', () => {
      expect(policy.canChangeStatus({
        user: { id: 'user-2', role: UserRole.DISPATCHER, isExecutor: false, companyId: 'company-1' },
        ticket,
      }).allowed).toBe(true);
    });

    it('CLIENT is denied', () => {
      expect(policy.canChangeStatus({
        user: { id: 'user-2', role: UserRole.CLIENT, isExecutor: true, companyId: 'company-1' },
        ticket,
      }).allowed).toBe(false);
    });

    it('cross-company is always denied', () => {
      expect(policy.canChangeStatus({
        user: { id: 'user-1', role: UserRole.ADMIN, isExecutor: true, companyId: 'company-2' },
        ticket,
      }).allowed).toBe(false);
    });
  });
});
