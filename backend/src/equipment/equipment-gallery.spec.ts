import 'reflect-metadata';
import {
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { CompanyType, UserAccessLocationMode, UserRole } from '@prisma/client';
import { validate } from 'class-validator';
import { ManagementSurfaceGuard } from '../common/management-surface-access';
import { PERMISSIONS } from '../common/permissions.constants';
import { PERMISSIONS_KEY } from '../common/permissions.decorator';
import { PermissionsGuard } from '../common/permissions.guard';
import { RolesGuard } from '../common/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceContractsService } from '../service-contracts/service-contracts.service';
import { EquipmentController } from './equipment.controller';
import { EquipmentRepository } from './equipment.repository';
import { EquipmentService } from './equipment.service';
import { SelectEquipmentCoverDto } from './dto/select-equipment-cover.dto';

const CLIENT = 'gallery-client';
const EQUIPMENT = 'eq-1';
const VERSION = '2026-10-01T12:00:00.000Z';
const KEY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg';
const MIME_FILTER = {
  in: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  mode: 'insensitive',
};
const photo = (id: string, overrides = {}) => ({
  id,
  equipmentId: EQUIPMENT,
  companyId: CLIENT,
  storageKey: KEY,
  mimeType: 'image/jpeg',
  createdAt: new Date(VERSION),
  uploadedByUserId: 'private-actor',
  originalName: 'private-original.jpg',
  url: 'https://untrusted.example/photo.jpg',
  ...overrides,
});
type Photo = ReturnType<typeof photo>;
type PhotoWhere = {
  id?: string;
  equipmentId: string;
  companyId: string;
  mimeType: { in: string[] };
};
const matches = (row: Photo, where: PhotoWhere) =>
  (!where.id || row.id === where.id) &&
  row.equipmentId === where.equipmentId &&
  row.companyId === where.companyId &&
  where.mimeType.in.includes(row.mimeType.toLowerCase());

function harness(
  options: {
    hidden?: boolean;
    locationDenied?: boolean;
    secondary?: boolean;
    missing?: boolean;
    mainPhotoId?: string | null;
  } = {},
) {
  const equipment = {
    id: EQUIPMENT,
    companyId: CLIENT,
    locationId: 'loc-1',
    mainPhotoId:
      options.mainPhotoId === undefined ? 'photo-1' : options.mainPhotoId,
    updatedAt: new Date(VERSION),
  };
  const photos = [
    photo('photo-1'),
    photo('photo-2'),
    photo('foreign-equipment', { equipmentId: 'eq-2' }),
    photo('foreign-company', { companyId: 'other-client' }),
    photo('document', { mimeType: 'application/pdf' }),
    photo('active-image', { mimeType: 'image/svg+xml' }),
  ];
  const prisma = {
    company: {
      findUnique: jest.fn().mockResolvedValue({ type: CompanyType.CLIENT }),
    },
    user: { findFirst: jest.fn().mockResolvedValue({ id: 'actor' }) },
    userAccessScope: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          options.locationDenied
            ? { locationMode: UserAccessLocationMode.SELECTED_LOCATIONS }
            : null,
        ),
    },
    userLocationBinding: { findMany: jest.fn().mockResolvedValue([]) },
    equipmentAttachment: {
      findMany: jest
        .fn()
        .mockImplementation(({ where }: { where: PhotoWhere }) =>
          Promise.resolve(
            photos
              .filter((row) => matches(row, where))
              .map(({ id, storageKey, mimeType, createdAt }) => ({
                id,
                storageKey,
                mimeType,
                createdAt,
              })),
          ),
        ),
      findFirst: jest
        .fn()
        .mockImplementation(({ where }: { where: PhotoWhere }) =>
          Promise.resolve(photos.find((row) => matches(row, where)) ?? null),
        ),
    },
    equipment: {
      updateMany: jest
        .fn()
        .mockImplementation(
          ({
            where,
            data,
          }: {
            where: { updatedAt: Date; attachments: { some: PhotoWhere } };
            data: { mainPhotoId: string; updatedAt: Date };
          }) => {
            if (
              where.updatedAt.getTime() !== equipment.updatedAt.getTime() ||
              !photos.some((row) => matches(row, where.attachments.some))
            )
              return Promise.resolve({ count: 0 });
            Object.assign(equipment, data);
            return Promise.resolve({ count: 1 });
          },
        ),
    },
  };
  const repo = {
    findOne: jest
      .fn()
      .mockImplementation((companyId: string, id: string) =>
        Promise.resolve(
          options.hidden ||
            options.missing ||
            companyId !== CLIENT ||
            id !== EQUIPMENT
            ? null
            : { ...equipment },
        ),
      ),
    findOneById: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(options.missing ? null : { ...equipment }),
      ),
    findLocationById: jest.fn().mockResolvedValue({
      id: 'loc-1',
      clientCompanyId: CLIENT,
      isActive: true,
    }),
    update: jest.fn(),
  };
  const access = {
    role: 'PRIMARY',
    status: 'ACTIVE',
    effectiveLocationScope: { mode: 'tenant_wide', locationIds: [] },
  };
  const contracts = {
    getLinkedClientAccess: jest
      .fn()
      .mockResolvedValue(options.hidden ? null : access),
    assertPrimaryLinkedClientAccess: jest
      .fn()
      .mockImplementation(() =>
        options.hidden || options.secondary
          ? Promise.reject(new NotFoundException())
          : Promise.resolve(access),
      ),
  };
  const svc = new EquipmentService(
    repo as unknown as EquipmentRepository,
    prisma as unknown as PrismaService,
    contracts as unknown as ServiceContractsService,
  );
  const list = (
    companyId = CLIENT,
    role: UserRole = UserRole.ADMIN,
    requestedCompanyId?: string,
  ) => svc.listPhotos(companyId, 'actor', role, EQUIPMENT, requestedCompanyId);
  const select = (
    photoId = 'photo-2',
    expectedVersion = VERSION,
    companyId = CLIENT,
  ) =>
    svc.selectCover(companyId, 'actor', UserRole.ADMIN, EQUIPMENT, {
      photoId,
      expectedVersion,
    });
  return { svc, list, select, prisma, repo, equipment, photos, contracts };
}

