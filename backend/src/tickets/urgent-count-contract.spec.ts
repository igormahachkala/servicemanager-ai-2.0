import { TicketPriority, UserRole } from '@prisma/client';

import { TicketsQueryService } from './tickets.query.service';

/**
 * SMA-MOBILE-URGENT-TICKETS-CARD-V1-AUDIT-FIX-129.
 *
 * Счётчик срочных обязан приходить из базы, а не из длины отданной страницы.
 * Аудит 127 признал реализацию верной, но непокрытой: ни один тест не смотрел,
 * с чем зовётся ticket.count и откуда берётся urgentTotal. Здесь это
 * проверяется исполнением — подделка считает аргументы и возвращает число,
 * заведомо не равное длине выдачи.
 */

type CountCall = { where: any };

function makeHarness(opts: {
  countResult: number;
  rows: number;
  role?: UserRole;
  serviceContracts?: Record<string, any>;
}) {
  const countCalls: CountCall[] = [];
  const findManyCalls: any[] = [];

  const tickets = Array.from({ length: opts.rows }, (_, i) => ({
    id: `t-${i}`,
    companyId: 'co-1',
    status: 'NEW',
    urgency: 'NOT_URGENT',
    priority: 'NORMAL',
    createdAt: new Date('2026-09-30T10:00:00.000Z'),
    slaDueAt: null,
    slaBreachedAt: null,
    plannedDueAt: null,
    problemText: '',
    location: { id: 'loc-1', name: 'Точка', platformCode: null, externalCode: null, city: null, address: null },
    problemCategory: { id: 'cat-1', name: 'Категория', specializationLinks: [] },
    equipment: null,
    assignedTechnician: null,
    assignedTechnicianId: null,
    createdByUser: null,
    createdByUserId: null,
    company: { id: 'co-1', name: 'Компания', type: 'CLIENT' },
    parentId: null,
    ticketNumber: i,
    requesterName: null,
    pointName: null,
    locationId: null,
    urgencyReason: null,
  }));

  const prisma = {
    ticket: {
      findMany: jest.fn(async (args: any) => {
        findManyCalls.push(args);
        return tickets;
      }),
      // Подделка повторяет семантику count: отдаёт число, а не строки,
      // и это число заведомо расходится с длиной выдачи.
      count: jest.fn(async (args: any) => {
        countCalls.push({ where: args?.where });
        return opts.countResult;
      }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    domainEvent: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findFirst: jest.fn().mockResolvedValue({ isExecutor: false }) },
    company: {
      findUnique: jest.fn().mockResolvedValue({ id: 'co-1', type: 'PROVIDER', allowTechnicianClaim: false }),
      findFirst: jest.fn().mockResolvedValue({ id: 'co-1', type: 'PROVIDER', allowTechnicianClaim: false }),
    },
    userAccessScope: { findUnique: jest.fn().mockResolvedValue(null) },
    userLocationBinding: { findMany: jest.fn().mockResolvedValue([]) },
    ticketAttachment: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
    serviceContract: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
    technicianSpecialization: { findMany: jest.fn().mockResolvedValue([]) },
    problemCategorySpecialization: { findMany: jest.fn().mockResolvedValue([]) },
    serviceContractSpecialization: { findMany: jest.fn().mockResolvedValue([]) },
    serviceContractLocation: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;

  const serviceContracts = {
    getLinkedClientAccess: jest.fn().mockResolvedValue(null),
    listSecondaryLinkedClientIds: jest.fn().mockResolvedValue([]),
    listPrimaryLinkedClientIds: jest.fn().mockResolvedValue([]),
    ...(opts.serviceContracts ?? {}),
  };

  const svc = new TicketsQueryService(
    prisma,
    {} as any,
    serviceContracts as any,
    { getContractContext: jest.fn().mockResolvedValue(null) } as any,
  );

  const run = () =>
    svc.board('co-1', 'u-1', opts.role ?? UserRole.ADMIN, {}, undefined, undefined, undefined);

  return { svc, run, countCalls, findManyCalls, prisma };
}

/** Плоский список условий ветки AND на любой глубине. */
function flattenAnd(where: any): any[] {
  if (!where || typeof where !== 'object') return [];
  const out: any[] = [where];
  const and = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
  for (const item of and) out.push(...flattenAnd(item));
  return out;
}

describe('129 urgentTotal приходит из базы', () => {
  it('1, 2, NC11. счётчик — результат count, а не длина страницы', async () => {
    const h = makeHarness({ countResult: 17, rows: 1 });

    const res: any = await h.run();

    expect(res.meta.urgentTotal).toBe(17);
    // Длина выдачи здесь равна 1 — если бы счётчик брался из неё, было бы 1.
    expect(res.meta.totalTickets).toBe(1);
    expect(res.meta.urgentTotal).not.toBe(res.meta.totalTickets);
    expect(h.prisma.ticket.count).toHaveBeenCalledTimes(1);
  });

  it('2. ноль строк на странице не обнуляет счётчик', async () => {
    const h = makeHarness({ countResult: 42, rows: 0 });

    const res: any = await h.run();

    expect(res.meta.urgentTotal).toBe(42);
    expect(res.meta.totalTickets).toBe(0);
  });

  it('4, NC13. условие счёта — priority=URGENT, а не urgency', async () => {
    const h = makeHarness({ countResult: 3, rows: 2 });

    await h.run();

    const where = h.countCalls[0].where;
    const nodes = flattenAnd(where);

    expect(nodes.some((node) => node?.priority === TicketPriority.URGENT)).toBe(true);
    expect(JSON.stringify(where)).not.toContain('urgency');
  });

  it('3, NC12. счёт идёт по тому же разрешённому where, что и выдача', async () => {
    const h = makeHarness({ countResult: 5, rows: 1 });

    await h.run();

    const listWhere = h.findManyCalls[0].where;
    const countWhere = h.countCalls[0].where;

    /*
     * Ровно тот же объект охвата стоит внутри условия счёта: счёт — это
     * выдача плюс срочность, а не отдельный запрос со своим охватом.
     */
    expect(Array.isArray(countWhere.AND)).toBe(true);
    expect(countWhere.AND[0]).toBe(listWhere);
    expect(countWhere.AND[1]).toEqual({ priority: TicketPriority.URGENT });
  });

  it('6. ограничения охвата остаются внутри условия счёта', async () => {
    /*
     * Ролевые сужения (техник, локации, контракт, SECONDARY) проверяются на
     * уровне политики в urgent-board-filter.spec.ts. Здесь важно другое и
     * более сильное: каким бы охват ни получился, счёт берёт его тот же
     * объект целиком, а не пересобирает свой. Поэтому проверяется тождество
     * ссылки, а не перечень условий — перечень не может разойтись с выдачей
     * по построению.
     */
    const h = makeHarness({ countResult: 9, rows: 1 });

    await h.run();

    const listWhere = h.findManyCalls[0].where;
    const countWhere = h.countCalls[0].where;

    expect(countWhere.AND[0]).toBe(listWhere);
    expect(JSON.stringify(countWhere)).toContain('co-1');
    expect(JSON.stringify(countWhere)).toContain('URGENT');
  });

  it('6. SECONDARY-ограничение не теряется в счёте', async () => {
    const h = makeHarness({
      countResult: 4,
      rows: 1,
      serviceContracts: {
        getLinkedClientAccess: jest.fn().mockResolvedValue({ role: 'SECONDARY' }),
        listSecondaryLinkedClientIds: jest.fn().mockResolvedValue(['client-9']),
      },
    });

    await h.run();

    const listWhere = h.findManyCalls[0].where;
    const countWhere = h.countCalls[0].where;

    // Каким бы ни было сужение выдачи, счёт наследует его целиком.
    expect(countWhere.AND[0]).toBe(listWhere);
  });

  it('5. urgency=URGENT не подменяет priority=URGENT', async () => {
    const h = makeHarness({ countResult: 1, rows: 1 });

    await h.run();

    const nodes = flattenAnd(h.countCalls[0].where);
    expect(nodes.some((node) => node?.urgency)).toBe(false);
    expect(nodes.some((node) => node?.priority === TicketPriority.URGENT)).toBe(true);
  });
});
