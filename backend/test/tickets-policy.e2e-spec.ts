import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ServiceContractRole, TicketStatus } from '@prisma/client';
import { PERMISSIONS } from '../src/common/permissions.constants';
import type { PermissionCode } from '../src/common/permissions.constants';

import {
  prisma,
  resetDb,
  resetDbFull,
  ensurePermissionBlocks,
  grantRolePermissions,
  grantUserPermissions,
  createCompanyWithUsers,
  createSpecAndCategory,
  linkTechToSpec,
  createTicket,
  createProviderClientSetup,
} from './helpers';

describe('Tickets Policy Contract (e2e)', () => {
  let app: INestApplication;

  const PERMS: PermissionCode[] = [
    PERMISSIONS.TICKETS_CREATE,
    PERMISSIONS.TICKETS_VIEW,
    PERMISSIONS.TICKETS_ASSIGN,
    PERMISSIONS.TICKETS_CLAIM,
    PERMISSIONS.TICKETS_STATUS_CHANGE,
    PERMISSIONS.TICKETS_VIEW_AVAILABLE,
    PERMISSIONS.ANALYTICS_VIEW,
  ];

  async function login(email: string, password: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);

    expect(res.body.access_token).toBeTruthy();
    return res.body.access_token as string;
  }

  beforeAll(async () => {
    const modRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = modRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDb();

    // включаем PBAC (чтобы PermissionsGuard НЕ был в bypass-режиме)
    await ensurePermissionBlocks(PERMS);

    // управленческие роли получают полный доступ (в рамках тестов)
    await grantRolePermissions('ADMIN' as any, PERMS);
    await grantRolePermissions('MASTER' as any, PERMS);
    await grantRolePermissions('DISPATCHER' as any, PERMS);
    await grantRolePermissions('NETWORK_DIRECTOR' as any, [
      PERMISSIONS.ANALYTICS_VIEW,
      PERMISSIONS.TICKETS_VIEW,
      PERMISSIONS.TICKETS_STATUS_CHANGE,
    ]);
    // TECHNICIAN по умолчанию НЕ даём прав — будем выдавать точечно через UserPermission,
    // чтобы проверить, что PBAC реально работает.
  });

  it('PBAC enforced: TECHNICIAN without TICKETS_VIEW cannot list tickets (403)', async () => {
    const { tech } = await createCompanyWithUsers();
    const token = await login(tech.email, tech.passwordPlain);

    await request(app.getHttpServer())
      .get('/tickets')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('TECHNICIAN can read own assigned ticket but NOT another tech\'s assigned ticket', async () => {
    const { company, tech, otherTech } = await createCompanyWithUsers();
    const { spec, categoryOk } = await createSpecAndCategory(company.id);

    await linkTechToSpec(tech.id, spec.id);

    // выдаём tech право на чтение тикетов
    await grantUserPermissions(tech.id, [PERMISSIONS.TICKETS_VIEW]);

    // тикет назначен ДРУГОМУ технику — tech не должен его видеть
    const otherTicket = await createTicket({
      companyId: company.id,
      problemCategoryId: categoryOk.id,
      status: TicketStatus.ASSIGNED,
      assignedTechnicianId: otherTech.id,
      problemText: 'Assigned to other tech',
    });

    // тикет назначен самому tech — должен видеть
    const myTicket = await createTicket({
      companyId: company.id,
      problemCategoryId: categoryOk.id,
      status: TicketStatus.ASSIGNED,
      assignedTechnicianId: tech.id,
      problemText: 'Assigned to me',
    });

    const token = await login(tech.email, tech.passwordPlain);

    // чужой тикет → 404 (policy: только свои)
    await request(app.getHttpServer())
      .get(`/tickets/${otherTicket.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    // свой тикет → 200
    const res = await request(app.getHttpServer())
      .get(`/tickets/${myTicket.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.id).toBe(myTicket.id);
  });

  it('TECHNICIAN claim: only NEW + unassigned + specialization match', async () => {
    const { company, tech } = await createCompanyWithUsers();
    const { spec, categoryOk, categoryNoMatch } = await createSpecAndCategory(company.id);

    await linkTechToSpec(tech.id, spec.id);

    await grantUserPermissions(tech.id, [PERMISSIONS.TICKETS_VIEW, PERMISSIONS.TICKETS_CLAIM]);

    const okTicket = await createTicket({
      companyId: company.id,
      problemCategoryId: categoryOk.id,
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
      problemText: 'claim OK',
    });

    const badTicket = await createTicket({
      companyId: company.id,
      problemCategoryId: categoryNoMatch.id,
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
      problemText: 'claim NO MATCH',
    });

    const token = await login(tech.email, tech.passwordPlain);

    // OK claim
    const okRes = await request(app.getHttpServer())
      .post(`/tickets/${okTicket.id}/claim`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(okRes.body.id).toBe(okTicket.id);
    expect(okRes.body.status).toBe('ASSIGNED');
    expect(okRes.body.assignedTechnicianId).toBe(tech.id);

    // NO MATCH claim -> 404 (ticket not in claimable scope for this tech's specializations)
    await request(app.getHttpServer())
      .post(`/tickets/${badTicket.id}/claim`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('TECHNICIAN status_change: only assigned to self', async () => {
    const { company, tech, otherTech } = await createCompanyWithUsers();
    const { spec, categoryOk } = await createSpecAndCategory(company.id);

    await linkTechToSpec(tech.id, spec.id);

    // выдаём tech права на просмотр и смену статуса
    await grantUserPermissions(tech.id, [PERMISSIONS.TICKETS_VIEW, PERMISSIONS.TICKETS_STATUS_CHANGE]);

    const чужой = await createTicket({
      companyId: company.id,
      problemCategoryId: categoryOk.id,
      status: TicketStatus.ASSIGNED,
      assignedTechnicianId: otherTech.id,
      problemText: 'not my ticket',
    });

    const мой = await createTicket({
      companyId: company.id,
      problemCategoryId: categoryOk.id,
      status: TicketStatus.ASSIGNED,
      assignedTechnicianId: tech.id,
      problemText: 'my ticket',
    });

    const token = await login(tech.email, tech.passwordPlain);

    // чужой -> 404 (ticket not in tech's readable scope — assigned to another, not NEW/unassigned)
    await request(app.getHttpServer())
      .patch(`/tickets/${чужой.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(404);

    // мой -> 200
    const res = await request(app.getHttpServer())
      .patch(`/tickets/${мой.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    expect(res.body.id).toBe(мой.id);
    expect(res.body.status).toBe('IN_PROGRESS');
  });

  it('ADMIN assign works (PBAC + role) and sets ASSIGNED', async () => {
    const { company, admin, tech } = await createCompanyWithUsers();
    const { spec, categoryOk } = await createSpecAndCategory(company.id);
    await linkTechToSpec(tech.id, spec.id);

    const ticket = await createTicket({
      companyId: company.id,
      problemCategoryId: categoryOk.id,
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
      problemText: 'assign me',
    });

    const token = await login(admin.email, admin.passwordPlain);

    const res = await request(app.getHttpServer())
      .put(`/tickets/${ticket.id}/assign/${tech.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.id).toBe(ticket.id);
    expect(res.body.status).toBe('ASSIGNED');
    expect(res.body.assignedTechnicianId).toBe(tech.id);
  });

  it.each([
    ['MASTER', 'master.executor@example.com'],
    ['DISPATCHER', 'dispatcher.executor@example.com'],
  ])('%s executor can assign self, move IN_PROGRESS, and close DONE', async (role, email) => {
    const { company, admin } = await createCompanyWithUsers({ adminEmail: email });
    const { spec, categoryOk } = await createSpecAndCategory(company.id);
    await linkTechToSpec(admin.id, spec.id);

    await prisma.user.update({
      where: { id: admin.id },
      data: { role: role as any, isExecutor: true },
    });

    const ticket = await createTicket({
      companyId: company.id,
      problemCategoryId: categoryOk.id,
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
      problemText: `${role} executor flow`,
    });

    const token = await login(email, 'Passw0rd!');

    const assigned = await request(app.getHttpServer())
      .put(`/tickets/${ticket.id}/assign/${admin.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(assigned.body.id).toBe(ticket.id);
    expect(assigned.body.status).toBe('ASSIGNED');
    expect(assigned.body.assignedTechnicianId).toBe(admin.id);

    const inProgress = await request(app.getHttpServer())
      .patch(`/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: TicketStatus.IN_PROGRESS })
      .expect(200);

    expect(inProgress.body.status).toBe('IN_PROGRESS');

    await prisma.ticketAttachment.create({
      data: {
        companyId: company.id,
        ticketId: ticket.id,
        uploadedByUserId: admin.id,
        originalName: 'work-report.png',
        storageKey: `test-${ticket.id}`,
        mimeType: 'image/png',
        sizeBytes: 100,
        url: `http://example.invalid/${ticket.id}.png`,
        purpose: 'WORK_REPORT' as any,
      },
    });
    await prisma.domainEvent.create({
      data: {
        companyId: company.id,
        entityType: 'Ticket',
        entityId: ticket.id,
        type: 'ticket.comment_added',
        actorUserId: admin.id,
        payload: { comment: 'Executor completed work' },
      },
    });

    const done = await request(app.getHttpServer())
      .patch(`/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: TicketStatus.DONE, comment: 'Completed' })
      .expect(200);

    expect(done.body.status).toBe('DONE');
    expect(done.body.closedAt).toBeTruthy();
  });
});

// ─── Failure 2: PRIMARY provider ADMIN assign via linkedClientCompanyId ──────

describe('Tickets — PRIMARY provider ADMIN assign client ticket (Failure 2 regression)', () => {
  let app: INestApplication;

  const PERMS: PermissionCode[] = [
    PERMISSIONS.TICKETS_CREATE,
    PERMISSIONS.TICKETS_VIEW,
    PERMISSIONS.TICKETS_ASSIGN,
    PERMISSIONS.TICKETS_CLAIM,
    PERMISSIONS.TICKETS_STATUS_CHANGE,
    PERMISSIONS.TICKETS_VIEW_AVAILABLE,
    PERMISSIONS.ANALYTICS_VIEW,
  ];

  async function login(email: string, password: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    return res.body.access_token as string;
  }

  beforeAll(async () => {
    const modRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDbFull();
    await ensurePermissionBlocks(PERMS);
    await grantRolePermissions('ADMIN' as any, PERMS);
    await grantRolePermissions('MASTER' as any, PERMS);
    await grantRolePermissions('DISPATCHER' as any, PERMS);
  });

  it('PRIMARY_PROVIDER_ADMIN can assign a client ticket via linkedClientCompanyId (was 403 before fix)', async () => {
    const { client, provider, admin, tech } = await createProviderClientSetup({
      contractRole: ServiceContractRole.PRIMARY,
    });
    const { categoryOk } = await createSpecAndCategory(client.id);

    const ticket = await createTicket({
      companyId: client.id,
      problemCategoryId: categoryOk.id,
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
      problemText: 'client ticket to assign',
    });

    const token = await login(admin.email, admin.passwordPlain);

    const res = await request(app.getHttpServer())
      .put(`/tickets/${ticket.id}/assign/${tech.id}?linkedClientCompanyId=${client.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.id).toBe(ticket.id);
    expect(res.body.assignedTechnicianId).toBe(tech.id);
    expect(res.body.status).toBe('ASSIGNED');
  });

  it('SECONDARY_PROVIDER_ADMIN cannot assign a client ticket they have no access to', async () => {
    const { client, provider: secondaryProvider, admin: secondaryAdmin } = await createProviderClientSetup({
      contractRole: ServiceContractRole.SECONDARY,
    });

    // Create a PRIMARY provider (needed for the client to have a managing provider)
    const { provider: primaryProvider } = await createProviderClientSetup({
      contractRole: ServiceContractRole.PRIMARY,
      clientSuffix: client.id, // reuse same client — but createProviderClientSetup creates a new client
    });

    // Create the category and ticket on the original client
    const { categoryOk } = await createSpecAndCategory(client.id);
    const ticket = await createTicket({
      companyId: client.id,
      problemCategoryId: categoryOk.id,
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
      problemText: 'client ticket - secondary has no executor bound here',
    });

    // Use a tech from a completely unrelated company (no contract with client)
    const { tech: unrelatedTech } = await createProviderClientSetup({
      contractRole: ServiceContractRole.PRIMARY,
    });

    const token = await login(secondaryAdmin.email, secondaryAdmin.passwordPlain);

    // SECONDARY admin should not be able to assign a ticket to a technician
    // from a different company with no secondary contract
    await request(app.getHttpServer())
      .put(`/tickets/${ticket.id}/assign/${unrelatedTech.id}?linkedClientCompanyId=${client.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect((res) => {
        // Expect 403 (SECONDARY cannot do management assign) or 404 (not found in scope)
        expect([403, 404]).toContain(res.status);
      });
  });
});

// ─── Failure 1: SECONDARY board scope restriction ─────────────────────────────

describe('Tickets — SECONDARY provider board scope (Failure 1 regression)', () => {
  let app: INestApplication;

  const PERMS: PermissionCode[] = [
    PERMISSIONS.TICKETS_CREATE,
    PERMISSIONS.TICKETS_VIEW,
    PERMISSIONS.TICKETS_ASSIGN,
    PERMISSIONS.TICKETS_CLAIM,
    PERMISSIONS.TICKETS_STATUS_CHANGE,
    PERMISSIONS.TICKETS_VIEW_AVAILABLE,
    PERMISSIONS.ANALYTICS_VIEW,
  ];

  async function login(email: string, password: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    return res.body.access_token as string;
  }

  beforeAll(async () => {
    const modRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDbFull();
    await ensurePermissionBlocks(PERMS);
    await grantRolePermissions('ADMIN' as any, PERMS);
    await grantRolePermissions('MASTER' as any, PERMS);
    await grantRolePermissions('DISPATCHER' as any, PERMS);
  });

  it('SECONDARY_PROVIDER_ADMIN board does NOT return unrelated client tickets (isolation)', async () => {
    const { client, admin: secondaryAdmin, tech: secondaryTech } = await createProviderClientSetup({
      contractRole: ServiceContractRole.SECONDARY,
    });
    const { categoryOk } = await createSpecAndCategory(client.id);

    // Create a ticket NOT assigned to secondary provider's executors and no location binding
    const unrelatedTicket = await createTicket({
      companyId: client.id,
      problemCategoryId: categoryOk.id,
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
      problemText: 'unrelated ticket - secondary should NOT see this',
    });

    const token = await login(secondaryAdmin.email, secondaryAdmin.passwordPlain);

    const boardRes = await request(app.getHttpServer())
      .get(`/tickets/board?linkedClientCompanyId=${client.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const allIds = (boardRes.body.columns ?? []).flatMap((col: any) =>
      (col.cards ?? []).map((c: any) => c.id),
    );
    expect(allIds).not.toContain(unrelatedTicket.id);
  });

  it('SECONDARY_PROVIDER_ADMIN board DOES return tickets assigned to their executor', async () => {
    const { client, provider: secondaryProvider, admin: secondaryAdmin, tech: secondaryTech } =
      await createProviderClientSetup({ contractRole: ServiceContractRole.SECONDARY });
    const { categoryOk } = await createSpecAndCategory(client.id);

    // Ticket assigned to the secondary provider's executor — SHOULD be visible
    const assignedTicket = await createTicket({
      companyId: client.id,
      problemCategoryId: categoryOk.id,
      status: TicketStatus.ASSIGNED,
      assignedTechnicianId: secondaryTech.id,
      problemText: 'assigned to secondary tech - should be visible',
    });

    // Unrelated ticket assigned to nobody — should NOT be visible (no location binding)
    const unrelatedTicket = await createTicket({
      companyId: client.id,
      problemCategoryId: categoryOk.id,
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
      problemText: 'unrelated NEW ticket - should NOT be visible',
    });

    const token = await login(secondaryAdmin.email, secondaryAdmin.passwordPlain);

    const boardRes = await request(app.getHttpServer())
      .get(`/tickets/board?linkedClientCompanyId=${client.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const allIds = (boardRes.body.columns ?? []).flatMap((col: any) =>
      (col.cards ?? []).map((c: any) => c.id),
    );
    expect(allIds).toContain(assignedTicket.id);
    expect(allIds).not.toContain(unrelatedTicket.id);
  });
});
