import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

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
  let adminTokenB = '';
  let companyIdA = '';
  let companyIdB = '';

  let specIT_A = '';
  let catIT_A = '';
  let techIdA = '';

  beforeAll(async () => {
    // IMPORTANT: tests use .env.test (set by test script)
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);

    // Clean DB (test db only!)
    await prisma.technicianSpecialization.deleteMany();
    await prisma.problemCategorySpecialization.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.specialization.deleteMany();
    await prisma.problemCategory.deleteMany();
    await prisma.user.deleteMany();
    await prisma.company.deleteMany();
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

    expect(me.body.email).toBe('ownerA@sma.test');
    expect(me.body.companyId).toBeTruthy();
    companyIdA = me.body.companyId;
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

    expect(companyIdB).toBeTruthy();
    expect(companyIdB).not.toBe(companyIdA);
  });

  it('C) tenant A creates specialization + problem category + links them', async () => {
    const spec = await request(app.getHttpServer())
      .post('/specializations')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ name: 'IT мастер' })
      .expect(201);

    specIT_A = spec.body.id;
    expect(specIT_A).toBeTruthy();

    const cat = await request(app.getHttpServer())
      .post('/problem-categories')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ name: 'IT / сеть / связь', instructions: 'Перезапусти роутер и проверь питание.' })
      .expect(201);

    catIT_A = cat.body.id;
    expect(catIT_A).toBeTruthy();

    await request(app.getHttpServer())
      .put(`/problem-categories/${catIT_A}/specializations`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ specializationIds: [specIT_A] })
      .expect(200);
  });

  it('D) tenant A creates technician user + assigns specialization', async () => {
    const u = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ email: 'ittechA@sma.test', password: 'ChangeMe123!', role: 'TECHNICIAN' })
      .expect(201);

    techIdA = u.body.id;
    expect(techIdA).toBeTruthy();

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
  });

  it('E) autoAssign ON → ticket becomes ASSIGNED', async () => {
    await request(app.getHttpServer())
      .patch('/company/auto-assign')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ enabled: true })
      .expect(200);

    const t = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({
        problemCategoryId: catIT_A,
        problemText: 'Не работает интернет, красный индикатор',
        urgency: 'URGENT',
        requesterName: 'Админ точки',
        requesterPhone: '+7 999 000-00-00',
        address: 'Уфа, ул. Тест, 1',
        pointName: 'Точка 1',
      })
      .expect(201);

    expect(t.body.ticket.status).toBe('ASSIGNED');
    expect(t.body.ticket.assignedTechnicianId).toBe(techIdA);
    expect(t.body.autoAssigned).toBe(true);
    expect(t.body.candidates?.length).toBeGreaterThan(0);
  });

  it('F) autoAssign OFF → ticket NEW + candidates returned', async () => {
    await request(app.getHttpServer())
      .patch('/company/auto-assign')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ enabled: false })
      .expect(200);

    const t = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({
        problemCategoryId: catIT_A,
        problemText: 'ТЕСТ: автоназначение выключено',
        urgency: 'NOT_URGENT',
        requesterName: 'Админ точки',
        requesterPhone: '+7 999 000-00-00',
        address: 'Уфа, ул. Тест, 1',
        pointName: 'Точка 1',
      })
      .expect(201);

    expect(t.body.ticket.status).toBe('NEW');
    expect(t.body.ticket.assignedTechnicianId).toBeNull();
    expect(t.body.autoAssigned).toBe(false);
    expect(t.body.candidates?.[0]?.id).toBe(techIdA);
  });

  it('G) manual assign works', async () => {
    const list = await request(app.getHttpServer())
      .get('/tickets')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .expect(200);

    const unassigned = list.body.find((x: any) => x.status === 'NEW');
    expect(unassigned).toBeTruthy();

    const assigned = await request(app.getHttpServer())
      .put(`/tickets/${unassigned.id}/assign/${techIdA}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .expect(200);

    expect(assigned.body.status).toBe('ASSIGNED');
    expect(assigned.body.assignedTechnicianId).toBe(techIdA);
  });

  it('H) create child ticket (independent) preserves requester/address and sets parentId', async () => {
    const list = await request(app.getHttpServer())
      .get('/tickets')
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
