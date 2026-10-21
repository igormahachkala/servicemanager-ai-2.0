import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = module.get<AppController>(AppController);
  });

  it('GET / returns 404', () => {
    expect(() => appController.root()).toThrow(NotFoundException);
  });
});
