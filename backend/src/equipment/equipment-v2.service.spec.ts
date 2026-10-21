import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  CompanyType,
  ServiceContractRole,
  UserAccessLocationMode,
  UserRole,
} from '@prisma/client';

// Снимок пишется в общий uploads/, поэтому в тестах диск подменяется:
// проверяется решение сервиса, а не файловая система.
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

import { PrismaService } from '../prisma/prisma.service';
import { ServiceContractsService } from '../service-contracts/service-contracts.service';
import { EquipmentRepository } from './equipment.repository';
import { EquipmentService } from './equipment.service';

/**
 * SMA-EQUIPMENT-V2-110A.
 *
 * Проверяется то, что добавила V2: паспортные поля, статусы, поиск с фильтрами
 * и снимки. Правила владения и доступа не переписываются — они уже покрыты
 * equipment.service.spec.ts, здесь лишь подтверждается, что новые операции
 * ходят через ту же проверку записи.
 */

const CLIENT = 'client-company';
const PROVIDER = 'provider-company';
const LOCATION = 'loc-allowed';
const EQUIPMENT = 'eq-1';

function makePrisma(options: {
  locationMode?: UserAccessLocationMode | null;
  locationIds?: string[];
  attachment?: { id: string } | null;
} = {}) {
  return {
    company: {
      findUnique: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve({
          type: where.id === CLIENT ? CompanyType.CLIENT : CompanyType.PROVIDER,
        }),
      ),
    },
    user: { findFirst: jest.fn().mockResolvedValue({ id: 'admin-1' }) },
    userAccessScope: {
      findUnique: jest
        .fn()
        .mockResolvedValue(options.locationMode ? { locationMode: options.locationMode } : null),
    },
    userLocationBinding: {
      findMany: jest
        .fn()
        .mockResolvedValue((options.locationIds ?? []).map((id) => ({ locationId: id }))),
    },
    equipmentAttachment: {
      findFirst: jest
        .fn()
        .mockResolvedValue('attachment' in options ? options.attachment : { id: 'att-1' }),
      create: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'att-new', url: data.url, originalName: data.originalName }),
      ),
    },
  } as any;
}

function makeRepo(options: { mainPhotoId?: string | null } = {}) {
  return {
    findLocation: jest.fn().mockResolvedValue({ id: LOCATION }),
    findLocationById: jest
      .fn()
      .mockResolvedValue({ id: LOCATION, clientCompanyId: CLIENT, isActive: true }),
    findAllByLocation: jest.fn().mockResolvedValue([]),
    findAllByCompany: jest.fn().mockResolvedValue([{ id: EQUIPMENT }]),
    findOne: jest.fn().mockResolvedValue({ id: EQUIPMENT, companyId: CLIENT, locationId: LOCATION }),
    findOneById: jest.fn().mockResolvedValue({
      id: EQUIPMENT,
      companyId: CLIENT,
      locationId: LOCATION,
      mainPhotoId: options.mainPhotoId ?? null,
    }),
    create: jest.fn().mockImplementation((data) => Promise.resolve({ id: EQUIPMENT, ...data })),
    update: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
  } as any;
}

function makeContracts(role: ServiceContractRole = ServiceContractRole.PRIMARY) {
  const access = {
    role,
    status: 'ACTIVE',
    effectiveLocationScope: { mode: 'tenant_wide' as const, locationIds: [] },
  };
  return {
    getLinkedClientAccess: jest.fn().mockResolvedValue(access),
    assertPrimaryLinkedClientAccess: jest.fn().mockImplementation(() =>
      role === ServiceContractRole.PRIMARY
        ? Promise.resolve(access)
        : Promise.reject(new BadRequestException('SECONDARY provider cannot write')),
    ),
  } as any;
}

function makeService(prisma: any, repo: any, contracts: any) {
  return new EquipmentService(
    repo as EquipmentRepository,
    prisma as PrismaService,
    contracts as ServiceContractsService,
  );
}

const PHOTO = {
  originalname: 'boiler.jpg',
  mimetype: 'image/jpeg',
  size: 1024,
  buffer: Buffer.from('x'),
};

