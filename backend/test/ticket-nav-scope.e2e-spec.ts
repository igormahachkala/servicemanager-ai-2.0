import { INestApplication } from '@nestjs/common';
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
  linkTechToSpec,
} from './helpers';

/**
 * Ticket UX V2 (TUX-01): контракт области, которую карточка заявки отправляет
 * в API, против настоящего сервера. Фронтенд открывает чужую заявку провайдера
 * с linkedClientCompanyId владельца и больше не подмешивает companyId.
 *
 * Тест фиксирует, что:
 *  - linked открывает заявку только при действующем договоре и в его объектах;
 *  - companyId сам по себе прав не даёт никому, кроме PLATFORM_ADMIN;
 *  - чужой tenant, SECONDARY без операционной связи и CLIENT чужой компании
 *    заявку не получают ни с какой областью.
 * Права сервера тест не меняет, только проверяет.
 */

const PASSWORD = 'Passw0rd!';
const PERMS: PermissionCode[] = [
  PERMISSIONS.TICKETS_VIEW,
  PERMISSIONS.TICKETS_ASSIGN,
  PERMISSIONS.TICKETS_CLAIM,
  PERMISSIONS.TICKETS_STATUS_CHANGE,
];
const ROLES = [
  UserRole.ADMIN,
  UserRole.DISPATCHER,
  UserRole.TECHNICIAN,
  UserRole.CLIENT,
  UserRole.PLATFORM_ADMIN,
];

