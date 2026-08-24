import { CompanyType, ServiceContractRole, TicketStatus, UserRole } from '@prisma/client';

import { TicketMetaBuilder } from './ticket-meta.builder';
import * as ticketAccessUtils from './ticket-access.utils';

jest.mock('./ticket-access.utils', () => {
  const actual = jest.requireActual('./ticket-access.utils');
  return {
    ...actual,
    buildSecondaryOperationalRestrictionWhere: jest.fn(),
    resolveReadableTicketAccess: jest.fn(),
    resolveTechnicianOperationalScope: jest.fn(),
    resolveTicketOperationAccess: jest.fn(),
  };
});

const mockBuildSecondaryOperationalRestrictionWhere =
  ticketAccessUtils.buildSecondaryOperationalRestrictionWhere as jest.MockedFunction<
    typeof ticketAccessUtils.buildSecondaryOperationalRestrictionWhere
  >;
const mockResolveReadableTicketAccess =
  ticketAccessUtils.resolveReadableTicketAccess as jest.MockedFunction<
    typeof ticketAccessUtils.resolveReadableTicketAccess
  >;
const mockResolveTechnicianOperationalScope =
  ticketAccessUtils.resolveTechnicianOperationalScope as jest.MockedFunction<
    typeof ticketAccessUtils.resolveTechnicianOperationalScope
  >;
const mockResolveTicketOperationAccess =
  ticketAccessUtils.resolveTicketOperationAccess as jest.MockedFunction<
    typeof ticketAccessUtils.resolveTicketOperationAccess
  >;

const CLIENT_ID = 'client-1';
const PROVIDER_ID = 'provider-1';
const TICKET_ID = 'ticket-1';

function makeServiceContracts(role: ServiceContractRole | null = ServiceContractRole.PRIMARY) {
  return {
    getLinkedClientAccess: jest.fn().mockResolvedValue(
      role
        ? {
            role,
            status: 'ACTIVE',
            clientCompanyId: CLIENT_ID,
            providerCompanyId: PROVIDER_ID,
          }
        : null,
    ),
  };
}

function makePrisma(params: {
  actorId: string;
  actorRole: UserRole;
  actorCompanyId: string;
  actorCompanyType: CompanyType;
  assignedTechnicianId?: string | null;
}) {
  const ticket = {
    id: TICKET_ID,
    companyId: CLIENT_ID,
    assignedTechnicianId: params.assignedTechnicianId ?? null,
    createdByUserId: 'client-admin-1',
    assignedTechnician: params.assignedTechnicianId
      ? { id: params.assignedTechnicianId, companyId: params.actorCompanyId }
      : null,
  };

  return {
    domainEvent: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    ticket: {
      findFirst: jest.fn().mockResolvedValue(ticket),
    },
    user: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => ({
        id: where.id,
        companyId: where.companyId,
        role: params.actorRole,
        isActive: true,
        company: { id: where.companyId, type: params.actorCompanyType },
      })),
    },
  } as any;
}

function defaultMetaParams(params: {
  actorCompanyId: string;
  userId: string;
  role: UserRole;
  isExecutor?: boolean;
}) {
  return {
    actorCompanyId: params.actorCompanyId,
    userId: params.userId,
    role: params.role,
    isExecutor: params.isExecutor ?? false,
    ticketId: TICKET_ID,
    ticketCompanyId: CLIENT_ID,
    ticketStatus: TicketStatus.AWAITING_ACCEPTANCE,
    assignedTechnicianId: params.userId,
    scopeCompanyId: CLIENT_ID,
    visibilityMode: 'provider_primary' as const,
    linkedClientCompanyId: CLIENT_ID,
  };
}

describe('TicketMetaBuilder acceptance actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildSecondaryOperationalRestrictionWhere.mockResolvedValue(null);
    mockResolveReadableTicketAccess.mockResolvedValue({
      ticket: {
        id: TICKET_ID,
        companyId: CLIENT_ID,
        assignedTechnicianId: null,
      },
      scopeCompanyId: CLIENT_ID,
      visibilityMode: 'tenant',
    } as any);
    mockResolveTechnicianOperationalScope.mockResolvedValue({
      companyIds: [PROVIDER_ID, CLIENT_ID],
      specializationIds: [],
      specializationNames: [],
      locationScopeByCompany: { [PROVIDER_ID]: [], [CLIENT_ID]: [] },
      allowTechnicianClaim: true,
      scopeCompanyId: CLIENT_ID,
      visibilityMode: 'provider_primary',
    } as any);
  });

  it('keeps acceptance available for a valid client management actor', async () => {
    const actorId = 'client-admin-1';
    const prisma = makePrisma({
      actorId,
      actorRole: UserRole.ADMIN,
      actorCompanyId: CLIENT_ID,
      actorCompanyType: CompanyType.CLIENT,
    });
    mockResolveTicketOperationAccess.mockResolvedValue({
      ticket: {
        id: TICKET_ID,
        companyId: CLIENT_ID,
        assignedTechnicianId: null,
      },
      scopeCompanyId: CLIENT_ID,
      visibilityMode: 'tenant',
      operationCompanyId: CLIENT_ID,
    } as any);

    const builder = new TicketMetaBuilder(
      prisma,
      makeServiceContracts() as any,
    );
    const meta = await builder.buildForGetOne({
      ...defaultMetaParams({
        actorCompanyId: CLIENT_ID,
        userId: actorId,
        role: UserRole.ADMIN,
      }),
      visibilityMode: 'tenant',
      linkedClientCompanyId: undefined,
    });

    expect(meta.availableActions.canAccept).toBe(true);
    expect(meta.availableActions.canReject).toBe(true);
  });

  it.each([
    [UserRole.ADMIN, false],
    [UserRole.MASTER, false],
    [UserRole.DISPATCHER, false],
    [UserRole.TECHNICIAN, true],
  ])('hides acceptance actions for provider %s', async (role, isExecutor) => {
    const actorId = `provider-${role.toLowerCase()}-1`;
    const prisma = makePrisma({
      actorId,
      actorRole: role,
      actorCompanyId: PROVIDER_ID,
      actorCompanyType: CompanyType.PROVIDER,
      assignedTechnicianId: actorId,
    });
    mockResolveTicketOperationAccess.mockResolvedValue({
      ticket: {
        id: TICKET_ID,
        companyId: CLIENT_ID,
        assignedTechnicianId: actorId,
      },
      scopeCompanyId: CLIENT_ID,
      visibilityMode: 'provider_primary',
      operationCompanyId: PROVIDER_ID,
    } as any);

    const builder = new TicketMetaBuilder(
      prisma,
      makeServiceContracts() as any,
    );
    const meta = await builder.buildForGetOne(
      defaultMetaParams({
        actorCompanyId: PROVIDER_ID,
        userId: actorId,
        role,
        isExecutor,
      }),
    );

    expect(meta.availableActions.canAccept).toBe(false);
    expect(meta.availableActions.canReject).toBe(false);
    expect(meta.availableActions.canComplete).toBe(false);
    expect(meta.availableStatusTransitions).not.toContain(TicketStatus.DONE);
  });
});
