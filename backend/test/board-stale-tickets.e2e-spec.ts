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
  TicketStatus,
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
 * Карточка «Заявки старше 10 дней» против настоящего сервера и базы:
 * board?olderThanDays=10 отдаёт только незакрытые заявки старше 240 ч,
 * в пределах обычной видимости доски, а meta.matchingTotal — точный счёт,
 * не ограниченный take.
 */

const PASSWORD = 'Passw0rd!';
const PERMS: PermissionCode[] = [PERMISSIONS.TICKETS_VIEW];
const ROLES = [UserRole.ADMIN, UserRole.CLIENT, UserRole.DISPATCHER];
const HOUR_MS = 60 * 60 * 1000;

type Scope = { linkedClientCompanyId?: string };

describe('Board stale tickets card (e2e)', () => {
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

  async function board(email: string, query: Record<string, string>, scope: Scope = {}) {
    const search = new URLSearchParams({ ...query, ...scope });
    return request(app.getHttpServer())
      .get(`/tickets/board?${search.toString()}`)
      .set('Authorization', `Bearer ${await token(email)}`);
  }

  function cardIds(body: any): string[] {
    return (body.columns as Array<{ cards: Array<{ id: string }> }>)
      .flatMap((c) => c.cards)
      .map((c) => c.id)
      .sort();
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

  async function ticketAged(
    companyId: string,
    problemCategoryId: string,
    locationId: string,
    status: TicketStatus,
    ageHours: number,
  ) {
    const t = await createTicket({ companyId, problemCategoryId, locationId, status });
    await prisma.ticket.update({
      where: { id: t.id },
      data: { createdAt: new Date(Date.now() - ageHours * HOUR_MS) },
    });
    return t.id;
  }

  let client: Awaited<ReturnType<typeof company>>;
  let provider: Awaited<ReturnType<typeof company>>;
  let foreign: Awaited<ReturnType<typeof company>>;
  let adminEmail: string;
  let dispatcherEmail: string;
  let foreignEmail: string;
  let staleIds: string[];
  let notStaleIds: string[];
  let foreignStaleId: string;
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

    client = await company('StaleClient', CompanyType.CLIENT, [UserRole.ADMIN]);
    provider = await company('StaleProvider', CompanyType.PROVIDER, [UserRole.DISPATCHER]);
    foreign = await company('StaleForeign', CompanyType.CLIENT, [UserRole.ADMIN]);

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
        name: 'Stale L1',
        platformCode: `e2e-${randomUUID()}`,
        isActive: true,
      },
    });
    const aged = (status: TicketStatus, hours: number) =>
      ticketAged(client.id, categoryOk.id, location.id, status, hours);

    staleIds = [
      await aged(TicketStatus.NEW, 241),
      await aged(TicketStatus.ASSIGNED, 24 * 30),
      await aged(TicketStatus.IN_PROGRESS, 24 * 11),
      await aged(TicketStatus.AWAITING_ACCEPTANCE, 24 * 12),
    ].sort();
    notStaleIds = [
      await aged(TicketStatus.NEW, 239),
      await aged(TicketStatus.IN_PROGRESS, 1),
      await aged(TicketStatus.DONE, 24 * 11),
      await aged(TicketStatus.CANCELED, 24 * 11),
    ];

    const foreignCat = await createSpecAndCategory(foreign.id);
    const foreignLocation = await prisma.location.create({
      data: {
        clientCompanyId: foreign.id,
        name: 'Stale Foreign L1',
        platformCode: `e2e-${randomUUID()}`,
        isActive: true,
      },
    });
    foreignStaleId = await ticketAged(
      foreign.id,
      foreignCat.categoryOk.id,
      foreignLocation.id,
      TicketStatus.NEW,
      24 * 20,
    );

    adminEmail = client.user(UserRole.ADMIN).email;
    dispatcherEmail = provider.user(UserRole.DISPATCHER).email;
    foreignEmail = foreign.user(UserRole.ADMIN).email;
  });

  afterAll(async () => {
    await app.close();
  });

  it('только незакрытые старше 240 ч, точный счёт в meta.matchingTotal', async () => {
    const res = await board(adminEmail, { olderThanDays: '10' });
    expect(res.status).toBe(200);
    expect(cardIds(res.body)).toEqual(staleIds);
    expect(res.body.meta.matchingTotal).toBe(4);
    for (const id of notStaleIds) expect(cardIds(res.body)).not.toContain(id);
  });

  it('без фильтра доска прежняя и без matchingTotal', async () => {
    const res = await board(adminEmail, {});
    expect(res.status).toBe(200);
    const ids = cardIds(res.body);
    for (const id of staleIds) expect(ids).toContain(id);
    expect(ids).toContain(notStaleIds[0]);
    expect(res.body.meta).not.toHaveProperty('matchingTotal');
  });

  it('счёт не урезается take, а карточки урезаются', async () => {
    const res = await board(adminEmail, { olderThanDays: '10', take: '1' });
    expect(res.status).toBe(200);
    expect(cardIds(res.body)).toHaveLength(1);
    expect(res.body.meta.matchingTotal).toBe(4);
  });

  it('видимость доски сохраняется: подрядчик видит то же, чужая компания — своё', async () => {
    const viaProvider = await board(dispatcherEmail, { olderThanDays: '10' }, linked());
    expect(viaProvider.status).toBe(200);
    expect(cardIds(viaProvider.body)).toEqual(staleIds);
    expect(viaProvider.body.meta.matchingTotal).toBe(4);

    const own = await board(foreignEmail, { olderThanDays: '10' });
    expect(own.status).toBe(200);
    expect(cardIds(own.body)).toEqual([foreignStaleId]);
    expect(own.body.meta.matchingTotal).toBe(1);
  });

  it('заявка, закрытая после 10 дней, из счёта уходит', async () => {
    const [first] = staleIds;
    await prisma.ticket.update({
      where: { id: first },
      data: { status: TicketStatus.DONE, closedAt: new Date() },
    });
    const res = await board(adminEmail, { olderThanDays: '10' });
    expect(res.body.meta.matchingTotal).toBe(3);
    expect(cardIds(res.body)).not.toContain(first);
    await prisma.ticket.update({
      where: { id: first },
      data: { status: TicketStatus.NEW, closedAt: null },
    });
  });

  it.each(['0', '366', 'abc', '1.5'])('olderThanDays=%s отклоняется', async (value) => {
    const res = await board(adminEmail, { olderThanDays: value });
    expect(res.status).toBe(400);
  });
});
