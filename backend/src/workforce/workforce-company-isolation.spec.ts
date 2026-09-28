import { UserRole } from '@prisma/client';

import { WorkforceService } from './workforce.service';

/**
 * SMA-WORKFORCE-CLIENT-ADMIN-ISOLATION-HARDENING-122N.
 *
 * Изоляция компаний в listWorkforce проверялась по тексту исходника: что
 * в решении об охвате упомянут PLATFORM_ADMIN и что рядом нет `??`. Такую
 * проверку переживает ровно та правка, от которой она должна защищать —
 * дописать `|| CLIENT_ADMIN` в условие, и оба маркера остаются на месте.
 *
 * Здесь проверяется поведение: настоящий сервис работает на заглушке Prisma,
 * которая отдаёт разные данные разным компаниям и запоминает все запросы.
 * Прочитать чужую компанию — значит увидеть её сотрудников и её имя, и это
 * видно в результате, а не в тексте файла.
 */

const OWN = 'own-client-company';
const FOREIGN = 'foreign-company';

const COMPANIES: Record<string, { id: string; name: string; timezone: string; shiftAutoCloseTime: string }> = {
  [OWN]: { id: OWN, name: 'Своя клиентская компания', timezone: 'Europe/Moscow', shiftAutoCloseTime: '23:59' },
  [FOREIGN]: { id: FOREIGN, name: 'Чужая компания', timezone: 'Europe/Moscow', shiftAutoCloseTime: '23:59' },
};

function shiftRow(companyId: string, userId: string, lastName: string) {
  const openedAt = new Date('2026-09-17T08:00:00.000Z');
  return {
    id: `shift-${userId}`,
    companyId,
    userId,
    openedAt,
    closedAt: new Date('2026-09-17T17:00:00.000Z'),
    status: 'CLOSED',
    user: { id: userId, firstName: 'Иван', lastName, email: `${userId}@example.com`, role: UserRole.TECHNICIAN },
    corrections: [],
    workLogs: [],
  };
}

const SHIFTS: Record<string, ReturnType<typeof shiftRow>[]> = {
  [OWN]: [shiftRow(OWN, 'user-own', 'Свой')],
  [FOREIGN]: [shiftRow(FOREIGN, 'user-foreign', 'Чужой')],
};

type RecordedQuery = { model: string; where: Record<string, unknown> };

function makeSuite() {
  const queries: RecordedQuery[] = [];

  const prisma = {
    company: {
      findUnique: jest.fn(async ({ where }: any) => {
        queries.push({ model: 'company.findUnique', where });
        return COMPANIES[where.id] ?? null;
      }),
    },
    workShift: {
      findMany: jest.fn(async ({ where }: any) => {
        queries.push({ model: 'workShift.findMany', where });
        return SHIFTS[where.companyId] ?? [];
      }),
    },
  } as any;

  const serviceContracts = {} as any;
  const svc = new WorkforceService(prisma, serviceContracts);

  return { svc, prisma, queries };
}

/** Каждая компания, упомянутая хоть в одном запросе к базе. */
function companiesTouched(queries: RecordedQuery[]): string[] {
  const seen = new Set<string>();
  for (const query of queries) {
    for (const value of Object.values(query.where)) {
      if (typeof value === 'string' && (value === OWN || value === FOREIGN)) seen.add(value);
    }
  }
  return [...seen].sort();
}

const actor = (role: UserRole, companyId: string) => ({ id: 'actor-1', role, companyId } as any);

