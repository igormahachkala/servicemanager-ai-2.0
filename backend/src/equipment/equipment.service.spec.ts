import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  CompanyType,
  ServiceContractRole,
  UserAccessLocationMode,
  UserRole,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ServiceContractsService } from '../service-contracts/service-contracts.service';
import { EquipmentRepository } from './equipment.repository';
import { EquipmentService } from './equipment.service';

describe('EquipmentService location scope', () => {
  const clientCompanyId = 'client-company';
  const providerCompanyId = 'provider-company';
  const locationId = 'loc-allowed';
  const equipmentId = 'eq-1';

  type CompanyFindUniqueArgs = { where: { id: string } };

  function makePrismaMock(
    locationMode: UserAccessLocationMode | null = null,
    locationIds: string[] = [],
  ) {
    return {
      company: {
        findUnique: jest
          .fn()
          .mockImplementation(({ where }: CompanyFindUniqueArgs) =>
            Promise.resolve({
              type:
                where.id === clientCompanyId
                  ? CompanyType.CLIENT
                  : CompanyType.PROVIDER,
            }),
          ),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'admin-1' }),
      },
      userAccessScope: {
        findUnique: jest
          .fn()
          .mockResolvedValue(locationMode ? { locationMode } : null),
      },
      userLocationBinding: {
        findMany: jest
          .fn()
          .mockResolvedValue(locationIds.map((id) => ({ locationId: id }))),
      },
    };
  }

  function makeRepoMock(params?: {
    clientCompanyId?: string;
    equipmentCompanyId?: string;
  }) {
    const resolvedClientCompanyId = params?.clientCompanyId ?? clientCompanyId;
    return {
      findLocation: jest.fn().mockResolvedValue({ id: locationId }),
      findLocationById: jest.fn().mockResolvedValue({
        id: locationId,
        clientCompanyId: resolvedClientCompanyId,
        isActive: true,
      }),
      findAllByLocation: jest
        .fn()
        .mockResolvedValue([{ id: equipmentId, locationId }]),
      findOne: jest.fn().mockResolvedValue({
        id: equipmentId,
        companyId: resolvedClientCompanyId,
        locationId,
      }),
      findOneById: jest.fn().mockResolvedValue({
        id: equipmentId,
        companyId: params?.equipmentCompanyId ?? resolvedClientCompanyId,
        locationId,
      }),
      create: jest
        .fn()
        .mockImplementation((data) =>
          Promise.resolve({ id: equipmentId, ...data }),
        ),
      update: jest
        .fn()
        .mockImplementation((id, data) => Promise.resolve({ id, ...data })),
    };
  }

  function makeContractsMock(params?: {
    role?: ServiceContractRole;
    locationIds?: string[] | null;
  }) {
    const role = params?.role ?? ServiceContractRole.PRIMARY;
    const effectiveLocationScope =
      params?.locationIds === null || params?.locationIds === undefined
        ? { mode: 'tenant_wide' as const, locationIds: [] }
        : { mode: 'bound_locations' as const, locationIds: params.locationIds };
    const access = {
      role,
      status: 'ACTIVE',
      effectiveLocationScope,
    };
    return {
      getLinkedClientAccess: jest.fn().mockResolvedValue(access),
      assertPrimaryLinkedClientAccess: jest.fn().mockImplementation(() => {
        if (role !== ServiceContractRole.PRIMARY) {
          return Promise.reject(
            new BadRequestException(
              'Linked client visibility is restricted for SECONDARY provider',
            ),
          );
        }
        return Promise.resolve(access);
      }),
    };
  }

  function makeService(params?: {
    locationMode?: UserAccessLocationMode | null;
    actorLocationIds?: string[];
    contractRole?: ServiceContractRole;
    contractLocationIds?: string[] | null;
    equipmentCompanyId?: string;
    clientCompanyId?: string;
  }) {
    const prisma = makePrismaMock(
      params?.locationMode ?? null,
      params?.actorLocationIds ?? [],
    );
    const repo = makeRepoMock({
      clientCompanyId: params?.clientCompanyId,
      equipmentCompanyId: params?.equipmentCompanyId,
    });
    const contracts = makeContractsMock({
      role: params?.contractRole,
      locationIds: params?.contractLocationIds,
    });
    const service = new EquipmentService(
      repo as unknown as EquipmentRepository,
      prisma as unknown as PrismaService,
      contracts as unknown as ServiceContractsService,
    );
    return { service, repo, prisma, contracts };
  }

  it('allows provider ADMIN equipment lookup for a selected linked-client location', async () => {
    const { service, repo } = makeService({
      locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      actorLocationIds: [locationId],
    });

    const result = await service.findAllByLocation(
      providerCompanyId,
      'admin-1',
      UserRole.ADMIN,
      locationId,
      clientCompanyId,
    );

    expect(result).toEqual([{ id: equipmentId, locationId }]);
    expect(repo.findAllByLocation).toHaveBeenCalledWith(
      clientCompanyId,
      locationId,
    );
  });

  it('preserves SECONDARY provider read access in current location scope', async () => {
    const { service, repo } = makeService({
      locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      actorLocationIds: [locationId],
      contractRole: ServiceContractRole.SECONDARY,
    });

    await expect(
      service.findAllByLocation(
        providerCompanyId,
        'admin-1',
        UserRole.ADMIN,
        locationId,
        clientCompanyId,
      ),
    ).resolves.toEqual([{ id: equipmentId, locationId }]);
    expect(repo.findAllByLocation).toHaveBeenCalledWith(
      clientCompanyId,
      locationId,
    );
  });

  it('blocks provider ADMIN equipment lookup for SELECTED_LOCATIONS with no bindings', async () => {
    const { service, repo } = makeService({
      locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
    });

    await expect(
      service.findAllByLocation(
        providerCompanyId,
        'admin-1',
        UserRole.ADMIN,
        'loc-forbidden',
        clientCompanyId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findLocation).not.toHaveBeenCalled();
    expect(repo.findAllByLocation).not.toHaveBeenCalled();
  });

  it('preserves CLIENT own create, update, and soft-deactivate flow', async () => {
    const { service, repo, contracts } = makeService();

    await service.create(clientCompanyId, 'client-admin', UserRole.ADMIN, {
      locationId,
      name: 'Boiler',
      type: 'heating',
    });
    await service.update(
      clientCompanyId,
      'client-admin',
      UserRole.ADMIN,
      equipmentId,
      {
        name: 'Main boiler',
      },
    );
    await service.remove(
      clientCompanyId,
      'client-admin',
      UserRole.ADMIN,
      equipmentId,
    );

    expect(repo.create).toHaveBeenCalledWith({
      companyId: clientCompanyId,
      locationId,
      name: 'Boiler',
      type: 'HEATING',
      status: 'ACTIVE',
    });
    expect(repo.update).toHaveBeenNthCalledWith(1, equipmentId, {
      name: 'Main boiler',
    });
    expect(repo.update).toHaveBeenNthCalledWith(2, equipmentId, {
      status: 'INACTIVE',
    });
    expect(contracts.assertPrimaryLinkedClientAccess).not.toHaveBeenCalled();
  });

  it('allows PRIMARY provider create, update, and deactivate for ALL_LOCATIONS', async () => {
    const { service, repo, contracts } = makeService({
      contractLocationIds: null,
    });

    await service.create(providerCompanyId, 'provider-admin', UserRole.ADMIN, {
      locationId,
      name: 'Pump',
      type: 'water',
    });
    await service.update(
      providerCompanyId,
      'provider-admin',
      UserRole.ADMIN,
      equipmentId,
      {
        type: 'electric',
      },
    );
    await service.remove(
      providerCompanyId,
      'provider-admin',
      UserRole.ADMIN,
      equipmentId,
    );

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: clientCompanyId, locationId }),
    );
    expect(repo.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ companyId: providerCompanyId }),
    );
    expect(repo.update).toHaveBeenNthCalledWith(1, equipmentId, {
      type: 'ELECTRIC',
    });
    expect(repo.update).toHaveBeenNthCalledWith(2, equipmentId, {
      status: 'INACTIVE',
    });
    expect(contracts.assertPrimaryLinkedClientAccess).toHaveBeenCalledTimes(3);
  });

  it('allows PRIMARY provider write for a selected contract location', async () => {
    const { service, repo } = makeService({
      contractLocationIds: [locationId],
    });

    await service.create(providerCompanyId, 'provider-admin', UserRole.ADMIN, {
      locationId,
      name: 'Pump',
      type: 'water',
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: clientCompanyId, locationId }),
    );
  });

  it('denies PRIMARY provider create, update, and deactivate outside selected contract locations', async () => {
    const { service, repo } = makeService({
      contractLocationIds: ['loc-other'],
    });

    await expect(
      service.create(providerCompanyId, 'provider-admin', UserRole.ADMIN, {
        locationId,
        name: 'Pump',
        type: 'water',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.update(
        providerCompanyId,
        'provider-admin',
        UserRole.ADMIN,
        equipmentId,
        {
          name: 'Changed',
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.remove(
        providerCompanyId,
        'provider-admin',
        UserRole.ADMIN,
        equipmentId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('denies provider write outside the actor location scope', async () => {
    const { service, repo } = makeService({
      locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      actorLocationIds: [],
      contractLocationIds: [locationId],
    });

    await expect(
      service.create(providerCompanyId, 'provider-admin', UserRole.ADMIN, {
        locationId,
        name: 'Pump',
        type: 'water',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it.each([
    'no contract',
    'inactive contract',
    'expired contract',
    'future contract',
  ])('denies provider write for %s', async () => {
    const { service, repo, contracts } = makeService();
    contracts.assertPrimaryLinkedClientAccess.mockRejectedValueOnce(
      new NotFoundException('Linked client not found'),
    );

    await expect(
      service.create(providerCompanyId, 'provider-admin', UserRole.ADMIN, {
        locationId,
        name: 'Pump',
        type: 'water',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('denies SECONDARY provider create, update, and deactivate', async () => {
    const { service, repo } = makeService({
      contractRole: ServiceContractRole.SECONDARY,
    });

    await expect(
      service.create(providerCompanyId, 'provider-admin', UserRole.ADMIN, {
        locationId,
        name: 'Pump',
        type: 'water',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update(
        providerCompanyId,
        'provider-admin',
        UserRole.ADMIN,
        equipmentId,
        {
          name: 'Changed',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.remove(
        providerCompanyId,
        'provider-admin',
        UserRole.ADMIN,
        equipmentId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('denies a client actor writing another client equipment register', async () => {
    const { service, repo, prisma } = makeService();
    prisma.company.findUnique.mockResolvedValue({ type: CompanyType.CLIENT });

    await expect(
      service.update(
        'other-client',
        'client-admin',
        UserRole.ADMIN,
        equipmentId,
        {
          name: 'Changed',
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('denies cross-provider equipment without access to its owning client', async () => {
    const { service, repo, contracts } = makeService();
    contracts.assertPrimaryLinkedClientAccess.mockRejectedValueOnce(
      new NotFoundException('Linked client not found'),
    );

    await expect(
      service.remove(
        'foreign-provider',
        'foreign-admin',
        UserRole.ADMIN,
        equipmentId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('fails closed when Equipment owner disagrees with the Location client owner', async () => {
    const { service, repo } = makeService({
      equipmentCompanyId: 'wrong-owner',
    });

    await expect(
      service.update(
        providerCompanyId,
        'provider-admin',
        UserRole.ADMIN,
        equipmentId,
        {
          name: 'Changed',
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.update).not.toHaveBeenCalled();
  });
});
