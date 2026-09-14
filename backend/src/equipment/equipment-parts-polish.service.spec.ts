import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  CompanyType,
  ServiceContractRole,
  TicketStatus,
  UserAccessLocationMode,
  UserRole,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ServiceContractsService } from '../service-contracts/service-contracts.service';
import { EquipmentRepository } from './equipment.repository';
import { EquipmentService } from './equipment.service';
import { EquipmentHistoryService } from './equipment-history.service';
import { EquipmentPartsService } from './equipment-parts.service';

/**
 * SMA-EQUIPMENT-PARTS-POLISH-110C.
 *
 * Доступ здесь не подменяется: EquipmentService собирается настоящий, и
 * снятие, правка и управление каталогом ходят через него же. Иначе проверка
 * «SECONDARY не пишет» доказывала бы только качество заглушки.
 */

const CLIENT = 'client-company';
const PROVIDER = 'provider-company';
const OTHER_CLIENT = 'other-client-company';
const LOCATION = 'loc-allowed';
const EQUIPMENT = 'eq-1';
const TICKET = 'tk-1';
const PART = 'ip-1';

function makeWorld(options: {
  role?: ServiceContractRole;
  locationMode?: UserAccessLocationMode | null;
  boundLocations?: string[];
  equipmentCompanyId?: string;
  existingPart?: any;
  partDefinition?: any;
  definitionRow?: any;
  ticketExists?: boolean;
  tickets?: any[];
} = {}) {
  const role = options.role ?? ServiceContractRole.PRIMARY;
  const access = {
    role,
    status: 'ACTIVE',
    effectiveLocationScope: { mode: 'tenant_wide' as const, locationIds: [] },
  };
  const equipmentCompanyId = options.equipmentCompanyId ?? CLIENT;

  const prisma: any = {
    company: {
      findUnique: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve({
          type:
            where.id === CLIENT || where.id === OTHER_CLIENT
              ? CompanyType.CLIENT
              : CompanyType.PROVIDER,
        }),
      ),
    },
    user: { findFirst: jest.fn().mockResolvedValue({ id: 'actor-1' }) },
    userAccessScope: {
      findUnique: jest
        .fn()
        .mockResolvedValue(options.locationMode ? { locationMode: options.locationMode } : null),
    },
    userLocationBinding: {
      findMany: jest
        .fn()
        .mockResolvedValue((options.boundLocations ?? []).map((id) => ({ locationId: id }))),
    },
    location: { findFirst: jest.fn().mockResolvedValue({ id: LOCATION }) },
    ticket: {
      findMany: jest.fn().mockResolvedValue(options.tickets ?? []),
      findFirst: jest
        .fn()
        .mockResolvedValue(options.ticketExists === false ? null : { id: TICKET }),
    },
    partDefinition: {
      findFirst: jest.fn().mockResolvedValue(
        'definitionRow' in options ? options.definitionRow : options.partDefinition ?? null,
      ),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'pd-new', ...data })),
      update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ id: where.id, ...data })),
    },
    installedPart: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(options.existingPart ?? null),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'ip-new', ...data })),
      update: jest.fn().mockImplementation(({ where, data }: any) =>
        Promise.resolve({ id: where.id, quantity: 1, ...data }),
      ),
    },
    domainEvent: { create: jest.fn().mockResolvedValue({ id: 'ev-1' }) },
  };
  prisma.$transaction = jest.fn().mockImplementation((fn: any) => fn(prisma));

  const repo: any = {
    findLocation: jest.fn().mockResolvedValue({ id: LOCATION }),
    findLocationById: jest
      .fn()
      .mockResolvedValue({ id: LOCATION, clientCompanyId: CLIENT, isActive: true }),
    findAllByLocation: jest.fn().mockResolvedValue([]),
    findAllByCompany: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockImplementation((companyId: string, id: string) =>
      Promise.resolve(
        companyId === equipmentCompanyId
          ? { id, companyId: equipmentCompanyId, locationId: LOCATION, name: 'Котёл' }
          : null,
      ),
    ),
    findOneById: jest
      .fn()
      .mockResolvedValue({ id: EQUIPMENT, companyId: equipmentCompanyId, locationId: LOCATION }),
    create: jest.fn(),
    update: jest.fn(),
  };

  const contracts: any = {
    getLinkedClientAccess: jest.fn().mockResolvedValue(access),
    assertPrimaryLinkedClientAccess: jest.fn().mockImplementation(() =>
      role === ServiceContractRole.PRIMARY
        ? Promise.resolve(access)
        : Promise.reject(new BadRequestException('SECONDARY provider cannot write')),
    ),
  };

  const equipment = new EquipmentService(
    repo as EquipmentRepository,
    prisma as PrismaService,
    contracts as ServiceContractsService,
  );
  return {
    prisma,
    parts: new EquipmentPartsService(prisma as PrismaService, equipment),
    history: new EquipmentHistoryService(prisma as PrismaService, equipment),
  };
}

