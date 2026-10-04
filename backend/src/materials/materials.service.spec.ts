import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  MaterialHolderType,
  MaterialMovementType,
  Prisma,
  UserRole,
} from '@prisma/client';

import * as ticketAccess from '../tickets/ticket-access.utils';
import { MaterialsService } from './materials.service';

jest.mock('../tickets/ticket-access.utils', () => ({
  resolveReadableTicketAccess: jest.fn(),
  resolveTicketOperationAccess: jest.fn(),
}));

const resolveOperation =
  ticketAccess.resolveTicketOperationAccess as jest.MockedFunction<
    typeof ticketAccess.resolveTicketOperationAccess
  >;
const resolveReadable =
  ticketAccess.resolveReadableTicketAccess as jest.MockedFunction<
    typeof ticketAccess.resolveReadableTicketAccess
  >;

const COMPANY_ID = '10000000-0000-4000-8000-000000000001';
const OTHER_COMPANY_ID = '10000000-0000-4000-8000-000000000002';
const TECHNICIAN_ID = '20000000-0000-4000-8000-000000000001';
const OTHER_TECHNICIAN_ID = '20000000-0000-4000-8000-000000000002';
const MATERIAL_ID = '30000000-0000-4000-8000-000000000001';
const FOREIGN_MATERIAL_ID = '30000000-0000-4000-8000-000000000002';
const TICKET_ID = '40000000-0000-4000-8000-000000000001';

const actor = {
  id: TECHNICIAN_ID,
  companyId: COMPANY_ID,
  role: UserRole.TECHNICIAN,
};
const manager = {
  id: '50000000-0000-4000-8000-000000000001',
  companyId: COMPANY_ID,
  role: UserRole.ADMIN,
};

type BalanceRow = {
  id: string;
  companyId: string;
  materialId: string;
  holderType: MaterialHolderType;
  holderUserId: string | null;
  quantity: Prisma.Decimal;
};

function balanceKey(input: {
  companyId: string;
  materialId: string;
  holderType: MaterialHolderType;
  holderUserId: string | null;
}) {
  return [
    input.companyId,
    input.materialId,
    input.holderType,
    input.holderUserId ?? 'stock',
  ].join(':');
}

function createHarness() {
  const materials = new Map([
    [MATERIAL_ID, { id: MATERIAL_ID, companyId: COMPANY_ID, active: true }],
    [
      FOREIGN_MATERIAL_ID,
      { id: FOREIGN_MATERIAL_ID, companyId: OTHER_COMPANY_ID, active: true },
    ],
  ]);
  const users = new Map([
    [
      TECHNICIAN_ID,
      {
        id: TECHNICIAN_ID,
        companyId: COMPANY_ID,
        role: UserRole.TECHNICIAN,
        isActive: true,
        deletedAt: null,
      },
    ],
    [
      OTHER_TECHNICIAN_ID,
      {
        id: OTHER_TECHNICIAN_ID,
        companyId: OTHER_COMPANY_ID,
        role: UserRole.TECHNICIAN,
        isActive: true,
        deletedAt: null,
      },
    ],
  ]);
  const balances = new Map<string, BalanceRow>();
  const movements: any[] = [];
  let idSequence = 0;

  const matchingBalance = (where: any) => {
    return [...balances.values()].find((row) => {
      if (where.id && row.id !== where.id) return false;
      if (where.companyId && row.companyId !== where.companyId) return false;
      if (where.materialId && row.materialId !== where.materialId) return false;
      if (where.holderType && row.holderType !== where.holderType) return false;
      if ('holderUserId' in where && row.holderUserId !== where.holderUserId)
        return false;
      return true;
    });
  };

  const tx: any = {
    material: {
      findFirst: jest.fn(async ({ where }: any) => {
        const row = materials.get(where.id);
        if (!row || row.companyId !== where.companyId) return null;
        if (where.active === true && !row.active) return null;
        return { id: row.id };
      }),
    },
    user: {
      findFirst: jest.fn(async ({ where }: any) => {
        const row = users.get(where.id);
        if (!row) return null;
        return row.companyId === where.companyId &&
          row.role === where.role &&
          row.isActive === where.isActive &&
          row.deletedAt === where.deletedAt
          ? { id: row.id }
          : null;
      }),
    },
    ticket: {
      findFirst: jest.fn(async ({ where }: any) =>
        where.id === TICKET_ID && where.companyId === COMPANY_ID
          ? { id: TICKET_ID }
          : null,
      ),
    },
    materialBalance: {
      findFirst: jest.fn(
        async ({ where }: any) => matchingBalance(where) ?? null,
      ),
      findFirstOrThrow: jest.fn(async ({ where }: any) => {
        const row = matchingBalance(where);
        if (!row) throw new Error('Balance not found');
        return row;
      }),
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: `balance-${++idSequence}`,
          ...data,
          quantity: new Prisma.Decimal(data.quantity),
        } as BalanceRow;
        balances.set(balanceKey(row), row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = matchingBalance(where);
        if (!row) throw new Error('Balance not found');
        row.quantity = row.quantity.add(data.quantity.increment);
        return row;
      }),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const compound = where.companyId_materialId_holderType_holderUserId;
        const key = balanceKey(compound);
        const row = balances.get(key);
        if (row) {
          row.quantity = row.quantity.add(update.quantity.increment);
          return row;
        }
        const created = {
          id: `balance-${++idSequence}`,
          ...create,
          quantity: new Prisma.Decimal(create.quantity),
        } as BalanceRow;
        balances.set(key, created);
        return created;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const row = matchingBalance(where);
        const minimum = new Prisma.Decimal(where.quantity.gte);
        if (!row || row.quantity.lt(minimum)) return { count: 0 };
        row.quantity = row.quantity.sub(data.quantity.decrement);
        return { count: 1 };
      }),
      findMany: jest.fn(async () => [...balances.values()]),
    },
    materialMovement: {
      create: jest.fn(async ({ data }: any) => {
        const movement = { id: `movement-${++idSequence}`, ...data };
        movements.push(movement);
        return movement;
      }),
      findMany: jest.fn(async ({ where }: any = {}) =>
        movements.filter((row) => {
          if (where.ticketId && row.ticketId !== where.ticketId) return false;
          if (where.type && row.type !== where.type) return false;
          if (where.companyId && row.companyId !== where.companyId)
            return false;
          return true;
        }),
      ),
    },
  };

  const prisma: any = {
    ...tx,
    $transaction: jest.fn(async (work: (client: any) => Promise<unknown>) =>
      work(tx),
    ),
  };
  const service = new MaterialsService(prisma, {} as any);

  return {
    balances,
    movements,
    prisma,
    service,
    tx,
    quantity(holderType: MaterialHolderType, holderUserId: string | null) {
      return balances
        .get(
          balanceKey({
            companyId: COMPANY_ID,
            materialId: MATERIAL_ID,
            holderType,
            holderUserId,
          }),
        )
        ?.quantity.toNumber();
    },
  };
}

