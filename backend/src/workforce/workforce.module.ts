import { Module } from '@nestjs/common'

import { PrismaModule } from '../prisma/prisma.module'
import { ServiceContractsModule } from '../service-contracts/service-contracts.module'
import { ShiftPolicyService } from './shift-policy.service'
import { WorkforceAutoCloseService } from './workforce-auto-close.service'
import { WorkforceController } from './workforce.controller'
import { GeoAccuracyController } from './geo-accuracy.controller'
import { GeoAccuracyService } from './geo-accuracy.service'
import { WorkforceGeoService } from './workforce-geo.service'
import { WorkforceOnSiteCorrectionService } from './workforce-on-site-correction.service'
import { WorkforceOnSiteReadService } from './workforce-on-site-read.service'
import { WorkforceOnSiteService } from './workforce-on-site.service'
import { WorkforceTechnicianMapService } from './workforce-technician-map.service'
import { WorkforceService } from './workforce.service'

@Module({
  imports: [PrismaModule, ServiceContractsModule],
  controllers: [WorkforceController, GeoAccuracyController],
  providers: [
    WorkforceService,
    WorkforceAutoCloseService,
    ShiftPolicyService,
    WorkforceOnSiteService,
    WorkforceOnSiteReadService,
    WorkforceOnSiteCorrectionService,
    WorkforceTechnicianMapService,
    WorkforceGeoService,
    GeoAccuracyService,
  ],
  // ShiftPolicyService is exported so 079 can enforce the policy from the tickets
  // module without re-implementing it. It is the only shift-policy authority.
  exports: [WorkforceService, ShiftPolicyService, WorkforceGeoService],
})
export class WorkforceModule {}
