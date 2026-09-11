import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  CompanyType,
  ServiceContractRole,
  TicketAttachmentPurpose,
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
 * SMA-EQUIPMENT-HISTORY-PARTS-110B.
 *
 * Здесь намеренно НЕ подменяется доступ. EquipmentService собирается настоящий,
 * и история с комплектующими ходят через него же. Только так проверка
 * «SECONDARY не пишет» доказывает делегирование, а не повторяет заглушку.
 */

const CLIENT = 'client-company';
const PROVIDER = 'provider-company';
const OTHER_CLIENT = 'other-client-company';
const LOCATION = 'loc-allowed';
const EQUIPMENT = 'eq-1';
const TICKET = 'tk-1';

type World = {
  prisma: any;
  repo: any;
  equipment: EquipmentService;
  parts: EquipmentPartsService;
  history: EquipmentHistoryService;
};

function makeWorld(options: {
  role?: ServiceContractRole;
  locationMode?: UserAccessLocationMode | null;
  boundLocations?: string[];
  equipmentCompanyId?: string;
  installedParts?: any[];
  tickets?: any[];
  ticketExists?: boolean;
  partDefinition?: any;
  existingPart?: any;
} = {}): World {
  const role = options.role ?? ServiceContractRole.PRIMARY;
  const access = {
    role,
    status: 'ACTIVE',
    effectiveLocationScope: { mode: 'tenant_wide' as const, locationIds: [] },
  };
  const equipmentCompanyId = options.equipmentCompanyId ?? CLIENT;

  const created: any[] = [];
  const updated: any[] = [];

  const prisma: any = {
    company: {
      findUnique: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve({
          type: where.id === CLIENT || where.id === OTHER_CLIENT ? CompanyType.CLIENT : CompanyType.PROVIDER,
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
    ticket: {
      findMany: jest.fn().mockResolvedValue(options.tickets ?? []),
      findFirst: jest
        .fn()
        .mockResolvedValue(options.ticketExists === false ? null : { id: TICKET }),
    },
    partDefinition: {
      findFirst: jest.fn().mockResolvedValue(options.partDefinition ?? null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'pd-new', ...data })),
    },
    installedPart: {
      findMany: jest.fn().mockResolvedValue(options.installedParts ?? []),
      findFirst: jest.fn().mockResolvedValue(options.existingPart ?? null),
      findUnique: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve({
          ...(options.existingPart ?? {}),
          id: where.id,
          removedAt: updated.find((u) => u.id === where.id)?.data?.removedAt ?? null,
          removedTicketId: updated.find((u) => u.id === where.id)?.data?.removedTicketId ?? null,
          equipmentId: EQUIPMENT,
          quantity: 1,
        }),
      ),
      create: jest.fn().mockImplementation(({ data }: any) => {
        created.push(data);
        return Promise.resolve({ id: 'ip-new', ...data });
      }),
      update: jest.fn().mockImplementation(({ where, data }: any) => {
        updated.push({ id: where.id, data });
        return Promise.resolve({ id: where.id, ...data });
      }),
    },
  };
  prisma.$transaction = jest.fn().mockImplementation((fn: any) => fn(prisma));
  prisma.__created = created;
  prisma.__updated = updated;

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
    repo,
    equipment,
    parts: new EquipmentPartsService(prisma as PrismaService, equipment),
    history: new EquipmentHistoryService(prisma as PrismaService, equipment),
  };
}

const asClient = [CLIENT, 'actor-1', UserRole.ADMIN] as const;
const asProvider = [PROVIDER, 'actor-1', UserRole.MASTER] as const;

function ticketRow(over: Record<string, any> = {}) {
  return {
    id: TICKET,
    ticketNumber: 812,
    createdAt: new Date('2026-09-04T08:00:00Z'),
    closedAt: new Date('2026-09-04T12:00:00Z'),
    status: TicketStatus.DONE,
    problemText: 'Не морозит',
    problemCategory: { name: 'Холодильное' },
    assignedTechnician: {
      id: 'u-1',
      firstName: 'Иван',
      lastName: 'Иванов',
      email: 'ivanov@test.local',
      company: { id: PROVIDER, name: 'ИП Ермаков' },
    },
    statusHistory: [
      {
        toStatus: TicketStatus.AWAITING_ACCEPTANCE,
        comment: 'Заменил датчик температуры',
        createdAt: new Date('2026-09-04T11:00:00Z'),
        changedBy: null,
      },
    ],
    attachments: [
      {
        id: 'att-1',
        url: '/uploads/ticket-attachments/x.jpg',
        originalName: 'akt.jpg',
        mimeType: 'image/jpeg',
        createdAt: new Date('2026-09-04T11:05:00Z'),
      },
    ],
    ...over,
  };
}

