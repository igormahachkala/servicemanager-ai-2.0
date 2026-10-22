import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import {
  CompanyType,
  Prisma,
  PrismaClient,
  ServiceContractRole,
  ServiceContractStatus,
  TicketStatus,
  UserAccessLocationMode,
  UserRole,
} from '@prisma/client';

import { ServiceContractsService } from '../src/service-contracts/service-contracts.service';
import {
  compareLongTermKeys,
  isLongTermCandidate,
  LONG_TERM_STATUSES,
  longTermKeyOf,
} from '../src/tickets/long-term-tickets';
import {
  longTermCountSql,
  longTermPageSql,
} from '../src/tickets/long-term-tickets.sql';
import { compileWhere } from '../src/tickets/prisma-where-sql';
import { TicketsQueryService } from '../src/tickets/tickets.query.service';

/**
 * SMA-MOBILE-LONG-TERM-TICKETS на настоящей PostgreSQL.
 *
 * 1. Перевод WHERE в SQL выбирает те же строки, что Prisma, — на синтетических
 *    формах и на настоящих WHERE board для разных акторов.
 * 2. GET /tickets/long-term под каждым актором отдаёт ровно долгосрочные заявки
 *    его board (Prisma) — tenant, PRIMARY/SECONDARY, привязки, restricted-empty.
 * 3. 1000 / 10 000 / 100 000 заявок: точный total, страницы без дублей и потерь,
 *    ни одна операция не приносит в Node.js больше строк, чем страница.
 *
 * Запуск: DATABASE_URL=<тестовая БД> npx jest --config ./test/jest-e2e.json long-term
 * EXPLAIN пишется в LONG_TERM_EXPLAIN_OUT, если переменная задана.
 */

const HOUR = 60 * 60 * 1000;
const RUN = randomUUID().slice(0, 8);
const base = new PrismaClient();

/** Клиент, считающий строки каждой операции, — для «без полного набора в Node.js». */
function countingClient() {
  const ops: Array<{
    op: string;
    model?: string;
    rows: number;
    args: unknown;
  }> = [];
  const client = base.$extends({
    query: {
      async $allOperations({ operation, model, args, query }) {
        const result: unknown = await query(args);
        ops.push({
          op: operation,
          model,
          rows: Array.isArray(result) ? result.length : 1,
          args,
        });
        return result;
      },
    },
  });
  return { client, ops };
}

function serviceOn(prisma: unknown) {
  return new TicketsQueryService(
    prisma as never,
    {} as never,
    new ServiceContractsService(prisma as never),
    { getContractContext: () => Promise.resolve(null) } as never,
  );
}

type Actor = {
  label: string;
  companyId: string;
  userId: string;
  role: UserRole;
  linked?: string;
};

const createdCompanyIds: string[] = [];

async function company(name: string, type: CompanyType) {
  const row = await base.company.create({
    data: { name: `${name} ${RUN}`, type, allowTechnicianClaim: true },
  });
  createdCompanyIds.push(row.id);
  return row;
}

async function user(companyId: string, role: UserRole, isExecutor = false) {
  return base.user.create({
    data: {
      companyId,
      email: `${role.toLowerCase()}-${randomUUID()}@lt.test`,
      password: 'x',
      role,
      isExecutor,
    },
  });
}

async function location(clientCompanyId: string, name: string) {
  return base.location.create({
    data: { clientCompanyId, name, platformCode: `lt-${randomUUID()}` },
  });
}

async function category(companyId: string, name: string) {
  return base.problemCategory.create({ data: { companyId, name } });
}

async function walkLongTerm(
  svc: TicketsQueryService,
  actor: Actor,
  limit: number,
  maxPages = Number.POSITIVE_INFINITY,
) {
  const ids: string[] = [];
  const totals = new Set<number>();
  let cursor: string | null = null;
  let pages = 0;
  do {
    const page = await svc.longTermTickets(
      actor.companyId,
      actor.userId,
      actor.role,
      { limit, cursor },
      undefined,
      actor.linked,
    );
    expect(page.items.length).toBeLessThanOrEqual(limit);
    ids.push(...page.items.map((card) => card.id));
    totals.add(page.total);
    cursor = page.nextCursor;
    pages += 1;
  } while (cursor && pages < maxPages);
  return { ids, totals, pages, cursor };
}