describe('Ticket nav scope contract (e2e)', () => {
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

  async function getTicket(
    email: string,
    ticketId: string,
    scope: { companyId?: string; linkedClientCompanyId?: string } = {},
  ) {
    const q = new URLSearchParams();
    if (scope.companyId) q.set('companyId', scope.companyId);
    if (scope.linkedClientCompanyId)
      q.set('linkedClientCompanyId', scope.linkedClientCompanyId);
    const suffix = q.toString() ? `?${q}` : '';
    return request(app.getHttpServer())
      .get(`/tickets/${ticketId}${suffix}`)
      .set('Authorization', `Bearer ${await token(email)}`);
  }

  async function company(
    name: string,
    type: CompanyType,
    users: Array<{ role: UserRole; isExecutor?: boolean }>,
  ) {
    const hash = await bcrypt.hash(PASSWORD, 4);
    const tag = randomUUID().slice(0, 8);
    const c = await prisma.company.create({
      data: {
        name: `${name}-${tag}`,
        type,
        autoAssignEnabled: false,
        users: {
          create: users.map((u) => ({
            email: `${u.role.toLowerCase()}-${name.toLowerCase()}-${tag}@example.com`,
            password: hash,
            role: u.role,
            isExecutor: !!u.isExecutor,
          })),
        },
      },
      include: { users: true },
    });
    const by = (role: UserRole) => c.users.find((u) => u.role === role)!.email;
    return { id: c.id, users: c.users, by };
  }

  async function contract(params: {
    clientId: string;
    providerId: string;
    role: ServiceContractRole;
    specId: string;
    locationIds?: string[];
  }) {
    const sc = await prisma.serviceContract.create({
      data: {
        clientCompanyId: params.clientId,
        providerCompanyId: params.providerId,
        role: params.role,
        status: ServiceContractStatus.ACTIVE,
        locationMode: params.locationIds
          ? ServiceContractLocationMode.SELECTED_LOCATIONS
          : ServiceContractLocationMode.ALL_LOCATIONS,
        specializationLinks: { create: [{ specializationId: params.specId }] },
      },
    });
    for (const locationId of params.locationIds ?? []) {
      await prisma.serviceContractLocation.create({
        data: {
          serviceContractId: sc.id,
          clientCompanyId: params.clientId,
          locationId,
        },
      });
    }
    return sc;
  }

  async function location(clientId: string, name: string) {
    return prisma.location.create({
      data: {
        clientCompanyId: clientId,
        name,
        platformCode: `e2e-${randomUUID()}`,
        isActive: true,
      },
    });
  }

  let world: Awaited<ReturnType<typeof buildWorld>>;

  async function buildWorld() {
    const client = await company('Client', CompanyType.CLIENT, [
      { role: UserRole.CLIENT },
    ]);
    const foreignClient = await company('Foreign', CompanyType.CLIENT, [
      { role: UserRole.CLIENT },
    ]);
    const primary = await company('Primary', CompanyType.PROVIDER, [
      { role: UserRole.ADMIN },
      { role: UserRole.DISPATCHER },
      { role: UserRole.TECHNICIAN, isExecutor: true },
    ]);
    const secondary = await company('Secondary', CompanyType.PROVIDER, [
      { role: UserRole.ADMIN },
      { role: UserRole.TECHNICIAN, isExecutor: true },
    ]);
    const limited = await company('Limited', CompanyType.PROVIDER, [
      { role: UserRole.DISPATCHER },
    ]);
    const platform = await company('Platform', CompanyType.PROVIDER, [
      { role: UserRole.PLATFORM_ADMIN },
    ]);

    const { spec, categoryOk } = await createSpecAndCategory(client.id);
    const foreignCat = await createSpecAndCategory(foreignClient.id);
    const l1 = await location(client.id, 'L1');
    const l2 = await location(client.id, 'L2');

    await contract({
      clientId: client.id,
      providerId: primary.id,
      role: ServiceContractRole.PRIMARY,
      specId: spec.id,
    });
    await contract({
      clientId: client.id,
      providerId: secondary.id,
      role: ServiceContractRole.SECONDARY,
      specId: spec.id,
    });
    await contract({
      clientId: client.id,
      providerId: limited.id,
      role: ServiceContractRole.PRIMARY,
      specId: spec.id,
      locationIds: [l1.id],
    });

    const primaryTech = primary.users.find(
      (u) => u.role === UserRole.TECHNICIAN,
    )!;
    const secondaryTech = secondary.users.find(
      (u) => u.role === UserRole.TECHNICIAN,
    )!;
    await linkTechToSpec(primaryTech.id, spec.id);
    await linkTechToSpec(secondaryTech.id, spec.id);

    const t1 = await createTicket({
      companyId: client.id,
      problemCategoryId: categoryOk.id,
      locationId: l1.id,
    });
    const t2 = await createTicket({
      companyId: client.id,
      problemCategoryId: categoryOk.id,
      locationId: l2.id,
    });
    const tSecondary = await createTicket({
      companyId: client.id,
      problemCategoryId: categoryOk.id,
      locationId: l2.id,
      status: TicketStatus.ASSIGNED,
      assignedTechnicianId: secondaryTech.id,
    });
    const tForeign = await createTicket({
      companyId: foreignClient.id,
      problemCategoryId: foreignCat.categoryOk.id,
    });

    return {
      client,
      foreignClient,
      primary,
      secondary,
      limited,
      platform,
      primaryTech,
      t1,
      t2,
      tSecondary,
      tForeign,
    };
  }

  beforeAll(async () => {
    const modRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modRef.createNestApplication();
    await app.init();
    // Без resetDbFull: компании с уникальными метками, общие строки прав —
    // идемпотентно. Тест не зависит от порядка и не стирает чужие данные.
    await ensurePermissionBlocks(PERMS);
    for (const role of ROLES) await grantRolePermissions(role, PERMS);
    world = await buildWorld();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('PRIMARY provider (DISPATCHER)', () => {
    it('linkedClientCompanyId владельца — заявка клиента открывается (ссылка из обхода)', async () => {
      const res = await getTicket(
        world.primary.by(UserRole.DISPATCHER),
        world.t1.id,
        { linkedClientCompanyId: world.client.id },
      );
      expect(res.status).toBe(200);
      expect(res.body.id ?? res.body.ticket?.id).toBe(world.t1.id);
    });

    it('без области сервер сам находит действующий договор — 200 (доступ по договору, не по ссылке)', async () => {
      expect(
        (await getTicket(world.primary.by(UserRole.DISPATCHER), world.t1.id))
          .status,
      ).toBe(200);
    });

    it('только companyId клиента — то же, что без области: companyId провайдеру ничего не добавляет', async () => {
      const email = world.primary.by(UserRole.DISPATCHER);
      const bare = await getTicket(email, world.t1.id);
      const withCompany = await getTicket(email, world.t1.id, {
        companyId: world.client.id,
      });
      expect(withCompany.status).toBe(bare.status);
      expect(
        withCompany.body.companyId ?? withCompany.body.ticket?.companyId,
      ).toBe(world.client.id);
    });

    it('companyId рядом с linked сервер для провайдера игнорирует (дефект был только в UI)', async () => {
      const res = await getTicket(
        world.primary.by(UserRole.DISPATCHER),
        world.t1.id,
        {
          companyId: world.client.id,
          linkedClientCompanyId: world.client.id,
        },
      );
      expect(res.status).toBe(200);
    });

    it('действие исполнителя с linked-областью разрешено: назначение техника', async () => {
      const res = await request(app.getHttpServer())
        .put(
          `/tickets/${world.t2.id}/assign/${world.primaryTech.id}?linkedClientCompanyId=${world.client.id}`,
        )
        .set(
          'Authorization',
          `Bearer ${await token(world.primary.by(UserRole.DISPATCHER))}`,
        );
      expect(res.status).toBe(200);
      expect(res.body.assignedTechnicianId).toBe(world.primaryTech.id);
    });

    it('чужой tenant: ни linked, ни companyId заявку не открывают', async () => {
      const email = world.primary.by(UserRole.DISPATCHER);
      expect([403, 404]).toContain(
        (
          await getTicket(email, world.tForeign.id, {
            linkedClientCompanyId: world.foreignClient.id,
          })
        ).status,
      );
      expect(
        (
          await getTicket(email, world.tForeign.id, {
            companyId: world.foreignClient.id,
          })
        ).status,
      ).toBe(404);
      expect([403, 404]).toContain(
        (
          await getTicket(email, world.tForeign.id, {
            linkedClientCompanyId: world.client.id,
          })
        ).status,
      );
    });
  });

  describe('договор с ограничением по объектам (SELECTED_LOCATIONS)', () => {
    it('объект договора — 200, объект вне договора — 404 даже с linked', async () => {
      const email = world.limited.by(UserRole.DISPATCHER);
      expect(
        (
          await getTicket(email, world.t1.id, {
            linkedClientCompanyId: world.client.id,
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await getTicket(email, world.t2.id, {
            linkedClientCompanyId: world.client.id,
          })
        ).status,
      ).toBe(404);
    });
  });

  describe('SECONDARY provider (ADMIN)', () => {
    it('заявка, назначенная своему исполнителю, — 200 с linked', async () => {
      const res = await getTicket(
        world.secondary.by(UserRole.ADMIN),
        world.tSecondary.id,
        { linkedClientCompanyId: world.client.id },
      );
      expect(res.status).toBe(200);
    });

    it('несвязанная заявка клиента — 404 с linked и с companyId', async () => {
      const email = world.secondary.by(UserRole.ADMIN);
      expect(
        (
          await getTicket(email, world.t1.id, {
            linkedClientCompanyId: world.client.id,
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await getTicket(email, world.t1.id, {
            companyId: world.client.id,
            linkedClientCompanyId: world.client.id,
          })
        ).status,
      ).toBe(404);
    });
  });

  describe('CLIENT', () => {
    it('своя заявка без области — 200', async () => {
      expect(
        (await getTicket(world.client.by(UserRole.CLIENT), world.t1.id)).status,
      ).toBe(200);
    });

    it('заявка чужой компании — 404 с любой областью', async () => {
      const email = world.client.by(UserRole.CLIENT);
      expect((await getTicket(email, world.tForeign.id)).status).toBe(404);
      expect(
        (
          await getTicket(email, world.tForeign.id, {
            companyId: world.foreignClient.id,
          })
        ).status,
      ).toBe(404);
      expect([403, 404]).toContain(
        (
          await getTicket(email, world.tForeign.id, {
            linkedClientCompanyId: world.foreignClient.id,
          })
        ).status,
      );
    });
  });

  describe('PLATFORM_ADMIN', () => {
    it('режим наблюдения: companyId владельца — 200', async () => {
      expect(
        (
          await getTicket(
            world.platform.by(UserRole.PLATFORM_ADMIN),
            world.t1.id,
            { companyId: world.client.id },
          )
        ).status,
      ).toBe(200);
    });
  });
});
