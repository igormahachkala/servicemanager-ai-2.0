import { Module } from '@nestjs/common'

import { PrismaModule } from '../prisma/prisma.module'
import { TicketsModule } from '../tickets/tickets.module'

import { PublicRequestController } from './public-request.controller'
import { PublicRequestService } from './public-request.service'
import { PublicRequestIpThrottleGuard } from './public-request-ip-throttle'
import { PublicRequestSecurityService } from './public-request-security.service'

@Module({
  imports: [PrismaModule, TicketsModule],
  controllers: [PublicRequestController],
  providers: [PublicRequestService, PublicRequestSecurityService, PublicRequestIpThrottleGuard],
})
export class PublicRequestModule {}
