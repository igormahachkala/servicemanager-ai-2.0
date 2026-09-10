import { Global, Module } from '@nestjs/common'

import { PrismaModule } from '../../prisma/prisma.module'
import { IdempotencyService } from './idempotency.service'

/**
 * SMA-OFFLINE-IDEMPOTENCY-113B. Global so any module gaining a retry-safe endpoint can inject
 * the service without another import edit — the mechanism is meant to be reused, not re-created.
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
