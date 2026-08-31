import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { VersionController } from './version.controller';

describe('VersionController', () => {
  const originalEnv = process.env;
  let app: INestApplication | undefined;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('returns the deployment identity response shape', () => {
    process.env.SMA_RELEASE_COMMIT_SHA = 'fa1fbd278313c5502484749c11be2b88c94a1251';
    process.env.SMA_RELEASE_ENVIRONMENT = 'beta';

    expect(new VersionController().getVersion()).toEqual({
      service: 'ServiceManager.AI',
      commitSha: 'fa1fbd278313c5502484749c11be2b88c94a1251',
      environment: 'beta',
    });
  });

  it('returns a present commitSha and environment without requiring database access', () => {
    process.env.SMA_RELEASE_COMMIT_SHA = 'e1dfbbd';
    process.env.SMA_RELEASE_ENVIRONMENT = 'prod';

    const response = new VersionController().getVersion();

    expect(response.commitSha).toBe('e1dfbbd');
    expect(response.environment).toBe('prod');
  });

  it('serves GET /version without auth or database providers', async () => {
    process.env.SMA_RELEASE_COMMIT_SHA = 'fa1fbd278313c5502484749c11be2b88c94a1251';
    process.env.SMA_RELEASE_ENVIRONMENT = 'beta';

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VersionController],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    await request(app.getHttpServer()).get('/version').expect(200).expect({
      service: 'ServiceManager.AI',
      commitSha: 'fa1fbd278313c5502484749c11be2b88c94a1251',
      environment: 'beta',
    });
  });

  it('does not expose arbitrary environment values', () => {
    process.env.SMA_RELEASE_COMMIT_SHA = 'fa1fbd278313c5502484749c11be2b88c94a1251';
    process.env.SMA_RELEASE_ENVIRONMENT = 'prod';
    process.env.DATABASE_URL = 'postgresql://secret-user:secret-pass@example/db';
    process.env.JWT_SECRET = 'secret-jwt-value';
    process.env.MAX_BOT_API_TOKEN = 'secret-max-token';

    const response = new VersionController().getVersion();

    expect(Object.keys(response).sort()).toEqual(['commitSha', 'environment', 'service']);
    expect(JSON.stringify(response)).not.toContain('DATABASE_URL');
    expect(JSON.stringify(response)).not.toContain('secret');
    expect(JSON.stringify(response)).not.toContain('token');
  });

  it('fails closed to unknown for missing or malformed deployment metadata', () => {
    delete process.env.SMA_RELEASE_COMMIT_SHA;
    process.env.SMA_RELEASE_ENVIRONMENT = 'staging';

    expect(new VersionController().getVersion()).toEqual({
      service: 'ServiceManager.AI',
      commitSha: 'unknown',
      environment: 'unknown',
    });
  });
});
