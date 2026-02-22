import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const company = await this.prisma.company.create({
      data: {
        name: dto.companyName,
        users: {
          create: {
            email: dto.email,
            password: passwordHash,
            role: UserRole.ADMIN,
          },
        },
      },
      include: { users: true },
    });

    const user = company.users[0];
    return this.issueToken(user.id, user.email, user.companyId, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return this.issueToken(user.id, user.email, user.companyId, user.role);
  }

  issueToken(userId: string, email: string, companyId: string, role: string) {
    const payload = { sub: userId, email, companyId, role };
    const access_token = this.jwt.sign(payload);
    return { access_token };
  }
}