describe('Equipment gallery metadata and canonical visibility', () => {
  it('returns every owned image in stable order, current cover and version, without private metadata or public URLs', async () => {
    const h = harness();
    const result = await h.list();
    expect(result.photos.map((row) => row.id)).toEqual(['photo-1', 'photo-2']);
    expect(result.mainPhotoId).toBe('photo-1');
    expect(result.version).toBe(VERSION);
    expect(result.photos[0]).toEqual({
      id: 'photo-1',
      url: `/uploads/equipment/${KEY}`,
      mimeType: 'image/jpeg',
      createdAt: new Date(VERSION),
    });
    expect(h.prisma.equipmentAttachment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: CLIENT,
          equipmentId: EQUIPMENT,
          mimeType: MIME_FILTER,
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(
      /private|uploadedBy|storageKey|originalName|https:|foreign|document/,
    );
  });

  it.each([{ hidden: true }, { missing: true }, { locationDenied: true }])(
    'denies invisible/missing equipment before reading any attachment metadata: %j',
    async (options) => {
      const h = harness(options);
      await expect(h.list()).rejects.toBeInstanceOf(NotFoundException);
      expect(h.prisma.equipmentAttachment.findMany).not.toHaveBeenCalled();
    },
  );

  it('denies a foreign company without an active link', async () => {
    const h = harness({ hidden: true });
    await expect(
      h.list('foreign-provider', UserRole.MASTER, CLIENT),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(h.prisma.equipmentAttachment.findMany).not.toHaveBeenCalled();
  });

  it('uses the existing provider/observer scope, rather than creating another access path', async () => {
    const h = harness();
    await expect(
      h.list('provider', UserRole.MASTER, CLIENT),
    ).resolves.toMatchObject({ mainPhotoId: 'photo-1' });
    expect(h.contracts.getLinkedClientAccess).toHaveBeenCalledWith(
      'provider',
      CLIENT,
    );
    // Preserve the canonical location resolver's cross-tenant observer denial.
    await expect(
      h.list('platform', UserRole.PLATFORM_ADMIN, CLIENT),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(h.prisma.equipmentAttachment.findMany).toHaveBeenCalledTimes(1);
  });

  it('includes legacy images with mixed-case MIME accepted by the original uploader', async () => {
    const h = harness();
    h.photos.push(photo('legacy-image', { mimeType: 'IMAGE/JPEG' }));
    expect((await h.list()).photos.map((row) => row.id)).toContain(
      'legacy-image',
    );
    expect((await h.select('legacy-image')).mainPhotoId).toBe('legacy-image');
    expect(h.prisma.equipmentAttachment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          equipmentId: EQUIPMENT,
          companyId: CLIENT,
          mimeType: {
            in: [
              'image/jpeg',
              'image/png',
              'image/webp',
              'image/heic',
              'image/heif',
            ],
            mode: 'insensitive',
          },
        },
      }),
    );
  });

  it('supports empty galleries and suppresses a legacy foreign/missing cover id', async () => {
    const h = harness({ mainPhotoId: 'foreign-company' });
    expect((await h.list()).mainPhotoId).toBeNull();
    h.photos.splice(0);
    expect(await h.list()).toEqual({
      photos: [],
      mainPhotoId: null,
      version: VERSION,
    });
  });
});

