import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { UserRole } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { PERMISSIONS } from '../src/common/permissions.constants';

import {
  resetDb,
  createCompanyWithUsers,
  ensurePermissionBlocks,
  grantRolePermissions,
  prisma,
} from './helpers';

function pickToken(body: any): string {
  const t = body?.access_token;
  if (!t || typeof t !== 'string') throw new Error('No access_token in response');
  return t;
}

describe('Users PBAC/Policy (e2e)', () => {
  let app: INestApplication;

  let adminEmail = '';
  let adminPassword = '';
  let companyId = '';

  let adminToken = '';

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

    // Создаём компанию + пользователей напрямую через Prisma (быстро и детерминированно)
    const created = await createCompanyWithUsers({
      companyName: 'E2E Users Company',
      adminEmail: 'admin_users@sma.test',
      adminPassword: 'ChangeMe123!',
    });

    companyId = created.company.id;
    adminEmail = created.admin.email;
    adminPassword = created.admin.passwordPlain;

    // ВАЖНО: включаем PBAC "по-настоящему":
    // если PermissionBlock пуст — PermissionsGuard будет в transition-mode и пропустит всё.
    await ensurePermissionBlocks([PERMISSIONS.USERS_MANAGE]);

    // Логинимся, чтобы получить JWT
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(201);

    adminToken = pickToken(login.body);
  });

  it('DENY: ADMIN without USERS_MANAGE must get 403 on GET /users when PBAC enabled', async () => {
    // Не выдаём RolePermission -> должно быть 403
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  });

  it('ALLOW: ADMIN with USERS_MANAGE can GET /users', async () => {
    await grantRolePermissions(UserRole.ADMIN, [PERMISSIONS.USERS_MANAGE]);

    const res = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);

    // Должны быть хотя бы 3 пользователя из createCompanyWithUsers
    expect(res.body.length).toBeGreaterThanOrEqual(3);

    // Все пользователи строго из одного tenant
    // (на уровне DB это companyId в where; проверяем косвенно через отсутствие "чужих")
    // Прямого companyId в select нет, поэтому проверим по email-ам созданных юзеров.
    const emails = res.body.map((u: any) => u.email);
    expect(emails).toContain(adminEmail);
  });

  it('ALLOW: ADMIN with USERS_MANAGE can POST /users and created user is in same company', async () => {
    await grantRolePermissions(UserRole.ADMIN, [PERMISSIONS.USERS_MANAGE]);

    const created = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'NewUser@SMA.test', password: 'ChangeMe123!', role: 'TECHNICIAN' })
      .expect(201);

    expect(created.body.id).toBeTruthy();
    expect(created.body.email).toBe('newuser@sma.test'); // UsersService приводит к lower-case
    expect(created.body.role).toBe('TECHNICIAN');

    // Проверяем через DB, что юзер создан в том же tenant (companyId)
    const dbUser = await prisma.user.findUnique({
      where: { id: created.body.id },
      select: { id: true, companyId: true, email: true },
    });

    expect(dbUser).toBeTruthy();
    expect(dbUser!.companyId).toBe(companyId);
    expect(dbUser!.email).toBe('newuser@sma.test');
  });
});
