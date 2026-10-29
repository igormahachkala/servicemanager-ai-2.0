import { TicketStatus, UserRole } from '@prisma/client';

import { compileWhere, UnsupportedWhereError } from './prisma-where-sql';

/**
 * SMA-MOBILE-LONG-TERM-TICKETS — перевод WHERE Prisma в SQL.
 *
 * Здесь — форма SQL и закрытость перевода. Что выборка совпадает с Prisma,
 * проверяется на PostgreSQL в test/long-term-tickets.e2e-spec.ts.
 */

const text = (where: unknown, model = 'Ticket') =>
  compileWhere(model, where, 't').text.replace(/\s+/g, ' ');
const values = (where: unknown, model = 'Ticket') =>
  compileWhere(model, where, 't').values;

describe('SMA-MOBILE-LONG-TERM-TICKETS перевод WHERE: скаляры', () => {
  it('равенство, null, not null, in, notIn', () => {
    expect(text({ companyId: 'c1' })).toBe('"t"."companyId" = $1');
    expect(text({ assignedTechnicianId: null })).toBe(
      '"t"."assignedTechnicianId" IS NULL',
    );
    expect(text({ plannedDueAt: { not: null } })).toBe(
      '"t"."plannedDueAt" IS NOT NULL',
    );
    expect(text({ id: { in: ['a', 'b'] } })).toBe('"t"."id" IN ($1,$2)');
    expect(text({ companyId: { notIn: ['a'] } })).toBe(
      '"t"."companyId" NOT IN ($1)',
    );
  });

  it('in: [] — FALSE, notIn: [] — TRUE, как у Prisma', () => {
    expect(text({ id: { in: [] } })).toBe('FALSE');
    expect(text({ id: { notIn: [] } })).toBe('TRUE');
  });

  it('enum — с явным приведением типа', () => {
    expect(text({ status: { in: [TicketStatus.NEW] } })).toBe(
      '"t"."status" IN (CAST($1 AS "TicketStatus"))',
    );
  });

  it('даты — timestamp(3) из ISO в UTC, без TimeZone сессии', () => {
    expect(
      text({ plannedDueAt: { gte: new Date('2026-01-01T00:00:00Z') } }),
    ).toBe('"t"."plannedDueAt" >= CAST($1 AS timestamp(3))');
    expect(
      values({ plannedDueAt: { gte: new Date('2026-01-01T00:00:00Z') } }),
    ).toEqual(['2026-01-01T00:00:00.000Z']);
  });

  it('insensitive: LOWER для равенства, ILIKE для contains', () => {
    expect(
      text(
        { specialization: { name: { equals: 'Холод', mode: 'insensitive' } } },
        'ProblemCategorySpecialization',
      ),
    ).toContain('LOWER("t_1"."name") = LOWER($1)');
    expect(text({ problemText: { contains: 'x', mode: 'insensitive' } })).toBe(
      '"t"."problemText" ILIKE $1',
    );
    expect(
      values({ problemText: { contains: 'x', mode: 'insensitive' } }),
    ).toEqual(['%x%']);
  });

  it('колонка с @map берётся из схемы, а не из имени поля', () => {
    expect(text({ avatarUrl: null }, 'User')).toBe(
      '"t"."profilePhotoUrl" IS NULL',
    );
  });

  it('значения — параметры, а не текст запроса', () => {
    const evil = `x'); DROP TABLE "Ticket"; --`;
    expect(text({ id: evil })).not.toContain('DROP');
    expect(values({ id: evil })).toEqual([evil]);
  });
});

