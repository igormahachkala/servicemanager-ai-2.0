import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SlaWorkerService } from './sla.worker.service';
import { TimelineModule } from '../timeline/timeline.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, TimelineModule, NotificationsModule],
  providers: [SlaWorkerService],
})
export class SlaModule {}
