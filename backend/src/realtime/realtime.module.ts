import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from '../prisma/prisma.module';

import { RealtimeService } from './realtime.service';
import { getJwtSecret } from '../config/required-env';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: getJwtSecret(),
    }),
  ],
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