describe('Equipment gallery cover compare-and-set', () => {
  it('selects another image, returns server confirmation and preserves it on reload', async () => {
    const h = harness();
    const result = await h.select();
    expect(result.mainPhotoId).toBe('photo-2');
    expect(result.version).not.toBe(VERSION);
    expect(await h.list()).toEqual(result);
    expect(h.prisma.equipment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: EQUIPMENT,
          companyId: CLIENT,
          updatedAt: new Date(VERSION),
          attachments: {
            some: {
              id: 'photo-2',
              companyId: CLIENT,
              equipmentId: EQUIPMENT,
              mimeType: MIME_FILTER,
            },
          },
        },
      }),
    );
  });

  it.each([
    'foreign-equipment',
    'foreign-company',
    'document',
    'active-image',
    'missing-or-deleted',
  ])('rejects %s uniformly as 404 without a write', async (id) => {
    const h = harness();
    await expect(h.select(id)).rejects.toBeInstanceOf(NotFoundException);
    expect(h.prisma.equipment.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    { missing: true },
    { locationDenied: true },
    { hidden: true },
    { secondary: true },
  ])('keeps the canonical write gate for %j', async (options) => {
    const h = harness(options);
    await expect(h.select('photo-2', VERSION, 'provider')).rejects.toThrow();
    expect(h.prisma.equipmentAttachment.findFirst).not.toHaveBeenCalled();
    expect(h.prisma.equipment.updateMany).not.toHaveBeenCalled();
  });

  it('makes one concurrent choice win, rejecting the stale choice rather than silently overwriting it', async () => {
    const h = harness();
    const results = await Promise.allSettled([
      h.select('photo-2'),
      h.select('photo-1'),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === 'rejected')?.reason,
    ).toBeInstanceOf(ConflictException);
    expect((await h.list()).mainPhotoId).toBe('photo-2');
  });

  it('advances the version even if two writes occur in the same clock millisecond', async () => {
    const clock = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date(VERSION).getTime());
    try {
      const h = harness();
      const result = await h.select();
      expect(new Date(result.version).getTime()).toBe(
        new Date(VERSION).getTime() + 1,
      );
      await expect(h.select('photo-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    } finally {
      clock.mockRestore();
    }
  });

  it('does not replace a concurrently deleted image', async () => {
    const h = harness();
    h.prisma.equipmentAttachment.findFirst.mockImplementationOnce(
      ({ where }: { where: PhotoWhere }) => {
        const row = h.photos.find((p) => matches(p, where));
        h.photos.splice(
          h.photos.findIndex((p) => p.id === where.id),
          1,
        );
        return Promise.resolve(row ?? null);
      },
    );
    await expect(h.select()).rejects.toBeInstanceOf(ConflictException);
    expect(h.equipment.mainPhotoId).toBe('photo-1');
  });

  it('allows repairing a stale cover without exposing the foreign reference', async () => {
    const h = harness({ mainPhotoId: 'foreign-company' });
    const list = await h.list();
    expect(list.mainPhotoId).toBeNull();
    expect((await h.select('photo-2', list.version)).mainPhotoId).toBe(
      'photo-2',
    );
  });

  it('hardens the existing passport update against foreign-company or non-image covers too', async () => {
    const h = harness();
    await expect(
      h.svc.update(CLIENT, 'actor', UserRole.ADMIN, EQUIPMENT, {
        mainPhotoId: 'foreign-company',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      h.svc.update(CLIENT, 'actor', UserRole.ADMIN, EQUIPMENT, {
        mainPhotoId: 'document',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(h.repo.update).not.toHaveBeenCalled();
  });

  it('requires an explicit well-formed version and a photo id', async () => {
    expect(
      await validate(
        Object.assign(new SelectEquipmentCoverDto(), {
          photoId: 'photo-2',
          expectedVersion: VERSION,
        }),
      ),
    ).toHaveLength(0);
    expect(await validate(new SelectEquipmentCoverDto())).toHaveLength(2);
    expect(
      await validate(
        Object.assign(new SelectEquipmentCoverDto(), {
          photoId: '',
          expectedVersion: 'yesterday',
        }),
      ),
    ).toHaveLength(2);
  });
});

function context(method: 'selectCover' | 'listPhotos', role: UserRole) {
  return {
    getHandler: () => EquipmentController.prototype[method],
    getClass: () => EquipmentController,
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: 'actor', companyId: CLIENT, role } }),
    }),
  } as unknown as ExecutionContext;
}

