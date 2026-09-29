import { TicketPriority, TicketStatus, UserRole } from '@prisma/client';

import { TicketsPolicy } from '../policy/tickets.policy';

/**
 * SMA-MOBILE-URGENT-TICKETS-CARD-120.
 *
 * Срочность доски — это priority, и только он. Решение продуктовое: именно
 * priority задаёт окно SLA (URGENT — 2 часа, NORMAL — сутки), тогда как
 * urgency остаётся пометкой заявителя и в расчёты не входит.
 *
 * Здесь закрепляется не столько сам фильтр, сколько его место: условие
 * ложится пересечением поверх уже вычисленного охвата и никогда не
 * становится основой выборки. Обратный порядок дал бы срочные заявки всего
 * тенанта, и это ровно та ошибка, ради которой написан этот файл.
 */

const ACTOR = {
  id: 'u-1',
  companyId: 'co-1',
  role: UserRole.TECHNICIAN,
} as any;

const policy = new TicketsPolicy();

/** Итоговый where решения политики: именно он уходит в выборку доски. */
function whereFor(actor: any, input: any = {}) {
  const decision = policy.boardWhere(actor, input) as any;
  expect(decision.allowed).toBe(true);
  return decision.where.where as any;
}

/** Собрать все условия ветки AND в плоский список, на любой глубине. */
function flattenAnd(where: any): any[] {
  if (!where || typeof where !== 'object') return [];
  const out: any[] = [where];
  const and = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
  for (const item of and) out.push(...flattenAnd(item));
  return out;
}

function hasPriorityCondition(where: any, value: TicketPriority): boolean {
  return flattenAnd(where).some((node) => node?.priority === value);
}

describe('120 срочность — это priority', () => {
  it('NC2. priority=URGENT попадает в условие выборки', () => {
    const where = whereFor(ACTOR, { priority: TicketPriority.URGENT });

    expect(hasPriorityCondition(where, TicketPriority.URGENT)).toBe(true);
  });

  it('NC1/NC3. без запроса срочности условие не появляется', () => {
    /*
     * Ни urgency, ни близость срока SLA сами по себе выборку не сужают:
     * это другие признаки, и доска их в priority не превращает.
     */
    const where = whereFor(ACTOR, {});

    expect(hasPriorityCondition(where, TicketPriority.URGENT)).toBe(false);
    expect(JSON.stringify(where)).not.toContain('urgency');
  });

  it('NC1. urgency в фильтр доски не принимается вовсе', () => {
    const where = whereFor(ACTOR, { urgency: 'URGENT' } as any);

    expect(JSON.stringify(where)).not.toContain('urgency');
    expect(hasPriorityCondition(where, TicketPriority.URGENT)).toBe(false);
  });

  it('NORMAL тоже выражается — фильтр не зашит на одно значение', () => {
    const where = whereFor(ACTOR, { priority: TicketPriority.NORMAL });

    expect(hasPriorityCondition(where, TicketPriority.NORMAL)).toBe(true);
  });
});

describe('120 срочность только сужает охват', () => {
  it('NC9. охват техника остаётся на месте рядом с фильтром', () => {
    const withoutFilter = whereFor(ACTOR, {});
    const withFilter = whereFor(ACTOR, { priority: TicketPriority.URGENT });

    // Компания и привязка к исполнителю — из охвата, а не из фильтра.
    expect(JSON.stringify(withoutFilter)).toContain('co-1');
    expect(JSON.stringify(withFilter)).toContain('co-1');
    expect(JSON.stringify(withFilter)).toContain('assignedTechnicianId');
  });

  it('NC9. срочность не выносится выше охвата', () => {
    const where = whereFor(ACTOR, { priority: TicketPriority.URGENT });

    /*
     * Верхний уровень остаётся охватом: companyId на месте, а priority живёт
     * внутри AND. Если бы условие стало корнем, companyId ушёл бы в ветку
     * и выборка перестала бы быть ограниченной компанией.
     */
    expect(where.companyId).toBe('co-1');
    expect(where.priority).toBeUndefined();
    expect(hasPriorityCondition(where, TicketPriority.URGENT)).toBe(true);
  });

  it('NC9. фильтр по локации не расширяет охват и складывается с срочностью', () => {
    const where = whereFor(ACTOR, {
      priority: TicketPriority.URGENT,
      locationId: 'loc-1',
    });

    expect(where.companyId).toBe('co-1');
    expect(flattenAnd(where).some((node) => node?.locationId === 'loc-1')).toBe(true);
    expect(hasPriorityCondition(where, TicketPriority.URGENT)).toBe(true);
  });

  it('NC7. управленческая роль получает свой текущий охват, фильтр его не меняет', () => {
    const master = { id: 'u-2', companyId: 'co-1', role: UserRole.MASTER } as any;

    const withoutFilter = whereFor(master, {});
    const withFilter = whereFor(master, { priority: TicketPriority.URGENT });

    // Новой модели охвата у мастера не появилось: как было, так и осталось.
    expect(withFilter.companyId).toBe(withoutFilter.companyId);
    expect(withFilter.assignedTechnicianId).toBeUndefined();
    expect(hasPriorityCondition(withFilter, TicketPriority.URGENT)).toBe(true);
  });

  it('NC5. техник без права видеть всё остаётся привязан к себе и со срочностью', () => {
    const where = whereFor(ACTOR, { priority: TicketPriority.URGENT });

    expect(where.assignedTechnicianId).toBe('u-1');
  });

  it('срочность сочетается со статусами, не подменяя их', () => {
    const where = whereFor(ACTOR, {
      priority: TicketPriority.URGENT,
      statuses: [TicketStatus.NEW],
    });

    expect(hasPriorityCondition(where, TicketPriority.URGENT)).toBe(true);
    expect(JSON.stringify(where)).toContain('NEW');
  });
});
