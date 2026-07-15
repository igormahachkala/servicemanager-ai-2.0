// backend/src/app.controller.spec.ts

import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const prismaMock = {
      user: {
        count: jest.fn().mockResolvedValue(42),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: PrismaService, useValue: prismaMock }],
    }).compile();

    appController = module.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return users count', async () => {
      await expect(appController.getUsersCount()).resolves.toEqual({ usersCount: 42 });
    });
  });
});
