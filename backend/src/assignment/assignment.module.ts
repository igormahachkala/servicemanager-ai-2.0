import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AssignmentService } from './assignment.service';

@Module({
  imports: [PrismaModule],
  providers: [AssignmentService],
  exports: [AssignmentService],
})
export class AssignmentModule {}
