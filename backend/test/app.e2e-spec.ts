import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ServiceContractRole, ServiceContractStatus } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDbFull, seedPermissionMatrix } from './helpers';

function pickToken(body: any): string {
  const t = body?.access_token;
  if (!t || typeof t !== 'string') throw new Error('No access_token in response');
  return t;
}

describe('SMA SaaS MVP (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Values created during tests
  let adminTokenA = '';
  let clientTokenA = '';
  let adminTokenB = '';
  let companyIdA = '';
  let clientCompanyIdA = '';
  let companyIdB = '';

  let specIT_A = '';
  let clientSpecIT_A = '';
  let catIT_A = '';
  let techIdA = '';
  let locationIdA = '';

  beforeAll(async () => {
    // IMPORTANT: tests use .env.test (set by test script)
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);

    // Clean DB (test db only!). PBAC fail-closed: без каталога любой защищённый эндпоинт отвечает 403.
    await resetDbFull();
    await seedPermissionMatrix();
  });

  afterAll(async () => {
    await app.close();
  });

  it('A) register admin + login + me', async () => {
    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ companyName: 'Company A', email: 'ownerA@sma.test', password: 'ChangeMe123!' })
      .expect(201);

    adminTokenA = pickToken(reg.body);

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .expect(200);

    // AuthService приводит email к lower-case
    expect(me.body.email).toBe('ownera@sma.test');
    expect(me.body.companyId).toBeTruthy();
    companyIdA = me.body.companyId;

    // Executor operations require PROVIDER company type; register creates CLIENT by default.
    await prisma.company.update({ where: { id: companyIdA }, data: { type: 'PROVIDER' } });
  });

  it('A2) client of tenant A registers and is served by provider A under a PRIMARY contract', async () => {
    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ companyName: 'Client of A', email: 'clientA@sma.test', password: 'ChangeMe123!' })
      .expect(201);

    clientTokenA = pickToken(reg.body);

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${clientTokenA}`)
      .expect(200);

    clientCompanyIdA = me.body.companyId;
    expect(clientCompanyIdA).toBeTruthy();
    expect(clientCompanyIdA).not.toBe(companyIdA);

    // Договор заводит PLATFORM_ADMIN, в e2e он создаётся напрямую.
    await prisma.serviceContract.create({
      data: {
        clientCompanyId: clientCompanyIdA,
        providerCompanyId: companyIdA,
        role: ServiceContractRole.PRIMARY,
        status: ServiceContractStatus.ACTIVE,
      },
    });
  });

  it('B) register second tenant admin', async () => {
    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ companyName: 'Company B', email: 'ownerB@sma.test', password: 'ChangeMe123!' })
      .expect(201);

    adminTokenB = pickToken(reg.body);

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${adminTokenB}`)
      .expect(200);

    companyIdB = me.body.companyId;

    expect(me.body.email).toBe('ownerb@sma.test');
    expect(companyIdB).toBeTruthy();
    expect(companyIdB).not.toBe(companyIdA);
    expect(companyIdB).not.toBe(clientCompanyIdA);
  });

  it('C) tenant A creates specialization + problem category + links them', async () => {
    // Специализация провайдера для техника. Совпадение с категорией клиента идёт по имени.
    const spec = await request(app.getHttpServer())
      .post('/specializations')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ name: 'IT мастер' })
      .expect(201);

    specIT_A = spec.body.id;
    expect(specIT_A).toBeTruthy();

    // Категории принадлежат клиенту, владельцу заявок.
    const clientSpec = await request(app.getHttpServer())
      .post('/specializations')
      .set('Authorization', `Bearer ${clientTokenA}`)
      .send({ name: 'IT мастер' })
      .expect(201);

    clientSpecIT_A = clientSpec.body.id;
    expect(clientSpecIT_A).toBeTruthy();

    const cat = await request(app.getHttpServer())
      .post('/problem-categories')
      .set('Authorization', `Bearer ${clientTokenA}`)
      .send({ name: 'IT / сеть / связь', instructions: 'Перезапусти роутер и проверь питание.' })
      .expect(201);

    catIT_A = cat.body.id;
    expect(catIT_A).toBeTruthy();

    await request(app.getHttpServer())
      .put(`/problem-categories/${catIT_A}/specializations`)
      .set('Authorization', `Bearer ${clientTokenA}`)
      .send({ specializationIds: [clientSpecIT_A] })
      .expect(200);

    // Договор без специализаций не даёт провайдеру ни одной заявки клиента.
    const contract = await prisma.serviceContract.findFirstOrThrow({
      where: { clientCompanyId: clientCompanyIdA, providerCompanyId: companyIdA },
    });
    await prisma.serviceContractSpecialization.create({
      data: { serviceContractId: contract.id, specializationId: clientSpecIT_A },
    });
  });

  it('D) tenant A creates technician user + assigns specialization', async () => {
    const u = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ email: 'ittechA@sma.test', password: 'ChangeMe123!', role: 'TECHNICIAN' })
      .expect(201);

    techIdA = u.body.id;
    expect(techIdA).toBeTruthy();

    // New users are created with isExecutor: false by default.
    // Set it to true so ensureTechnician passes and the tech appears in assignment candidates.
    await request(app.getHttpServer())
      .patch(`/users/${techIdA}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ isExecutor: true })
      .expect(200);

    await request(app.getHttpServer())
      .put(`/technicians/${techIdA}/specializations`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ specializationIds: [specIT_A] })
      .expect(200);

    const techs = await request(app.getHttpServer())
      .get('/technicians')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .expect(200);

    expect(Array.isArray(techs.body)).toBe(true);
    expect(techs.body.length).toBe(1);
    expect(techs.body[0].id).toBe(techIdA);

    // Точка принадлежит компании-клиенту (locationId is required in CreateTicketDto)
    const loc = await request(app.getHttpServer())
      .post('/locations')
      .set('Authorization', `Bearer ${clientTokenA}`)
      .send({ name: 'Точка 1', platformCode: 'E2E-LOC-A', city: 'Уфа', address: 'Уфа, ул. Тест, 1' })
      .expect(201);
    locationIdA = loc.body.id;
    expect(locationIdA).toBeTruthy();
    expect(loc.body.clientCompanyId).toBe(clientCompanyIdA);
  });

  it('E) autoAssign ON → ticket becomes ASSIGNED', async () => {
    // Автоназначение берётся из компании-владельца заявки, то есть клиента.
    await request(app.getHttpServer())
      .patch('/company/auto-assign')
      .set('Authorization', `Bearer ${clientTokenA}`)
      .send({ enabled: true })
      .expect(200);

    const t = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({
        locationId: locationIdA,
        problemCategoryId: catIT_A,
        problemText: 'Не работает интернет, красный индикатор',
        urgency: 'URGENT',
        requesterName: 'Админ точки',
        requesterPhone: '+7 999 000-00-00',
      })
      .expect(201);

    expect(t.body.ticket.companyId).toBe(clientCompanyIdA);
    expect(t.body.ticket.status).toBe('ASSIGNED');
    expect(t.body.ticket.assignedTechnicianId).toBe(techIdA);
    expect(t.body.autoAssigned).toBe(true);
    expect(t.body.candidates?.length).toBeGreaterThan(0);
  });

  it('F) autoAssign OFF → ticket NEW + candidates returned', async () => {
    await request(app.getHttpServer())
      .patch('/company/auto-assign')
      .set('Authorization', `Bearer ${clientTokenA}`)
      .send({ enabled: false })
      .expect(200);

    const t = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({
        locationId: locationIdA,
        problemCategoryId: catIT_A,
        problemText: 'ТЕСТ: автоназначение выключено',
        urgency: 'NOT_URGENT',
        requesterName: 'Админ точки',
        requesterPhone: '+7 999 000-00-00',
      })
      .expect(201);

    expect(t.body.ticket.companyId).toBe(clientCompanyIdA);
    expect(t.body.ticket.status).toBe('NEW');
    expect(t.body.ticket.assignedTechnicianId).toBeNull();
    expect(t.body.autoAssigned).toBe(false);
    expect(t.body.candidates?.[0]?.id).toBe(techIdA);
  });

  it('G) manual assign works', async () => {
    const list = await request(app.getHttpServer())
      .get(`/tickets?linkedClientCompanyId=${clientCompanyIdA}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .expect(200);

    const unassigned = list.body.find((x: any) => x.status === 'NEW');
    expect(unassigned).toBeTruthy();

    const assigned = await request(app.getHttpServer())
      .put(`/tickets/${unassigned.id}/assign/${techIdA}?linkedClientCompanyId=${clientCompanyIdA}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .expect(200);

    expect(assigned.body.status).toBe('ASSIGNED');
    expect(assigned.body.assignedTechnicianId).toBe(techIdA);
  });

  it('H) create child ticket (independent) preserves requester/address and sets parentId', async () => {
    const list = await request(app.getHttpServer())
      .get(`/tickets?linkedClientCompanyId=${clientCompanyIdA}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .expect(200);

    const parent = list.body.find((x: any) => x.problemText?.includes('Не работает интернет'));
    expect(parent).toBeTruthy();

    const child = await request(app.getHttpServer())
      .post(`/tickets/${parent.id}/child`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({
        problemCategoryId: catIT_A,
        problemText: 'ДОЧЕРНЯЯ: проверить порт на свитче',
        urgency: 'NOT_URGENT',
      })
      .expect(201);

    expect(child.body.ticket.parentId).toBe(parent.id);
    expect(child.body.ticket.status).toBe('NEW'); // because autoAssign currently OFF
    expect(child.body.ticket.requesterName).toBe(parent.requesterName);
    expect(child.body.ticket.address).toBe(parent.address);
  });

  it('I) multi-tenant isolation: tenant B must not see tenant A tickets', async () => {
    const listB = await request(app.getHttpServer())
      .get('/tickets')
      .set('Authorization', `Bearer ${adminTokenB}`)
      .expect(200);

    expect(Array.isArray(listB.body)).toBe(true);
    expect(listB.body.length).toBe(0);
  });
});
