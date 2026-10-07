import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ServiceContractsModule } from '../service-contracts/service-contracts.module';
import { AssignmentService } from './assignment.service';
import { AssignmentEngine } from './assignment.engine';
import { AssignmentEligibilityResolver } from './assignment-eligibility.resolver';

@Module({
  imports: [PrismaModule, ServiceContractsModule],
  providers: [AssignmentService, AssignmentEngine, AssignmentEligibilityResolver],
  exports: [AssignmentService, AssignmentEngine, AssignmentEligibilityResolver],
})
export class AssignmentModule {}
