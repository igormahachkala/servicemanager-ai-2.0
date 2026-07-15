import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PERMISSIONS } from '../src/common/permissions.constants';
import { prisma, ensurePermissionBlocks, grantRolePermissions } from './helpers';

function pickToken(body: any): string {
  const t = body?.access_token;
  if (!t || typeof t !== 'string') throw new Error('No access_token in response');
  return t;
}

describe('Ticket update equipment context consistency (e2e)', () => {
  let app: INestApplication;
  let token = '';
  let companyId = '';

  let locationAId = '';
  let locationBId = '';
  let equipmentAId = '';
  let equipmentBId = '';
  let categoryId = '';
  let ticketId = '';

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
      PERMISSIONS.TICKETS_EDIT,
      PERMISSIONS.TICKETS_VIEW,
    ] as const;
    await ensurePermissionBlocks([...ADMIN_PERMS]);
    await grantRolePermissions('ADMIN' as any, [...ADMIN_PERMS]);

    const suffix = Date.now();

    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        companyName: `Ticket Update Equipment ${suffix}`,
        email: `ticket_update_eq_${suffix}@sma.test`,
        password: 'ChangeMe123!',
      })
      .expect(201);
    token = pickToken(reg.body);

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    companyId = me.body.companyId;
    expect(companyId).toBeTruthy();

    const locationA = await request(app.getHttpServer())
      .post('/locations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Update Location A',
        platformCode: `ULOC-A-${suffix}`,
        city: 'Ufa',
        address: 'Update A',
      })
      .expect(201);
    locationAId = locationA.body.id;

    const locationB = await request(app.getHttpServer())
      .post('/locations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Update Location B',
        platformCode: `ULOC-B-${suffix}`,
        city: 'Ufa',
        address: 'Update B',
      })
      .expect(201);
    locationBId = locationB.body.id;

    const equipmentA = await request(app.getHttpServer())
      .post('/equipment')
      .set('Authorization', `Bearer ${token}`)
      .send({
        locationId: locationAId,
        name: 'Update Equipment A',
        type: 'HVAC',
      })
      .expect(201);
    equipmentAId = equipmentA.body.id;

    const equipmentB = await request(app.getHttpServer())
      .post('/equipment')
      .set('Authorization', `Bearer ${token}`)
      .send({
        locationId: locationBId,
        name: 'Update Equipment B',
        type: 'POS',
      })
      .expect(201);
    equipmentBId = equipmentB.body.id;

    const category = await request(app.getHttpServer())
      .post('/problem-categories')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Update equipment category ${suffix}`,
        instructions: 'Update equipment context',
      })
      .expect(201);
    categoryId = category.body.id;

    const created = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        locationId: locationAId,
        problemCategoryId: categoryId,
        problemText: 'Ticket for equipment update checks',
        urgency: 'NOT_URGENT',
      })
      .expect(201);
    ticketId = created.body?.ticket?.id;
    expect(ticketId).toBeTruthy();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('sets equipment in same location and keeps location unchanged', async () => {
    await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        equipmentId: equipmentAId,
      })
      .expect(200);

    const ticket = await request(app.getHttpServer())
      .get(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(ticket.body.companyId).toBe(companyId);
    expect(ticket.body.locationId).toBe(locationAId);
    expect(ticket.body.equipmentId).toBe(equipmentAId);
    expect(ticket.body.location?.id).toBe(locationAId);
    expect(ticket.body.equipment?.id).toBe(equipmentAId);
  });

  it('clears equipment with equipmentId=null', async () => {
    await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        equipmentId: null,
      })
      .expect(200);

    const ticket = await request(app.getHttpServer())
      .get(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(ticket.body.locationId).toBe(locationAId);
    expect(ticket.body.equipmentId ?? null).toBeNull();
    expect(ticket.body.equipment ?? null).toBeNull();
  });

  it('rejects equipment from another location', async () => {
    const bad = await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        equipmentId: equipmentBId,
      })
      .expect(404);

    const message = Array.isArray(bad.body?.message) ? bad.body.message.join(',') : String(bad.body?.message || '');
    expect(message.toLowerCase()).toContain('equipment');
  });
});

