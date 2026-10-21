import {
  attributeTicket,
  buildContractorAnalytics,
  selectVisibleContractors,
  type ContractorRef,
  type ContractorTicketRow,
} from './analytics-contractors';

/**
 * SMA-ANALYTICS-CONTRACTORS — атрибуция, счётчики и видимость исполнением.
 */

const NOW = new Date('2026-10-20T12:00:00.000Z');

const PRIMARY: ContractorRef = {
  companyId: 'prov-primary',
  name: 'Генподрядчик',
  role: 'PRIMARY',
};
const SUB_A: ContractorRef = {
  companyId: 'sub-a',
  name: 'Альфа',
  role: 'SECONDARY',
};
const SUB_B: ContractorRef = {
  companyId: 'sub-b',
  name: 'Бета',
  role: 'SECONDARY',
};

let seq = 0;
function row(
  overrides: Partial<ContractorTicketRow> = {},
): ContractorTicketRow {
  seq += 1;
  return {
    id: `t-${seq}`,
    status: 'NEW',
    locationId: 'loc-1',
    locationName: 'Точка 1',
    city: 'Москва',
    executorCompanyId: null,
    createdAt: new Date('2026-10-01T09:00:00.000Z'),
    closedAt: null,
    slaDueAt: null,
    slaBreachedAt: null,
    firstResponseAt: null,
    ...overrides,
  };
}

describe('attributeTicket', () => {
  const ids = new Set(['sub-a']);

  it('работа подрядчика — только при исполнителе из его организации', () => {
    expect(attributeTicket({ executorCompanyId: 'sub-a' }, ids)).toBe('sub-a');
  });

  it('без исполнителя и с исполнителем без договора — не подрядчик', () => {
    expect(attributeTicket({ executorCompanyId: null }, ids)).toBeNull();
    expect(
      attributeTicket({ executorCompanyId: 'client-staff' }, ids),
    ).toBeNull();
  });
});

