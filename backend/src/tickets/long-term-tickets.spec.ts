import { Reflector } from '@nestjs/core';
import { TicketStatus, UserRole } from '@prisma/client';

import { PERMISSIONS } from '../common/permissions.constants';
import { PERMISSIONS_KEY } from '../common/permissions.decorator';
import { ROLES_KEY } from '../common/roles.decorator';
import {
  compareLongTermKeys,
  decodeLongTermCursor,
  encodeLongTermCursor,
  isLongTermCandidate,
  LONG_TERM_MIN_HOURS,
  LONG_TERM_STATUSES,
  longTermKeyOf,
  type LongTermCandidate,
} from './long-term-tickets';
import {
  countLongTermTickets,
  longTermCountSql,
  longTermPageSql,
  pageLongTermTickets,
} from './long-term-tickets.sql';
import { TicketsController } from './tickets.controller';

const HOUR = 60 * 60 * 1000;
const BASE = Date.parse('2026-01-01T00:00:00Z');

function candidate(
  id: string,
  createdHours: number,
  durationMs: number | null,
): LongTermCandidate {
  const createdAt = new Date(BASE + createdHours * HOUR);
  return {
    id,
    createdAt,
    plannedDueAt:
      durationMs === null ? null : new Date(createdAt.getTime() + durationMs),
  };
}

