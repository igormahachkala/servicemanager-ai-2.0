import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';

// ── mock factory ──────────────────────────────────────────────────────────────

function makeTx() {
  return {
    user: { update: jest.fn().mockResolvedValue({}) },
    technicianSpecialization: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    userLocationBinding: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
}

function makePrisma(existingUser: {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  role: UserRole;
  isActive: boolean;
  isExecutor: boolean;
}) {
  const tx = makeTx();
  return {
    _tx: tx,
    user: {
      findFirst: jest
        .fn()
        // first call: findCompanyUser; second call: getPublicUserById
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValue({
          ...existingUser,
          technicianSpecializations: [],
          createdAt: new Date(),
        }),
      count: jest.fn().mockResolvedValue(2), // other admins exist → no last-admin guard
      findUnique: jest.fn().mockResolvedValue(null), // email not taken
    },
    $transaction: jest.fn().mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(tx)),
  };
}

// ── isLeavingExecutorRole (tested via update behaviour) ──────────────────────

describe('Role-change executor cleanup', () => {
  // ── 1. executor-capable → non-executor-capable: full cleanup ─────────────

  it('ADMIN executor → CLIENT: clears specializations, bindings, forces isExecutor=false', async () => {
    const prisma = makePrisma({
      id: 'user-1',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      isActive: true,
      isExecutor: true,
    });

    const svc = new UsersService(prisma as any);
    await svc.update('co-1', 'actor-1', 'user-1', { role: UserRole.CLIENT });

    expect(prisma._tx.technicianSpecialization.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(prisma._tx.userLocationBinding.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    // user.update must include isExecutor: false
    expect(prisma._tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isExecutor: false }),
      }),
    );
  });

  it('TECHNICIAN executor → NETWORK_DIRECTOR: clears specializations, bindings, forces isExecutor=false', async () => {
    const prisma = makePrisma({
      id: 'user-2',
      email: 'tech@example.com',
      role: UserRole.TECHNICIAN,
      isActive: true,
      isExecutor: true,
    });

    const svc = new UsersService(prisma as any);
    await svc.update('co-1', 'actor-1', 'user-2', { role: UserRole.NETWORK_DIRECTOR });

    expect(prisma._tx.technicianSpecialization.deleteMany).toHaveBeenCalled();
    expect(prisma._tx.userLocationBinding.deleteMany).toHaveBeenCalled();
    expect(prisma._tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isExecutor: false }),
      }),
    );
  });

  it('MASTER executor → CLIENT: clears specializations, bindings, forces isExecutor=false', async () => {
    const prisma = makePrisma({
      id: 'user-3',
      email: 'master@example.com',
      role: UserRole.MASTER,
      isActive: true,
      isExecutor: true,
    });

    const svc = new UsersService(prisma as any);
    await svc.update('co-1', 'actor-1', 'user-3', { role: UserRole.CLIENT });

    expect(prisma._tx.technicianSpecialization.deleteMany).toHaveBeenCalled();
    expect(prisma._tx.userLocationBinding.deleteMany).toHaveBeenCalled();
    expect(prisma._tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isExecutor: false }) }),
    );
  });

  it('DISPATCHER executor → NETWORK_DIRECTOR: clears specializations, bindings, forces isExecutor=false', async () => {
    const prisma = makePrisma({
      id: 'user-4',
      email: 'disp@example.com',
      role: UserRole.DISPATCHER,
      isActive: true,
      isExecutor: true,
    });

    const svc = new UsersService(prisma as any);
    await svc.update('co-1', 'actor-1', 'user-4', { role: UserRole.NETWORK_DIRECTOR });

    expect(prisma._tx.technicianSpecialization.deleteMany).toHaveBeenCalled();
    expect(prisma._tx.userLocationBinding.deleteMany).toHaveBeenCalled();
    expect(prisma._tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isExecutor: false }) }),
    );
  });

  it('ADMIN (isExecutor=false) → CLIENT: still clears executor scope data and forces isExecutor=false', async () => {
    const prisma = makePrisma({
      id: 'user-5',
      email: 'admin2@example.com',
      role: UserRole.ADMIN,
      isActive: true,
      isExecutor: false,
    });

    const svc = new UsersService(prisma as any);
    await svc.update('co-1', 'actor-1', 'user-5', { role: UserRole.CLIENT });

    // deleteMany still runs (no-op is fine; keeps logic simple and consistent)
    expect(prisma._tx.technicianSpecialization.deleteMany).toHaveBeenCalled();
    expect(prisma._tx.userLocationBinding.deleteMany).toHaveBeenCalled();
    expect(prisma._tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isExecutor: false }) }),
    );
  });

  // ── 2. executor-capable → executor-capable: no cleanup ───────────────────

  it('ADMIN → MASTER: no specialization/binding cleanup', async () => {
    const prisma = makePrisma({
      id: 'user-6',
      email: 'admin3@example.com',
      role: UserRole.ADMIN,
      isActive: true,
      isExecutor: true,
    });

    const svc = new UsersService(prisma as any);
    await svc.update('co-1', 'actor-1', 'user-6', { role: UserRole.MASTER });

    expect(prisma._tx.technicianSpecialization.deleteMany).not.toHaveBeenCalled();
    expect(prisma._tx.userLocationBinding.deleteMany).not.toHaveBeenCalled();
    // isExecutor not forced — dto had no isExecutor field so update data omits it
    const updateCall = prisma._tx.user.update.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty('isExecutor');
  });

  it('TECHNICIAN → DISPATCHER: no specialization/binding cleanup', async () => {
    const prisma = makePrisma({
      id: 'user-7',
      email: 'tech2@example.com',
      role: UserRole.TECHNICIAN,
      isActive: true,
      isExecutor: true,
    });

    const svc = new UsersService(prisma as any);
    await svc.update('co-1', 'actor-1', 'user-7', { role: UserRole.DISPATCHER });

    expect(prisma._tx.technicianSpecialization.deleteMany).not.toHaveBeenCalled();
    expect(prisma._tx.userLocationBinding.deleteMany).not.toHaveBeenCalled();
  });

  it('MASTER → TECHNICIAN: no cleanup', async () => {
    const prisma = makePrisma({
      id: 'user-8',
      email: 'master2@example.com',
      role: UserRole.MASTER,
      isActive: true,
      isExecutor: true,
    });

    const svc = new UsersService(prisma as any);
    await svc.update('co-1', 'actor-1', 'user-8', { role: UserRole.TECHNICIAN });

    expect(prisma._tx.technicianSpecialization.deleteMany).not.toHaveBeenCalled();
    expect(prisma._tx.userLocationBinding.deleteMany).not.toHaveBeenCalled();
  });

  // ── 3. non-executor-capable → executor-capable: no cleanup, isExecutor unchanged ─

  it('CLIENT → TECHNICIAN: no cleanup; isExecutor stays false when not explicitly set', async () => {
    const prisma = makePrisma({
      id: 'user-9',
      email: 'client@example.com',
      role: UserRole.CLIENT,
      isActive: true,
      isExecutor: false,
    });

    const svc = new UsersService(prisma as any);
    await svc.update('co-1', 'actor-1', 'user-9', { role: UserRole.TECHNICIAN });

    expect(prisma._tx.technicianSpecialization.deleteMany).not.toHaveBeenCalled();
    expect(prisma._tx.userLocationBinding.deleteMany).not.toHaveBeenCalled();
    // isExecutor was not in dto and no forced override → not present in update data
    const updateCall = prisma._tx.user.update.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty('isExecutor');
  });

  it('NETWORK_DIRECTOR → ADMIN: no cleanup; dto.isExecutor=true is accepted and passed through', async () => {
    const prisma = makePrisma({
      id: 'user-10',
      email: 'nd@example.com',
      role: UserRole.NETWORK_DIRECTOR,
      isActive: true,
      isExecutor: false,
    });

    const svc = new UsersService(prisma as any);
    await svc.update('co-1', 'actor-1', 'user-10', {
      role: UserRole.ADMIN,
      isExecutor: true,
    });

    expect(prisma._tx.technicianSpecialization.deleteMany).not.toHaveBeenCalled();
    expect(prisma._tx.userLocationBinding.deleteMany).not.toHaveBeenCalled();
    // isExecutor: true should be passed through since target role is executor-capable
    expect(prisma._tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isExecutor: true }) }),
    );
  });

  // ── 4. no role change — only other fields change ─────────────────────────

  it('ADMIN executor — role unchanged, only name updated: no cleanup', async () => {
    const prisma = makePrisma({
      id: 'user-11',
      email: 'admin4@example.com',
      role: UserRole.ADMIN,
      isActive: true,
      isExecutor: true,
    });

    const svc = new UsersService(prisma as any);
    await svc.update('co-1', 'actor-1', 'user-11', { firstName: 'Ivan' });

    expect(prisma._tx.technicianSpecialization.deleteMany).not.toHaveBeenCalled();
    expect(prisma._tx.userLocationBinding.deleteMany).not.toHaveBeenCalled();
  });
});
