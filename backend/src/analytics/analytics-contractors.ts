/**
 * SMA-ANALYTICS-CONTRACTORS — аналитика подрядных организаций.
 *
 * Чистый модуль: ни Prisma, ни Nest. Здесь решается, чья это работа и как она
 * считается; кто какие заявки видит, решено до вызова — строки приходят уже
 * суженными областью видимости Analytics V2 (resolveScope +
 * resolveScopedTicketWhere). Ни одна строка здесь не добавляется.
 *
 * Атрибуция — единственная связь заявки с подрядчиком, которую можно
 * подтвердить данными: исполнитель заявки (Ticket.assignedTechnician) состоит
 * в организации подрядчика, и у этой организации действующий договор с
 * клиентом. Точка, привязка подрядчика к точке или видимость заявки
 * подрядчику работу ему НЕ приписывают: SECONDARY видит заявки привязанных
 * точек, даже когда их выполняет другой исполнитель.
 */
import {
  buildCityAggregates,
  computeSlaMetrics,
  type CityAggregate,
  type SlaMetrics,
  type SlaSourceTicket,
} from './analytics-aggregates';

export type ContractorRole = 'PRIMARY' | 'SECONDARY';

export type ContractorRef = {
  companyId: string;
  name: string;
  role: ContractorRole;
};

export type ContractorTicketRow = {
  id: string;
  status: string;
  locationId: string;
  locationName: string | null;
  city: string | null;
  /** Organization of the assigned executor; null when the ticket has no executor. */
  executorCompanyId: string | null;
  createdAt: Date;
  closedAt: Date | null;
  slaDueAt: Date | null;
  slaBreachedAt: Date | null;
  firstResponseAt: Date | null;
};

/**
 * Счётчики разделяют два разных события: подрядчик сдал работу и клиент
 * заявку закрыл. Семантика статусов — по ticket.workflow.ts:
 *
 * - NEW, ASSIGNED, IN_PROGRESS — работа идёт;
 * - AWAITING_ACCEPTANCE — подрядчик сдал работу, ждёт приёмки клиентом;
 *   при отказе возвращается в IN_PROGRESS;
 * - FIELD_COMPLETE — подзаявка: полевая работа сдана, своей приёмки нет,
 *   закроется вместе с родительской (ticket-close-tree);
 * - DONE — принято и закрыто, стоит closedAt. Бывает и без шага приёмки
 *   (ASSIGNED/IN_PROGRESS → DONE).
 *
 * Тождества, которые держатся по построению:
 *   totalTickets = activeTickets + workCompletedTickets + canceledTickets
 *   workCompletedTickets = awaitingAcceptanceTickets + awaitingParentCloseTickets + closedTickets
 *   overdueActiveTickets + overdueAwaitingClosureTickets = sla.openOverdueCount
 */
export type ContractorCounters = {
  totalTickets: number;
  /** В работе: NEW, ASSIGNED, IN_PROGRESS. */
  activeTickets: number;
  /** Выполнено подрядчиком — работа сдана: AWAITING_ACCEPTANCE + FIELD_COMPLETE + DONE. */
  workCompletedTickets: number;
  /** Ждёт приёмки клиентом: AWAITING_ACCEPTANCE. */
  awaitingAcceptanceTickets: number;
  /** Подзаявка сдана, ждёт закрытия родительской: FIELD_COMPLETE. */
  awaitingParentCloseTickets: number;
  /** Принято и закрыто: DONE. */
  closedTickets: number;
  canceledTickets: number;
  /**
   * Текущая просрочка по правилу V2 (computeSlaMetrics.openOverdueCount:
   * не закрыта, не отменена, slaDueAt < now), разделённая по тому, на чьей
   * стороне заявка: работа ещё идёт — у подрядчика…
   */
  overdueActiveTickets: number;
  /** …работа сдана, но заявка не закрыта — ждёт клиента или родительскую. */
  overdueAwaitingClosureTickets: number;
};

export type ContractorLocationRow = ContractorCounters & {
  locationId: string;
  locationName: string | null;
  city: string | null;
  sla: SlaMetrics;
};

export type ContractorAnalyticsItem = {
  companyId: string;
  name: string;
  role: ContractorRole;
  counters: ContractorCounters;
  sla: SlaMetrics;
  cities: CityAggregate[];
  locations: ContractorLocationRow[];
};

