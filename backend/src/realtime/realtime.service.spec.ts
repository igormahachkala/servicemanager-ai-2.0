import { UserRole } from '@prisma/client';

import { AUTH_INVALID_PAYLOAD } from './realtime.heartbeat';
import { RealtimeService } from './realtime.service';

function makeService(findMany: jest.Mock) {
  const prisma = { user: { findMany, findFirst: jest.fn() } } as any;
  const jwt = { verifyAsync: jest.fn() } as any;
  return new RealtimeService(prisma, jwt);
}

function stubSocket() {
  return {
    write: jest.fn().mockReturnValue(true),
    end: jest.fn(),
    destroyed: false,
  };
}

function stubClient(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    id: 'client-1',
    socket: stubSocket(),
    receiveBuffer: Buffer.alloc(0),
    subscriptions: new Map(),
    user: {
      id: 'user-1',
      email: 'a@b.c',
      companyId: 'company-a',
      role: UserRole.ADMIN,
    },
    tokenExpiresAt: now + 60_000,
    authTimer: null,
    lastPongAt: now,
    closed: false,
    ...overrides,
  };
}

function textFrames(socket: { write: jest.Mock }) {
  return socket.write.mock.calls
    .map(([buf]) => buf as Buffer)
    .filter((buf) => (buf[0] & 0x0f) === 0x1)
    .map((buf) => JSON.parse(buf.subarray(2).toString('utf8')));
}

function closeCodes(socket: { write: jest.Mock }) {
  return socket.write.mock.calls
    .map(([buf]) => buf as Buffer)
    .filter((buf) => (buf[0] & 0x0f) === 0x8)
    .map((buf) => buf.readUInt16BE(2));
}

describe('RealtimeService heartbeat auth', () => {
  it('closes 1008 when the user is inactive or deleted', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = makeService(findMany);
    const client = stubClient();
    (service as any).clients.set(client.id, client);

    await (service as any).sweepHeartbeats();

    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: ['user-1'] }, isActive: true, deletedAt: null },
      select: { id: true, companyId: true },
    });
    expect(textFrames(client.socket)).toEqual([AUTH_INVALID_PAYLOAD]);
    expect(closeCodes(client.socket)).toEqual([1008]);
    expect(client.closed).toBe(true);
  });

  it('keeps a live session whose JWT has not expired', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'user-1', companyId: 'company-a' }]);
    const service = makeService(findMany);
    const client = stubClient();
    (service as any).clients.set(client.id, client);

    await (service as any).sweepHeartbeats();

    expect(findMany).toHaveBeenCalled();
    expect(textFrames(client.socket)).toEqual([]);
    expect(closeCodes(client.socket)).toEqual([]);
    expect(client.closed).toBe(false);
    const ping = client.socket.write.mock.calls
      .map(([buf]) => buf as Buffer)
      .find((buf) => (buf[0] & 0x0f) === 0x9);
    expect(ping).toBeDefined();
  });

  it('closes 1008 on JWT expiry without querying users', async () => {
    const findMany = jest.fn();
    const service = makeService(findMany);
    const client = stubClient({ tokenExpiresAt: Date.now() - 1 });
    (service as any).clients.set(client.id, client);

    await (service as any).sweepHeartbeats();

    expect(findMany).not.toHaveBeenCalled();
    expect(textFrames(client.socket)).toEqual([AUTH_INVALID_PAYLOAD]);
    expect(closeCodes(client.socket)).toEqual([1008]);
    expect(client.closed).toBe(true);
  });
});
