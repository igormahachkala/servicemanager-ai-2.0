import { Module } from '@nestjs/common'

import { PrismaModule } from '../prisma/prisma.module'
import { ServiceContractsModule } from '../service-contracts/service-contracts.module'
import { ShiftPolicyService } from './shift-policy.service'
import { WorkforceAutoCloseService } from './workforce-auto-close.service'
import { WorkforceController } from './workforce.controller'
import { WorkforceService } from './workforce.service'

@Module({
  imports: [PrismaModule, ServiceContractsModule],
  controllers: [WorkforceController],
  providers: [WorkforceService, WorkforceAutoCloseService, ShiftPolicyService],
  // ShiftPolicyService is exported so 079 can enforce the policy from the tickets
  // module without re-implementing it. It is the only shift-policy authority.
  exports: [WorkforceService, ShiftPolicyService],
})
export class WorkforceModule {}
