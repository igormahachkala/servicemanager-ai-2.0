import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { CompanyType, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../prisma/prisma.service';

import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(_dto: RegisterDto) {
    throw new ForbiddenException('Public registration is disabled');
  }

  async login(dto: LoginDto) {
    await this.ensurePlatformAdmin();

    const email = dto.email.toLowerCase().trim();
    const password = dto.password.trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: true,
        companyId: true,
        isActive: true,
        company: {
          select: { name: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const ok = await bcrypt.compare(password, user.password);

    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueAuthPayload({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      companyId: user.companyId,
      isActive: user.isActive,
      companyName: user.company?.name ?? null,
    });
  }

  async me(userId: string, companyId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: true,
        companyId: true,
        isActive: true,
        company: {
          select: { name: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    return this.toPublicUser({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl ?? null,
      role: user.role,
      companyId: user.companyId,
      isActive: user.isActive,
      companyName: user.company?.name ?? null,
    });
  }

  private async ensurePlatformAdmin() {
    const email = (process.env.PLATFORM_ADMIN_EMAIL || '').trim().toLowerCase();
    const password = (process.env.PLATFORM_ADMIN_PASSWORD || '').trim();
    const firstName = (process.env.PLATFORM_ADMIN_FIRST_NAME || 'Platform').trim();
    const lastName = (process.env.PLATFORM_ADMIN_LAST_NAME || 'Admin').trim();
    const companyName = (process.env.PLATFORM_COMPANY_NAME || 'ServiceManager Platform').trim();
    const timezone = (process.env.PLATFORM_COMPANY_TIMEZONE || 'UTC').trim() || 'UTC';

    if (!email && !password) return;
    if (!email || !password) {
      throw new BadRequestException('PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD must be configured together');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) return;

    const passwordHash = await bcrypt.hash(password, 10);

    const company = await this.prisma.company.findFirst({
      where: { name: companyName },
      select: { id: true },
    });

    const companyId = company?.id ?? (
      await this.prisma.company.create({
        data: {
          name: companyName,
          type: CompanyType.PROVIDER,
          timezone,
        },
        select: { id: true },
      })
    ).id;

    await this.prisma.user.create({
      data: {
        companyId,
        email,
        password: passwordHash,
        firstName: firstName || 'Platform',
        lastName: lastName || 'Admin',
        avatarUrl: null,
        role: UserRole.PLATFORM_ADMIN,
        isActive: true,
      },
    });
  }

  private issueAuthPayload(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl?: string | null;
    role: UserRole;
    companyId: string;
    isActive: boolean;
    companyName: string | null;
  }) {
    const access_token = this.jwt.sign({
      sub: user.id,
      userId: user.id,
      email: user.email,
      companyId: user.companyId,
      role: user.role,
    });

    return {
      access_token,
      user: this.toPublicUser(user),
    };
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl?: string | null;
    role: UserRole;
    companyId: string;
    isActive: boolean;
    companyName: string | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl ?? null,
      role: user.role,
      companyId: user.companyId,
      companyName: user.companyName,
      isActive: user.isActive,
    };
  }
}