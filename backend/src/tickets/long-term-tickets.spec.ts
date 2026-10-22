import { Reflector } from '@nestjs/core';
import { TicketStatus, UserRole } from '@prisma/client';

import { PERMISSIONS } from '../common/permissions.constants';
import { PERMISSIONS_KEY } from '../common/permissions.decorator';
import { ROLES_KEY } from '../common/roles.decorator';
import {
  decodeLongTermCursor,
  encodeLongTermCursor,
  isLongTermCandidate,
  LONG_TERM_MIN_HOURS,
  LONG_TERM_STATUSES,
  paginateLongTerm,
  type LongTermCandidate,
} from './long-term-tickets';
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

describe('SMA-MOBILE-LONG-TERM-TICKETS страницы', () => {
  const rows = Array.from({ length: 1200 }, (_, index) =>
    // одинаковые сроки и даты у групп по 7 — порядок решает id
    candidate(
      `t-${String(index).padStart(4, '0')}`,
      Math.floor(index / 7),
      index % 4 === 0 ? 100 * HOUR : 300 * HOUR,
    ),
  );

  it('total точный, страницы покрывают выборку без потерь и дублей', () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let total = 0;
    for (let guard = 0; guard < 500; guard++) {
      const page = paginateLongTerm(rows, { limit: 23, cursor });
      total = page.total;
      seen.push(...page.page.map((row) => row.id));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    expect(total).toBe(900);
    expect(seen).toHaveLength(900);
    expect(new Set(seen).size).toBe(900);
  });

  it('порядок одинаков при любом порядке входа', () => {
    const shuffled = [...rows].reverse();
    expect(
      paginateLongTerm(shuffled, { limit: 50 }).page.map((r) => r.id),
    ).toEqual(paginateLongTerm(rows, { limit: 50 }).page.map((r) => r.id));
  });

  it('последняя страница без курсора; курсор за концом — пустая страница', () => {
    const small = [
      candidate('a', 0, 300 * HOUR),
      candidate('b', 1, 300 * HOUR),
    ];
    const first = paginateLongTerm(small, { limit: 2 });
    expect(first.nextCursor).toBeNull();
    const beyond = paginateLongTerm(small, {
      limit: 2,
      cursor: encodeLongTermCursor(first.page[1]),
    });
    expect(beyond).toEqual({ total: 2, page: [], nextCursor: null });
  });

  it('курсор — ключ строки, а не смещение: удаление строк до курсора ничего не сдвигает', () => {
    const list = Array.from({ length: 6 }, (_, index) =>
      candidate(`r-${index}`, index, 300 * HOUR),
    );
    const first = paginateLongTerm(list, { limit: 3 });
    const second = paginateLongTerm(list.slice(2), {
      limit: 3,
      cursor: first.nextCursor,
    });
    expect(second.page.map((r) => r.id)).toEqual(['r-3', 'r-4', 'r-5']);
  });

  it('битый курсор — ошибка запроса', () => {
    expect(() => decodeLongTermCursor('мусор')).toThrow('Invalid cursor');
    expect(() =>
      decodeLongTermCursor(
        Buffer.from(JSON.stringify({ p: 'x', c: 1, i: 'a' })).toString(
          'base64url',
        ),
      ),
    ).toThrow('Invalid cursor');
  });
});

describe('SMA-MOBILE-LONG-TERM-TICKETS маршрут', () => {
  const reflector = new Reflector();
  const methodOf = (name: string) =>
    Object.getOwnPropertyDescriptor(TicketsController.prototype, name)
      ?.value as (...args: unknown[]) => unknown;

  it('роли и право — те же, что у GET /tickets/board', () => {
    const roles = reflector.get<UserRole[]>(ROLES_KEY, methodOf('longTerm'));
    const boardRoles = reflector.get<UserRole[]>(ROLES_KEY, methodOf('board'));
    expect([...roles].sort()).toEqual([...boardRoles].sort());
    expect(
      reflector.get<string[]>(PERMISSIONS_KEY, methodOf('longTerm')),
    ).toEqual([PERMISSIONS.TICKETS_VIEW]);
  });
});