describe('MaterialsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveOperation.mockResolvedValue({
      ticket: { id: TICKET_ID, companyId: COMPANY_ID },
      scopeCompanyId: COMPANY_ID,
    } as any);
    resolveReadable.mockResolvedValue({
      ticket: { id: TICKET_ID, companyId: COMPANY_ID },
      scopeCompanyId: COMPANY_ID,
    } as any);
  });

  it('keeps material reads and writes tenant-scoped', async () => {
    const { service, tx } = createHarness();

    await expect(
      service.receiptToCompanyStock(manager, {
        materialId: FOREIGN_MATERIAL_ID,
        quantity: '1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.material.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: FOREIGN_MATERIAL_ID,
          companyId: COMPANY_ID,
        }),
      }),
    );
  });

  it('issues stock 10 -> 7 and technician 0 -> 3 atomically', async () => {
    const { service, quantity, movements, prisma } = createHarness();
    await service.receiptToCompanyStock(manager, {
      materialId: MATERIAL_ID,
      quantity: '10',
    });

    await service.issue(manager, {
      materialId: MATERIAL_ID,
      technicianId: TECHNICIAN_ID,
      quantity: '3',
    });

    expect(quantity(MaterialHolderType.COMPANY_STOCK, null)).toBe(7);
    expect(quantity(MaterialHolderType.TECHNICIAN, TECHNICIAN_ID)).toBe(3);
    expect(movements.at(-1)).toMatchObject({
      type: MaterialMovementType.ISSUE,
      quantity: new Prisma.Decimal(3),
    });
    expect(prisma.$transaction).toHaveBeenLastCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
  });

  it('records a self-purchase and increases technician balance 3 -> 8', async () => {
    const { service, quantity, movements } = createHarness();
    await service.purchase(actor, { materialId: MATERIAL_ID, quantity: '3' });

    await service.purchase(actor, {
      materialId: MATERIAL_ID,
      quantity: '5',
      unitPrice: '12.50',
    });

    expect(quantity(MaterialHolderType.TECHNICIAN, TECHNICIAN_ID)).toBe(8);
    expect(movements.at(-1)).toMatchObject({
      type: MaterialMovementType.PURCHASE,
      actorUserId: TECHNICIAN_ID,
      totalAmount: new Prisma.Decimal(62.5),
    });
  });

  it('consumes material on an accessible ticket and decreases balance 8 -> 6', async () => {
    const { service, quantity } = createHarness();
    await service.purchase(actor, { materialId: MATERIAL_ID, quantity: '8' });

    await service.consume(actor, {
      materialId: MATERIAL_ID,
      ticketId: TICKET_ID,
      quantity: '2',
    });

    expect(quantity(MaterialHolderType.TECHNICIAN, TECHNICIAN_ID)).toBe(6);
  });

  it('links the consumption movement to the exact ticket', async () => {
    const { service, movements } = createHarness();
    await service.purchase(actor, { materialId: MATERIAL_ID, quantity: '2' });

    await service.consume(actor, {
      materialId: MATERIAL_ID,
      ticketId: TICKET_ID,
      quantity: '1',
    });

    expect(movements.at(-1)).toMatchObject({
      type: MaterialMovementType.CONSUMPTION,
      ticketId: TICKET_ID,
      fromUserId: TECHNICIAN_ID,
    });
  });

  it('rejects insufficient balance without creating a consumption movement', async () => {
    const { service, movements } = createHarness();
    await service.purchase(actor, { materialId: MATERIAL_ID, quantity: '1' });

    await expect(
      service.consume(actor, {
        materialId: MATERIAL_ID,
        ticketId: TICKET_ID,
        quantity: '2',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      movements.filter((row) => row.type === MaterialMovementType.CONSUMPTION),
    ).toHaveLength(0);
  });

  it.each(['0', '-1', '0.000'])(
    'rejects non-positive quantity %s',
    async (quantity) => {
      const { service } = createHarness();
      expect(() =>
        service.purchase(actor, { materialId: MATERIAL_ID, quantity }),
      ).toThrow(BadRequestException);
    },
  );

  it('rejects a foreign-company material', async () => {
    const { service } = createHarness();
    await expect(
      service.purchase(actor, {
        materialId: FOREIGN_MATERIAL_ID,
        quantity: '1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a foreign-company technician', async () => {
    const { service } = createHarness();
    await service.receiptToCompanyStock(manager, {
      materialId: MATERIAL_ID,
      quantity: '2',
    });

    await expect(
      service.issue(manager, {
        materialId: MATERIAL_ID,
        technicianId: OTHER_TECHNICIAN_ID,
        quantity: '1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a foreign or inaccessible ticket through the canonical resolver', async () => {
    const { service, prisma } = createHarness();
    resolveOperation.mockRejectedValueOnce(
      new ForbiddenException('Нет доступа'),
    );

    await expect(
      service.consume(actor, {
        materialId: MATERIAL_ID,
        ticketId: TICKET_ID,
        quantity: '1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('exposes movement history as immutable create-only records', () => {
    const { service, tx } = createHarness();

    expect((service as any).updateMovement).toBeUndefined();
    expect((service as any).deleteMovement).toBeUndefined();
    expect(tx.materialMovement.update).toBeUndefined();
    expect(tx.materialMovement.delete).toBeUndefined();
  });

  it('uses an atomic conditional decrement so concurrent requests cannot go negative', async () => {
    const { service, quantity, movements, tx } = createHarness();
    await service.purchase(actor, { materialId: MATERIAL_ID, quantity: '3' });

    const results = await Promise.allSettled([
      service.consume(actor, {
        materialId: MATERIAL_ID,
        ticketId: TICKET_ID,
        quantity: '2',
      }),
      service.consume(actor, {
        materialId: MATERIAL_ID,
        ticketId: TICKET_ID,
        quantity: '2',
      }),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(quantity(MaterialHolderType.TECHNICIAN, TECHNICIAN_ID)).toBe(1);
    expect(
      movements.filter((row) => row.type === MaterialMovementType.CONSUMPTION),
    ).toHaveLength(1);
    expect(tx.materialBalance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          quantity: { gte: new Prisma.Decimal(2) },
        }),
      }),
    );
  });

  it('scopes ticket consumption history through canonical ticket access', async () => {
    const { service, movements } = createHarness();
    movements.push(
      {
        id: 'own',
        companyId: COMPANY_ID,
        ticketId: TICKET_ID,
        type: MaterialMovementType.CONSUMPTION,
      },
      {
        id: 'other-provider',
        companyId: OTHER_COMPANY_ID,
        ticketId: TICKET_ID,
        type: MaterialMovementType.CONSUMPTION,
      },
    );
    resolveReadable.mockResolvedValueOnce({
      ticket: { id: TICKET_ID, companyId: OTHER_COMPANY_ID },
      scopeCompanyId: OTHER_COMPANY_ID,
    } as any);

    const result = await service.getTicketConsumptions(
      actor,
      TICKET_ID,
      OTHER_COMPANY_ID,
    );

    expect(result).toEqual([expect.objectContaining({ id: 'own' })]);
    expect(resolveReadable).toHaveBeenCalledWith(
      expect.objectContaining({
        actor,
        ticketId: TICKET_ID,
        linkedClientCompanyId: OTHER_COMPANY_ID,
      }),
    );
  });
});
