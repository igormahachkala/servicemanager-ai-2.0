import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { LoginRateLimiterService } from './login-rate-limiter.service';
import { getJwtSecret } from '../config/required-env';
import { accessTokenSignOptions } from './auth-token-policy';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: accessTokenSignOptions(),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LoginRateLimiterService],
})
export class AuthModule {}
