import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TicketStatus, UserRole } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { PERMISSIONS } from '../src/common/permissions.constants';

import {
  prisma,
  resetDb,
  createCompanyWithUsers,
  createSpecAndCategory,
  linkTechToSpec,
  createTicket,
  ensurePermissionBlocks,
  grantRolePermissions,
} from './helpers';

function pickToken(body: any): string {
  const t = body?.access_token;
  if (!t || typeof t !== 'string') throw new Error('No access_token in response');
  return t;
}

async function waitForEvent(where: any, timeoutMs = 1500) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const found = await prisma.domainEvent.findFirst({ where });
    if (found) return found;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`DomainEvent not found within ${timeoutMs}ms: ${JSON.stringify(where)}`);
}

describe('Hubex Event Store (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it('writes events: ticket.claimed + ticket.status_changed', async () => {
    const { company, tech } = await createCompanyWithUsers({
      companyName: 'E2E Event Company',
      adminEmail: 'admin_events@sma.test',
      adminPassword: 'ChangeMe123!',
      techEmail: 'tech_events@sma.test',
      techPassword: 'ChangeMe123!',
    });

    // Включаем PBAC для tickets
    await ensurePermissionBlocks([
      PERMISSIONS.TICKETS_VIEW_AVAILABLE,
      PERMISSIONS.TICKETS_CLAIM,
      PERMISSIONS.TICKETS_VIEW,
      PERMISSIONS.TICKETS_STATUS_CHANGE,
    ]);
    await grantRolePermissions(UserRole.TECHNICIAN, [
      PERMISSIONS.TICKETS_VIEW_AVAILABLE,
      PERMISSIONS.TICKETS_CLAIM,
      PERMISSIONS.TICKETS_VIEW,
      PERMISSIONS.TICKETS_STATUS_CHANGE,
    ]);

    // Делаем категорию/спек и линк технику (чтобы ticket был available)
    const { spec, categoryOk } = await createSpecAndCategory(company.id);
    await linkTechToSpec(tech.id, spec.id);

    // Создаём NEW тикет, подходящий по специализации
    const t = await createTicket({
      companyId: company.id,
      problemCategoryId: categoryOk.id,
      problemText: 'E2E event store ticket',
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
    });

    // Логин техником
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: tech.email, password: (tech as any).passwordPlain })
      .expect(201);

    const techToken = pickToken(login.body);

    // Claim
    await request(app.getHttpServer())
      .post(`/tickets/${t.id}/claim`)
      .set('Authorization', `Bearer ${techToken}`)
      .expect(201);

    await waitForEvent({
      companyId: company.id,
      entityType: 'Ticket',
      entityId: t.id,
      type: 'ticket.claimed',
    });

    // Status change -> IN_PROGRESS
    await request(app.getHttpServer())
      .patch(`/tickets/${t.id}/status`)
      .set('Authorization', `Bearer ${techToken}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    await waitForEvent({
      companyId: company.id,
      entityType: 'Ticket',
      entityId: t.id,
      type: 'ticket.status_changed',
    });

    // sanity: события реально лежат в таблице
    const all = await prisma.domainEvent.findMany({
      where: { companyId: company.id, entityType: 'Ticket', entityId: t.id },
      orderBy: { createdAt: 'asc' },
      select: { type: true },
    });

    const types = all.map((x) => x.type);
    expect(types).toContain('ticket.claimed');
    expect(types).toContain('ticket.status_changed');
  });
});