describe('SMA-MOBILE-LONG-TERM-TICKETS перевод WHERE: логика и связи', () => {
  it('ключи объекта — через AND; AND, OR, NOT', () => {
    expect(text({ companyId: 'c', assignedTechnicianId: 'u' })).toBe(
      '("t"."companyId" = $1 AND "t"."assignedTechnicianId" = $2)',
    );
    expect(
      text({
        OR: [{ assignedTechnicianId: 'u' }, { status: TicketStatus.NEW }],
      }),
    ).toBe(
      '("t"."assignedTechnicianId" = $1 OR "t"."status" = CAST($2 AS "TicketStatus"))',
    );
    expect(text({ NOT: { companyId: 'c' } })).toBe(
      'NOT ("t"."companyId" = $1)',
    );
  });

  it('пустые {} и AND: [] не сужают выборку', () => {
    expect(text({})).toBe('TRUE');
    expect(text({ AND: [] })).toBe('TRUE');
    expect(text({ AND: [{ companyId: 'c' }, {}] })).toBe(
      '"t"."companyId" = $1',
    );
    expect(text({ NOT: {} })).toBe('TRUE');
  });

  it('связь «к одному» и списки some/none — через EXISTS по ключам схемы', () => {
    expect(
      text({ problemCategory: { specializationLinks: { none: {} } } }),
    ).toBe(
      'EXISTS (SELECT 1 FROM "ProblemCategory" AS "t_1" WHERE "t_1"."id" = "t"."problemCategoryId" AND NOT EXISTS (SELECT 1 FROM "ProblemCategorySpecialization" AS "t_1_3" WHERE "t_1_3"."problemCategoryId" = "t_1"."id" AND TRUE))',
    );
    expect(
      text({
        problemCategory: {
          specializationLinks: { some: { specializationId: { in: ['s'] } } },
        },
      }),
    ).toContain('"t_1_3"."specializationId" IN ($1)');
  });

  it('связь null — пустой внешний ключ', () => {
    expect(text({ assignedTechnician: null })).toBe(
      '("t"."assignedTechnicianId" IS NULL)',
    );
    expect(text({ assignedTechnician: { isNot: null } })).toBe(
      'NOT ("t"."assignedTechnicianId" IS NULL)',
    );
  });

  it('настоящая форма SECONDARY-ограничения переводится целиком', () => {
    const where = {
      AND: [
        { companyId: 'client', status: { in: [TicketStatus.NEW] } },
        {
          OR: [
            { companyId: { notIn: ['client'] } },
            {
              AND: [
                { companyId: 'client' },
                {
                  OR: [
                    { assignedTechnicianId: { in: ['exec'] } },
                    { locationId: { in: ['loc'] } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(text(where)).toContain('"t"."assignedTechnicianId" IN ($');
    expect(values(where)).toEqual([
      'client',
      TicketStatus.NEW,
      'client',
      'client',
      'exec',
      'loc',
    ]);
  });
});

describe('SMA-MOBILE-LONG-TERM-TICKETS перевод WHERE: закрытый перевод', () => {
  const rejects = (where: unknown, model = 'Ticket') =>
    expect(() => compileWhere(model, where, 't')).toThrow(
      UnsupportedWhereError,
    );

  it('неизвестные поле, оператор и модель — отказ, а не пропуск условия', () => {
    rejects({ companyIdd: 'c' });
    rejects({ companyId: { like: 'c' } });
    rejects({ companyId: { search: 'c' } });
    rejects({}, 'NoSuchModel');
    rejects({ problemCategory: { specializationLinks: { many: {} } } });
  });

  it('пустой OR и пустые члены OR — отказ: Prisma трактует их по-разному в разных местах', () => {
    rejects({ OR: [] });
    rejects({ OR: [{}] });
    rejects({ OR: [{}, { companyId: 'c' }] });
    rejects({ OR: [{ OR: [] }, { companyId: 'c' }] });
    rejects({ problemCategory: { specializationLinks: { some: { OR: [] } } } });
  });

  it('пустой фильтр связи «к одному» — отказ', () => {
    rejects({ assignedTechnician: {} });
    rejects({ problemCategory: { is: {} } });
    rejects({ problemCategory: { specializationLinks: {} } });
  });

  it('значение не того типа — отказ', () => {
    rejects({ companyId: 1 });
    rejects({ plannedDueAt: { gte: 'не дата' } });
    rejects({ status: { in: [1] } });
    rejects({ OR: { companyId: 'c' } });
    rejects({ assignedTechnician: { role: UserRole.TECHNICIAN, is: null } });
  });
});