describe('122N изоляция компаний в Workforce — поведение, а не текст', () => {
  // ── Случай A: CLIENT_ADMIN ────────────────────────────────────────────────

  it('A. CLIENT_ADMIN с чужим observerCompanyId читает только свою компанию', async () => {
    const { svc, queries } = makeSuite();

    const result: any = await svc.listWorkforce({
      actor: actor(UserRole.CLIENT_ADMIN, OWN),
      observerCompanyId: FOREIGN,
    });

    // Результат — своей компании: имя, сотрудники, смены.
    expect(result.company.id).toBe(OWN);
    expect(result.company.name).toBe('Своя клиентская компания');
    expect(result.employees.map((row: any) => row.user.id)).toEqual(['user-own']);
    expect(result.shifts.map((row: any) => row.companyId)).toEqual([OWN]);

    // Ни один запрос к базе не упоминает чужую компанию.
    expect(companiesTouched(queries)).toEqual([OWN]);
    expect(JSON.stringify(queries)).not.toContain(FOREIGN);
    expect(JSON.stringify(result)).not.toContain(FOREIGN);
    expect(JSON.stringify(result)).not.toContain('Чужой');
  });

  it('A. параметр не меняет охват и при совпадении с собственной компанией', async () => {
    const { svc, queries } = makeSuite();

    await svc.listWorkforce({ actor: actor(UserRole.CLIENT_ADMIN, OWN), observerCompanyId: OWN });

    expect(companiesTouched(queries)).toEqual([OWN]);
  });

  it('A. без параметра CLIENT_ADMIN по-прежнему читает свою компанию', async () => {
    const { svc, queries } = makeSuite();

    const result: any = await svc.listWorkforce({ actor: actor(UserRole.CLIENT_ADMIN, OWN) });

    expect(result.company.id).toBe(OWN);
    expect(result.employees).toHaveLength(1);
    expect(companiesTouched(queries)).toEqual([OWN]);
  });

  // ── Случай B: PLATFORM_ADMIN ──────────────────────────────────────────────

  it('B. PLATFORM_ADMIN с observerCompanyId читает названную компанию', async () => {
    const { svc, queries } = makeSuite();

    const result: any = await svc.listWorkforce({
      actor: actor(UserRole.PLATFORM_ADMIN, OWN),
      observerCompanyId: FOREIGN,
    });

    // Каноническое поведение сохраняется целиком.
    expect(result.company.id).toBe(FOREIGN);
    expect(result.company.name).toBe('Чужая компания');
    expect(result.employees.map((row: any) => row.user.id)).toEqual(['user-foreign']);
    expect(companiesTouched(queries)).toEqual([FOREIGN]);
  });

  it('B. PLATFORM_ADMIN без параметра остаётся в своей компании', async () => {
    const { svc, queries } = makeSuite();

    const result: any = await svc.listWorkforce({ actor: actor(UserRole.PLATFORM_ADMIN, OWN) });

    expect(result.company.id).toBe(OWN);
    expect(companiesTouched(queries)).toEqual([OWN]);
  });

  // ── никто, кроме PLATFORM_ADMIN, охват не меняет ──────────────────────────

  it('чужая компания недостижима ни для одной другой роли', async () => {
    const roles: UserRole[] = [
      UserRole.CLIENT_ADMIN,
      UserRole.CLIENT,
      UserRole.ADMIN,
      UserRole.MASTER,
      UserRole.DISPATCHER,
      UserRole.NETWORK_DIRECTOR,
      UserRole.TERRITORIAL_MANAGER,
      UserRole.TECHNICIAN,
      UserRole.STAFF,
    ];

    // Jest не принимает подпись вторым аргументом, поэтому роль входит
    // в сравниваемое значение: в отчёте видно, на какой роли сломалось.
    const seen: Array<{ role: UserRole; company: string; touched: string[] }> = [];
    for (const role of roles) {
      const { svc, queries } = makeSuite();
      const result: any = await svc.listWorkforce({
        actor: actor(role, OWN),
        observerCompanyId: FOREIGN,
      });
      seen.push({ role, company: result.company.id, touched: companiesTouched(queries) });
    }

    expect(seen).toEqual(roles.map((role) => ({ role, company: OWN, touched: [OWN] })));
  });

  it('подставленный параметр не проходит и мимо фильтра смен', async () => {
    const { svc, prisma } = makeSuite();

    await svc.listWorkforce({
      actor: actor(UserRole.CLIENT_ADMIN, OWN),
      observerCompanyId: FOREIGN,
      userId: 'user-foreign',
    });

    // userId клиент назвать может, но он применяется внутри своей компании.
    const where = prisma.workShift.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe(OWN);
    expect(where.userId).toBe('user-foreign');
  });
});
