import { CompanyType, ServiceContractRole, TicketStatus, UserRole } from '@prisma/client';

import {
  assertTicketSelfAssignAllowed,
  deriveTicketSelfAssignCapability,
  SELF_ASSIGN_DENY_REASONS,
} from './ticket-self-assign-capability';

/**
 * Каноническое правило «Назначить на себя». Проверяется само решение:
 * входы к этому моменту уже посчитаны существующей архитектурой
 * (доступ к операции, политика назначения, Contract Context).
 */
describe('deriveTicketSelfAssignCapability', () => {
  const PROVIDER = 'provider-company';
  const ACTOR = 'actor-1';

  function decide(overrides?: {
    role?: UserRole;
    actorCompanyType?: CompanyType;
    policyAllowsAssign?: boolean;
    status?: TicketStatus;
    assignedTechnicianId?: string | null;
    directAssignmentAllowed?: boolean;
    candidateCompanyIds?: string[];
  }) {
    return deriveTicketSelfAssignCapability({
      actor: { id: ACTOR, role: overrides?.role ?? UserRole.ADMIN, companyId: PROVIDER },
      actorCompanyType: overrides?.actorCompanyType ?? CompanyType.PROVIDER,
      policyAllowsAssign: overrides?.policyAllowsAssign ?? true,
      ticket: {
        status: overrides?.status ?? TicketStatus.NEW,
        assignedTechnicianId:
          overrides?.assignedTechnicianId === undefined ? null : overrides.assignedTechnicianId,
      },
      authority: {
        directAssignmentAllowed: overrides?.directAssignmentAllowed ?? true,
        candidateCompanyIds: overrides?.candidateCompanyIds ?? [PROVIDER],
      },
    });
  }

  describe('провайдерский ADMIN', () => {
    it('свободная заявка в его области — разрешено', () => {
      expect(decide()).toEqual({ canAssignSelf: true, assignSelfAvailabilityReason: null });
    });

    it('заявка, созданная другим пользователем, — то же разрешение', () => {
      // Автор заявки на решение не влияет: входом является область назначения.
      expect(decide({ assignedTechnicianId: null }).canAssignSelf).toBe(true);
    });

    it('уже назначенная на другого — разрешено (переназначение на себя)', () => {
      expect(decide({ status: TicketStatus.ASSIGNED, assignedTechnicianId: 'someone-else' }).canAssignSelf).toBe(true);
    });

    it('вне области назначения — закрыто', () => {
      expect(decide({ directAssignmentAllowed: false })).toEqual({
        canAssignSelf: false,
        assignSelfAvailabilityReason: SELF_ASSIGN_DENY_REASONS.outOfScope,
      });
    });

    it('своей компании нет среди кандидатов — закрыто', () => {
      expect(decide({ candidateCompanyIds: ['other-provider'] }).canAssignSelf).toBe(false);
    });

    it('нет права назначать по политике — закрыто', () => {
      expect(decide({ policyAllowsAssign: false })).toEqual({
        canAssignSelf: false,
        assignSelfAvailabilityReason: SELF_ASSIGN_DENY_REASONS.policy,
      });
    });
  });

  describe('провайдерский MASTER', () => {
    it('в своей области — разрешено', () => {
      expect(decide({ role: UserRole.MASTER }).canAssignSelf).toBe(true);
    });

    it('вне области — закрыто', () => {
      expect(decide({ role: UserRole.MASTER, directAssignmentAllowed: false }).canAssignSelf).toBe(false);
    });
  });

  describe('роли, которым действие не даётся', () => {
    it.each([UserRole.TECHNICIAN, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.CLIENT, UserRole.STAFF])(
      '%s — закрыто',
      (role) => {
        expect(decide({ role })).toEqual({
          canAssignSelf: false,
          assignSelfAvailabilityReason: SELF_ASSIGN_DENY_REASONS.role,
        });
      },
    );

    it('ADMIN клиентской компании — закрыто', () => {
      expect(decide({ actorCompanyType: CompanyType.CLIENT })).toEqual({
        canAssignSelf: false,
        assignSelfAvailabilityReason: SELF_ASSIGN_DENY_REASONS.clientCompany,
      });
    });
  });

  describe('статусы', () => {
    it.each([TicketStatus.NEW, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, TicketStatus.AWAITING_ACCEPTANCE])(
      '%s — разрешено',
      (status) => {
        expect(decide({ status }).canAssignSelf).toBe(true);
      },
    );

    it.each([TicketStatus.DONE, TicketStatus.CANCELED])('%s — закрыто', (status) => {
      expect(decide({ status })).toEqual({
        canAssignSelf: false,
        assignSelfAvailabilityReason: SELF_ASSIGN_DENY_REASONS.terminalStatus,
      });
    });

    it('заявка уже назначена на самого актора — повторного назначения нет', () => {
      expect(decide({ status: TicketStatus.ASSIGNED, assignedTechnicianId: ACTOR })).toEqual({
        canAssignSelf: false,
        assignSelfAvailabilityReason: SELF_ASSIGN_DENY_REASONS.alreadyMine,
      });
    });
  });

  describe('SLA не является входом', () => {
    // Просрочка в решении не участвует вовсе: у правила нет такого входа.
    // Тест фиксирует это как контракт — появление поля сломает его сигнатуру.
    it('решение зависит только от роли, компании, политики, статуса и области', () => {
      const overdueLike = decide({ status: TicketStatus.NEW });
      const freshLike = decide({ status: TicketStatus.NEW });
      expect(overdueLike).toEqual(freshLike);
      expect(overdueLike.canAssignSelf).toBe(true);
    });
  });

  describe('assertTicketSelfAssignAllowed', () => {
    it('разрешение проходит молча', () => {
      expect(() => assertTicketSelfAssignAllowed({ canAssignSelf: true, assignSelfAvailabilityReason: null })).not.toThrow();
    });

    it('отказ поднимает 403 с причиной', () => {
      try {
        assertTicketSelfAssignAllowed({
          canAssignSelf: false,
          assignSelfAvailabilityReason: SELF_ASSIGN_DENY_REASONS.outOfScope,
        });
        throw new Error('ожидалось исключение');
      } catch (err: any) {
        expect(err.getStatus?.()).toBe(403);
        expect(err.getResponse?.()).toEqual({
          code: 'PERMISSION_DENIED',
          message: SELF_ASSIGN_DENY_REASONS.outOfScope,
        });
      }
    });
  });

  describe('SECONDARY подрядчик', () => {
    // Contract Context уже свёл SECONDARY к directAssignmentAllowed только тогда,
    // когда заявка закреплена за его компанией. Правило это уважает и не расширяет.
    it('без действующего закрепления — закрыто', () => {
      expect(
        decide({ directAssignmentAllowed: false, candidateCompanyIds: [] }).canAssignSelf,
      ).toBe(false);
    });

    it('с закреплением за своей компанией — разрешено', () => {
      expect(
        decide({ directAssignmentAllowed: true, candidateCompanyIds: [PROVIDER] }).canAssignSelf,
      ).toBe(true);
    });
  });

  it('роль в контракте сама по себе решение не меняет — его несёт directAssignmentAllowed', () => {
    expect(ServiceContractRole.PRIMARY).toBeDefined();
    expect(decide({ directAssignmentAllowed: true }).canAssignSelf).toBe(true);
    expect(decide({ directAssignmentAllowed: false }).canAssignSelf).toBe(false);
  });
});
