/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await -- хранилище Prisma в памяти: строки и where намеренно any, как в technicians.service.spec.ts */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ServiceContractLocationMode,
  ServiceContractRole,
  ServiceContractStatus,
  UserRole,
} from '@prisma/client';

import { AnalyticsService } from './analytics.service';

/**
 * SMA-ANALYTICS-CONTRACTORS — кто чью работу видит.
 *
 * Заявки лежат в памяти, а where из сервиса исполняется (AND, OR, сравнения,
 * связь assignedTechnician). Поэтому проверяется результат, а не форма запроса:
 * чужая заявка не должна оказаться ни в счётчиках, ни в прочитанных строках.
 */

const CLIENT = 'client-1';
const OTHER_CLIENT = 'client-2';

const companies: Record<string, string> = {
  'prov-primary': 'Генподрядчик',
  'sub-a': 'Альфа',
  'sub-b': 'Бета',
  'other-primary': 'Чужой генподрядчик',
};

const contracts = [
  {
    clientCompanyId: CLIENT,
    providerCompanyId: 'prov-primary',
    role: ServiceContractRole.PRIMARY,
  },
  {
    clientCompanyId: CLIENT,
    providerCompanyId: 'sub-a',
    role: ServiceContractRole.SECONDARY,
  },
  {
    clientCompanyId: CLIENT,
    providerCompanyId: 'sub-b',
    role: ServiceContractRole.SECONDARY,
  },
  {
    clientCompanyId: OTHER_CLIENT,
    providerCompanyId: 'sub-a',
    role: ServiceContractRole.SECONDARY,
  },
  {
    clientCompanyId: OTHER_CLIENT,
    providerCompanyId: 'other-primary',
    role: ServiceContractRole.PRIMARY,
  },
].map((c) => ({ ...c, status: ServiceContractStatus.ACTIVE }));

const users = [
  { id: 'tech-p', companyId: 'prov-primary', isExecutor: true },
  { id: 'tech-a', companyId: 'sub-a', isExecutor: true },
  { id: 'tech-b', companyId: 'sub-b', isExecutor: true },
  { id: 'staff', companyId: CLIENT, isExecutor: true },
];

const locations: Record<
  string,
  { name: string; city: string | null; clientCompanyId: string }
> = {
  'loc-1': { name: 'Тверская', city: 'Москва', clientCompanyId: CLIENT },
  'loc-2': {
    name: 'Невский',
    city: 'Санкт-Петербург',
    clientCompanyId: CLIENT,
  },
  'loc-9': {
    name: 'Чужая точка',
    city: 'Казань',
    clientCompanyId: OTHER_CLIENT,
  },
};

/** sub-a привязан к loc-1: SECONDARY видит там и чужую работу. */
const providerBindings = [{ companyId: 'sub-a', locationId: 'loc-1' }];

const day = (d: number) =>
  new Date(`2026-10-${String(d).padStart(2, '0')}T09:00:00.000Z`);

const tickets = [
  {
    id: 't-a',
    companyId: CLIENT,
    locationId: 'loc-1',
    assignedTechnicianId: 'tech-a',
    status: 'DONE',
    createdAt: day(1),
    closedAt: day(2),
  },
  {
    id: 't-b',
    companyId: CLIENT,
    locationId: 'loc-1',
    assignedTechnicianId: 'tech-b',
    status: 'IN_PROGRESS',
    createdAt: day(3),
    closedAt: null,
  },
  {
    id: 't-p',
    companyId: CLIENT,
    locationId: 'loc-2',
    assignedTechnicianId: 'tech-p',
    status: 'ASSIGNED',
    createdAt: day(5),
    closedAt: null,
  },
  {
    id: 't-staff',
    companyId: CLIENT,
    locationId: 'loc-2',
    assignedTechnicianId: 'staff',
    status: 'DONE',
    createdAt: day(6),
    closedAt: day(7),
  },
  {
    id: 't-none',
    companyId: CLIENT,
    locationId: 'loc-1',
    assignedTechnicianId: null,
    status: 'NEW',
    createdAt: day(8),
    closedAt: null,
  },
  {
    id: 't-other',
    companyId: OTHER_CLIENT,
    locationId: 'loc-9',
    assignedTechnicianId: 'tech-a',
    status: 'DONE',
    createdAt: day(2),
    closedAt: day(3),
  },
].map((t) => ({ slaDueAt: null, slaBreachedAt: null, ...t }));

