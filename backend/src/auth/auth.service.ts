import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
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

  async register(dto: RegisterDto) {
    const companyName = dto.companyName.trim();
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const email = dto.email.toLowerCase().trim();
    const password = dto.password.trim();

    if (!companyName) {
      throw new BadRequestException('Company name is required');
    }

    if (!firstName) {
      throw new BadRequestException('First name is required');
    }

    if (!lastName) {
      throw new BadRequestException('Last name is required');
    }

    if (!password) {
      throw new BadRequestException('Password is required');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const company = await this.prisma.company.create({
      data: {
        name: companyName,
        users: {
          create: {
            email,
            password: passwordHash,
            firstName,
            lastName,
            profilePhotoUrl: null,
            role: UserRole.ADMIN,
            isActive: true,
          },
        },
      },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
            role: true,
            companyId: true,
            isActive: true,
          },
        },
      },
    });

    return this.issueAuthPayload({
      ...company.users[0],
      companyName: company.name,
    });
  }

  async login(dto: LoginDto) {
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
        profilePhotoUrl: true,
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
      profilePhotoUrl: user.profilePhotoUrl,
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
        profilePhotoUrl: true,
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
      profilePhotoUrl: user.profilePhotoUrl ?? null,
      role: user.role,
      companyId: user.companyId,
      isActive: user.isActive,
      companyName: user.company?.name ?? null,
    });
  }

  private issueAuthPayload(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    profilePhotoUrl?: string | null;
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
    profilePhotoUrl?: string | null;
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
      profilePhotoUrl: user.profilePhotoUrl ?? null,
      role: user.role,
      companyId: user.companyId,
      companyName: user.companyName,
      isActive: user.isActive,
    };
  }
}
