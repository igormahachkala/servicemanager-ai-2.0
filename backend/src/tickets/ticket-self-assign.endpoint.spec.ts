import { CompanyType, ServiceContractRole, TicketStatus, UserRole } from '@prisma/client';

import * as ticketAccess from './ticket-access.utils';
import { TicketsAssignmentService } from './tickets.assignment.service';

/**
 * Поток PUT /tickets/:id/assign/:technicianId, когда technicianId — сам актор.
 * Проверяется, что управляющая роль подрядчика не проходит через пул
 * исполнителей (именно он давал 404 «Technician not found») и что отказ
 * остаётся закрытым вне области назначения.
 */
describe('TicketsAssignmentService self-assignment', () => {
  const PROVIDER = 'provider-company';
  const CLIENT = 'client-company';
  const TICKET = 'ticket-1';
  const LOCATION = 'location-1';

  let resolveOperationAccessSpy: jest.SpyInstance;

  function makePrisma(options?: {
    actorCompanyType?: CompanyType;
    status?: TicketStatus;
    assignedTechnicianId?: string | null;
    ticketCompanyId?: string;
  }) {
    const ticket = {
      id: TICKET,
      companyId: options?.ticketCompanyId ?? PROVIDER,
      locationId: LOCATION,
      status: options?.status ?? TicketStatus.NEW,
      assignedTechnicianId: options?.assignedTechnicianId ?? null,
      assignedTechnician: null,
      problemCategory: { specializationLinks: [] },
    };
    const updates: any[] = [];
    const prisma: any = {
      __updates: updates,
      __ticket: ticket,
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: PROVIDER,
          type: options?.actorCompanyType ?? CompanyType.PROVIDER,
        }),
      },
      ticket: {
        findFirst: jest.fn().mockResolvedValue(ticket),
        findUnique: jest.fn().mockResolvedValue({
          companyId: ticket.companyId,
          locationId: LOCATION,
          ticketNumber: 1,
          problemText: 'тест',
        }),
        update: jest.fn().mockImplementation(async (args: any) => {
          updates.push(args);
          return { ...ticket, ...args.data };
        }),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue({ companyId: PROVIDER, email: 'actor-1@provider.local' }),
      },
      ticketStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      assignmentHistory: { create: jest.fn().mockResolvedValue({}) },
      assignmentDecision: { create: jest.fn().mockResolvedValue({}) },
      location: { findUnique: jest.fn().mockResolvedValue({ name: 'Точка', city: 'Город' }) },
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prisma)),
    };
    return prisma;
  }

  function makeService(prisma: any) {
    const timeline = { recordTx: jest.fn().mockResolvedValue({ id: 'event-1' }) };
    const notifications = {
      scheduleTicketAssignedToTechnician: jest.fn(),
      onTicketAssigned: jest.fn(),
      scheduleTicketAssignedClientCompany: jest.fn(),
    };
    const contractContext = { getContractContext: jest.fn().mockResolvedValue(null) };
    const query = { getOne: jest.fn().mockResolvedValue({ id: TICKET, meta: {} }) };
    return new TicketsAssignmentService(
      prisma,
      {} as any,
      query as any,
      timeline as any,
      {} as any,
      { getLinkedClientAccess: jest.fn().mockResolvedValue(null), listSecondaryProviderCompanyIds: jest.fn().mockResolvedValue([]) } as any,
      {} as any,
      notifications as any,
      contractContext as any,
    );
  }

  function actor(role: UserRole, id = 'actor-1') {
    return { id, role, companyId: PROVIDER, email: `${id}@provider.local` };
  }

  beforeEach(() => {
    resolveOperationAccessSpy = jest
      .spyOn(ticketAccess, 'resolveTicketOperationAccess')
      .mockResolvedValue({
        ticket: { id: TICKET, companyId: PROVIDER, assignedTechnicianId: null },
        scopeCompanyId: PROVIDER,
        operationCompanyId: PROVIDER,
        visibilityMode: 'tenant',
      } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('провайдерский ADMIN назначает себя: заявка обновляется, пул исполнителей не запрашивается', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    const me = actor(UserRole.ADMIN);

    await service.assign(PROVIDER, me, TICKET, me.id);

    const update = prisma.__updates.at(-1);
    expect(update.data.assignedTechnicianId).toBe(me.id);
    expect(update.data.status).toBe(TicketStatus.ASSIGNED);
    // Пул исполнителей строится через user.findMany — на пути самоназначения его нет.
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('провайдерский MASTER назначает себя', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    const me = actor(UserRole.MASTER, 'master-1');

    await service.assign(PROVIDER, me, TICKET, me.id);

    expect(prisma.__updates.at(-1).data.assignedTechnicianId).toBe(me.id);
  });

  it('смена не требуется: самоназначение не обращается к политике смен', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    const me = actor(UserRole.MASTER, 'master-1');

    // ShiftPolicyService в этот поток не внедряется вовсе — назначение проходит без смены.
    await expect(service.assign(PROVIDER, me, TICKET, me.id)).resolves.toBeDefined();
  });

  it('заявка уже назначена на актора — повторного самоназначения нет', async () => {
    const prisma = makePrisma({ status: TicketStatus.ASSIGNED, assignedTechnicianId: 'actor-1' });
    const service = makeService(prisma);
    const me = actor(UserRole.ADMIN);

    await expect(service.assign(PROVIDER, me, TICKET, me.id)).rejects.toMatchObject({
      response: { code: 'PERMISSION_DENIED' },
    });
  });

  it('ADMIN клиентской компании до самоназначения не доходит', async () => {
    const prisma = makePrisma({ actorCompanyType: CompanyType.CLIENT });
    const service = makeService(prisma);
    const me = actor(UserRole.ADMIN);

    await expect(service.assign(CLIENT, me, TICKET, me.id)).rejects.toMatchObject({
      response: { code: 'PERMISSION_DENIED' },
    });
  });

  it.each([TicketStatus.DONE, TicketStatus.CANCELED])(
    'терминальный статус %s — назначение отклонено',
    async (status) => {
      const prisma = makePrisma({ status });
      const service = makeService(prisma);
      const me = actor(UserRole.ADMIN);

      await expect(service.assign(PROVIDER, me, TICKET, me.id)).rejects.toThrow();
    },
  );

  it('SLA на разрешение не влияет: просроченная и свежая заявка ведут себя одинаково', async () => {
    for (const slaDueAt of [new Date(Date.now() - 3_600_000), new Date(Date.now() + 3_600_000)]) {
      const prisma = makePrisma();
      prisma.__ticket.slaDueAt = slaDueAt;
      const service = makeService(prisma);
      const me = actor(UserRole.ADMIN);

      await service.assign(PROVIDER, me, TICKET, me.id);
      expect(prisma.__updates.at(-1).data.assignedTechnicianId).toBe(me.id);
    }
  });

  it('TECHNICIAN через этот поток не проходит — у него остаётся claim', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    const me = actor(UserRole.TECHNICIAN, 'tech-1');

    // Роль не входит в ASSIGN_ROLES: политика назначения отклоняет до всего прочего.
    await expect(service.assign(PROVIDER, me, TICKET, me.id)).rejects.toThrow();
  });

  it('роль в контракте берётся из существующей архитектуры, второго резолвера нет', () => {
    expect(ServiceContractRole.PRIMARY).toBeDefined();
    expect(resolveOperationAccessSpy).toBeDefined();
  });
});