const executorCompanyOf = (userId: string | null) =>
  users.find((u) => u.id === userId)?.companyId ?? null;

function cmp(actual: any, expected: any): boolean {
  if (
    expected === null ||
    typeof expected !== 'object' ||
    expected instanceof Date
  ) {
    return expected instanceof Date
      ? actual?.getTime() === expected.getTime()
      : actual === expected;
  }
  return Object.entries(expected).every(([op, value]: [string, any]) => {
    if (op === 'equals') return actual === value;
    if (op === 'in') return value.includes(actual);
    if (op === 'gte') return actual >= value;
    if (op === 'lte') return actual <= value;
    throw new Error(`unsupported operator ${op}`);
  });
}

function matches(ticket: any, where: any): boolean {
  return Object.entries(where ?? {}).every(([key, value]: [string, any]) => {
    if (key === 'AND') return value.every((w: any) => matches(ticket, w));
    if (key === 'OR') return value.some((w: any) => matches(ticket, w));
    if (key === 'assignedTechnician') {
      const companyId = executorCompanyOf(ticket.assignedTechnicianId);
      return companyId !== null && cmp(companyId, value.companyId);
    }
    return cmp(ticket[key], value);
  });
}

function makeService() {
  const loaded: string[] = [];
  const prisma: any = {
    company: {
      findUnique: jest.fn(async ({ where }: any) =>
        companies[where.id] || where.id === CLIENT ? { id: where.id } : null,
      ),
    },
    serviceContract: {
      findMany: jest.fn(async ({ where }: any) =>
        contracts
          .filter(
            (c) =>
              c.clientCompanyId === where.clientCompanyId &&
              c.status === where.status,
          )
          .map((c) => ({
            providerCompanyId: c.providerCompanyId,
            role: c.role,
            providerCompany: { name: companies[c.providerCompanyId] },
          })),
      ),
    },
    user: {
      findMany: jest.fn(async ({ where }: any) =>
        users.filter(
          (u) =>
            u.companyId === where.companyId &&
            (where.isExecutor === undefined ||
              u.isExecutor === where.isExecutor),
        ),
      ),
    },
    userLocationBinding: {
      findMany: jest.fn(async ({ where }: any) => {
        if (where.userId) return []; // у акторов нет личных привязок: доступ на всю область договора
        return providerBindings.filter(
          (b) =>
            b.companyId === where.companyId &&
            locations[b.locationId].clientCompanyId ===
              where.location.clientCompanyId,
        );
      }),
    },
    ticket: {
      findMany: jest.fn(async ({ where }: any) =>
        tickets
          .filter((t) => matches(t, where))
          .map((t) => {
            loaded.push(t.id);
            const companyId = executorCompanyOf(t.assignedTechnicianId);
            return {
              ...t,
              location: {
                name: locations[t.locationId].name,
                city: locations[t.locationId].city,
              },
              assignedTechnician: companyId ? { companyId } : null,
            };
          }),
      ),
    },
    ticketStatusHistory: { groupBy: jest.fn(async () => []) },
  };

  const serviceContracts = {
    getLinkedClientAccess: jest.fn(
      async (providerCompanyId: string, clientCompanyId: string) => {
        const contract = contracts.find(
          (c) =>
            c.providerCompanyId === providerCompanyId &&
            c.clientCompanyId === clientCompanyId,
        );
        return contract
          ? {
              ...contract,
              locationMode: ServiceContractLocationMode.ALL_LOCATIONS,
            }
          : null;
      },
    ),
  };

  const service = new AnalyticsService(
    prisma,
    {} as any,
    serviceContracts as any,
  );
  return { service, prisma, loaded };
}

const byCompany = (result: any) =>
  Object.fromEntries(
    result.contractors.map((c: any) => [c.companyId, c.counters.totalTickets]),
  );

