import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

import { TimelineService } from './timeline.service';
import { TimelineController } from './timeline.controller';

@Module({
  controllers: [TimelineController],
  providers: [TimelineService, PrismaService],
})
export class TimelineModule {}
