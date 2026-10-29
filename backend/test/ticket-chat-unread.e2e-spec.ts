import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import {
  CompanyType,
  ServiceContractLocationMode,
  ServiceContractRole,
  ServiceContractStatus,
  UserRole,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PERMISSIONS } from '../src/common/permissions.constants';
import type { PermissionCode } from '../src/common/permissions.constants';
import {
  prisma,
  ensurePermissionBlocks,
  grantRolePermissions,
  createSpecAndCategory,
  createTicket,
} from './helpers';

/**
 * Индикатор 💬 непрочитанного чата на карточке доски против настоящего
 * сервера и базы: hasUnreadChat у каждого пользователя свой, свой комментарий
 * непрочитанным не делает, отметка прочтения только растёт и ставится лишь
 * на заявку, которую пользователь вправе читать.
 */

const PASSWORD = 'Passw0rd!';
const PERMS: PermissionCode[] = [PERMISSIONS.TICKETS_VIEW];
const ROLES = [UserRole.ADMIN, UserRole.CLIENT, UserRole.DISPATCHER];

type Scope = { linkedClientCompanyId?: string };

describe('Ticket chat unread indicator (e2e)', () => {
  let app: INestApplication;
  const tokens = new Map<string, string>();

  async function token(email: string) {
    const cached = tokens.get(email);
    if (cached) return cached;
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(201);
    tokens.set(email, res.body.access_token);
    return res.body.access_token as string;
  }

  function suffix(scope: Scope = {}) {
    return scope.linkedClientCompanyId
      ? `?linkedClientCompanyId=${scope.linkedClientCompanyId}`
      : '';
  }

  async function unread(email: string, ticketId: string, scope: Scope = {}) {
    const res = await request(app.getHttpServer())
      .get(`/tickets/board${suffix(scope)}`)
      .set('Authorization', `Bearer ${await token(email)}`)
      .expect(200);
    const cards = (res.body.columns as Array<{ cards: any[] }>).flatMap(
      (c) => c.cards,
    );
    const card = cards.find((c) => c.id === ticketId);
    if (!card) throw new Error(`ticket ${ticketId} not on board of ${email}`);
    return card.hasUnreadChat as boolean;
  }

  async function comment(email: string, ticketId: string, text: string) {
    await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${await token(email)}`)
      .send({ comment: text })
      .expect(201);
  }

  async function markRead(
    email: string,
    ticketId: string,
    body: { upTo?: string } = {},
    scope: Scope = {},
  ) {
    return request(app.getHttpServer())
      .post(`/timeline/tickets/${ticketId}/read${suffix(scope)}`)
      .set('Authorization', `Bearer ${await token(email)}`)
      .send(body);
  }

  async function company(name: string, type: CompanyType, roles: UserRole[]) {
    const hash = await bcrypt.hash(PASSWORD, 4);
    const tag = randomUUID().slice(0, 8);
    const c = await prisma.company.create({
      data: {
        name: `${name}-${tag}`,
        type,
        autoAssignEnabled: false,
        users: {
          create: roles.map((role) => ({
            email: `${role.toLowerCase()}-${name.toLowerCase()}-${tag}@example.com`,
            password: hash,
            role,
          })),
        },
      },
      include: { users: true },
    });
    const user = (role: UserRole) => c.users.find((u) => u.role === role)!;
    return { id: c.id, user };
  }

  let client: Awaited<ReturnType<typeof company>>;
  let provider: Awaited<ReturnType<typeof company>>;
  let foreign: Awaited<ReturnType<typeof company>>;
  let ticketId: string;
  let clientEmail: string;
  let adminEmail: string;
  let dispatcherEmail: string;
  const linked = () => ({ linkedClientCompanyId: client.id });

  beforeAll(async () => {
    const modRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modRef.createNestApplication();
    // Тот же пайп, что в main.ts: без него тест не видит отказа валидации.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    await ensurePermissionBlocks(PERMS);
    for (const role of ROLES) await grantRolePermissions(role, PERMS);

    client = await company('ChatClient', CompanyType.CLIENT, [
      UserRole.CLIENT,
      UserRole.ADMIN,
    ]);
    provider = await company('ChatProvider', CompanyType.PROVIDER, [
      UserRole.DISPATCHER,
    ]);
    foreign = await company('ChatForeign', CompanyType.CLIENT, [
      UserRole.CLIENT,
    ]);
    const { spec, categoryOk } = await createSpecAndCategory(client.id);
    await prisma.serviceContract.create({
      data: {
        clientCompanyId: client.id,
        providerCompanyId: provider.id,
        role: ServiceContractRole.PRIMARY,
        status: ServiceContractStatus.ACTIVE,
        locationMode: ServiceContractLocationMode.ALL_LOCATIONS,
        specializationLinks: { create: [{ specializationId: spec.id }] },
      },
    });
    const location = await prisma.location.create({
      data: {
        clientCompanyId: client.id,
        name: 'Chat L1',
        platformCode: `e2e-${randomUUID()}`,
        isActive: true,
      },
    });
    const ticket = await createTicket({
      companyId: client.id,
      problemCategoryId: categoryOk.id,
      locationId: location.id,
    });
    ticketId = ticket.id;
    clientEmail = client.user(UserRole.CLIENT).email;
    adminEmail = client.user(UserRole.ADMIN).email;
    dispatcherEmail = provider.user(UserRole.DISPATCHER).email;
  });

  afterAll(async () => {
    await app.close();
  });

  it('без сообщений индикатора нет ни у кого', async () => {
    expect(await unread(clientEmail, ticketId)).toBe(false);
    expect(await unread(adminEmail, ticketId)).toBe(false);
    expect(await unread(dispatcherEmail, ticketId, linked())).toBe(false);
  });

  it('чужое сообщение — индикатор у остальных, у автора нет', async () => {
    await comment(adminEmail, ticketId, 'первое');
    expect(await unread(clientEmail, ticketId)).toBe(true);
    expect(await unread(dispatcherEmail, ticketId, linked())).toBe(true);
    expect(await unread(adminEmail, ticketId)).toBe(false);
  });

  it('прочтение гасит индикатор только у прочитавшего', async () => {
    const res = await markRead(clientEmail, ticketId);
    expect(res.status).toBe(200);
    expect(await unread(clientEmail, ticketId)).toBe(false);
    expect(await unread(dispatcherEmail, ticketId, linked())).toBe(true);
  });

  it('новое сообщение зажигает индикатор снова', async () => {
    await comment(adminEmail, ticketId, 'второе');
    expect(await unread(clientEmail, ticketId)).toBe(true);
  });

  it('upTo раньше последнего сообщения его не гасит', async () => {
    const latest = await prisma.ticketComment.findFirst({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
    });
    const before = new Date(latest!.createdAt.getTime() - 1).toISOString();
    expect((await markRead(clientEmail, ticketId, { upTo: before })).status).toBe(200);
    expect(await unread(clientEmail, ticketId)).toBe(true);

    const exact = latest!.createdAt.toISOString();
    expect((await markRead(clientEmail, ticketId, { upTo: exact })).status).toBe(200);
    expect(await unread(clientEmail, ticketId)).toBe(false);
  });

  it('отметка не откатывается назад более ранним upTo', async () => {
    const row = await prisma.ticketChatRead.findFirstOrThrow({
      where: { ticketId, userId: client.user(UserRole.CLIENT).id },
    });
    const past = new Date(row.lastReadAt.getTime() - 60_000).toISOString();
    expect((await markRead(clientEmail, ticketId, { upTo: past })).status).toBe(200);
    const after = await prisma.ticketChatRead.findFirstOrThrow({
      where: { ticketId, userId: client.user(UserRole.CLIENT).id },
    });
    expect(after.lastReadAt.getTime()).toBe(row.lastReadAt.getTime());
    expect(await unread(clientEmail, ticketId)).toBe(false);
  });

  it('upTo из будущего обрезается временем сервера', async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    expect((await markRead(adminEmail, ticketId, { upTo: future })).status).toBe(200);
    const row = await prisma.ticketChatRead.findFirstOrThrow({
      where: { ticketId, userId: client.user(UserRole.ADMIN).id },
    });
    expect(row.lastReadAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('провайдер отмечает прочтение в своей области', async () => {
    expect((await markRead(dispatcherEmail, ticketId, {}, linked())).status).toBe(200);
    expect(await unread(dispatcherEmail, ticketId, linked())).toBe(false);
  });

  it('переписка до отметки выкатки прочитанной не требует', async () => {
    await prisma.ticketChatRead.deleteMany({
      where: { ticketId, userId: client.user(UserRole.CLIENT).id },
    });
    expect(await unread(clientEmail, ticketId)).toBe(true);
    await prisma.user.update({
      where: { id: client.user(UserRole.CLIENT).id },
      data: { chatReadBaseline: new Date() },
    });
    expect(await unread(clientEmail, ticketId)).toBe(false);
  });

  it('чужой арендатор не может отметить заявку и строки не создаёт', async () => {
    const res = await markRead(foreign.user(UserRole.CLIENT).email, ticketId);
    expect([403, 404]).toContain(res.status);
    const rows = await prisma.ticketChatRead.count({
      where: { ticketId, userId: foreign.user(UserRole.CLIENT).id },
    });
    expect(rows).toBe(0);
  });

  it('некорректный upTo отклоняется валидацией', async () => {
    const res = await markRead(clientEmail, ticketId, { upTo: 'вчера' });
    expect(res.status).toBe(400);
  });
});
