import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { UserRole } from '@prisma/client'

import { PermissionsService } from './permissions.service'

function makeServiceContractsMock() {
  return {
    listPrimaryLinkedClientIds: jest.fn().mockResolvedValue([]),
    listSecondaryLinkedClientIds: jest.fn().mockResolvedValue([]),
  }
}

describe('PermissionsService.updateUserOverrides', () => {
  it('rejects unknown permission codes', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-1',
          companyId: 'co-1',
          role: UserRole.ADMIN,
          isActive: true,
          isExecutor: false,
        }),
      },
      permissionBlock: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      userPermission: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(),
    }

    const service = new PermissionsService(prisma as any, makeServiceContractsMock() as any)

    await expect(
      service.updateUserOverrides(
        { id: 'actor-1', role: UserRole.ADMIN, companyId: 'co-1' },
        'user-1',
        { grantPermissionCodes: ['UNKNOWN_CODE'], reason: 'qa' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('forbids ADMIN cross-tenant override updates', async () => {
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: 'co-2' }),
      },
    }

    const service = new PermissionsService(prisma as any, makeServiceContractsMock() as any)

    await expect(
      service.updateUserOverrides(
        { id: 'actor-1', role: UserRole.ADMIN, companyId: 'co-1' },
        'user-2',
        { grantPermissionCodes: ['TICKETS_ASSIGN'], reason: 'qa' },
        'co-2',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('updates user overrides inside transaction and writes audit event', async () => {
    const tx = {
      userPermission: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      domainEvent: {
        create: jest.fn().mockResolvedValue({ id: 'ev-1' }),
      },
    }

    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-1',
          companyId: 'co-1',
          role: UserRole.ADMIN,
          isActive: true,
          isExecutor: false,
        }),
      },
      permissionBlock: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'pb-1', code: 'ANALYTICS_VIEW' },
          { id: 'pb-2', code: 'TICKETS_ASSIGN' },
        ]),
      },
      userPermission: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ permissionBlock: { code: 'TICKETS_VIEW_ALL_COMPANY' } }])
          .mockResolvedValueOnce([
            {
              createdAt: new Date('2026-06-23T10:00:00.000Z'),
              permissionBlock: {
                code: 'ANALYTICS_VIEW',
                name: 'Analytics view',
                description: 'Can view analytics',
              },
            },
            {
              createdAt: new Date('2026-06-23T10:00:01.000Z'),
              permissionBlock: {
                code: 'TICKETS_ASSIGN',
                name: 'Tickets assign',
                description: 'Can assign tickets',
              },
            },
          ]),
      },
      $transaction: jest.fn().mockImplementation(async (cb: (ctx: any) => Promise<any>) => cb(tx)),
    }

    const service = new PermissionsService(prisma as any, makeServiceContractsMock() as any)

    const result = await service.updateUserOverrides(
      { id: 'actor-1', role: UserRole.ADMIN, companyId: 'co-1' },
      'user-1',
      {
        grantPermissionCodes: ['TICKETS_ASSIGN', 'ANALYTICS_VIEW', 'TICKETS_ASSIGN'],
        reason: 'Temporary access',
      },
    )

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.userPermission.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    })
    expect(tx.userPermission.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'user-1', permissionBlockId: 'pb-1' },
        { userId: 'user-1', permissionBlockId: 'pb-2' },
      ],
      skipDuplicates: true,
    })
    expect(tx.domainEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: 'User',
          entityId: 'user-1',
          type: 'user.permission_overrides_updated',
          actorUserId: 'actor-1',
          payload: expect.objectContaining({
            reason: 'Temporary access',
            grantPermissionCodes: ['ANALYTICS_VIEW', 'TICKETS_ASSIGN'],
            previousPermissionCodes: ['TICKETS_VIEW_ALL_COMPANY'],
          }),
        }),
      }),
    )
    expect(result).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        companyId: 'co-1',
        reason: 'Temporary access',
        overrides: [
          expect.objectContaining({ code: 'ANALYTICS_VIEW' }),
          expect.objectContaining({ code: 'TICKETS_ASSIGN' }),
        ],
      }),
    )
  })
})

describe('PermissionsService.getUserPermissionAuditHistory', () => {
  it('returns audit items sorted by createdAt desc with added/removed diff', async () => {
    const prisma = {
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'user-1',
            companyId: 'co-1',
            role: UserRole.ADMIN,
            isActive: true,
            isExecutor: false,
          })
          .mockResolvedValueOnce({
            id: 'user-1',
            email: 'target@test.local',
            firstName: 'Petr',
            lastName: 'Petrov',
          }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'actor-1',
            email: 'ivan@test.local',
            firstName: 'Ivan',
            lastName: 'Ivanov',
          },
        ]),
      },
      domainEvent: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'ev-2',
            actorUserId: 'actor-1',
            payload: {
              reason: 'Second change',
              grantPermissionCodes: ['ANALYTICS_VIEW'],
              previousPermissionCodes: ['TICKETS_ASSIGN', 'ANALYTICS_VIEW'],
            },
            createdAt: new Date('2026-06-15T14:23:00.000Z'),
          },
          {
            id: 'ev-1',
            actorUserId: 'actor-1',
            payload: {
              reason: 'Temporary access for dispatcher',
              grantPermissionCodes: ['TICKETS_ASSIGN', 'ANALYTICS_VIEW'],
              previousPermissionCodes: ['USERS_MANAGE'],
            },
            createdAt: new Date('2026-06-14T10:00:00.000Z'),
          },
        ]),
        count: jest.fn().mockResolvedValue(2),
      },
    }

    const service = new PermissionsService(prisma as any, makeServiceContractsMock() as any)

    const result = await service.getUserPermissionAuditHistory(
      { id: 'actor-1', role: UserRole.ADMIN, companyId: 'co-1' },
      'user-1',
      { take: '10', skip: '0' },
    )

    expect(prisma.domainEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: 'co-1',
          entityType: 'User',
          entityId: 'user-1',
          type: 'user.permission_overrides_updated',
        },
        orderBy: { createdAt: 'desc' },
      }),
    )
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'ev-2',
        reason: 'Second change',
        addedPermissionCodes: [],
        removedPermissionCodes: ['TICKETS_ASSIGN'],
        actor: expect.objectContaining({
          userId: 'actor-1',
          email: 'ivan@test.local',
          firstName: 'Ivan',
          lastName: 'Ivanov',
        }),
      }),
    )
    expect(result.items[1]).toEqual(
      expect.objectContaining({
        addedPermissionCodes: ['ANALYTICS_VIEW', 'TICKETS_ASSIGN'],
        removedPermissionCodes: ['USERS_MANAGE'],
      }),
    )
    expect(result.targetUser).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        email: 'target@test.local',
        firstName: 'Petr',
        lastName: 'Petrov',
      }),
    )
    expect(result.meta.total).toBe(2)
  })

  it('forbids ADMIN cross-tenant audit reads', async () => {
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: 'co-2' }),
      },
    }

    const service = new PermissionsService(prisma as any, makeServiceContractsMock() as any)

    await expect(
      service.getUserPermissionAuditHistory(
        { id: 'actor-1', role: UserRole.ADMIN, companyId: 'co-1' },
        'user-2',
        { companyId: 'co-2' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })
})