describe('Equipment V2 — паспортные поля', () => {
  it('клиент создаёт своё оборудование с паспортом; владелец — компания площадки', async () => {
    const repo = makeRepo();
    const service = makeService(makePrisma(), repo, makeContracts());

    await service.create(CLIENT, 'admin-1', UserRole.ADMIN, {
      locationId: LOCATION,
      name: 'Котёл',
      type: 'heating',
      manufacturer: 'Bosch',
      model: 'GB162',
      serialNumber: 'SN-1',
      inventoryNumber: 'INV-1',
      commissionedAt: '2026-01-15',
      warrantyUntil: '2028-01-15',
      description: 'Котёл в подсобке',
    } as any);

    const data = repo.create.mock.calls[0][0];
    expect(data.companyId).toBe(CLIENT);
    expect(data.manufacturer).toBe('Bosch');
    expect(data.serialNumber).toBe('SN-1');
    expect(data.inventoryNumber).toBe('INV-1');
    expect(data.commissionedAt).toBeInstanceOf(Date);
    expect(data.warrantyUntil).toBeInstanceOf(Date);
  });

  it('PRIMARY-провайдер создаёт оборудование клиенту, владельцем остаётся клиент', async () => {
    const repo = makeRepo();
    const service = makeService(makePrisma(), repo, makeContracts(ServiceContractRole.PRIMARY));

    await service.create(PROVIDER, 'master-1', UserRole.MASTER, {
      locationId: LOCATION,
      name: 'Холодильник',
      type: 'fridge',
    } as any);

    // Ключевой инвариант: провайдер оператор, но не владелец.
    expect(repo.create.mock.calls[0][0].companyId).toBe(CLIENT);
    expect(repo.create.mock.calls[0][0].companyId).not.toBe(PROVIDER);
  });

  it('SECONDARY-провайдер писать не может', async () => {
    const repo = makeRepo();
    const service = makeService(
      makePrisma(),
      repo,
      makeContracts(ServiceContractRole.SECONDARY),
    );

    await expect(
      service.create(PROVIDER, 'master-1', UserRole.MASTER, {
        locationId: LOCATION,
        name: 'Насос',
        type: 'pump',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('незаполненные паспортные поля не пишутся вовсе', async () => {
    const repo = makeRepo();
    const service = makeService(makePrisma(), repo, makeContracts());

    await service.create(CLIENT, 'admin-1', UserRole.ADMIN, {
      locationId: LOCATION,
      name: 'Котёл',
      type: 'heating',
    } as any);

    const data = repo.create.mock.calls[0][0];
    expect('manufacturer' in data).toBe(false);
    expect('serialNumber' in data).toBe(false);
  });

  it('пустая строка в правке очищает поле, а не оставляет прежнее', async () => {
    const repo = makeRepo();
    const service = makeService(makePrisma(), repo, makeContracts());

    await service.update(CLIENT, 'admin-1', UserRole.ADMIN, EQUIPMENT, {
      manufacturer: '   ',
    } as any);

    expect(repo.update.mock.calls[0][1]).toEqual({ manufacturer: null });
  });

  it('некорректная дата отклоняется', async () => {
    const service = makeService(makePrisma(), makeRepo(), makeContracts());

    await expect(
      service.update(CLIENT, 'admin-1', UserRole.ADMIN, EQUIPMENT, {
        commissionedAt: 'не-дата',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Equipment V2 — статусы', () => {
  it.each(['ACTIVE', 'INACTIVE', 'REPAIR', 'DECOMMISSIONED'])(
    'принимает статус %s',
    async (status) => {
      const repo = makeRepo();
      const service = makeService(makePrisma(), repo, makeContracts());

      await service.update(CLIENT, 'admin-1', UserRole.ADMIN, EQUIPMENT, { status } as any);

      expect(repo.update.mock.calls[0][1].status).toBe(status);
    },
  );

  it('произвольный статус больше не принимается', async () => {
    const service = makeService(makePrisma(), makeRepo(), makeContracts());

    await expect(
      service.update(CLIENT, 'admin-1', UserRole.ADMIN, EQUIPMENT, {
        status: 'ЧТО-УГОДНО',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('мягкое удаление продолжает ставить INACTIVE', async () => {
    // Именно поэтому status остался строкой: предложенный enum это значение не содержал.
    const repo = makeRepo();
    const service = makeService(makePrisma(), repo, makeContracts());

    await service.remove(CLIENT, 'admin-1', UserRole.ADMIN, EQUIPMENT);

    expect(repo.update).toHaveBeenCalledWith(EQUIPMENT, { status: 'INACTIVE' });
  });
});

describe('Equipment V2 — список, поиск и фильтры', () => {
  it('поиск и фильтры уходят в запрос, а не фильтруются в памяти', async () => {
    const repo = makeRepo();
    const service = makeService(makePrisma(), repo, makeContracts());

    await service.findAllByCompany(CLIENT, 'admin-1', UserRole.ADMIN, {
      search: 'SN-1',
      locationId: LOCATION,
      status: 'active',
    });

    const params = repo.findAllByCompany.mock.calls[0][1];
    expect(params.search).toBe('SN-1');
    expect(params.locationId).toBe(LOCATION);
    expect(params.status).toBe('ACTIVE');
  });

  it('недопустимый статус в фильтре отклоняется', async () => {
    const service = makeService(makePrisma(), makeRepo(), makeContracts());

    await expect(
      service.findAllByCompany(CLIENT, 'admin-1', UserRole.ADMIN, { status: 'МУСОР' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('пользователь, привязанный к площадкам, видит только их парк', async () => {
    const repo = makeRepo();
    const prisma = makePrisma({
      locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      locationIds: [LOCATION],
    });
    const service = makeService(prisma, repo, makeContracts());

    await service.findAllByCompany(CLIENT, 'user-1', UserRole.TERRITORIAL_MANAGER, {});

    expect(repo.findAllByCompany.mock.calls[0][1].locationIds).toEqual([LOCATION]);
  });

  it('пустая область площадок возвращает пустой список, а не весь парк', async () => {
    const repo = makeRepo();
    const prisma = makePrisma({
      locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      locationIds: [],
    });
    const service = makeService(prisma, repo, makeContracts());

    await expect(
      service.findAllByCompany(CLIENT, 'user-1', UserRole.TERRITORIAL_MANAGER, {}),
    ).resolves.toEqual([]);
    expect(repo.findAllByCompany).not.toHaveBeenCalled();
  });
});

describe('Equipment V2 — снимки', () => {
  it('загрузка проходит проверку записи и сохраняет вложение владельцу площадки', async () => {
    const repo = makeRepo();
    const prisma = makePrisma();
    const service = makeService(prisma, repo, makeContracts());

    await service.uploadPhoto(CLIENT, 'admin-1', UserRole.ADMIN, EQUIPMENT, PHOTO);

    const data = prisma.equipmentAttachment.create.mock.calls[0][0].data;
    expect(data.companyId).toBe(CLIENT);
    expect(data.equipmentId).toBe(EQUIPMENT);
    // Путь ведёт в защищённую раздачу, а не в публичный каталог.
    expect(data.url).toMatch(/^\/uploads\/equipment\//);
  });

  it('первый снимок становится обложкой', async () => {
    const repo = makeRepo({ mainPhotoId: null });
    const service = makeService(makePrisma(), repo, makeContracts());

    await service.uploadPhoto(CLIENT, 'admin-1', UserRole.ADMIN, EQUIPMENT, PHOTO);

    expect(repo.update).toHaveBeenCalledWith(EQUIPMENT, { mainPhotoId: 'att-new' });
  });

  it('следующий снимок обложку не подменяет', async () => {
    const repo = makeRepo({ mainPhotoId: 'att-existing' });
    const service = makeService(makePrisma(), repo, makeContracts());

    await service.uploadPhoto(CLIENT, 'admin-1', UserRole.ADMIN, EQUIPMENT, PHOTO);

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('SECONDARY-провайдер снимок загрузить не может', async () => {
    const prisma = makePrisma();
    const service = makeService(
      prisma,
      makeRepo(),
      makeContracts(ServiceContractRole.SECONDARY),
    );

    await expect(
      service.uploadPhoto(PROVIDER, 'master-1', UserRole.MASTER, EQUIPMENT, PHOTO),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.equipmentAttachment.create).not.toHaveBeenCalled();
  });

  it('не-изображение отклоняется', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, makeRepo(), makeContracts());

    await expect(
      service.uploadPhoto(CLIENT, 'admin-1', UserRole.ADMIN, EQUIPMENT, {
        ...PHOTO,
        mimetype: 'application/pdf',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.equipmentAttachment.create).not.toHaveBeenCalled();
  });

  it('обложкой нельзя назначить чужое вложение', async () => {
    const service = makeService(makePrisma({ attachment: null }), makeRepo(), makeContracts());

    await expect(
      service.update(CLIENT, 'admin-1', UserRole.ADMIN, EQUIPMENT, {
        mainPhotoId: 'att-of-another-equipment',
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('обложку можно снять', async () => {
    const repo = makeRepo();
    const service = makeService(makePrisma(), repo, makeContracts());

    await service.update(CLIENT, 'admin-1', UserRole.ADMIN, EQUIPMENT, {
      mainPhotoId: '',
    } as any);

    expect(repo.update.mock.calls[0][1]).toEqual({ mainPhotoId: null });
  });
});
