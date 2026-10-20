import { readFileSync } from 'fs';
import { join } from 'path';

import { UserRole } from '@prisma/client';

import { RealtimeService } from './realtime.service';

// authenticateClient передаёт secret: getJwtSecret() в verifyAsync; verify замокан,
// но секрет обязан существовать (>=32 символов), иначе getJwtSecret() бросит.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-value-0123456789abcdef';

/**
 * SECURITY P1 — WEBSOCKET JWT HARDENING.
 *
 * Аудит: WS-рукопожатие принимало обычный access JWT из query (?token= /
 * ?access_token=). URL попадают в логи прокси/доступа, историю браузера и
 * Referer, поэтому полноценный access-токен в URL — утечка.
 *
 * Здесь закреплено, что после исправления токен в URL игнорируется, а
 * легитимные пути рукопожатия сохранены: заголовок Authorization,
 * подпротокол Sec-WebSocket-Protocol (bearer.<jwt> / jwt.<jwt>) и
 * пост-коннект сообщение {type:'auth'} (его использует веб/мобайл SPA).
 * Проверяется также, что неавторизованное подключение, чужой tenant и
 * просроченные/битые учётные данные отклоняются (close 1008).
 */

function makeService(userFindFirst: jest.Mock, verifyAsync: jest.Mock) {
  const prisma = { user: { findFirst: userFindFirst, findMany: jest.fn() } } as any;
  const jwt = { verifyAsync } as any;
  return new RealtimeService(prisma, jwt);
}

function reqWith(headers: Record<string, string | undefined>) {
  return { headers } as any;
}

function stubSocket() {
  return { write: jest.fn().mockReturnValue(true), end: jest.fn(), destroyed: false };
}

function stubClient(overrides: Record<string, unknown> = {}) {
  return {
    id: 'client-1',
    socket: stubSocket(),
    receiveBuffer: Buffer.alloc(0),
    subscriptions: new Map(),
    user: null,
    tokenExpiresAt: null,
    authTimer: null,
    lastPongAt: Date.now(),
    closed: false,
    ...overrides,
  } as any;
}

// Серверные кадры не маскируются; длина payload может быть расширенной
// (>=126 байт → 2 доп. байта), поэтому payload начинается не всегда с offset 2.
function payloadOffset(buf: Buffer): number {
  const len = buf[1] & 0x7f;
  if (len === 126) return 4;
  if (len === 127) return 10;
  return 2;
}

function textFrames(socket: { write: jest.Mock }) {
  return socket.write.mock.calls
    .map(([buf]) => buf as Buffer)
    .filter((buf) => (buf[0] & 0x0f) === 0x1)
    .map((buf) => JSON.parse(buf.subarray(payloadOffset(buf)).toString('utf8')));
}

function closeCodes(socket: { write: jest.Mock }) {
  return socket.write.mock.calls
    .map(([buf]) => buf as Buffer)
    .filter((buf) => (buf[0] & 0x0f) === 0x8)
    .map((buf) => buf.readUInt16BE(payloadOffset(buf)));
}

const ext = (svc: RealtimeService, request: unknown): string =>
  (svc as any).extractHandshakeToken(request);

describe('P1 WS handshake: токен не читается из URL', () => {
  const svc = makeService(jest.fn(), jest.fn());

  it('1. ?token= в URL игнорируется (токен берётся только вне URL)', () => {
    // extractHandshakeToken больше не получает URL — даже если клиент оставил
    // ?token= в адресе, заголовков нет → токена нет.
    expect(ext(svc, reqWith({}))).toBe('');
  });

  it('2. Authorization: Bearer — принимается', () => {
    expect(ext(svc, reqWith({ authorization: 'Bearer abc.def.ghi' }))).toBe('abc.def.ghi');
  });

  it('3. подпротокол bearer.<jwt> — принимается', () => {
    expect(ext(svc, reqWith({ 'sec-websocket-protocol': 'bearer.aaa.bbb.ccc' }))).toBe('aaa.bbb.ccc');
  });

  it('4. подпротокол jwt.<jwt> — принимается', () => {
    expect(ext(svc, reqWith({ 'sec-websocket-protocol': 'jwt.xxx.yyy.zzz' }))).toBe('xxx.yyy.zzz');
  });

  it('5. нет заголовков/подпротокола — токена нет', () => {
    expect(ext(svc, reqWith({ 'sec-websocket-protocol': 'graphql-ws' }))).toBe('');
  });
});

describe('P1 WS handshake: аутентификация и изоляция (пост-коннект {type:auth})', () => {
  const LIVE = { id: 'user-1', email: 'a@b.c', companyId: 'company-a', role: UserRole.ADMIN };

  async function auth(
    verifyAsync: jest.Mock,
    userFindFirst: jest.Mock,
    token = 'jwt-token',
  ) {
    const svc = makeService(userFindFirst, verifyAsync);
    const client = stubClient();
    await (svc as any).authenticateClient(client, token);
    return client;
  }

  it('валидный токen + живой пользователь → session.ready, user установлен', async () => {
    const verify = jest.fn().mockResolvedValue({
      sub: 'user-1',
      companyId: 'company-a',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const find = jest.fn().mockResolvedValue(LIVE);
    const client = await auth(verify, find);
    expect(client.user).toMatchObject({ id: 'user-1', companyId: 'company-a' });
    expect(textFrames(client.socket).map((f: any) => f.type)).toContain('session.ready');
    expect(closeCodes(client.socket)).toEqual([]);
    // tenant-привязка: поиск пользователя по id И companyId токена
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'user-1', companyId: 'company-a', isActive: true, deletedAt: null }) }),
    );
  });

  it('неавторизован: битый токен (verify бросает) → close 1008', async () => {
    const verify = jest.fn().mockRejectedValue(new Error('invalid signature'));
    const find = jest.fn();
    const client = await auth(verify, find);
    expect(find).not.toHaveBeenCalled();
    expect(client.user).toBeNull();
    expect(closeCodes(client.socket)).toContain(1008);
  });

  it('чужой tenant / неактивный пользователь: пара (id, companyId) не найдена → close 1008', async () => {
    const verify = jest.fn().mockResolvedValue({
      sub: 'user-1',
      companyId: 'company-OTHER',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const find = jest.fn().mockResolvedValue(null); // нет активного пользователя в этом tenant
    const client = await auth(verify, find);
    expect(client.user).toBeNull();
    expect(closeCodes(client.socket)).toContain(1008);
  });

  it('просрочка: токен без exp отклоняется → close 1008', async () => {
    const verify = jest.fn().mockResolvedValue({ sub: 'user-1', companyId: 'company-a' });
    const find = jest.fn();
    const client = await auth(verify, find);
    expect(client.user).toBeNull();
    expect(closeCodes(client.socket)).toContain(1008);
  });
});

describe('P1 WS handshake: контракт исходника', () => {
  const source = readFileSync(join(__dirname, 'realtime.service.ts'), 'utf-8');

  it("не читает token/access_token из query", () => {
    expect(source).not.toMatch(/searchParams\.get\('(token|access_token)'\)/);
  });
});