async function boardLongTermIds(svc: TicketsQueryService, actor: Actor) {
  const board = await svc.board(
    actor.companyId,
    actor.userId,
    actor.role,
    { statuses: LONG_TERM_STATUSES, includeArchived: true, take: 500 },
    undefined,
    actor.linked,
  );
  const cards = board.columns.flatMap((column) => column.cards);
  expect(cards.length).toBeLessThan(500);
  return cards
    .map((card) => ({
      id: card.id,
      createdAt: new Date(card.createdAt as unknown as string),
      plannedDueAt: card.plannedDueAt
        ? new Date(card.plannedDueAt as unknown as string)
        : null,
    }))
    .filter(isLongTermCandidate)
    .sort((a, b) => compareLongTermKeys(longTermKeyOf(a), longTermKeyOf(b)))
    .map((row) => row.id);
}

afterAll(async () => {
  await base.ticket.deleteMany({
    where: { companyId: { in: createdCompanyIds } },
  });
  await base.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
  await base.$disconnect();
});

describe('SMA-MOBILE-LONG-TERM-TICKETS на PostgreSQL: контур и перевод WHERE', () => {
  const actors: Record<string, Actor> = {};
  const ids: Record<string, string> = {};
  let ticketCompanyIds: string[] = [];

  beforeAll(async () => {
    const clientA = await company('Client A', CompanyType.CLIENT);
    const clientB = await company('Client B', CompanyType.CLIENT);
    const primary = await company('Primary P', CompanyType.PROVIDER);
    const secondary = await company('Secondary S', CompanyType.PROVIDER);
    ticketCompanyIds = [clientA.id, clientB.id];
    ids.clientA = clientA.id;
    ids.clientB = clientB.id;

    const [a1, a2, b1] = await Promise.all([
      location(clientA.id, 'A1'),
      location(clientA.id, 'A2'),
      location(clientB.id, 'B1'),
    ]);
    const spec = await base.specialization.create({
      data: { companyId: clientA.id, name: `Холод ${RUN}` },
    });
    // Договоры с одной специализацией: без неё договорной scope пуст.
    for (const [provider, role] of [
      [primary, ServiceContractRole.PRIMARY],
      [secondary, ServiceContractRole.SECONDARY],
    ] as const) {
      await base.serviceContract.create({
        data: {
          clientCompanyId: clientA.id,
          providerCompanyId: provider.id,
          status: ServiceContractStatus.ACTIVE,
          role,
          specializationLinks: { create: [{ specializationId: spec.id }] },
        },
      });
    }
    const catSpec = await category(clientA.id, 'Холод');
    await base.problemCategorySpecialization.create({
      data: { problemCategoryId: catSpec.id, specializationId: spec.id },
    });
    const catFree = await category(clientA.id, 'Прочее');
    const catB = await category(clientB.id, 'Прочее B');

    const adminA = await user(clientA.id, UserRole.ADMIN);
    const clientAdminA = await user(clientA.id, UserRole.CLIENT_ADMIN);
    const restrictedA = await user(clientA.id, UserRole.DISPATCHER);
    await base.userAccessScope.create({
      data: {
        userId: restrictedA.id,
        companyId: clientA.id,
        locationMode: UserAccessLocationMode.RESTRICTED_EMPTY,
      },
    });
    const boundA = await user(clientA.id, UserRole.DISPATCHER);
    await base.userLocationBinding.create({
      data: { userId: boundA.id, locationId: a1.id, companyId: clientA.id },
    });
    const adminB = await user(clientB.id, UserRole.ADMIN);
    const adminP = await user(primary.id, UserRole.ADMIN);
    const techP = await user(primary.id, UserRole.TECHNICIAN, true);
    const adminS = await user(secondary.id, UserRole.ADMIN);
    const techS = await user(secondary.id, UserRole.TECHNICIAN, true);
    await base.technicianSpecialization.create({
      data: { userId: techS.id, specializationId: spec.id },
    });
    const dispatcherS = await user(secondary.id, UserRole.DISPATCHER);
    await base.userLocationBinding.create({
      data: {
        userId: dispatcherS.id,
        locationId: a2.id,
        companyId: secondary.id,
      },
    });

    Object.assign(actors, {
      adminA: {
        label: 'ADMIN клиента A',
        companyId: clientA.id,
        userId: adminA.id,
        role: UserRole.ADMIN,
      },
      clientAdminA: {
        label: 'CLIENT_ADMIN клиента A',
        companyId: clientA.id,
        userId: clientAdminA.id,
        role: UserRole.CLIENT_ADMIN,
      },
      restrictedA: {
        label: 'restricted-empty диспетчер A',
        companyId: clientA.id,
        userId: restrictedA.id,
        role: UserRole.DISPATCHER,
      },
      boundA: {
        label: 'диспетчер A с привязкой к A1',
        companyId: clientA.id,
        userId: boundA.id,
        role: UserRole.DISPATCHER,
      },
      adminB: {
        label: 'ADMIN клиента B',
        companyId: clientB.id,
        userId: adminB.id,
        role: UserRole.ADMIN,
      },
      adminP: {
        label: 'ADMIN PRIMARY-провайдера в контуре A',
        companyId: primary.id,
        userId: adminP.id,
        role: UserRole.ADMIN,
        linked: clientA.id,
      },
      techP: {
        label: 'техник PRIMARY-провайдера',
        companyId: primary.id,
        userId: techP.id,
        role: UserRole.TECHNICIAN,
      },
      adminS: {
        label: 'ADMIN SECONDARY-провайдера в контуре A',
        companyId: secondary.id,
        userId: adminS.id,
        role: UserRole.ADMIN,
        linked: clientA.id,
      },
      techS: {
        label: 'техник SECONDARY-провайдера',
        companyId: secondary.id,
        userId: techS.id,
        role: UserRole.TECHNICIAN,
      },
      foreignLinked: {
        label: 'ADMIN клиента B с чужим linked A',
        companyId: clientB.id,
        userId: adminB.id,
        role: UserRole.ADMIN,
        linked: clientA.id,
      },
    } satisfies Record<string, Actor>);
    ids.techP = techP.id;
    ids.techS = techS.id;

    // Все сочетания статуса, плановой длительности, исполнителя, объекта и
    // категории; createdAt разнесён, плановый срок местами совпадает.
    const durations: Array<number | null> = [
      null,
      24 * HOUR,
      240 * HOUR - 1,
      240 * HOUR,
      240 * HOUR + 1,
      500 * HOUR,
      -10 * HOUR,
    ];
    const assignees = [null, techP.id, techS.id, adminA.id];
    const statuses = Object.values(TicketStatus);
    const rows: Prisma.TicketCreateManyInput[] = [];
    let n = 0;
    const t0 = Date.UTC(2026, 0, 1);
    for (const status of statuses) {
      for (const duration of durations) {
        for (const assignee of assignees) {
          n += 1;
          const createdAt = new Date(t0 + (n % 37) * HOUR);
          const onB = n % 5 === 0;
          rows.push({
            companyId: onB ? clientB.id : clientA.id,
            locationId: onB ? b1.id : n % 2 ? a1.id : a2.id,
            problemCategoryId: onB ? catB.id : n % 3 ? catSpec.id : catFree.id,
            problemText: `LT_${n % 4 === 0 ? '50%_off' : 'plain'} ${n}`,
            status,
            assignedTechnicianId: onB ? null : assignee,
            createdAt,
            plannedDueAt:
              duration === null
                ? null
                : new Date(createdAt.getTime() + duration),
          });
        }
      }
    }
    await base.ticket.createMany({ data: rows });
  });

  it('под каждым актором long-term = долгосрочные заявки его board, страницы без дублей', async () => {
    const svc = serviceOn(base);
    const seen: Record<string, number> = {};
    for (const [key, actor] of Object.entries(actors)) {
      if (key === 'foreignLinked') continue;
      const expected = await boardLongTermIds(svc, actor);
      const walked = await walkLongTerm(svc, actor, 7);
      expect({ actor: actor.label, ids: walked.ids }).toEqual({
        actor: actor.label,
        ids: expected,
      });
      expect(new Set(walked.ids).size).toBe(walked.ids.length);
      expect([...walked.totals]).toEqual([expected.length]);
      const { total } = await svc.longTermTicketsTotal(
        actor.companyId,
        actor.userId,
        actor.role,
        undefined,
        actor.linked,
      );
      expect({ actor: actor.label, total }).toEqual({
        actor: actor.label,
        total: expected.length,
      });
      seen[key] = expected.length;
    }

    // Выборки не пустые там, где должны быть, и разные там, где scope разный.
    expect(seen.adminA).toBeGreaterThan(0);
    expect(seen.adminB).toBeGreaterThan(0);
    expect(seen.restrictedA).toBe(0);
    expect(seen.boundA).toBeGreaterThan(0);
    expect(seen.boundA).toBeLessThan(seen.adminA);
    expect(seen.adminS).toBeGreaterThan(0);
    expect(seen.adminS).toBeLessThan(seen.adminA);
    expect(seen.techS).toBeGreaterThan(0);
    expect(seen.adminP).toBeGreaterThan(0);
    expect(seen.techP).toBeGreaterThan(0);
  });

  it('tenant isolation: в контуре B нет заявок A, и наоборот', async () => {
    const svc = serviceOn(base);
    const aIds = new Set(
      (
        await base.ticket.findMany({
          where: { companyId: ids.clientA },
          select: { id: true },
        })
      ).map((t) => t.id),
    );
    const b = await walkLongTerm(svc, actors.adminB, 50);
    expect(b.ids.some((id) => aIds.has(id))).toBe(false);
    const a = await walkLongTerm(svc, actors.adminA, 50);
    expect(a.ids.every((id) => aIds.has(id))).toBe(true);
  });

  it('чужой linkedClientCompanyId — отказ, как у board', async () => {
    const svc = serviceOn(base);
    const actor = actors.foreignLinked;
    await expect(
      svc.board(
        actor.companyId,
        actor.userId,
        actor.role,
        {},
        undefined,
        actor.linked,
      ),
    ).rejects.toThrow();
    await expect(
      svc.longTermTickets(
        actor.companyId,
        actor.userId,
        actor.role,
        {},
        undefined,
        actor.linked,
      ),
    ).rejects.toThrow();
    await expect(
      svc.longTermTicketsTotal(
        actor.companyId,
        actor.userId,
        actor.role,
        undefined,
        actor.linked,
      ),
    ).rejects.toThrow();
  });

  it('порог ровно 240 ч входит, на 1 мс меньше — нет; SLA не подставляется', async () => {
    const rows = await base.$queryRaw<Array<{ id: string; ms: number }>>(
      Prisma.sql`SELECT "t"."id", (EXTRACT(EPOCH FROM ("t"."plannedDueAt" - "t"."createdAt")) * 1000)::bigint::int AS "ms" FROM "Ticket" AS "t" WHERE "t"."companyId" IN (${Prisma.join(ticketCompanyIds)}) AND "t"."plannedDueAt" IS NOT NULL`,
    );
    const svc = serviceOn(base);
    const all = new Set((await walkLongTerm(svc, actors.adminA, 100)).ids);
    for (const row of rows) {
      if (row.ms === 240 * HOUR) {
        const status = (await base.ticket.findUnique({
          where: { id: row.id },
        }))!;
        if (
          status.companyId === ids.clientA &&
          LONG_TERM_STATUSES.includes(status.status)
        ) {
          expect(all.has(row.id)).toBe(true);
        }
      }
      if (row.ms === 240 * HOUR - 1) expect(all.has(row.id)).toBe(false);
    }
    // Заявки без плана, но с SLA через 500 ч — не долгосрочные.
    await base.ticket.updateMany({
      where: { companyId: ids.clientA, plannedDueAt: null },
      data: { slaDueAt: new Date(Date.UTC(2027, 0, 1)) },
    });
    const after = await walkLongTerm(svc, actors.adminA, 100);
    expect(new Set(after.ids)).toEqual(all);
  });

  it('завершённые и отменённые (и FIELD_COMPLETE) не входят', async () => {
    const svc = serviceOn(base);
    const all = (await walkLongTerm(svc, actors.adminA, 100)).ids;
    const statuses = await base.ticket.findMany({
      where: { id: { in: all } },
      select: { status: true },
    });
    for (const { status } of statuses) {
      expect(LONG_TERM_STATUSES).toContain(status);
    }
  });

  it('перевод WHERE выбирает те же строки, что Prisma: синтетические формы', async () => {
    const scope: Prisma.TicketWhereInput = {
      companyId: { in: ticketCompanyIds },
    };
    const shapes: Prisma.TicketWhereInput[] = [
      {},
      { status: TicketStatus.NEW },
      { status: { in: [TicketStatus.NEW, TicketStatus.DONE] } },
      { status: { notIn: [TicketStatus.NEW] } },
      { status: { in: [] } },
      { status: { notIn: [] } },
      { assignedTechnicianId: null },
      { assignedTechnicianId: { not: null } },
      { assignedTechnicianId: ids.techP },
      { assignedTechnicianId: { not: ids.techP } },
      { assignedTechnicianId: { notIn: [ids.techP] } },
      { assignedTechnicianId: { equals: null } },
      { NOT: { assignedTechnicianId: ids.techP } },
      {
        NOT: [
          { assignedTechnicianId: ids.techP },
          { status: TicketStatus.NEW },
        ],
      },
      { AND: [] },
      { AND: { status: TicketStatus.NEW } },
      { NOT: [] },
      { NOT: {} },
      { NOT: [{}] },
      {
        OR: [
          { assignedTechnicianId: ids.techS },
          { status: TicketStatus.NEW, assignedTechnicianId: null },
        ],
      },
      { plannedDueAt: { gte: new Date(Date.UTC(2026, 0, 10)) } },
      { plannedDueAt: { lt: new Date(Date.UTC(2026, 0, 10)), not: null } },
      { problemText: { contains: '50%_off', mode: 'insensitive' } },
      { problemText: { contains: '0%_', mode: 'insensitive' } },
      { problemText: { startsWith: 'lt_', mode: 'insensitive' } },
      { problemText: { startsWith: 'lt_' } },
      { problemCategory: { name: { contains: 'холод', mode: 'insensitive' } } },
      { problemCategory: { specializationLinks: { none: {} } } },
      { problemCategory: { specializationLinks: { some: {} } } },
      {
        problemCategory: {
          specializationLinks: {
            some: {
              specialization: {
                name: { equals: `ХОЛОД ${RUN}`, mode: 'insensitive' },
              },
            },
          },
        },
      },
      {
        problemCategory: {
          specializationLinks: {
            every: { specialization: { isActive: true } },
          },
        },
      },
      { problemCategory: { is: { name: 'Прочее' } } },
      { problemCategory: { isNot: { name: 'Прочее' } } },
      { assignedTechnician: null },
      { assignedTechnician: { is: null } },
      { assignedTechnician: { isNot: null } },
      { assignedTechnician: { role: UserRole.TECHNICIAN } },
      { assignedTechnician: { isNot: { role: UserRole.TECHNICIAN } } },
      { location: { name: { in: ['A1', 'B1'] } } },
      { id: { equals: '__no_access__' } },
    ];
    const mismatches: unknown[] = [];
    let nonTrivial = 0;
    for (const shape of shapes) {
      const where = { AND: [scope, shape] };
      const viaPrisma = (
        await base.ticket.findMany({ where, select: { id: true } })
      )
        .map((t) => t.id)
        .sort();
      const viaSql = (
        await base.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "t"."id" FROM "Ticket" AS "t" WHERE ${compileWhere('Ticket', where, 't')}`,
        )
      )
        .map((t) => t.id)
        .sort();
      if (JSON.stringify(viaSql) !== JSON.stringify(viaPrisma)) {
        mismatches.push({
          shape,
          prisma: viaPrisma.length,
          sql: viaSql.length,
        });
      }
      if (viaPrisma.length > 0) nonTrivial += 1;
    }
    expect(mismatches).toEqual([]);

    // Пустые OR и пустые фильтры связи Prisma трактует по-разному в разных
    // местах (OR: [] сверху — всё, внутри связи — ничего; член {} из OR
    // выбрасывается). Перевод на них отказывает, а не угадывает.
    const ambiguous: Prisma.TicketWhereInput[] = [
      { OR: [] },
      { OR: [], status: TicketStatus.NEW },
      { NOT: { OR: [] } },
      { NOT: { OR: [], status: TicketStatus.NEW } },
      { OR: [{}] },
      { OR: [{}, { status: TicketStatus.NEW }] },
      { OR: [{ OR: [] }, { status: TicketStatus.NEW }] },
      { AND: [{ OR: [] }, { status: TicketStatus.NEW }] },
      { problemCategory: {} },
      { assignedTechnician: {} },
      { problemCategory: { specializationLinks: { some: { OR: [] } } } },
    ];
    for (const shape of ambiguous) {
      expect(() =>
        compileWhere('Ticket', { AND: [scope, shape] }, 't'),
      ).toThrow(/prisma-where-sql/);
    }
    expect(nonTrivial).toBeGreaterThan(shapes.length - 6);
  });
});

describe('SMA-MOBILE-LONG-TERM-TICKETS на PostgreSQL: масштаб', () => {
  const explain: string[] = [];

  afterAll(() => {
    const out = process.env.LONG_TERM_EXPLAIN_OUT;
    if (out) {
      writeFileSync(out, explain.join('\n\n'));
    }
  });

  /**
   * size заявок одной компании через generate_series: каждая третья —
   * долгосрочная (300 ч), каждая третья — 239 ч, остальные без плана; каждая
   * седьмая — DONE/CANCELED. createdAt и плановые сроки повторяются, чтобы
   * порядок держался на id.
   */
  async function seed(size: number) {
    const co = await company(`Scale ${size}`, CompanyType.CLIENT);
    const admin = await user(co.id, UserRole.ADMIN);
    const loc = await location(co.id, 'S1');
    const cat = await category(co.id, 'S');
    await base.$executeRaw(Prisma.sql`
      INSERT INTO "Ticket" ("id", "companyId", "locationId", "problemCategoryId", "problemText", "status", "createdAt", "updatedAt", "plannedDueAt")
      SELECT gen_random_uuid()::text, ${co.id}, ${loc.id}, ${cat.id}, 'scale',
        (CASE WHEN g % 7 = 0 THEN (CASE WHEN g % 2 = 0 THEN 'DONE' ELSE 'CANCELED' END) ELSE (ARRAY['NEW','ASSIGNED','IN_PROGRESS','AWAITING_ACCEPTANCE'])[1 + g % 4] END)::"TicketStatus",
        TIMESTAMP '2026-01-01' + ((g % 97) * INTERVAL '1 hour'),
        now(),
        CASE g % 3
          WHEN 0 THEN TIMESTAMP '2026-01-01' + ((g % 97) * INTERVAL '1 hour') + INTERVAL '300 hours'
          WHEN 1 THEN TIMESTAMP '2026-01-01' + ((g % 97) * INTERVAL '1 hour') + INTERVAL '239 hours'
          ELSE NULL
        END
      FROM generate_series(1, ${size}::int) AS g`);
    await base.$executeRawUnsafe('ANALYZE "Ticket"');
    // Ожидание по формуле генерации, без правила из кода.
    let expected = 0;
    for (let g = 1; g <= size; g += 1)
      if (g % 3 === 0 && g % 7 !== 0) expected += 1;
    const actor: Actor = {
      label: `ADMIN ${size}`,
      companyId: co.id,
      userId: admin.id,
      role: UserRole.ADMIN,
    };
    return { actor, expected };
  }

  function assertNoFullScanInNode(
    ops: Array<{ op: string; model?: string; rows: number; args: unknown }>,
    limit: number,
  ) {
    for (const op of ops) {
      expect({
        op: op.op,
        model: op.model,
        rows: op.rows <= limit + 1,
      }).toEqual({
        op: op.op,
        model: op.model,
        rows: true,
      });
    }
    // Заявки через findMany читаются только по id страницы.
    for (const op of ops.filter(
      (o) => o.model === 'Ticket' && o.op === 'findMany',
    )) {
      expect(JSON.stringify(op.args)).toContain('"in"');
    }
  }

  it.each([1000, 10000])(
    '%i заявок: точный total, все страницы без дублей и потерь, в Node.js — не больше страницы',
    async (size) => {
      const { actor, expected } = await seed(size);
      const { client, ops } = countingClient();
      const svc = serviceOn(client);
      const walked = await walkLongTerm(svc, actor, 100);
      expect([...walked.totals]).toEqual([expected]);
      expect(walked.ids.length).toBe(expected);
      expect(new Set(walked.ids).size).toBe(expected);
      expect(walked.ids.length).toBeGreaterThan(size / 4);

      // board отдаёт последние 500 — часть долгосрочных за его пределами, и
      // long-term их всё равно возвращает.
      const board = await serviceOn(base).board(
        actor.companyId,
        actor.userId,
        actor.role,
        { statuses: LONG_TERM_STATUSES, includeArchived: true },
      );
      const onBoard = new Set(
        board.columns.flatMap((column) => column.cards.map((card) => card.id)),
      );
      expect(onBoard.size).toBe(500);
      expect(
        walked.ids.filter((id) => !onBoard.has(id)).length,
      ).toBeGreaterThan(0);
      assertNoFullScanInNode(ops, 100);

      // Порядок страниц — порядок ключа (plannedDueAt, createdAt, id).
      const keys = await base.ticket.findMany({
        where: { id: { in: walked.ids } },
        select: { id: true, createdAt: true, plannedDueAt: true },
      });
      const byId = new Map(keys.map((k) => [k.id, k]));
      const sorted = [...walked.ids].sort((a, b) =>
        compareLongTermKeys(
          longTermKeyOf(byId.get(a) as never),
          longTermKeyOf(byId.get(b) as never),
        ),
      );
      expect(walked.ids).toEqual(sorted);
    },
    120_000,
  );

  it('100000 заявок: total одним COUNT, первые страницы, глубокий курсор; EXPLAIN', async () => {
    const { actor, expected } = await seed(100000);
    const { client, ops } = countingClient();
    const svc = serviceOn(client);

    const started = Date.now();
    const { total } = await svc.longTermTicketsTotal(
      actor.companyId,
      actor.userId,
      actor.role,
    );
    const countMs = Date.now() - started;
    expect(total).toBe(expected);

    const first = await walkLongTerm(svc, actor, 100, 5);
    expect(first.ids.length).toBe(500);
    expect(new Set(first.ids).size).toBe(500);
    expect([...first.totals]).toEqual([expected]);
    assertNoFullScanInNode(ops, 100);

    // Глубокая страница по курсору стоит столько же, сколько первая.
    let cursor = first.cursor;
    const tailStarted = Date.now();
    for (let i = 0; i < 20 && cursor; i += 1) {
      const page = await svc.longTermTickets(
        actor.companyId,
        actor.userId,
        actor.role,
        { limit: 100, cursor },
      );
      cursor = page.nextCursor;
    }
    const tailMs = (Date.now() - tailStarted) / 20;
    assertNoFullScanInNode(ops, 100);

    // Настоящий WHERE актора — тот, что уходит в SQL, а не упрощённый.
    const where = await (
      svc as unknown as {
        resolveLongTermWhere: (
          companyId: string,
          userId: string,
          role: UserRole,
        ) => Promise<Prisma.TicketWhereInput>;
      }
    ).resolveLongTermWhere(actor.companyId, actor.userId, actor.role);
    explain.push(`-- WHERE актора\n${JSON.stringify(where)}`);
    for (const [name, sql] of [
      ['COUNT', longTermCountSql(where)],
      ['PAGE first', longTermPageSql(where, { limit: 100, after: null })],
      [
        'PAGE after',
        longTermPageSql(where, {
          limit: 100,
          after: { p: Date.UTC(2026, 0, 10), c: Date.UTC(2026, 0, 2), i: '8' },
        }),
      ],
    ] as const) {
      const plan = await base.$queryRaw<Array<{ 'QUERY PLAN': string }>>(
        Prisma.sql`EXPLAIN (ANALYZE, BUFFERS) ${sql}`,
      );
      explain.push(
        `-- ${name} (100000 заявок)\n${plan.map((r) => r['QUERY PLAN']).join('\n')}`,
      );
    }
    explain.push(
      `-- service: COUNT ${countMs} ms; страница по глубокому курсору ~${tailMs.toFixed(0)} ms`,
    );
  }, 300_000);
});
