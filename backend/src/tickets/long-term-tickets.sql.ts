import { Prisma } from '@prisma/client';

import {
  LONG_TERM_MIN_HOURS,
  type LongTermRow,
  type LongTermSortKey,
} from './long-term-tickets';
import { compileWhere } from './prisma-where-sql';

/**
 * SMA-MOBILE-LONG-TERM-TICKETS — выборка долгосрочных заявок в PostgreSQL.
 *
 * `where` — готовый WHERE видимости из resolveBoardWhere, он переводится в SQL
 * без изменений (prisma-where-sql.ts). К нему добавляется только правило:
 * plannedDueAt − createdAt ≥ 240 ч. Колонки — timestamp(3) без зоны в UTC,
 * поэтому разность точная и не зависит от перехода на летнее время.
 *
 * В Node.js приходит число (COUNT) и не больше limit + 1 строк страницы,
 * сколько бы заявок ни было в контуре.
 */

type RawQueryClient = {
  $queryRaw<T = unknown>(query: Prisma.Sql): Prisma.PrismaPromise<T>;
};

const ALIAS = 't';

export function longTermRuleSql(): Prisma.Sql {
  return Prisma.sql`"t"."plannedDueAt" IS NOT NULL AND "t"."plannedDueAt" - "t"."createdAt" >= make_interval(hours => ${LONG_TERM_MIN_HOURS}::int)`;
}

function longTermWhereSql(where: Prisma.TicketWhereInput): Prisma.Sql {
  return Prisma.sql`(${compileWhere('Ticket', where, ALIAS)}) AND ${longTermRuleSql()}`;
}

/** Метка времени ключа как timestamp(3) в UTC, без TimeZone сессии. */
function timestampOf(ms: number): Prisma.Sql {
  return Prisma.sql`CAST(${new Date(ms).toISOString()} AS timestamp(3))`;
}

export function longTermCountSql(where: Prisma.TicketWhereInput): Prisma.Sql {
  return Prisma.sql`SELECT COUNT(*)::int AS "total" FROM "Ticket" AS "t" WHERE ${longTermWhereSql(where)}`;
}

export function longTermPageSql(
  where: Prisma.TicketWhereInput,
  params: { limit: number; after: LongTermSortKey | null },
): Prisma.Sql {
  const after = params.after
    ? Prisma.sql` AND ("t"."plannedDueAt", "t"."createdAt", "t"."id") > (${timestampOf(
        params.after.p,
      )}, ${timestampOf(params.after.c)}, ${params.after.i})`
    : Prisma.empty;
  return Prisma.sql`SELECT "t"."id", "t"."createdAt", "t"."plannedDueAt" FROM "Ticket" AS "t" WHERE ${longTermWhereSql(
    where,
  )}${after} ORDER BY "t"."plannedDueAt" ASC, "t"."createdAt" ASC, "t"."id" ASC LIMIT ${
    params.limit + 1
  }`;
}

/** Точное число долгосрочных заявок всего контура — отдельным COUNT(*). */
export async function countLongTermTickets(
  db: RawQueryClient,
  where: Prisma.TicketWhereInput,
): Promise<number> {
  const rows = await db.$queryRaw<Array<{ total: number }>>(
    longTermCountSql(where),
  );
  return Number(rows[0]?.total ?? 0);
}

/**
 * Страница после ключа `after` (keyset): строка limit + 1 только говорит, что
 * дальше есть ещё, и в страницу не входит.
 */
export async function pageLongTermTickets(
  db: RawQueryClient,
  where: Prisma.TicketWhereInput,
  params: { limit: number; after: LongTermSortKey | null },
): Promise<{ rows: LongTermRow[]; hasMore: boolean }> {
  const rows = await db.$queryRaw<LongTermRow[]>(
    longTermPageSql(where, params),
  );
  return {
    rows: rows.slice(0, params.limit),
    hasMore: rows.length > params.limit,
  };
}
