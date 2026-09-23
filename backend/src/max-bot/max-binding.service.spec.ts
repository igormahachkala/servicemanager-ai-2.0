import { createHmac } from 'node:crypto';

import { MaxUserBindingStatus } from '@prisma/client';

import { MaxBindingService, maskMaxUserId } from './max-binding.service';
import { MAX_START_AFTER_LOGIN_TEXT } from './max-menu.builder';

/**
 * SMA-MAX-SECURE-USER-BINDING-054.
 *
 * Ceremony-level tests. The signature algorithm itself is covered in max-init-data.spec.ts;
 * here the concern is what the ceremony does with a verdict — who may bind to whom, and that
 * a still-fresh initData can re-bind after revoke (MAX keeps the same string for a while).
 */

const BOT_TOKEN = 'test-bot-token-054';

function buildInitData(maxUserId: number, authDateSeconds = Math.floor(Date.now() / 1000)): string {
  const params: Record<string, string> = {
    auth_date: String(authDateSeconds),
    query_id: `q-${maxUserId}`,
    user: JSON.stringify({ id: maxUserId, first_name: 'Ada' }),
  };
  const launchParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = createHmac('sha256', secretKey).update(launchParams).digest('hex');
  return [
    ...Object.keys(params).map((key) => `${key}=${encodeURIComponent(params[key])}`),
    `hash=${hash}`,
  ].join('&');
}

type BindingRow = {
  id: string;
  userId: string;
  companyId: string;
  maxUserId: string;
  status: MaxUserBindingStatus;
  linkedAt: Date;
  lastVerifiedAt: Date | null;
};

function makePrisma(options: {
  users?: Record<string, { id: string; companyId: string; isActive: boolean; deletedAt: Date | null }>;
  bindings?: BindingRow[];
} = {}) {
  const users = options.users ?? {
    'user-1': { id: 'user-1', companyId: 'company-1', isActive: true, deletedAt: null },
    'user-2': { id: 'user-2', companyId: 'company-2', isActive: true, deletedAt: null },
  };
  const bindings: BindingRow[] = [...(options.bindings ?? [])];
  let seq = 0;

  return {
    _bindings: bindings,
    user: {
      findUnique: async ({ where }: any) => users[where.id] ?? null,
    },
    maxUserBinding: {
      findUnique: async ({ where }: any) =>
        bindings.find((b) => b.maxUserId === where.maxUserId) ?? null,
      findFirst: async ({ where }: any) => {
        return (
          bindings.find((b) => {
            if (where.userId && b.userId !== where.userId) return false;
            if (where.status?.not && b.status === where.status.not) return false;
            if (typeof where.status === 'string' && b.status !== where.status) return false;
            return true;
          }) ?? null
        );
      },
      create: async ({ data }: any) => {
        const row: BindingRow = { id: `b-${++seq}`, lastVerifiedAt: null, ...data };
        bindings.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = bindings.find((b) => b.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const row of bindings) {
          if (where.userId && row.userId !== where.userId) continue;
          if (where.maxUserId && row.maxUserId !== where.maxUserId) continue;
          if (where.status?.not && row.status === where.status.not) continue;
          if (typeof where.status === 'string' && row.status !== where.status) continue;
          Object.assign(row, data);
          count += 1;
        }
        return { count };
      },
    },
  } as any;
}

