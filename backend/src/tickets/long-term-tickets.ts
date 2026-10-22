import { BadRequestException } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';

/**
 * SMA-MOBILE-LONG-TERM-TICKETS — правило «долгосрочной заявки» и страницы её
 * выборки. Без БД и без часов: правило проверяется исполнением.
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

type SortKey = { p: number; c: number; i: string };

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
function compareKeys(a: SortKey, b: SortKey): number {
  if (a.p !== b.p) return a.p - b.p;
  if (a.c !== b.c) return a.c - b.c;
  return a.i < b.i ? -1 : a.i > b.i ? 1 : 0;
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

/**
 * Страница по курсору-ключу (keyset), а не по смещению: если между запросами
 * заявка закрылась или появилась новая, следующая страница всё равно начнётся
 * строго после последней показанной — без дублей и без пропуска оставшихся.
 *
 * total — все долгосрочные заявки выборки, а не число строк на странице.
 */
export function paginateLongTerm(
  candidates: LongTermCandidate[],
  params: { limit: number; cursor?: string | null },
): { total: number; page: LongTermRow[]; nextCursor: string | null } {
  const rows = candidates
    .filter(isLongTermCandidate)
    .sort((a, b) => compareKeys(keyOf(a), keyOf(b)));
  const after = params.cursor ? decodeLongTermCursor(params.cursor) : null;
  const start = after
    ? rows.findIndex((row) => compareKeys(keyOf(row), after) > 0)
    : 0;
  const from = start === -1 ? rows.length : start;
  const page = rows.slice(from, from + params.limit);
  const hasMore = from + params.limit < rows.length;
  return {
    total: rows.length,
    page,
    nextCursor:
      hasMore && page.length > 0
        ? encodeLongTermCursor(page[page.length - 1])
        : null,
  };
}