describe('Equipment gallery guards are the existing equipment permission boundary', () => {
  it('allows only management roles for selecting, keeping platform/technician/client read-only', () => {
    const guard = new RolesGuard(new Reflector());
    for (const role of [UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER])
      expect(guard.canActivate(context('selectCover', role))).toBe(true);
    for (const role of [
      UserRole.TECHNICIAN,
      UserRole.CLIENT,
      UserRole.PLATFORM_ADMIN,
      UserRole.TERRITORIAL_MANAGER,
    ]) {
      expect(guard.canActivate(context('selectCover', role))).toBe(false);
      expect(guard.canActivate(context('listPhotos', role))).toBe(true);
    }
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        context('selectCover', UserRole.ADMIN).getHandler(),
      ),
    ).toContain(ManagementSurfaceGuard);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        context('listPhotos', UserRole.ADMIN).getHandler(),
      ),
    ).toEqual([PERMISSIONS.LOCATIONS_VIEW]);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        context('selectCover', UserRole.ADMIN).getHandler(),
      ),
    ).toEqual([PERMISSIONS.LOCATIONS_MANAGE]);
  });

  it('an ADMIN without the existing management permission is denied', async () => {
    const prisma = {
      permissionBlock: { count: jest.fn().mockResolvedValue(1) },
      company: {
        findUnique: jest.fn().mockResolvedValue({ type: CompanyType.CLIENT }),
      },
      rolePermission: { findFirst: jest.fn().mockResolvedValue(null) },
      userPermission: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const guard = new PermissionsGuard(
      new Reflector(),
      prisma as unknown as PrismaService,
    );
    await expect(
      guard.canActivate(context('selectCover', UserRole.ADMIN)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
