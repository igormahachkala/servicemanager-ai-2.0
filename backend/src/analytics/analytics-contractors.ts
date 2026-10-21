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

export type ContractorCounters = {
  totalTickets: number;
  /** Выполнено: DONE, канонический момент завершения — closedAt. */
  completedTickets: number;
  /** Работа исполнителя сделана, ждёт приёмки клиентом или закрытия родителя. */
  awaitingClosureTickets: number;
  /** В работе: NEW, ASSIGNED, IN_PROGRESS. */
  activeTickets: number;
  /** Активные с прошедшим slaDueAt на момент ответа. */
  overdueTickets: number;
  canceledTickets: number;
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
const AWAITING_CLOSURE = new Set(['AWAITING_ACCEPTANCE', 'FIELD_COMPLETE']);

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
    completedTickets: 0,
    awaitingClosureTickets: 0,
    activeTickets: 0,
    overdueTickets: 0,
    canceledTickets: 0,
  };
}

function countInto(
  counters: ContractorCounters,
  row: ContractorTicketRow,
  nowMs: number,
) {
  counters.totalTickets += 1;
  if (row.status === 'DONE') counters.completedTickets += 1;
  else if (row.status === 'CANCELED') counters.canceledTickets += 1;
  else if (AWAITING_CLOSURE.has(row.status))
    counters.awaitingClosureTickets += 1;
  else if (ACTIVE.has(row.status)) {
    counters.activeTickets += 1;
    if (row.slaDueAt && row.slaDueAt.getTime() < nowMs)
      counters.overdueTickets += 1;
  }
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
  const nowMs = now.getTime();
  const counters = emptyContractorCounters();
  const byLocation = new Map<string, ContractorTicketRow[]>();

  for (const row of rows) {
    countInto(counters, row, nowMs);
    const bucket = byLocation.get(row.locationId);
    if (bucket) bucket.push(row);
    else byLocation.set(row.locationId, [row]);
  }

  const locations: ContractorLocationRow[] = Array.from(byLocation.values())
    .map((bucket) => {
      const locationCounters = emptyContractorCounters();
      for (const row of bucket) countInto(locationCounters, row, nowMs);
      const first = bucket[0];
      return {
        locationId: first.locationId,
        locationName: first.locationName,
        city: first.city,
        ...locationCounters,
        sla: computeSlaMetrics(bucket.map(toSlaSource), now),
      };
    })
    .sort(
      (a, b) =>
        b.totalTickets - a.totalTickets ||
        (a.locationName ?? '').localeCompare(b.locationName ?? '', 'ru-RU'),
    );

  /*
   * Города — тем же агрегатором V2, что и в аналитике по точкам: одинаковая
   * нормализация названия и «Город не указан» последним. В его полях
   * newTickets + inProgressTickets дают активные, overdueTickets — текущую
   * просрочку активных, как и в счётчиках подрядчика.
   */
  const cities = buildCityAggregates(
    locations.map((location) => {
      const bucket = byLocation.get(location.locationId) ?? [];
      return {
        locationId: location.locationId,
        city: location.city,
        totalTickets: location.totalTickets,
        newTickets: bucket.filter((row) => row.status === 'NEW').length,
        inProgressTickets:
          location.activeTickets -
          bucket.filter((row) => row.status === 'NEW').length,
        awaitingAcceptanceTickets: location.awaitingClosureTickets,
        doneTickets: location.completedTickets,
        canceledTickets: location.canceledTickets,
        overdueTickets: location.overdueTickets,
      };
    }),
    rows.map(toSlaSource),
    now,
  );

  return {
    companyId: contractor.companyId,
    name: contractor.name,
    role: contractor.role,
    counters,
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
  const unattributed = emptyContractorCounters();
  const nowMs = params.now.getTime();

  for (const row of params.rows) {
    const companyId = attributeTicket(row, contractorIds);
    if (!companyId) {
      countInto(unattributed, row, nowMs);
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
    unattributed: params.includeUnattributed ? unattributed : null,
  };
}