describe('MaxBindingService', () => {
  const originalToken = process.env.MAX_BOT_API_TOKEN;
  beforeEach(() => {
    process.env.MAX_BOT_API_TOKEN = BOT_TOKEN;
  });
  afterAll(() => {
    if (originalToken === undefined) delete process.env.MAX_BOT_API_TOKEN;
    else process.env.MAX_BOT_API_TOKEN = originalToken;
  });

  it('creates a binding from verified initData plus an authenticated user', async () => {
    const prisma = makePrisma();
    const service = new MaxBindingService(prisma);

    const result = await service.createBinding('user-1', buildInitData(4242));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(true);
    expect(result.binding.status).toBe(MaxUserBindingStatus.ACTIVE);
    expect(prisma._bindings[0]).toMatchObject({
      userId: 'user-1',
      companyId: 'company-1',
      maxUserId: '4242',
    });
  });

  it('asks the MAX chat for /start when a binding is created', async () => {
    const bot = { sendStartHint: jest.fn().mockResolvedValue(undefined) };
    const result = await new MaxBindingService(makePrisma(), bot).createBinding('user-1', buildInitData(4242));
    expect(result.ok).toBe(true);
    expect(bot.sendStartHint).toHaveBeenCalledWith(4242);
    expect(MAX_START_AFTER_LOGIN_TEXT).toContain('/start');
  });

  it('keeps the binding when the start hint cannot be sent', async () => {
    const bot = { sendStartHint: jest.fn().mockRejectedValue(new Error('max down')) };
    const result = await new MaxBindingService(makePrisma(), bot).createBinding('user-1', buildInitData(4242));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(true);
  });

  it('never returns the full MAX user id', async () => {
    const prisma = makePrisma();
    const result = await new MaxBindingService(prisma).createBinding('user-1', buildInitData(1234567890));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.binding.maxUserIdMasked).toBe('****7890');
    expect(JSON.stringify(result)).not.toContain('1234567890');
  });

  // --- tamper / invalid ---

  it('denies invalid initData', async () => {
    const result = await new MaxBindingService(makePrisma()).createBinding('user-1', 'garbage');
    expect(result).toEqual({ ok: false, reason: 'init_data_malformed' });
  });

  it('denies tampered initData', async () => {
    const tampered = buildInitData(4242).replace('auth_date=', 'auth_date=1');
    const result = await new MaxBindingService(makePrisma()).createBinding('user-1', tampered);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/^init_data_/);
  });

  it('denies expired initData', async () => {
    const stale = buildInitData(4242, Math.floor(Date.now() / 1000) - 86_400);
    const result = await new MaxBindingService(makePrisma()).createBinding('user-1', stale);
    expect(result).toEqual({ ok: false, reason: 'init_data_expired' });
  });

  // --- same initData after revoke / re-confirm ---

  it('accepts the same valid initData a second time for the same user', async () => {
    const prisma = makePrisma();
    const service = new MaxBindingService(prisma);
    const initData = buildInitData(4242);

    const first = await service.createBinding('user-1', initData);
    expect(first.ok).toBe(true);

    const second = await service.createBinding('user-1', initData);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.created).toBe(false);
    expect(prisma._bindings).toHaveLength(1);
  });

  it('reactivates after revoke with the same initData', async () => {
    const prisma = makePrisma();
    const service = new MaxBindingService(prisma);
    const initData = buildInitData(4242);

    await service.createBinding('user-1', initData);
    await service.revokeBinding('user-1', initData);
    expect(prisma._bindings[0].status).toBe(MaxUserBindingStatus.REVOKED);
    expect(await service.getBinding('user-1')).toBeNull();

    const again = await service.createBinding('user-1', initData);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.created).toBe(false);
    expect(prisma._bindings[0].status).toBe(MaxUserBindingStatus.ACTIVE);
    expect(await service.getBinding('user-1')).not.toBeNull();
  });

  it('refuses cross-account bind while the victim binding is still ACTIVE', async () => {
    const prisma = makePrisma();
    const service = new MaxBindingService(prisma);
    const victimPayload = buildInitData(4242);

    await service.createBinding('user-1', victimPayload);
    const attack = await service.createBinding('user-2', victimPayload);

    expect(attack).toEqual({ ok: false, reason: 'max_user_already_bound' });
    expect(prisma._bindings).toHaveLength(1);
    expect(prisma._bindings[0].userId).toBe('user-1');
  });

  // --- uniqueness ---

  it('refuses to steal a MAX identity that is actively bound elsewhere', async () => {
    const prisma = makePrisma({
      bindings: [
        {
          id: 'b-existing',
          userId: 'user-1',
          companyId: 'company-1',
          maxUserId: '4242',
          status: MaxUserBindingStatus.ACTIVE,
          linkedAt: new Date(),
          lastVerifiedAt: null,
        },
      ],
    });
    const result = await new MaxBindingService(prisma).createBinding('user-2', buildInitData(4242));
    expect(result).toEqual({ ok: false, reason: 'max_user_already_bound' });
    expect(prisma._bindings[0].userId).toBe('user-1');
  });

  it('refuses a second MAX account for an already-bound user', async () => {
    const prisma = makePrisma({
      bindings: [
        {
          id: 'b-existing',
          userId: 'user-1',
          companyId: 'company-1',
          maxUserId: '1111',
          status: MaxUserBindingStatus.ACTIVE,
          linkedAt: new Date(),
          lastVerifiedAt: null,
        },
      ],
    });
    const result = await new MaxBindingService(prisma).createBinding('user-1', buildInitData(2222));
    expect(result).toEqual({ ok: false, reason: 'user_already_bound' });
  });

  it('does not ask for /start again when an active binding is re-confirmed', async () => {
    const prisma = makePrisma({
      bindings: [
        {
          id: 'b-existing',
          userId: 'user-1',
          companyId: 'company-1',
          maxUserId: '4242',
          status: MaxUserBindingStatus.ACTIVE,
          linkedAt: new Date('2026-01-01'),
          lastVerifiedAt: null,
        },
      ],
    });
    const bot = { sendStartHint: jest.fn().mockResolvedValue(undefined) };
    const result = await new MaxBindingService(prisma, bot).createBinding('user-1', buildInitData(4242));
    expect(result.ok).toBe(true);
    expect(bot.sendStartHint).not.toHaveBeenCalled();
  });

  it('asks for /start again when a revoked binding is restored', async () => {
    const prisma = makePrisma({
      bindings: [
        {
          id: 'b-old',
          userId: 'user-1',
          companyId: 'company-1',
          maxUserId: '4242',
          status: MaxUserBindingStatus.REVOKED,
          linkedAt: new Date('2026-01-01'),
          lastVerifiedAt: null,
        },
      ],
    });
    const bot = { sendStartHint: jest.fn().mockResolvedValue(undefined) };
    const result = await new MaxBindingService(prisma, bot).createBinding('user-1', buildInitData(4242));
    expect(result.ok).toBe(true);
    expect(bot.sendStartHint).toHaveBeenCalledWith(4242);
  });

  it('is deterministic when the same user re-confirms the same MAX account', async () => {
    const prisma = makePrisma({
      bindings: [
        {
          id: 'b-existing',
          userId: 'user-1',
          companyId: 'company-1',
          maxUserId: '4242',
          status: MaxUserBindingStatus.ACTIVE,
          linkedAt: new Date('2026-01-01'),
          lastVerifiedAt: null,
        },
      ],
    });
    const result = await new MaxBindingService(prisma).createBinding('user-1', buildInitData(4242));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(false);
    expect(prisma._bindings).toHaveLength(1);
    expect(prisma._bindings[0].lastVerifiedAt).toBeInstanceOf(Date);
  });

  it('lets a revoked MAX identity be reclaimed by a different proven user', async () => {
    const prisma = makePrisma({
      bindings: [
        {
          id: 'b-old',
          userId: 'user-1',
          companyId: 'company-1',
          maxUserId: '4242',
          status: MaxUserBindingStatus.REVOKED,
          linkedAt: new Date('2026-01-01'),
          lastVerifiedAt: null,
        },
      ],
    });
    const result = await new MaxBindingService(prisma).createBinding('user-2', buildInitData(4242));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(prisma._bindings).toHaveLength(1);
    expect(prisma._bindings[0]).toMatchObject({
      userId: 'user-2',
      companyId: 'company-2',
      status: MaxUserBindingStatus.ACTIVE,
    });
  });

  // --- SMA-side state ---

  it('denies an inactive ServiceManager user', async () => {
    const prisma = makePrisma({
      users: { 'user-1': { id: 'user-1', companyId: 'company-1', isActive: false, deletedAt: null } },
    });
    const result = await new MaxBindingService(prisma).createBinding('user-1', buildInitData(4242));
    expect(result).toEqual({ ok: false, reason: 'user_inactive' });
    expect(prisma._bindings).toHaveLength(0);
  });

  it('denies a soft-deleted ServiceManager user', async () => {
    const prisma = makePrisma({
      users: { 'user-1': { id: 'user-1', companyId: 'company-1', isActive: true, deletedAt: new Date() } },
    });
    const result = await new MaxBindingService(prisma).createBinding('user-1', buildInitData(4242));
    expect(result).toEqual({ ok: false, reason: 'user_inactive' });
  });

  it('denies an unknown ServiceManager user', async () => {
    const result = await new MaxBindingService(makePrisma()).createBinding('ghost', buildInitData(4242));
    expect(result).toEqual({ ok: false, reason: 'user_not_found' });
  });

  it('denies when no bot token is configured', async () => {
    delete process.env.MAX_BOT_API_TOKEN;
    const result = await new MaxBindingService(makePrisma()).createBinding('user-1', buildInitData(4242));
    expect(result).toEqual({ ok: false, reason: 'init_data_bot_token_missing' });
  });

  // --- read / revoke ---

  it('revokes idempotently', async () => {
    const prisma = makePrisma();
    const service = new MaxBindingService(prisma);
    await service.createBinding('user-1', buildInitData(4242));

    expect(await service.revokeBinding('user-1')).toEqual({ ok: true, revoked: true });
    expect(prisma._bindings[0].status).toBe(MaxUserBindingStatus.REVOKED);
    expect(await service.revokeBinding('user-1')).toEqual({ ok: true, revoked: false });
  });

  it('unlinks the MAX account on logout even when JWT is a different SMA user', async () => {
    const prisma = makePrisma({
      bindings: [
        {
          id: 'b-tech',
          userId: 'user-1',
          companyId: 'company-1',
          maxUserId: '4242',
          status: MaxUserBindingStatus.ACTIVE,
          linkedAt: new Date('2026-01-01'),
          lastVerifiedAt: null,
        },
      ],
    });
    const service = new MaxBindingService(prisma);

    expect(await service.revokeBinding('user-2', buildInitData(4242))).toEqual({ ok: true, revoked: true });
    expect(prisma._bindings[0]).toMatchObject({
      userId: 'user-1',
      status: MaxUserBindingStatus.REVOKED,
    });
  });

  it('still revokes the JWT user when initData is garbage', async () => {
    const prisma = makePrisma();
    const service = new MaxBindingService(prisma);
    await service.createBinding('user-1', buildInitData(4242));

    expect(await service.revokeBinding('user-1', 'not-init-data')).toEqual({ ok: true, revoked: true });
    expect(prisma._bindings[0].status).toBe(MaxUserBindingStatus.REVOKED);
  });

  it('hides a revoked binding from the read endpoint', async () => {
    const prisma = makePrisma();
    const service = new MaxBindingService(prisma);
    await service.createBinding('user-1', buildInitData(4242));
    expect(await service.getBinding('user-1')).not.toBeNull();

    await service.revokeBinding('user-1');
    expect(await service.getBinding('user-1')).toBeNull();
  });

  it('masks short and long ids without leaking them', () => {
    expect(maskMaxUserId('42')).toBe('****');
    expect(maskMaxUserId('123456')).toBe('****3456');
  });

  it('silent login refreshes lastVerifiedAt without creating a row', async () => {
    const prisma = makePrisma({
      bindings: [
        {
          id: 'b-existing',
          userId: 'user-1',
          companyId: 'company-1',
          maxUserId: '4242',
          status: MaxUserBindingStatus.ACTIVE,
          linkedAt: new Date('2026-01-01'),
          lastVerifiedAt: null,
        },
      ],
    });
    const service = new MaxBindingService(prisma);

    await service.touchBindingAfterSilentLogin('user-1');
    expect(prisma._bindings).toHaveLength(1);
    expect(prisma._bindings[0].lastVerifiedAt).toBeInstanceOf(Date);

    await service.touchBindingAfterSilentLogin('user-1');
    expect(prisma._bindings).toHaveLength(1);
  });
});
