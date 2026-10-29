import { BadRequestException } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';

/**
 * SMA-MOBILE-LONG-TERM-TICKETS — правило «долгосрочной заявки», порядок и курсор
 * её выборки. Выборка идёт в PostgreSQL (long-term-tickets.sql.ts); здесь — то же
 * правило без БД: по нему тесты сверяют SQL.
 *
 * Долгосрочная — активная заявка, у которой плановый срок выполнения
 * plannedDueAt − createdAt не меньше 240 часов. Это время, отведённое на работу
 * при постановке, а не время, оставшееся до дедлайна: текущий момент в правило
 * не входит. Срок SLA (slaDueAt) — срок реакции, сюда не подставляется.
 */

export const LONG_TERM_MIN_HOURS = 240;
export const LONG_TERM_MIN_MS = LONG_TERM_MIN_HOURS * 60 * 60 * 1000;

/**
 * Активные статусы — те же, что у главной мобильной (isActiveHomeTicketStatus)
 * и колонок board. FIELD_COMPLETE — подзаявка со сданной полевой работой, она
 * ждёт закрытия родительской и на главной не показывается.
 */
export const LONG_TERM_STATUSES: TicketStatus[] = [
  TicketStatus.NEW,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
  TicketStatus.AWAITING_ACCEPTANCE,
];

export const LONG_TERM_DEFAULT_LIMIT = 50;
export const LONG_TERM_MAX_LIMIT = 100;

export type LongTermCandidate = {
  id: string;
  createdAt: Date;
  plannedDueAt: Date | null;
};

export type LongTermRow = { id: string; createdAt: Date; plannedDueAt: Date };

export function isLongTermCandidate(
  row: LongTermCandidate,
): row is LongTermRow {
  if (!row.plannedDueAt) return false;
  return (
    row.plannedDueAt.getTime() - row.createdAt.getTime() >= LONG_TERM_MIN_MS
  );
}

export type LongTermSortKey = { p: number; c: number; i: string };
type SortKey = LongTermSortKey;

function keyOf(row: LongTermRow): SortKey {
  return {
    p: row.plannedDueAt.getTime(),
    c: row.createdAt.getTime(),
    i: row.id,
  };
}

/**
 * Порядок: ближайший плановый срок первым, затем раньше созданная, затем id.
 * id уникален, поэтому порядок полный: у двух заявок не бывает равного ключа,
 * и страница не может ни потерять, ни повторить строку.
 */
export function compareLongTermKeys(a: SortKey, b: SortKey): number {
  if (a.p !== b.p) return a.p - b.p;
  if (a.c !== b.c) return a.c - b.c;
  return a.i < b.i ? -1 : a.i > b.i ? 1 : 0;
}

export function longTermKeyOf(row: LongTermRow): SortKey {
  return keyOf(row);
}

export function encodeLongTermCursor(row: LongTermRow): string {
  return Buffer.from(JSON.stringify(keyOf(row)), 'utf8').toString('base64url');
}

export function decodeLongTermCursor(cursor: string): SortKey {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<SortKey>;
    if (
      typeof parsed.p === 'number' &&
      Number.isFinite(parsed.p) &&
      typeof parsed.c === 'number' &&
      Number.isFinite(parsed.c) &&
      typeof parsed.i === 'string' &&
      parsed.i.length > 0
    ) {
      return { p: parsed.p, c: parsed.c, i: parsed.i };
    }
  } catch {
    // ниже — общий отказ
  }
  throw new BadRequestException('Invalid cursor');
}
