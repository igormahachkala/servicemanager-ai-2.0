import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SlaWorkerService } from './sla.worker.service';
import { TimelineModule } from '../timeline/timeline.module';

@Module({
  imports: [PrismaModule, TimelineModule],
  providers: [SlaWorkerService],
})
export class SlaModule {}