export type ContractorAnalyticsResult = {
  contractors: ContractorAnalyticsItem[];
  /**
   * Заявки области без подтверждённого подрядчика: без исполнителя либо с
   * исполнителем организации без действующего договора (например, штат
   * клиента). null — актору сводка не положена (SECONDARY).
   */
  unattributed: ContractorCounters | null;
};

export type ContractorVisibilityMode =
  | 'tenant'
  | 'provider_primary'
  | 'provider_secondary'
  | 'platform_observer';

/**
 * Какие подрядчики клиента видны актору.
 *
 * - клиент (tenant) и наблюдатель платформы — все провайдеры с действующим
 *   договором: это исполнители заявок самого клиента;
 * - PRIMARY — себя и SECONDARY-подрядчиков этого клиента; чужой PRIMARY того
 *   же клиента ему не подотчётен;
 * - SECONDARY — только себя и только при собственном SECONDARY-договоре.
 *
 * Сводка «не отнесено» SECONDARY не положена: его область включает заявки
 * привязанных точек, которые выполняет не он, и итог по ним раскрывал бы
 * чужую работу.
 */
export function selectVisibleContractors(
  mode: ContractorVisibilityMode,
  actorCompanyId: string,
  contracted: readonly ContractorRef[],
): { contractors: ContractorRef[]; includeUnattributed: boolean } {
  if (mode === 'provider_secondary') {
    return {
      contractors: contracted.filter(
        (c) => c.companyId === actorCompanyId && c.role === 'SECONDARY',
      ),
      includeUnattributed: false,
    };
  }
  if (mode === 'provider_primary') {
    return {
      contractors: contracted.filter(
        (c) => c.companyId === actorCompanyId || c.role === 'SECONDARY',
      ),
      includeUnattributed: true,
    };
  }
  return { contractors: [...contracted], includeUnattributed: true };
}

const ACTIVE = new Set(['NEW', 'ASSIGNED', 'IN_PROGRESS']);

/** Подрядчик заявки или null. Других путей атрибуции нет. */
export function attributeTicket(
  row: Pick<ContractorTicketRow, 'executorCompanyId'>,
  contractorIds: ReadonlySet<string>,
): string | null {
  const companyId = row.executorCompanyId;
  return companyId && contractorIds.has(companyId) ? companyId : null;
}

export function emptyContractorCounters(): ContractorCounters {
  return {
    totalTickets: 0,
    activeTickets: 0,
    workCompletedTickets: 0,
    awaitingAcceptanceTickets: 0,
    awaitingParentCloseTickets: 0,
    closedTickets: 0,
    canceledTickets: 0,
    overdueActiveTickets: 0,
    overdueAwaitingClosureTickets: 0,
  };
}

/**
 * Счётчики набора заявок. Просрочка не пересчитывается своим правилом:
 * это openOverdueCount канонического computeSlaMetrics, применённого к
 * активным и к сданным-но-не-закрытым по отдельности.
 */
export function computeContractorCounters(
  rows: readonly ContractorTicketRow[],
  now: Date,
): ContractorCounters {
  const counters = emptyContractorCounters();
  const active: ContractorTicketRow[] = [];
  const awaitingClosure: ContractorTicketRow[] = [];

  for (const row of rows) {
    counters.totalTickets += 1;
    if (row.status === 'CANCELED') {
      counters.canceledTickets += 1;
    } else if (row.status === 'DONE') {
      counters.workCompletedTickets += 1;
      counters.closedTickets += 1;
    } else if (row.status === 'AWAITING_ACCEPTANCE') {
      counters.workCompletedTickets += 1;
      counters.awaitingAcceptanceTickets += 1;
      awaitingClosure.push(row);
    } else if (row.status === 'FIELD_COMPLETE') {
      counters.workCompletedTickets += 1;
      counters.awaitingParentCloseTickets += 1;
      awaitingClosure.push(row);
    } else if (ACTIVE.has(row.status)) {
      counters.activeTickets += 1;
      active.push(row);
    }
  }

  counters.overdueActiveTickets = computeSlaMetrics(
    active.map(toSlaSource),
    now,
  ).openOverdueCount;
  counters.overdueAwaitingClosureTickets = computeSlaMetrics(
    awaitingClosure.map(toSlaSource),
    now,
  ).openOverdueCount;
  return counters;
}

