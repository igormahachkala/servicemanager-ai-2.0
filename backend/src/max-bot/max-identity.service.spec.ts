import { MaxUserBindingStatus, UserRole } from '@prisma/client';

import { MaxIdentityService, extractMaxUserId } from './max-identity.service';

function makePrisma(binding: unknown) {
  return {
    maxUserBinding: { findUnique: jest.fn().mockResolvedValue(binding) },
  } as any;
}

const activeUser = {
  id: 'user-1',
  companyId: 'company-1',
  role: UserRole.TECHNICIAN,
  isActive: true,
  deletedAt: null,
};

describe('extractMaxUserId', () => {
  it('reads the sender of a message_created update', () => {
    expect(extractMaxUserId({ message: { sender: { user_id: 4242 } } })).toBe('4242');
  });

  it('reads the presser of a message_callback update', () => {
    expect(extractMaxUserId({ callback: { user: { user_id: 77 } } })).toBe('77');
  });

  it('prefers the callback presser over the message sender', () => {
    const update = { callback: { user: { user_id: 77 } }, message: { sender: { user_id: 1 } } };
    expect(extractMaxUserId(update)).toBe('77');
  });

  it('returns null when no user id is present', () => {
    expect(extractMaxUserId({ message: { text: '/start' } })).toBeNull();
    expect(extractMaxUserId(null)).toBeNull();
  });
});

describe('MaxIdentityService', () => {
  // SMA-MAX-SECURE-USER-BINDING-054: the secure ceremony now exists, so creation is on.
  // Resolution stays fail-closed regardless — the cases below are what actually guard it.
  it('binding creation is enabled once the secure ceremony exists', () => {
    expect(MaxIdentityService.BINDING_CREATION_ENABLED).toBe(true);
  });

  it('resolves an active binding for an active user', async () => {
    const prisma = makePrisma({
      status: MaxUserBindingStatus.ACTIVE,
      userId: 'user-1',
      companyId: 'company-1',
      user: activeUser,
    });
    const result = await new MaxIdentityService(prisma).resolveByMaxUserId('4242');
    expect(result).toEqual({
      resolved: true,
      userId: 'user-1',
      companyId: 'company-1',
      role: UserRole.TECHNICIAN,
      maxUserId: '4242',
    });
  });

  it('fails closed when there is no binding', async () => {
    const result = await new MaxIdentityService(makePrisma(null)).resolveByMaxUserId('4242');
    expect(result).toEqual({ resolved: false, reason: 'not_bound' });
  });

  it('fails closed for a revoked binding', async () => {
    const prisma = makePrisma({
      status: MaxUserBindingStatus.REVOKED,
      userId: 'user-1',
      companyId: 'company-1',
      user: activeUser,
    });
    const result = await new MaxIdentityService(prisma).resolveByMaxUserId('4242');
    expect(result).toEqual({ resolved: false, reason: 'binding_revoked' });
  });

  it('fails closed for a suspended binding', async () => {
    const prisma = makePrisma({
      status: MaxUserBindingStatus.SUSPENDED,
      userId: 'user-1',
      companyId: 'company-1',
      user: activeUser,
    });
    const result = await new MaxIdentityService(prisma).resolveByMaxUserId('4242');
    expect(result).toEqual({ resolved: false, reason: 'binding_suspended' });
  });

  it('fails closed for a deactivated user', async () => {
    const prisma = makePrisma({
      status: MaxUserBindingStatus.ACTIVE,
      userId: 'user-1',
      companyId: 'company-1',
      user: { ...activeUser, isActive: false },
    });
    const result = await new MaxIdentityService(prisma).resolveByMaxUserId('4242');
    expect(result).toEqual({ resolved: false, reason: 'user_inactive' });
  });

  it('fails closed for a soft-deleted user', async () => {
    const prisma = makePrisma({
      status: MaxUserBindingStatus.ACTIVE,
      userId: 'user-1',
      companyId: 'company-1',
      user: { ...activeUser, deletedAt: new Date() },
    });
    const result = await new MaxIdentityService(prisma).resolveByMaxUserId('4242');
    expect(result).toEqual({ resolved: false, reason: 'user_inactive' });
  });

  it('fails closed when the user moved to another company after binding', async () => {
    const prisma = makePrisma({
      status: MaxUserBindingStatus.ACTIVE,
      userId: 'user-1',
      companyId: 'company-1',
      user: { ...activeUser, companyId: 'company-2' },
    });
    const result = await new MaxIdentityService(prisma).resolveByMaxUserId('4242');
    expect(result).toEqual({ resolved: false, reason: 'company_mismatch' });
  });

  it('fails closed without a MAX user id and never queries the database', async () => {
    const prisma = makePrisma(null);
    const result = await new MaxIdentityService(prisma).resolve({ message: { text: '/start' } });
    expect(result).toEqual({ resolved: false, reason: 'no_max_user_id' });
    expect(prisma.maxUserBinding.findUnique).not.toHaveBeenCalled();
  });

  it('fails closed when prisma is unavailable', async () => {
    const result = await new MaxIdentityService(undefined).resolveByMaxUserId('4242');
    expect(result).toEqual({ resolved: false, reason: 'not_bound' });
  });

  it('looks the binding up by the unique maxUserId', async () => {
    const prisma = makePrisma(null);
    await new MaxIdentityService(prisma).resolveByMaxUserId(' 4242 ');
    expect(prisma.maxUserBinding.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { maxUserId: '4242' } }),
    );
  });
});