describe('SMA-MOBILE-LONG-TERM-TICKETS правило', () => {
  it('порог — ровно 240 часов плановой длительности, включительно', () => {
    expect(LONG_TERM_MIN_HOURS).toBe(240);
    expect(isLongTermCandidate(candidate('a', 0, 240 * HOUR))).toBe(true);
    expect(isLongTermCandidate(candidate('b', 0, 240 * HOUR - 1))).toBe(false);
    expect(isLongTermCandidate(candidate('c', 0, null))).toBe(false);
  });

  it('срок SLA не подставляется вместо планового срока', () => {
    const withSlaOnly = {
      ...candidate('sla', 0, null),
      slaDueAt: new Date(BASE + 1000 * HOUR),
    };
    expect(isLongTermCandidate(withSlaOnly)).toBe(false);
  });

  it('не зависит от текущего момента: заявка с прошедшим сроком остаётся долгосрочной', () => {
    jest.useFakeTimers().setSystemTime(new Date('2030-01-01T00:00:00Z'));
    try {
      expect(isLongTermCandidate(candidate('old', 0, 300 * HOUR))).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('активные статусы — как на главной: без FIELD_COMPLETE, DONE и CANCELED', () => {
    expect(LONG_TERM_STATUSES).toEqual([
      TicketStatus.NEW,
      TicketStatus.ASSIGNED,
      TicketStatus.IN_PROGRESS,
      TicketStatus.AWAITING_ACCEPTANCE,
    ]);
  });
});

describe('SMA-MOBILE-LONG-TERM-TICKETS курсор и порядок', () => {
  it('курсор — ключ последней строки (plannedDueAt, createdAt, id), туда и обратно', () => {
    const last = candidate(
      't-42',
      3,
      300 * HOUR,
    ) as Required<LongTermCandidate> & {
      plannedDueAt: Date;
    };
    expect(decodeLongTermCursor(encodeLongTermCursor(last))).toEqual(
      longTermKeyOf(last),
    );
  });

  it('порядок полный: срок, затем дата создания, затем id', () => {
    const key = (p: number, c: number, i: string) => ({ p, c, i });
    expect(compareLongTermKeys(key(1, 9, 'z'), key(2, 0, 'a'))).toBeLessThan(0);
    expect(compareLongTermKeys(key(1, 1, 'z'), key(1, 2, 'a'))).toBeLessThan(0);
    expect(compareLongTermKeys(key(1, 1, 'a'), key(1, 1, 'b'))).toBeLessThan(0);
    expect(compareLongTermKeys(key(1, 1, 'a'), key(1, 1, 'a'))).toBe(0);
  });

  it('битый курсор — ошибка запроса', () => {
    const encoded = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString('base64url');
    for (const cursor of [
      'мусор',
      encoded({ p: 'x', c: 1, i: 'a' }),
      encoded({ p: 1, c: Number.NaN, i: 'a' }),
      encoded({ p: 1, c: 1, i: '' }),
      encoded({ p: 1, c: 1 }),
      encoded(null),
    ]) {
      expect(() => decodeLongTermCursor(cursor)).toThrow('Invalid cursor');
    }
  });
});

describe('SMA-MOBILE-LONG-TERM-TICKETS SQL', () => {
  const where = { companyId: 'client-1', status: { in: LONG_TERM_STATUSES } };
  const text = (sql: { text: string }) => sql.text.replace(/\s+/g, ' ');

  it('правило 240 ч — в SQL, по разности колонок, без slaDueAt и без now()', () => {
    for (const sql of [
      longTermCountSql(where),
      longTermPageSql(where, { limit: 50, after: null }),
    ]) {
      expect(text(sql)).toContain(
        '"t"."plannedDueAt" IS NOT NULL AND "t"."plannedDueAt" - "t"."createdAt" >= make_interval(hours => $',
      );
      expect(sql.values).toContain(240);
      expect(text(sql)).not.toMatch(/slaDueAt|now\(\)|CURRENT_/i);
    }
  });

  it('COUNT — отдельный запрос по тому же WHERE видимости', () => {
    const count = longTermCountSql(where);
    expect(text(count)).toMatch(
      /^SELECT COUNT\(\*\)::int AS "total" FROM "Ticket" AS "t" WHERE \(/,
    );
    expect(text(count)).toContain('"t"."companyId" = $1');
    expect(count.values[0]).toBe('client-1');
    expect(text(count)).not.toMatch(/LIMIT|ORDER BY/);
  });

  it('страница — keyset по (plannedDueAt, createdAt, id), ORDER BY того же ключа и LIMIT limit + 1', () => {
    const after = {
      p: Date.UTC(2026, 0, 11),
      c: Date.UTC(2026, 0, 1),
      i: 'id-9',
    };
    const page = longTermPageSql(where, { limit: 50, after });
    expect(text(page)).toContain(
      '("t"."plannedDueAt", "t"."createdAt", "t"."id") > (CAST($',
    );
    expect(text(page)).toMatch(
      /ORDER BY "t"\."plannedDueAt" ASC, "t"\."createdAt" ASC, "t"\."id" ASC LIMIT \$\d+$/,
    );
    expect(page.values.slice(-4)).toEqual([
      '2026-01-11T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
      'id-9',
      51,
    ]);
    expect(text(page)).not.toMatch(/OFFSET/);
    expect(
      text(longTermPageSql(where, { limit: 50, after: null })),
    ).not.toContain(') > (');
  });

  it('значения курсора — параметры, а не текст запроса', () => {
    const page = longTermPageSql(where, {
      limit: 10,
      after: { p: 1, c: 1, i: `x'); DROP TABLE "Ticket"; --` },
    });
    expect(page.text).not.toContain('DROP TABLE');
    expect(page.values).toContain(`x'); DROP TABLE "Ticket"; --`);
  });

  it('в Node.js приходит не больше limit строк; лишняя строка только говорит «есть ещё»', async () => {
    const rows = Array.from({ length: 11 }, (_, index) => ({
      id: `r-${index}`,
      createdAt: new Date(BASE),
      plannedDueAt: new Date(BASE + 300 * HOUR),
    }));
    const db = { $queryRaw: jest.fn().mockResolvedValue(rows) };
    const page = await pageLongTermTickets(db as never, where, {
      limit: 10,
      after: null,
    });
    expect(page.rows).toHaveLength(10);
    expect(page.hasMore).toBe(true);

    db.$queryRaw.mockResolvedValue(rows.slice(0, 10));
    const last = await pageLongTermTickets(db as never, where, {
      limit: 10,
      after: null,
    });
    expect(last).toMatchObject({ hasMore: false });
    expect(last.rows).toHaveLength(10);
  });

  it('COUNT отдаёт число, пустой ответ — ноль', async () => {
    const db = { $queryRaw: jest.fn().mockResolvedValue([{ total: 734 }]) };
    await expect(countLongTermTickets(db as never, where)).resolves.toBe(734);
    db.$queryRaw.mockResolvedValue([]);
    await expect(countLongTermTickets(db as never, where)).resolves.toBe(0);
  });
});

describe('SMA-MOBILE-LONG-TERM-TICKETS маршрут', () => {
  const reflector = new Reflector();
  const methodOf = (name: string) =>
    Object.getOwnPropertyDescriptor(TicketsController.prototype, name)
      ?.value as (...args: unknown[]) => unknown;

  it.each(['longTerm', 'longTermCount'])(
    '%s: роли и право — те же, что у GET /tickets/board',
    (name) => {
      const roles = reflector.get<UserRole[]>(ROLES_KEY, methodOf(name));
      const boardRoles = reflector.get<UserRole[]>(
        ROLES_KEY,
        methodOf('board'),
      );
      expect([...roles].sort()).toEqual([...boardRoles].sort());
      expect(reflector.get<string[]>(PERMISSIONS_KEY, methodOf(name))).toEqual([
        PERMISSIONS.TICKETS_VIEW,
      ]);
    },
  );
});
