import { CompanyType, TicketStatus, UserRole } from '@prisma/client';

import type { PrismaService } from '../prisma/prisma.service';
import type { ServiceContractsService } from '../service-contracts/service-contracts.service';
import type { TicketVisibilityMode } from './ticket-access.utils';
import {
  TicketMetaBuilder,
  type TicketMetaBuildParams,
} from './ticket-meta.builder';

describe('TicketMetaBuilder edit availability', () => {
  type EditAvailabilityProbe = {
    resolveEditAvailability(params: TicketMetaBuildParams): Promise<boolean>;
  };

  function resolveEditAvailability(
    builder: TicketMetaBuilder,
    params: TicketMetaBuildParams,
  ): Promise<boolean> {
    return (
      builder as unknown as EditAvailabilityProbe
    ).resolveEditAvailability(params);
  }

  const baseParams: TicketMetaBuildParams = {
    actorCompanyId: 'provider-company',
    userId: 'actor-1',
    role: UserRole.MASTER,
    isExecutor: false,
    ticketId: 'ticket-1',
    ticketCompanyId: 'client-company',
    ticketStatus: TicketStatus.NEW,
    assignedTechnicianId: null,
    scopeCompanyId: 'client-company',
    visibilityMode: 'provider_primary' as TicketVisibilityMode,
    linkedClientCompanyId: 'client-company',
  };

  function makeBuilder(options?: {
    permissionBlocksCount?: number;
    companyType?: CompanyType;
    rolePermission?: boolean;
    userPermission?: boolean;
  }) {
    const prisma = {
      permissionBlock: {
        count: jest.fn().mockResolvedValue(options?.permissionBlocksCount ?? 1),
      },
      company: {
        findUnique: jest.fn().mockResolvedValue({
          type: options?.companyType ?? CompanyType.PROVIDER,
        }),
      },
      rolePermission: {
        findFirst: jest
          .fn()
          .mockResolvedValue(
            options?.rolePermission === false
              ? null
              : { id: 'role-permission-1' },
          ),
      },
      userPermission: {
        findFirst: jest
          .fn()
          .mockResolvedValue(
            options?.userPermission ? { id: 'user-permission-1' } : null,
          ),
      },
    };
    return {
      prisma,
      builder: new TicketMetaBuilder(
        prisma as unknown as PrismaService,
        {} as ServiceContractsService,
      ),
    };
  }

  it('allows editable management role when TICKETS_EDIT is granted by role', async () => {
    const { builder, prisma } = makeBuilder({ rolePermission: true });

    await expect(resolveEditAvailability(builder, baseParams)).resolves.toBe(
      true,
    );

    expect(prisma.rolePermission.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.userPermission.findFirst).toHaveBeenCalledTimes(1);
  });

  it('denies when neither role nor user grants TICKETS_EDIT', async () => {
    const { builder } = makeBuilder({
      rolePermission: false,
      userPermission: false,
    });

    await expect(resolveEditAvailability(builder, baseParams)).resolves.toBe(
      false,
    );
  });

  it('denies controller-ineligible roles even with user-level TICKETS_EDIT', async () => {
    const { builder, prisma } = makeBuilder({
      rolePermission: false,
      userPermission: true,
    });

    await expect(
      resolveEditAvailability(builder, {
        ...baseParams,
        role: UserRole.TECHNICIAN,
      }),
    ).resolves.toBe(false);

    expect(prisma.permissionBlock.count).not.toHaveBeenCalled();
  });

  it('denies terminal tickets before checking permissions', async () => {
    const { builder, prisma } = makeBuilder({ rolePermission: true });

    await expect(
      resolveEditAvailability(builder, {
        ...baseParams,
        ticketStatus: TicketStatus.DONE,
      }),
    ).resolves.toBe(false);

    expect(prisma.permissionBlock.count).not.toHaveBeenCalled();
  });

  it('keeps territorial manager limited to own NEW tenant scope', async () => {
    const { builder } = makeBuilder({
      companyType: CompanyType.CLIENT,
      rolePermission: true,
    });

    await expect(
      resolveEditAvailability(builder, {
        ...baseParams,
        actorCompanyId: 'client-company',
        ticketCompanyId: 'client-company',
        scopeCompanyId: 'client-company',
        linkedClientCompanyId: undefined,
        role: UserRole.TERRITORIAL_MANAGER,
        ticketStatus: TicketStatus.NEW,
      }),
    ).resolves.toBe(true);

    await expect(
      resolveEditAvailability(builder, {
        ...baseParams,
        actorCompanyId: 'client-company',
        ticketCompanyId: 'client-company',
        scopeCompanyId: 'client-company',
        linkedClientCompanyId: 'client-company',
        role: UserRole.TERRITORIAL_MANAGER,
        ticketStatus: TicketStatus.NEW,
      }),
    ).resolves.toBe(false);
  });
});
