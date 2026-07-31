import { NotFoundException } from '@nestjs/common';
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
  type CompanyFindUniqueArgs = { where: { id: string } };

  function makePrismaMock(
    locationMode: UserAccessLocationMode | null,
    locationIds: string[],
  ) {
    return {
      company: {
        findUnique: jest
          .fn()
          .mockImplementation(({ where }: CompanyFindUniqueArgs) =>
            Promise.resolve({
              type:
                where.id === 'client-company'
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
          .mockResolvedValue(locationIds.map((locationId) => ({ locationId }))),
      },
    };
  }

  function makeRepoMock() {
    return {
      findLocation: jest.fn().mockResolvedValue({ id: 'loc-allowed' }),
      findAllByLocation: jest
        .fn()
        .mockResolvedValue([{ id: 'eq-1', locationId: 'loc-allowed' }]),
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'eq-1', locationId: 'loc-allowed' }),
    };
  }

  function makeContractsMock() {
    return {
      getLinkedClientAccess: jest.fn().mockResolvedValue({
        role: ServiceContractRole.PRIMARY,
        status: 'ACTIVE',
      }),
    };
  }

  it('allows provider ADMIN equipment lookup for a selected linked-client location', async () => {
    const prisma = makePrismaMock(UserAccessLocationMode.SELECTED_LOCATIONS, [
      'loc-allowed',
    ]);
    const repo = makeRepoMock();
    const service = new EquipmentService(
      repo as unknown as EquipmentRepository,
      prisma as unknown as PrismaService,
      makeContractsMock() as unknown as ServiceContractsService,
    );

    const result = await service.findAllByLocation(
      'provider-company',
      'admin-1',
      UserRole.ADMIN,
      'loc-allowed',
      'client-company',
    );

    expect(result).toEqual([{ id: 'eq-1', locationId: 'loc-allowed' }]);
    expect(repo.findAllByLocation).toHaveBeenCalledWith(
      'client-company',
      'loc-allowed',
    );
  });

  it('blocks provider ADMIN equipment lookup for SELECTED_LOCATIONS with no bindings', async () => {
    const prisma = makePrismaMock(
      UserAccessLocationMode.SELECTED_LOCATIONS,
      [],
    );
    const repo = makeRepoMock();
    const service = new EquipmentService(
      repo as unknown as EquipmentRepository,
      prisma as unknown as PrismaService,
      makeContractsMock() as unknown as ServiceContractsService,
    );

    await expect(
      service.findAllByLocation(
        'provider-company',
        'admin-1',
        UserRole.ADMIN,
        'loc-forbidden',
        'client-company',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findLocation).not.toHaveBeenCalled();
    expect(repo.findAllByLocation).not.toHaveBeenCalled();
  });
});