describe('GET /analytics/contractors — область видимости', () => {
  it('клиент видит всех своих подрядчиков и заявки без подрядчика', async () => {
    const { service } = makeService();

    const result: any = await service.getContractorsAnalytics(
      CLIENT,
      'client-admin',
      UserRole.ADMIN,
      {},
    );

    expect(byCompany(result)).toEqual({
      'prov-primary': 1,
      'sub-a': 1,
      'sub-b': 1,
    });
    // Штат клиента и неназначенная — не работа подрядчика.
    expect(result.unattributed.totalTickets).toBe(2);
    expect(result.meta.visibilityMode).toBe('tenant');
  });

  it('PRIMARY видит себя и SECONDARY своего клиента; чужой клиент не смешивается', async () => {
    const { service, loaded } = makeService();

    const result: any = await service.getContractorsAnalytics(
      'prov-primary',
      'p-admin',
      UserRole.ADMIN,
      {
        linkedClientCompanyId: CLIENT,
      },
    );

    expect(byCompany(result)).toEqual({
      'prov-primary': 1,
      'sub-a': 1,
      'sub-b': 1,
    });
    expect(result.unattributed.totalTickets).toBe(2);
    expect(
      result.contractors.find((c: any) => c.companyId === 'sub-a').role,
    ).toBe('SECONDARY');
    // Работа sub-a у другого клиента сюда не попадает.
    expect(loaded).not.toContain('t-other');
  });

  it('SECONDARY видит только свои данные, даже на точке, где работает другой', async () => {
    const { service, loaded } = makeService();

    const result: any = await service.getContractorsAnalytics(
      'sub-a',
      'a-admin',
      UserRole.ADMIN,
      {
        linkedClientCompanyId: CLIENT,
      },
    );

    expect(byCompany(result)).toEqual({ 'sub-a': 1 });
    expect(result.unattributed).toBeNull();
    expect(result.meta.visibilityMode).toBe('provider_secondary');
    // t-b на привязанной точке loc-1 SECONDARY видит в работе, но в аналитике
    // её нет даже среди прочитанных строк: фильтр стоит в самом запросе.
    expect(loaded).toEqual(['t-a']);
  });

  it('SECONDARY не может запросить чужого подрядчика — 404 без различия причин', async () => {
    const { service } = makeService();

    for (const contractorCompanyId of [
      'sub-b',
      'prov-primary',
      'no-such-company',
    ]) {
      await expect(
        service.getContractorsAnalytics('sub-a', 'a-admin', UserRole.ADMIN, {
          linkedClientCompanyId: CLIENT,
          contractorCompanyId,
        }),
      ).rejects.toThrow(new NotFoundException('Contractor not found'));
    }
  });

  it('PRIMARY не видит PRIMARY чужого клиента', async () => {
    const { service } = makeService();

    await expect(
      service.getContractorsAnalytics(
        'prov-primary',
        'p-admin',
        UserRole.ADMIN,
        {
          linkedClientCompanyId: CLIENT,
          contractorCompanyId: 'other-primary',
        },
      ),
    ).rejects.toThrow(new NotFoundException('Contractor not found'));
  });

  it('PRIMARY с фильтром подрядчика получает одну строку и без сводки', async () => {
    const { service, loaded } = makeService();

    const result: any = await service.getContractorsAnalytics(
      'prov-primary',
      'p-admin',
      UserRole.ADMIN,
      {
        linkedClientCompanyId: CLIENT,
        contractorCompanyId: 'sub-b',
      },
    );

    expect(byCompany(result)).toEqual({ 'sub-b': 1 });
    expect(result.unattributed).toBeNull();
    expect(loaded).toEqual(['t-b']);
  });

  it('провайдер без договора с клиентом получает отказ области V2', async () => {
    const { service } = makeService();

    await expect(
      service.getContractorsAnalytics(
        'other-primary',
        'x-admin',
        UserRole.ADMIN,
        {
          linkedClientCompanyId: CLIENT,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('период по createdAt сужает выборку', async () => {
    const { service } = makeService();

    const result: any = await service.getContractorsAnalytics(
      CLIENT,
      'client-admin',
      UserRole.ADMIN,
      {
        from: '2026-10-02',
        to: '2026-10-05',
      },
    );

    // t-a (1-е) за пределами; t-b (3-е) и t-p (5-е) внутри.
    expect(byCompany(result)).toEqual({
      'prov-primary': 1,
      'sub-a': 0,
      'sub-b': 1,
    });
    expect(result.unattributed.totalTickets).toBe(0);
    expect(result.period.from).toEqual(new Date('2026-10-02'));
  });
});
