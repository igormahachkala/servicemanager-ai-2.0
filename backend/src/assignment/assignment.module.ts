import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AssignmentService } from './assignment.service';
import { AssignmentEngine } from './assignment.engine';

@Module({
  imports: [PrismaModule],
  providers: [AssignmentService, AssignmentEngine],
  exports: [AssignmentService, AssignmentEngine],
})
export class AssignmentModule {}
