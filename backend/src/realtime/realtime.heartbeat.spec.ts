import {
  applyHeartbeatSweep,
  heartbeatDecision,
  heartbeatTimedOut,
  indexActiveUsers,
  jwtExpired,
  REALTIME_HEARTBEAT_MS,
  tokenExpiresAtMs,
  uniqueUserIds,
  userSessionStillValid,
} from './realtime.heartbeat';

describe('heartbeatTimedOut', () => {
  it('keeps a client that answered within two intervals', () => {
    expect(heartbeatTimedOut(1_000, 1_000 + REALTIME_HEARTBEAT_MS * 2)).toBe(false);
  });

  it('drops a client silent for more than two intervals', () => {
    expect(heartbeatTimedOut(1_000, 1_000 + REALTIME_HEARTBEAT_MS * 2 + 1)).toBe(true);
  });
});

describe('tokenExpiresAtMs', () => {
  it('converts JWT exp seconds to milliseconds', () => {
    expect(tokenExpiresAtMs(1_700_000_000)).toBe(1_700_000_000_000);
  });

  it('rejects missing exp', () => {
    expect(tokenExpiresAtMs(undefined)).toBeNull();
    expect(tokenExpiresAtMs('1700000000')).toBeNull();
  });
});

describe('jwtExpired', () => {
  const now = 1_700_000_000_000;

  it('keeps a token that has not reached exp', () => {
    expect(jwtExpired(now + 1, now)).toBe(false);
  });

  it('drops a token at the exp instant', () => {
    expect(jwtExpired(now, now)).toBe(true);
  });

  it('drops a token past exp', () => {
    expect(jwtExpired(now - 1, now)).toBe(true);
  });

  it('drops a session with no exp', () => {
    expect(jwtExpired(null, now)).toBe(true);
  });
});

describe('userSessionStillValid', () => {
  const active = indexActiveUsers([
    { id: 'user-1', companyId: 'company-a' },
    { id: 'user-2', companyId: 'company-b' },
  ]);

  it('keeps a user still active in the same company', () => {
    expect(userSessionStillValid({ id: 'user-1', companyId: 'company-a' }, active)).toBe(true);
  });

  it('drops a deactivated or missing user', () => {
    expect(userSessionStillValid({ id: 'user-1', companyId: 'company-a' }, indexActiveUsers([]))).toBe(
      false,
    );
  });

  it('drops a user whose companyId no longer matches', () => {
    expect(userSessionStillValid({ id: 'user-1', companyId: 'company-other' }, active)).toBe(false);
  });

  it('drops a connection without a user', () => {
    expect(userSessionStillValid(null, active)).toBe(false);
  });
});

describe('heartbeatDecision', () => {
  const now = 1_000;
  const liveUser = { id: 'user-1', companyId: 'company-a' };

  it('skips a closed client', () => {
    expect(
      heartbeatDecision(
        { closed: true, lastPongAt: now, user: liveUser, tokenExpiresAt: now + 1 },
        now,
      ),
    ).toBe('skip');
  });

  it('times out a silent client before auth checks', () => {
    expect(
      heartbeatDecision(
        {
          closed: false,
          lastPongAt: now - REALTIME_HEARTBEAT_MS * 2 - 1,
          user: liveUser,
          tokenExpiresAt: now + 1,
        },
        now,
      ),
    ).toBe('timeout');
  });

  it('pings a client that has not authenticated yet', () => {
    expect(
      heartbeatDecision(
        { closed: false, lastPongAt: now, user: null, tokenExpiresAt: null },
        now,
      ),
    ).toBe('ping');
  });

  it('rejects an authenticated client whose JWT has expired', () => {
    expect(
      heartbeatDecision(
        { closed: false, lastPongAt: now, user: liveUser, tokenExpiresAt: now },
        now,
      ),
    ).toBe('rejectAuth');
  });

  it('queues an authenticated client with a live JWT for the user lookup', () => {
    expect(
      heartbeatDecision(
        { closed: false, lastPongAt: now, user: liveUser, tokenExpiresAt: now + 1 },
        now,
      ),
    ).toBe('checkUser');
  });
});

describe('uniqueUserIds', () => {
  it('deduplicates user ids for the batched lookup', () => {
    expect(
      uniqueUserIds([
        { user: { id: 'user-1', companyId: 'company-a' } },
        { user: { id: 'user-1', companyId: 'company-a' } },
        { user: { id: 'user-2', companyId: 'company-b' } },
      ]),
    ).toEqual(['user-1', 'user-2']);
  });
});

describe('applyHeartbeatSweep', () => {
  const now = 1_700_000_000_000;
  const liveUser = { id: 'user-1', companyId: 'company-a' };

  function stub(overrides: {
    closed?: boolean;
    lastPongAt?: number;
    user?: { id: string; companyId: string } | null;
    tokenExpiresAt?: number | null;
  }) {
    return {
      closed: false,
      lastPongAt: now,
      user: liveUser,
      tokenExpiresAt: now + 1,
      ...overrides,
    };
  }

  async function run(clients: ReturnType<typeof stub>[], rows: { id: string; companyId: string }[]) {
    const findActiveUsers = jest.fn().mockResolvedValue(rows);
    const onTimeout = jest.fn();
    const onRejectAuth = jest.fn();
    const onPing = jest.fn();
    await applyHeartbeatSweep({
      clients,
      now,
      findActiveUsers,
      onTimeout,
      onRejectAuth,
      onPing,
    });
    return { findActiveUsers, onTimeout, onRejectAuth, onPing };
  }

  it('rejects an expired JWT without querying users', async () => {
    const { findActiveUsers, onRejectAuth, onPing } = await run(
      [stub({ tokenExpiresAt: now })],
      [liveUser],
    );
    expect(findActiveUsers).not.toHaveBeenCalled();
    expect(onRejectAuth).toHaveBeenCalledTimes(1);
    expect(onPing).not.toHaveBeenCalled();
  });

  it('rejects a deactivated or deleted user after the batched lookup', async () => {
    const { findActiveUsers, onRejectAuth, onPing } = await run([stub({})], []);
    expect(findActiveUsers).toHaveBeenCalledWith(['user-1']);
    expect(onRejectAuth).toHaveBeenCalledTimes(1);
    expect(onPing).not.toHaveBeenCalled();
  });

  it('pings a live session whose JWT is still valid', async () => {
    const { onRejectAuth, onPing, onTimeout } = await run([stub({})], [liveUser]);
    expect(onPing).toHaveBeenCalledTimes(1);
    expect(onRejectAuth).not.toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
