import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'

import { PrismaModule } from '../prisma/prisma.module'
import { UploadsController } from './uploads.controller'

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev_secret',
    }),
  ],
  controllers: [UploadsController],
})
export class UploadsModule {}