describe('buildContractorAnalytics — показатели', () => {
  it('выполненные, активные, просроченные, ожидают закрытия, отменённые', () => {
    const rows = [
      row({
        executorCompanyId: 'sub-a',
        status: 'DONE',
        closedAt: new Date('2026-10-01T11:00:00.000Z'),
      }),
      row({
        executorCompanyId: 'sub-a',
        status: 'IN_PROGRESS',
        slaDueAt: new Date('2026-10-19T00:00:00.000Z'),
      }),
      row({
        executorCompanyId: 'sub-a',
        status: 'ASSIGNED',
        slaDueAt: new Date('2026-10-21T00:00:00.000Z'),
      }),
      row({
        executorCompanyId: 'sub-a',
        status: 'AWAITING_ACCEPTANCE',
        slaDueAt: new Date('2026-10-19T00:00:00.000Z'),
      }),
      row({ executorCompanyId: 'sub-a', status: 'FIELD_COMPLETE' }),
      row({ executorCompanyId: 'sub-a', status: 'CANCELED' }),
    ];

    const [item] = buildContractorAnalytics({
      rows,
      contractors: [SUB_A],
      includeUnattributed: false,
      now: NOW,
    }).contractors;

    expect(item.counters).toEqual({
      totalTickets: 6,
      completedTickets: 1,
      awaitingClosureTickets: 2,
      activeTickets: 2,
      // Просрочка — только у активных: ожидающая приёмки работа уже сделана.
      overdueTickets: 1,
      canceledTickets: 1,
    });
  });

  it('SLA и среднее время выполнения — правилами Analytics V2', () => {
    const rows = [
      // 2 ч, в срок
      row({
        executorCompanyId: 'sub-a',
        status: 'DONE',
        createdAt: new Date('2026-10-01T09:00:00.000Z'),
        closedAt: new Date('2026-10-01T11:00:00.000Z'),
        slaDueAt: new Date('2026-10-01T12:00:00.000Z'),
      }),
      // 4 ч, с нарушением
      row({
        executorCompanyId: 'sub-a',
        status: 'DONE',
        createdAt: new Date('2026-10-02T09:00:00.000Z'),
        closedAt: new Date('2026-10-02T13:00:00.000Z'),
        slaDueAt: new Date('2026-10-02T12:00:00.000Z'),
        slaBreachedAt: new Date('2026-10-02T12:00:00.000Z'),
      }),
    ];

    const [item] = buildContractorAnalytics({
      rows,
      contractors: [SUB_A],
      includeUnattributed: false,
      now: NOW,
    }).contractors;

    expect(item.sla.avgResolutionMinutes).toBe(180);
    expect(item.sla.withinSlaRatio).toBe(0.5);
    expect(item.sla.withinSlaCount).toBe(1);
    expect(item.sla.slaEvaluatedCount).toBe(2);
    expect(item.sla.slaBreaches).toBe(1);
  });

  it('города и объекты: разбиение без потерь, «Город не указан» последним', () => {
    const rows = [
      row({
        executorCompanyId: 'sub-a',
        locationId: 'msk-1',
        locationName: 'Тверская',
        city: 'Москва',
      }),
      row({
        executorCompanyId: 'sub-a',
        locationId: 'msk-2',
        locationName: 'Арбат',
        city: ' москва ',
      }),
      row({
        executorCompanyId: 'sub-a',
        locationId: 'msk-2',
        locationName: 'Арбат',
        city: ' москва ',
      }),
      row({
        executorCompanyId: 'sub-a',
        locationId: 'x',
        locationName: 'Без города',
        city: null,
      }),
    ];

    const [item] = buildContractorAnalytics({
      rows,
      contractors: [SUB_A],
      includeUnattributed: false,
      now: NOW,
    }).contractors;

    expect(item.locations.map((l) => [l.locationId, l.totalTickets])).toEqual([
      ['msk-2', 2],
      ['x', 1],
      ['msk-1', 1],
    ]);
    // «Москва» и « москва » — одна группа по ключу нормализации V2.
    expect(
      item.cities.map((c) => [c.cityKey, c.totalTickets, c.locationsCount]),
    ).toEqual([
      ['москва', 3, 2],
      ['__no_city__', 1, 1],
    ]);
    expect(item.cities[1].cityLabel).toBe('Город не указан');
    expect(item.cities.reduce((s, c) => s + c.totalTickets, 0)).toBe(
      item.counters.totalTickets,
    );
  });

  it('работа не приписывается подрядчику без связи с исполнителем', () => {
    const rows = [
      row({ executorCompanyId: 'sub-a' }),
      // Точка подрядчика, но исполнитель — штат клиента.
      row({ executorCompanyId: 'client-staff' }),
      row({ executorCompanyId: null }),
      // Исполнитель организации без действующего договора.
      row({ executorCompanyId: 'sub-expired' }),
    ];

    const result = buildContractorAnalytics({
      rows,
      contractors: [SUB_A],
      includeUnattributed: true,
      now: NOW,
    });

    expect(result.contractors[0].counters.totalTickets).toBe(1);
    expect(result.unattributed?.totalTickets).toBe(3);
  });

  it('подрядчик без заявок остаётся с нулями; сортировка по объёму', () => {
    const result = buildContractorAnalytics({
      rows: [row({ executorCompanyId: 'sub-b' })],
      contractors: [SUB_A, SUB_B],
      includeUnattributed: false,
      now: NOW,
    });

    expect(
      result.contractors.map((c) => [c.companyId, c.counters.totalTickets]),
    ).toEqual([
      ['sub-b', 1],
      ['sub-a', 0],
    ]);
    expect(result.contractors[1].sla.withinSlaRatio).toBeNull();
    expect(result.unattributed).toBeNull();
  });
});

describe('selectVisibleContractors', () => {
  const contracted = [PRIMARY, SUB_A, SUB_B];

  it('клиент и наблюдатель видят всех провайдеров и сводку «не отнесено»', () => {
    for (const mode of ['tenant', 'platform_observer'] as const) {
      const visible = selectVisibleContractors(mode, 'client', contracted);
      expect(visible.contractors).toHaveLength(3);
      expect(visible.includeUnattributed).toBe(true);
    }
  });

  it('PRIMARY видит себя и SECONDARY, но не другой PRIMARY', () => {
    const otherPrimary: ContractorRef = {
      companyId: 'other-primary',
      name: 'Другой',
      role: 'PRIMARY',
    };
    const visible = selectVisibleContractors(
      'provider_primary',
      'prov-primary',
      [...contracted, otherPrimary],
    );
    expect(visible.contractors.map((c) => c.companyId).sort()).toEqual([
      'prov-primary',
      'sub-a',
      'sub-b',
    ]);
  });

  it('SECONDARY видит только себя и без сводки по чужим заявкам', () => {
    const visible = selectVisibleContractors(
      'provider_secondary',
      'sub-a',
      contracted,
    );
    expect(visible.contractors.map((c) => c.companyId)).toEqual(['sub-a']);
    expect(visible.includeUnattributed).toBe(false);
  });

  it('SECONDARY без собственного SECONDARY-договора не видит никого', () => {
    expect(
      selectVisibleContractors('provider_secondary', 'prov-primary', contracted)
        .contractors,
    ).toEqual([]);
    expect(
      selectVisibleContractors('provider_secondary', 'stranger', contracted)
        .contractors,
    ).toEqual([]);
  });
});
