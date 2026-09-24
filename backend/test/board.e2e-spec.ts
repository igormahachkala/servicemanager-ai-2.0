import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TicketStatus } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { PERMISSIONS } from '../src/common/permissions.constants';
import { prisma, ensurePermissionBlocks, grantRolePermissions } from './helpers';

function pickToken(body: any): string {
  const t = body?.access_token;
  if (!t || typeof t !== 'string') throw new Error('No access_token in response');
  return t;
}

describe('Tickets Board (e2e)', () => {
  let app: INestApplication;

  let token = '';
  let catId = '';
  let locationId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    // Ensure PBAC is set up for ADMIN regardless of DB state from other test files
    const ADMIN_PERMS = [
      PERMISSIONS.LOCATIONS_MANAGE,
      PERMISSIONS.LOCATIONS_VIEW,
      PERMISSIONS.COMPANY_SETTINGS_EDIT,
      PERMISSIONS.TICKETS_CREATE,
      PERMISSIONS.TICKETS_VIEW,
    ] as const;
    await ensurePermissionBlocks([...ADMIN_PERMS]);
    await grantRolePermissions('ADMIN' as any, [...ADMIN_PERMS]);

    // register admin
    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ companyName: 'Board Company', email: 'board_admin@sma.test', password: 'ChangeMe123!' })
      .expect(201);

    token = pickToken(reg.body);

    // create location (required by CreateTicketDto)
    const loc = await request(app.getHttpServer())
      .post('/locations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Board Location', platformCode: 'BOARD-LOC-1', city: 'Test', address: 'Test St 1' })
      .expect(201);
    locationId = loc.body.id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('creates category+spec, creates ticket, board returns it in NEW column', async () => {
    // specialization
    const spec = await request(app.getHttpServer())
      .post('/specializations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'IT мастер' })
      .expect(201);

    // category
    const cat = await request(app.getHttpServer())
      .post('/problem-categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'IT / сеть / связь', instructions: 'Перезапусти роутер.' })
      .expect(201);

    catId = cat.body.id;

    // link
    await request(app.getHttpServer())
      .put(`/problem-categories/${catId}/specializations`)
      .set('Authorization', `Bearer ${token}`)
      .send({ specializationIds: [spec.body.id] })
      .expect(200);

    // ticket
    const created = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        locationId,
        problemCategoryId: catId,
        problemText: 'Не работает интернет',
        urgency: 'URGENT',
        slaMinutes: 120,
      })
      .expect(201);

    const ticketId = created.body?.ticket?.id;
    expect(ticketId).toBeTruthy();

    // board
    const board = await request(app.getHttpServer())
      .get('/tickets/board')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const colNew = board.body.columns.find((c: any) => c.status === TicketStatus.NEW);
    expect(colNew).toBeTruthy();
    expect(colNew.total).toBeGreaterThanOrEqual(1);

    const card = colNew.cards.find((x: any) => x.id === ticketId);
    expect(card).toBeTruthy();
    expect(card.status).toBe('NEW');
    expect(card.assignedTechnician).toBeNull();
    expect(card.category?.id).toBe(catId);
    expect(typeof card.title).toBe('string');
  });
});
