import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'

import { getJwtSecret } from '../config/required-env'
import { PrismaModule } from '../prisma/prisma.module'
import { ServiceContractsModule } from '../service-contracts/service-contracts.module'
import { UploadsController } from './uploads.controller'

@Module({
  imports: [
    PrismaModule,
    ServiceContractsModule,
    JwtModule.register({
      secret: getJwtSecret(),
    }),
  ],
  controllers: [UploadsController],
})
export class UploadsModule {}
