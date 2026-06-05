import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'

import { PrismaModule } from '../prisma/prisma.module'
import { UploadsController } from './uploads.controller'
import { getJwtSecret } from '../config/required-env'

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: getJwtSecret(),
    }),
  ],
  controllers: [UploadsController],
})
export class UploadsModule {}
