import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { TicketStatus } from '@prisma/client';
import { PERMISSIONS } from '../src/common/permissions.constants';
import type { PermissionCode } from '../src/common/permissions.constants';

import {
  prisma,
  resetDb,
  ensurePermissionBlocks,
  grantRolePermissions,
  grantUserPermissions,
  createCompanyWithUsers,
  createSpecAndCategory,
  linkTechToSpec,
  createTicket,
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
});
