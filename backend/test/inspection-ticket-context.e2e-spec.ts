import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';

function pickToken(body: any): string {
  const t = body?.access_token;
  if (!t || typeof t !== 'string') throw new Error('No access_token in response');
  return t;
}

describe('Inspection -> Ticket context consistency (e2e)', () => {
  let app: INestApplication;
  let token = '';

  let locationId = '';
  let equipmentId = '';
  let categoryId = '';
  let templateId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    const suffix = Date.now();

    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        companyName: `Inspection Ticket Context ${suffix}`,
        email: `inspect_ctx_${suffix}@sma.test`,
        password: 'ChangeMe123!',
      })
      .expect(201);

    token = pickToken(reg.body);

    const location = await request(app.getHttpServer())
      .post('/locations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'E2E Location',
        platformCode: `LOC-${suffix}`,
        city: 'Ufa',
        address: 'Test street 1',
      })
      .expect(201);
    locationId = location.body.id;

    const equipment = await request(app.getHttpServer())
      .post('/equipment')
      .set('Authorization', `Bearer ${token}`)
      .send({
        locationId,
        name: 'E2E HVAC',
        type: 'HVAC',
      })
      .expect(201);
    equipmentId = equipment.body.id;

    const category = await request(app.getHttpServer())
      .post('/problem-categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Inspection issue ${suffix}`, instructions: 'Check and fix' })
      .expect(201);
    categoryId = category.body.id;

    const template = await request(app.getHttpServer())
      .post('/inspection/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Inspection template ${suffix}`,
        items: [{ title: 'Check compressor', description: 'Compressor inspection', sortOrder: 0, isRequired: true }],
      })
      .expect(201);
    templateId = template.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('inherits run location and equipment when creating ticket from item', async () => {
    const run = await request(app.getHttpServer())
      .post('/inspection/runs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        templateId,
        locationId,
        equipmentId,
        title: 'Run with equipment',
      })
      .expect(201);

    const itemId = run.body.items?.[0]?.id;
    expect(itemId).toBeTruthy();
    expect(run.body.locationId).toBe(locationId);
    expect(run.body.equipmentId).toBe(equipmentId);

    await request(app.getHttpServer())
      .patch(`/inspection/runs/${run.body.id}/items/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ISSUE', requiresRepair: true, comment: 'Needs repair' })
      .expect(200);

    const created = await request(app.getHttpServer())
      .post(`/inspection/runs/${run.body.id}/items/${itemId}/create-ticket`)
      .set('Authorization', `Bearer ${token}`)
      .send({ categoryId, title: 'Issue from inspection', description: 'Created from run item' })
      .expect(201);

    const ticketId = created.body.ticket?.id;
    expect(ticketId).toBeTruthy();

    const ticket = await request(app.getHttpServer())
      .get(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(ticket.body.locationId).toBe(locationId);
    expect(ticket.body.equipmentId).toBe(equipmentId);
    expect(ticket.body.location?.id).toBe(locationId);
    expect(ticket.body.equipment?.id).toBe(equipmentId);
  });

  it('keeps ticket equipment empty when run has no equipment', async () => {
    const run = await request(app.getHttpServer())
      .post('/inspection/runs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        templateId,
        locationId,
        title: 'Run without equipment',
      })
      .expect(201);

    const itemId = run.body.items?.[0]?.id;
    expect(itemId).toBeTruthy();
    expect(run.body.locationId).toBe(locationId);
    expect(run.body.equipmentId ?? null).toBeNull();

    await request(app.getHttpServer())
      .patch(`/inspection/runs/${run.body.id}/items/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'CRITICAL', requiresRepair: true, comment: 'Critical issue' })
      .expect(200);

    const created = await request(app.getHttpServer())
      .post(`/inspection/runs/${run.body.id}/items/${itemId}/create-ticket`)
      .set('Authorization', `Bearer ${token}`)
      .send({ categoryId, title: 'Issue without equipment' })
      .expect(201);

    const ticketId = created.body.ticket?.id;
    expect(ticketId).toBeTruthy();

    const ticket = await request(app.getHttpServer())
      .get(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(ticket.body.locationId).toBe(locationId);
    expect(ticket.body.equipmentId ?? null).toBeNull();
    expect(ticket.body.location?.id).toBe(locationId);
    expect(ticket.body.equipment ?? null).toBeNull();
  });
});

