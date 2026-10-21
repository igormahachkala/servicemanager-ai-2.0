import { Controller, Get, NotFoundException } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  root() {
    throw new NotFoundException();
  }
}