function toSlaSource(row: ContractorTicketRow): SlaSourceTicket {
  return {
    locationId: row.locationId,
    createdAt: row.createdAt,
    firstResponseAt: row.firstResponseAt,
    canceled: row.status === 'CANCELED',
    closedAt: row.closedAt,
    slaDueAt: row.slaDueAt,
    slaBreachedAt: row.slaBreachedAt,
  };
}

function buildItem(
  contractor: ContractorRef,
  rows: readonly ContractorTicketRow[],
  now: Date,
): ContractorAnalyticsItem {
  const byLocation = new Map<string, ContractorTicketRow[]>();

  for (const row of rows) {
    const bucket = byLocation.get(row.locationId);
    if (bucket) bucket.push(row);
    else byLocation.set(row.locationId, [row]);
  }

  const locations: ContractorLocationRow[] = Array.from(byLocation.values())
    .map((bucket) => {
      const first = bucket[0];
      return {
        locationId: first.locationId,
        locationName: first.locationName,
        city: first.city,
        ...computeContractorCounters(bucket, now),
        sla: computeSlaMetrics(bucket.map(toSlaSource), now),
      };
    })
    .sort(
      (a, b) =>
        b.totalTickets - a.totalTickets ||
        (a.locationName ?? '').localeCompare(b.locationName ?? '', 'ru-RU'),
    );

  /*
   * Города — агрегатором V2 и с полями в смысле V2, как в /analytics/locations:
   * doneTickets — DONE, awaitingAcceptanceTickets — AWAITING_ACCEPTANCE,
   * overdueTickets — исторические нарушения (slaBreachedAt), текущая
   * просрочка — city.sla.openOverdueCount. FIELD_COMPLETE V2 отдельным
   * полем не знает: он входит только в totalTickets города.
   */
  const cities = buildCityAggregates(
    Array.from(byLocation.entries()).map(([locationId, bucket]) => {
      const count = (status: string) =>
        bucket.filter((row) => row.status === status).length;
      return {
        locationId,
        city: bucket[0].city,
        totalTickets: bucket.length,
        newTickets: count('NEW'),
        inProgressTickets: count('ASSIGNED') + count('IN_PROGRESS'),
        awaitingAcceptanceTickets: count('AWAITING_ACCEPTANCE'),
        doneTickets: count('DONE'),
        canceledTickets: count('CANCELED'),
        overdueTickets: bucket.filter((row) => row.slaBreachedAt).length,
      };
    }),
    rows.map(toSlaSource),
    now,
  );

  return {
    companyId: contractor.companyId,
    name: contractor.name,
    role: contractor.role,
    counters: computeContractorCounters(rows, now),
    sla: computeSlaMetrics(rows.map(toSlaSource), now),
    cities,
    locations,
  };
}

/**
 * Разложить заявки области по подрядчикам.
 *
 * Подрядчик без заявок за период остаётся в ответе с нулями: отсутствие
 * работы — тоже показатель, и список не должен зависеть от периода.
 * Порядок: по числу заявок, при равенстве — по названию.
 */
export function buildContractorAnalytics(params: {
  rows: readonly ContractorTicketRow[];
  contractors: readonly ContractorRef[];
  includeUnattributed: boolean;
  now: Date;
}): ContractorAnalyticsResult {
  const contractorIds = new Set(params.contractors.map((c) => c.companyId));
  const rowsByContractor = new Map<string, ContractorTicketRow[]>();
  const unattributedRows: ContractorTicketRow[] = [];

  for (const row of params.rows) {
    const companyId = attributeTicket(row, contractorIds);
    if (!companyId) {
      unattributedRows.push(row);
      continue;
    }
    const bucket = rowsByContractor.get(companyId);
    if (bucket) bucket.push(row);
    else rowsByContractor.set(companyId, [row]);
  }

  const contractors = params.contractors
    .map((contractor) =>
      buildItem(
        contractor,
        rowsByContractor.get(contractor.companyId) ?? [],
        params.now,
      ),
    )
    .sort(
      (a, b) =>
        b.counters.totalTickets - a.counters.totalTickets ||
        a.name.localeCompare(b.name, 'ru-RU'),
    );

  return {
    contractors,
    unattributed: params.includeUnattributed
      ? computeContractorCounters(unattributedRows, params.now)
      : null,
  };
}