describe('История оборудования', () => {
  it('пустая история не падает', async () => {
    const w = makeWorld({ tickets: [] });
    const res = await w.history.getHistory(...asClient, EQUIPMENT);
    expect(res.tickets).toEqual([]);
    expect(res.page.hasMore).toBe(false);
    expect(res.page.nextCursor).toBeNull();
  });

  it('показывает связанную заявку целиком', async () => {
    const w = makeWorld({ tickets: [ticketRow()] });
    const [entry] = (await w.history.getHistory(...asClient, EQUIPMENT)).tickets;

    expect(entry.ticketNumber).toBe(812);
    expect(entry.category).toBe('Холодильное');
    expect(entry.problem).toBe('Не морозит');
    expect(entry.status).toBe(TicketStatus.DONE);
    expect(entry.performedBy).toBe('Иванов Иван');
    expect(entry.performedByCompany).toBe('ИП Ермаков');
  });

  it('результат берётся из комментария приёмки, а не выдумывается из статуса', async () => {
    const w = makeWorld({ tickets: [ticketRow()] });
    const [entry] = (await w.history.getHistory(...asClient, EQUIPMENT)).tickets;
    expect(entry.result).toBe('Заменил датчик температуры');
  });

  it('без комментария результат остаётся пустым', async () => {
    const w = makeWorld({
      tickets: [ticketRow({ statusHistory: [{ toStatus: TicketStatus.DONE, comment: '   ', createdAt: new Date(), changedBy: null }] })],
    });
    const [entry] = (await w.history.getHistory(...asClient, EQUIPMENT)).tickets;
    expect(entry.result).toBeNull();
  });

  it('отдаёт вложения отчёта о работах', async () => {
    const w = makeWorld({ tickets: [ticketRow()] });
    const [entry] = (await w.history.getHistory(...asClient, EQUIPMENT)).tickets;
    expect(entry.workReports).toHaveLength(1);
    expect(entry.workReports[0].originalName).toBe('akt.jpg');
    // Запрошены именно отчёты о работах, а не все вложения заявки.
    const where = w.prisma.ticket.findMany.mock.calls[0][0].select.attachments.where;
    expect(where.purpose).toBe(TicketAttachmentPurpose.WORK_REPORT);
  });

  it('состав работ по деталям берётся из InstalledPart, а не из текста', async () => {
    const w = makeWorld({
      tickets: [ticketRow()],
      installedParts: [
        { id: 'ip-old', displayName: 'Вентилятор старый', serialNumber: 'S1', quantity: 1, installedTicketId: null, removedTicketId: TICKET },
        { id: 'ip-new', displayName: 'Вентилятор новый', serialNumber: 'S2', quantity: 1, installedTicketId: TICKET, removedTicketId: null },
      ],
    });
    const [entry] = (await w.history.getHistory(...asClient, EQUIPMENT)).tickets;

    expect(entry.partsInstalled.map((p) => p.name)).toEqual(['Вентилятор новый']);
    expect(entry.partsRemoved.map((p) => p.name)).toEqual(['Вентилятор старый']);
  });

  it('заявки запрашиваются в контуре владельца — изоляция арендаторов', async () => {
    const w = makeWorld({ tickets: [] });
    await w.history.getHistory(...asClient, EQUIPMENT);
    const where = w.prisma.ticket.findMany.mock.calls[0][0].where;
    expect(where.equipmentId).toBe(EQUIPMENT);
    expect(where.companyId).toBe(CLIENT);
  });

  it('чужая единица не отдаёт историю', async () => {
    const w = makeWorld({ equipmentCompanyId: OTHER_CLIENT, tickets: [ticketRow()] });
    await expect(w.history.getHistory(...asClient, EQUIPMENT)).rejects.toBeInstanceOf(NotFoundException);
    expect(w.prisma.ticket.findMany).not.toHaveBeenCalled();
  });

  it('площадка вне области закрывает историю', async () => {
    const w = makeWorld({
      tickets: [ticketRow()],
      locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      boundLocations: ['loc-other'],
    });
    await expect(w.history.getHistory(...asClient, EQUIPMENT)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('Комплектующие — чтение', () => {
  const installed = {
    id: 'ip-1',
    equipmentId: EQUIPMENT,
    companyId: CLIENT,
    displayName: 'Вентилятор',
    serialNumber: 'S1',
    quantity: 1,
    installedAt: new Date('2026-08-01T00:00:00Z'),
    removedAt: null,
    partDefinition: { id: 'pd-1', name: 'Вентилятор', unit: 'шт' },
  };
  const removed = { ...installed, id: 'ip-0', removedAt: new Date('2026-09-04T11:00:00Z') };

  it('разделяет «стоит сейчас» и «снято» на сервере', async () => {
    const w = makeWorld({ installedParts: [installed, removed] });
    const res = await w.parts.listForEquipment(...asClient, EQUIPMENT);

    expect(res.installed.map((p) => p.id)).toEqual(['ip-1']);
    expect(res.history.map((p) => p.id)).toEqual(['ip-0']);
  });

  it('status вычисляется из removedAt, отдельной колонки нет', async () => {
    const w = makeWorld({ installedParts: [installed, removed] });
    const res = await w.parts.listForEquipment(...asClient, EQUIPMENT);
    expect(res.installed[0].status).toBe('INSTALLED');
    expect(res.history[0].status).toBe('REMOVED');
  });

  it('выборка ограничена контуром владельца', async () => {
    const w = makeWorld({ installedParts: [] });
    await w.parts.listForEquipment(...asClient, EQUIPMENT);
    expect(w.prisma.installedPart.findMany.mock.calls[0][0].where).toMatchObject({
      equipmentId: EQUIPMENT,
      companyId: CLIENT,
    });
  });

  it('SECONDARY-провайдер читает комплектующие', async () => {
    const w = makeWorld({ role: ServiceContractRole.SECONDARY, installedParts: [installed] });
    const res = await w.parts.listForEquipment(...asProvider, EQUIPMENT, CLIENT);
    expect(res.installed).toHaveLength(1);
  });

  it('чужая единица не отдаёт комплектующие', async () => {
    const w = makeWorld({ equipmentCompanyId: OTHER_CLIENT });
    await expect(w.parts.listForEquipment(...asClient, EQUIPMENT)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('Комплектующие — установка', () => {
  it('клиент ставит деталь; владельцем строки остаётся клиентская компания', async () => {
    const w = makeWorld();
    const res = await w.parts.install(...asClient, EQUIPMENT, {
      displayName: 'Вентилятор', serialNumber: 'S1', quantity: '2',
    });
    expect(res.displayName).toBe('Вентилятор');
    const data = w.prisma.installedPart.create.mock.calls[0][0].data;
    expect(data.companyId).toBe(CLIENT);
    expect(data.equipmentId).toBe(EQUIPMENT);
    expect(String(data.quantity)).toBe('2');
  });

  it('PRIMARY-провайдер ставит деталь, владельцем остаётся клиент', async () => {
    const w = makeWorld({ role: ServiceContractRole.PRIMARY });
    await w.parts.install(...asProvider, EQUIPMENT, { displayName: 'Насос' });
    expect(w.prisma.installedPart.create.mock.calls[0][0].data.companyId).toBe(CLIENT);
  });

  it('первичная комплектация допускается без заявки', async () => {
    const w = makeWorld();
    await w.parts.install(...asClient, EQUIPMENT, { displayName: 'Фильтр' });
    expect(w.prisma.installedPart.create.mock.calls[0][0].data.installedTicketId).toBeNull();
    expect(w.prisma.ticket.findFirst).not.toHaveBeenCalled();
  });

  it('заявка из чужой единицы отклоняется', async () => {
    const w = makeWorld({ ticketExists: false });
    await expect(
      w.parts.install(...asClient, EQUIPMENT, { displayName: 'Фильтр', ticketId: TICKET }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('позиция каталога из чужого контура отклоняется', async () => {
    const w = makeWorld({ partDefinition: null });
    await expect(
      w.parts.install(...asClient, EQUIPMENT, { partDefinitionId: 'pd-foreign' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('имя берётся из каталога, но сохраняется в строке', async () => {
    const w = makeWorld({ partDefinition: { id: 'pd-1', name: 'Вентилятор 120мм', isActive: true } });
    await w.parts.install(...asClient, EQUIPMENT, { partDefinitionId: 'pd-1' });
    const data = w.prisma.installedPart.create.mock.calls[0][0].data;
    expect(data.displayName).toBe('Вентилятор 120мм');
    expect(data.partDefinitionId).toBe('pd-1');
  });

  it('нулевое и отрицательное количество отклоняются', async () => {
    const w = makeWorld();
    for (const q of ['0', '-1']) {
      await expect(
        w.parts.install(...asClient, EQUIPMENT, { displayName: 'X', quantity: q }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('SECONDARY-провайдер установить НЕ может', async () => {
    const w = makeWorld({ role: ServiceContractRole.SECONDARY });
    await expect(
      w.parts.install(...asProvider, EQUIPMENT, { displayName: 'Насос' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(w.prisma.installedPart.create).not.toHaveBeenCalled();
  });

  it('единица вне области площадок закрыта и для записи', async () => {
    const w = makeWorld({
      locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      boundLocations: ['loc-other'],
    });
    await expect(
      w.parts.install(...asProvider, EQUIPMENT, { displayName: 'Насос' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('Комплектующие — замена', () => {
  const existingPart = {
    id: 'ip-old',
    removedAt: null,
    displayName: 'Вентилятор старый',
    partDefinitionId: null,
  };

  it('старая строка закрывается, новая заводится — обе остаются', async () => {
    const w = makeWorld({ existingPart });
    const res = await w.parts.replace(...asClient, EQUIPMENT, 'ip-old', {
      ticketId: TICKET, displayName: 'Вентилятор новый', removalComment: 'заклинил',
    });

    const upd = w.prisma.installedPart.update.mock.calls[0][0];
    expect(upd.where.id).toBe('ip-old');
    expect(upd.data.removedAt).toBeInstanceOf(Date);
    expect(upd.data.removedTicketId).toBe(TICKET);
    expect(upd.data.removalComment).toBe('заклинил');

    const created = w.prisma.installedPart.create.mock.calls[0][0].data;
    expect(created.displayName).toBe('Вентилятор новый');
    expect(created.installedTicketId).toBe(TICKET);

    expect(res.removed.id).toBe('ip-old');
    expect(res.installed.displayName).toBe('Вентилятор новый');
  });

  it('замена НЕ переписывает старую строку: displayName не трогается', async () => {
    const w = makeWorld({ existingPart });
    await w.parts.replace(...asClient, EQUIPMENT, 'ip-old', { ticketId: TICKET, displayName: 'Новый' });
    const upd = w.prisma.installedPart.update.mock.calls[0][0];
    expect(upd.data.displayName).toBeUndefined();
    expect(upd.data.installedAt).toBeUndefined();
  });

  it('обе операции идут одной транзакцией', async () => {
    const w = makeWorld({ existingPart });
    await w.parts.replace(...asClient, EQUIPMENT, 'ip-old', { ticketId: TICKET, displayName: 'Новый' });
    expect(w.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('замена без заявки отклоняется', async () => {
    const w = makeWorld({ existingPart });
    await expect(
      w.parts.replace(...asClient, EQUIPMENT, 'ip-old', { ticketId: '', displayName: 'Новый' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(w.prisma.installedPart.update).not.toHaveBeenCalled();
  });

  it('уже снятую деталь снять повторно нельзя', async () => {
    const w = makeWorld({ existingPart: { ...existingPart, removedAt: new Date() } });
    await expect(
      w.parts.replace(...asClient, EQUIPMENT, 'ip-old', { ticketId: TICKET, displayName: 'Новый' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('деталь другой единицы не заменяется', async () => {
    const w = makeWorld({ existingPart: null });
    await expect(
      w.parts.replace(...asClient, EQUIPMENT, 'ip-foreign', { ticketId: TICKET, displayName: 'Новый' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('SECONDARY-провайдер заменить НЕ может', async () => {
    const w = makeWorld({ role: ServiceContractRole.SECONDARY, existingPart });
    await expect(
      w.parts.replace(...asProvider, EQUIPMENT, 'ip-old', { ticketId: TICKET, displayName: 'Новый' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(w.prisma.installedPart.update).not.toHaveBeenCalled();
    expect(w.prisma.installedPart.create).not.toHaveBeenCalled();
  });
});

describe('Справочник комплектующих', () => {
  it('позиция заводится в контуре клиента, а не провайдера', async () => {
    const w = makeWorld();
    await w.parts.createDefinition(...asProvider, {
      locationId: LOCATION, name: 'Вентилятор 120мм', article: 'VF-120', unit: 'шт',
    });
    expect(w.prisma.partDefinition.create.mock.calls[0][0].data.companyId).toBe(CLIENT);
  });

  it('SECONDARY-провайдер завести позицию НЕ может', async () => {
    const w = makeWorld({ role: ServiceContractRole.SECONDARY });
    await expect(
      w.parts.createDefinition(...asProvider, { locationId: LOCATION, name: 'X' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(w.prisma.partDefinition.create).not.toHaveBeenCalled();
  });

  it('в справочнике нет складских полей', async () => {
    const w = makeWorld();
    await w.parts.createDefinition(...asClient, { locationId: LOCATION, name: 'Вентилятор' });
    const data = w.prisma.partDefinition.create.mock.calls[0][0].data;
    for (const forbidden of ['stock', 'quantity', 'price', 'cost', 'reserved', 'writeOff']) {
      expect(Object.keys(data)).not.toContain(forbidden);
    }
  });

  it('поиск ограничен контуром', async () => {
    const w = makeWorld();
    await w.parts.listDefinitions(...asClient, { search: 'VF' });
    expect(w.prisma.partDefinition.findMany.mock.calls[0][0].where.companyId).toBe(CLIENT);
  });
});