const asClient = [CLIENT, 'actor-1', UserRole.ADMIN] as const;
const asProvider = [PROVIDER, 'actor-1', UserRole.MASTER] as const;

const installedPart = {
  id: PART,
  removedAt: null,
  displayName: 'Вентилятор',
  partDefinitionId: null,
  serialNumber: 'SN-1',
  quantity: 1,
  comment: null,
  removalComment: null,
};

// ── 1. Снятие без замены ───────────────────────────────────────────────────

describe('Снятие комплектующей без замены', () => {
  it('проставляет дату, заявку, исполнителя и комментарий', async () => {
    const w = makeWorld({ existingPart: installedPart });

    await w.parts.removePart(...asClient, EQUIPMENT, PART, {
      ticketId: TICKET, removalComment: 'вышел из строя, замена завтра',
    });

    const data = w.prisma.installedPart.update.mock.calls[0][0].data;
    expect(data.removedAt).toBeInstanceOf(Date);
    expect(data.removedTicketId).toBe(TICKET);
    expect(data.removedByUserId).toBe('actor-1');
    expect(data.removalComment).toBe('вышел из строя, замена завтра');
  });

  it('НЕ создаёт строку замены', async () => {
    const w = makeWorld({ existingPart: installedPart });
    await w.parts.removePart(...asClient, EQUIPMENT, PART, { ticketId: TICKET });
    expect(w.prisma.installedPart.create).not.toHaveBeenCalled();
  });

  it('снятая деталь уходит из «установлено сейчас», но остаётся в истории', async () => {
    const removed = { ...installedPart, id: PART, removedAt: new Date('2026-09-10T10:00:00Z') };
    const w = makeWorld();
    w.prisma.installedPart.findMany.mockResolvedValue([removed]);

    const res = await w.parts.listForEquipment(...asClient, EQUIPMENT);

    expect(res.installed).toEqual([]);
    expect(res.history.map((p) => p.id)).toEqual([PART]);
    expect(res.history[0].status).toBe('REMOVED');
  });

  it('снятие без заявки допускается — административная операция', async () => {
    const w = makeWorld({ existingPart: installedPart });
    await w.parts.removePart(...asClient, EQUIPMENT, PART, {});
    expect(w.prisma.installedPart.update.mock.calls[0][0].data.removedTicketId).toBeNull();
    expect(w.prisma.ticket.findFirst).not.toHaveBeenCalled();
  });

  it('заявка из чужой единицы отклоняется', async () => {
    const w = makeWorld({ existingPart: installedPart, ticketExists: false });
    await expect(
      w.parts.removePart(...asClient, EQUIPMENT, PART, { ticketId: TICKET }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(w.prisma.installedPart.update).not.toHaveBeenCalled();
  });

  it('повторное снятие отклоняется', async () => {
    const w = makeWorld({ existingPart: { ...installedPart, removedAt: new Date() } });
    await expect(
      w.parts.removePart(...asClient, EQUIPMENT, PART, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(w.prisma.installedPart.update).not.toHaveBeenCalled();
  });

  it('деталь другой единицы не снимается', async () => {
    const w = makeWorld({ existingPart: null });
    await expect(
      w.parts.removePart(...asClient, EQUIPMENT, 'ip-foreign', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('SECONDARY снять НЕ может', async () => {
    const w = makeWorld({ role: ServiceContractRole.SECONDARY, existingPart: installedPart });
    await expect(
      w.parts.removePart(...asProvider, EQUIPMENT, PART, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(w.prisma.installedPart.update).not.toHaveBeenCalled();
  });
});

// ── 2. Исправление административных полей ─────────────────────────────────

describe('Исправление установленной детали', () => {
  it('правит серийный номер, количество и комментарий', async () => {
    const w = makeWorld({ existingPart: installedPart });

    await w.parts.correctPart(...asClient, EQUIPMENT, PART, {
      serialNumber: 'SN-ИСПРАВЛЕН', quantity: '3', comment: 'уточнено',
    });

    const data = w.prisma.installedPart.update.mock.calls[0][0].data;
    expect(data.serialNumber).toBe('SN-ИСПРАВЛЕН');
    expect(String(data.quantity)).toBe('3');
    expect(data.comment).toBe('уточнено');
  });

  it('ИСТОРИЯ ЗАЩИЩЕНА: даты, заявки и исполнители не переписываются', async () => {
    const w = makeWorld({ existingPart: installedPart });

    await w.parts.correctPart(...asClient, EQUIPMENT, PART, {
      serialNumber: 'SN-2',
      // Эти поля DTO не принимает; даже если просочатся — сервис их игнорирует.
      installedAt: '2020-01-01', removedAt: '2020-01-02',
      installedTicketId: 'tk-other', removedTicketId: 'tk-other',
      installedByUserId: 'someone', removedByUserId: 'someone',
    } as any);

    const data = w.prisma.installedPart.update.mock.calls[0][0].data;
    for (const forbidden of [
      'installedAt', 'removedAt', 'installedTicketId', 'removedTicketId',
      'installedByUserId', 'removedByUserId',
    ]) {
      expect(data).not.toHaveProperty(forbidden);
    }
  });

  it('правка пишется в DomainEvent — канонический журнал', async () => {
    const w = makeWorld({ existingPart: installedPart });

    await w.parts.correctPart(...asClient, EQUIPMENT, PART, { serialNumber: 'SN-2' });

    const ev = w.prisma.domainEvent.create.mock.calls[0][0].data;
    expect(ev.entityType).toBe('InstalledPart');
    expect(ev.entityId).toBe(PART);
    expect(ev.type).toBe('equipment.part_corrected');
    expect(ev.actorUserId).toBe('actor-1');
    expect(ev.companyId).toBe(CLIENT);
    expect(ev.payload.fields).toContain('serialNumber');
    expect(ev.payload.before.serialNumber).toBe('SN-1');
  });

  it('пустой запрос отклоняется, журнал не засоряется', async () => {
    const w = makeWorld({ existingPart: installedPart });
    await expect(
      w.parts.correctPart(...asClient, EQUIPMENT, PART, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(w.prisma.domainEvent.create).not.toHaveBeenCalled();
  });

  it('привязку к каталогу можно снять', async () => {
    const w = makeWorld({ existingPart: installedPart });
    await w.parts.correctPart(...asClient, EQUIPMENT, PART, { partDefinitionId: '' });
    expect(w.prisma.installedPart.update.mock.calls[0][0].data.partDefinitionId).toBeNull();
  });

  it('нельзя привязать выведенную из обращения позицию', async () => {
    const w = makeWorld({
      existingPart: installedPart,
      definitionRow: { id: 'pd-1', isActive: false },
    });
    await expect(
      w.parts.correctPart(...asClient, EQUIPMENT, PART, { partDefinitionId: 'pd-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('нулевое количество отклоняется', async () => {
    const w = makeWorld({ existingPart: installedPart });
    await expect(
      w.parts.correctPart(...asClient, EQUIPMENT, PART, { quantity: '0' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('SECONDARY править НЕ может', async () => {
    const w = makeWorld({ role: ServiceContractRole.SECONDARY, existingPart: installedPart });
    await expect(
      w.parts.correctPart(...asProvider, EQUIPMENT, PART, { serialNumber: 'X' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(w.prisma.installedPart.update).not.toHaveBeenCalled();
  });
});

// ── 3. Управление каталогом ────────────────────────────────────────────────

describe('Справочник комплектующих: правка и вывод из обращения', () => {
  const definition = { id: 'pd-1', companyId: CLIENT };

  it('правит поля позиции', async () => {
    const w = makeWorld({ definitionRow: definition });
    await w.parts.updateDefinition(...asClient, 'pd-1', {
      name: 'Вентилятор 140мм', article: 'VF-140', unit: 'шт',
    });
    const data = w.prisma.partDefinition.update.mock.calls[0][0].data;
    expect(data.name).toBe('Вентилятор 140мм');
    expect(data.article).toBe('VF-140');
  });

  it('вывод из обращения — это isActive=false, а не удаление', async () => {
    const w = makeWorld({ definitionRow: definition });
    await w.parts.updateDefinition(...asClient, 'pd-1', { isActive: false });
    expect(w.prisma.partDefinition.update.mock.calls[0][0].data.isActive).toBe(false);
    expect((w.prisma.partDefinition as any).delete).toBeUndefined();
  });

  it('выведенную позицию нельзя поставить заново', async () => {
    const w = makeWorld({ definitionRow: { id: 'pd-1', name: 'Старая', isActive: false } });
    await expect(
      w.parts.install(...asClient, EQUIPMENT, { partDefinitionId: 'pd-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(w.prisma.installedPart.create).not.toHaveBeenCalled();
  });

  it('и нельзя выбрать при замене', async () => {
    const w = makeWorld({
      existingPart: installedPart,
      definitionRow: { id: 'pd-1', name: 'Старая', isActive: false },
    });
    await expect(
      w.parts.replace(...asClient, EQUIPMENT, PART, { ticketId: TICKET, partDefinitionId: 'pd-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('по умолчанию каталог отдаёт только действующие позиции', async () => {
    const w = makeWorld();
    await w.parts.listDefinitions(...asClient, {});
    expect(w.prisma.partDefinition.findMany.mock.calls[0][0].where.isActive).toBe(true);
  });

  it('экран управления может запросить и выведенные', async () => {
    const w = makeWorld();
    await w.parts.listDefinitions(...asClient, { includeInactive: true });
    expect(w.prisma.partDefinition.findMany.mock.calls[0][0].where.isActive).toBeUndefined();
  });

  it('позиция чужого контура не правится', async () => {
    const w = makeWorld({ definitionRow: null });
    await expect(
      w.parts.updateDefinition(...asClient, 'pd-foreign', { name: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('SECONDARY править каталог НЕ может', async () => {
    const w = makeWorld({ role: ServiceContractRole.SECONDARY, definitionRow: definition });
    await expect(
      w.parts.updateDefinition(...asProvider, 'pd-1', { isActive: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(w.prisma.partDefinition.update).not.toHaveBeenCalled();
  });
});

// ── 4. Пагинация истории ───────────────────────────────────────────────────

function ticketRow(n: number, iso: string) {
  return {
    id: `tk-${n}`,
    ticketNumber: n,
    createdAt: new Date(iso),
    closedAt: null,
    status: TicketStatus.DONE,
    problemText: `проблема ${n}`,
    problemCategory: null,
    assignedTechnician: null,
    statusHistory: [],
    attachments: [],
  };
}

describe('Пагинация истории', () => {
  it('без курсора берётся размер страницы по умолчанию', async () => {
    const w = makeWorld({ tickets: [] });
    const res = await w.history.getHistory(...asClient, EQUIPMENT);
    expect(res.page.limit).toBe(25);
    // Запрашивается на одну больше — так узнаём «есть ли ещё» без count.
    expect(w.prisma.ticket.findMany.mock.calls[0][0].take).toBe(26);
  });

  it('порядок строгий: createdAt desc, затем id desc', async () => {
    const w = makeWorld({ tickets: [] });
    await w.history.getHistory(...asClient, EQUIPMENT);
    expect(w.prisma.ticket.findMany.mock.calls[0][0].orderBy).toEqual([
      { createdAt: 'desc' }, { id: 'desc' },
    ]);
  });

  it('лишняя строка не попадает в выдачу, но даёт курсор', async () => {
    const rows = [ticketRow(3, '2026-09-03'), ticketRow(2, '2026-09-02'), ticketRow(1, '2026-09-01')];
    const w = makeWorld({ tickets: rows });

    const res = await w.history.getHistory(...asClient, EQUIPMENT, undefined, { limit: 2 });

    expect(res.tickets.map((t) => t.ticketNumber)).toEqual([3, 2]);
    expect(res.page.hasMore).toBe(true);
    expect(res.page.nextCursor).toBeTruthy();
  });

  it('последняя страница закрывает пагинацию', async () => {
    const w = makeWorld({ tickets: [ticketRow(1, '2026-09-01')] });
    const res = await w.history.getHistory(...asClient, EQUIPMENT, undefined, { limit: 5 });
    expect(res.page.hasMore).toBe(false);
    expect(res.page.nextCursor).toBeNull();
  });

  it('СТРАНИЦЫ НЕ ПЕРЕСЕКАЮТСЯ: курсор отсекает строго меньшие', async () => {
    const rows = [ticketRow(3, '2026-09-03'), ticketRow(2, '2026-09-02'), ticketRow(1, '2026-09-01')];
    const w = makeWorld({ tickets: rows });
    const first = await w.history.getHistory(...asClient, EQUIPMENT, undefined, { limit: 2 });

    await w.history.getHistory(...asClient, EQUIPMENT, undefined, {
      limit: 2, cursor: first.page.nextCursor!,
    });

    const where = w.prisma.ticket.findMany.mock.calls[1][0].where;
    // Ничья по дате разрывается по id — иначе строка повторилась бы.
    expect(where.OR).toEqual([
      { createdAt: { lt: new Date('2026-09-02') } },
      { createdAt: new Date('2026-09-02'), id: { lt: 'tk-2' } },
    ]);
  });

  it('курсор не расширяет доступ: контур владельца остаётся в запросе', async () => {
    const w = makeWorld({ tickets: [ticketRow(1, '2026-09-01')] });
    const first = await w.history.getHistory(...asClient, EQUIPMENT, undefined, { limit: 1 });
    await w.history.getHistory(...asClient, EQUIPMENT, undefined, { cursor: first.page.nextCursor ?? undefined });
    for (const call of w.prisma.ticket.findMany.mock.calls) {
      expect(call[0].where.companyId).toBe(CLIENT);
      expect(call[0].where.equipmentId).toBe(EQUIPMENT);
    }
  });

  it('битый курсор отклоняется, а не игнорируется молча', async () => {
    const w = makeWorld({ tickets: [] });
    await expect(
      w.history.getHistory(...asClient, EQUIPMENT, undefined, { cursor: 'не-курсор' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('размер страницы ограничен сверху', async () => {
    const w = makeWorld({ tickets: [] });
    const res = await w.history.getHistory(...asClient, EQUIPMENT, undefined, { limit: 100000 });
    expect(res.page.limit).toBe(100);
  });

  it('детали тянутся только по заявкам страницы, а не по всей единице', async () => {
    const w = makeWorld({ tickets: [ticketRow(1, '2026-09-01')] });
    await w.history.getHistory(...asClient, EQUIPMENT, undefined, { limit: 5 });
    const where = w.prisma.installedPart.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { installedTicketId: { in: ['tk-1'] } },
      { removedTicketId: { in: ['tk-1'] } },
    ]);
  });

  it('пустая страница не запрашивает детали вовсе', async () => {
    const w = makeWorld({ tickets: [] });
    await w.history.getHistory(...asClient, EQUIPMENT);
    expect(w.prisma.installedPart.findMany).not.toHaveBeenCalled();
  });

  it('чужая единица не отдаёт страницу истории', async () => {
    const w = makeWorld({ equipmentCompanyId: OTHER_CLIENT, tickets: [ticketRow(1, '2026-09-01')] });
    await expect(w.history.getHistory(...asClient, EQUIPMENT)).rejects.toBeInstanceOf(NotFoundException);
  });
});
