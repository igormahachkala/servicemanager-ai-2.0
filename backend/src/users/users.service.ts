import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { UsersPolicy } from '../policy/users.policy';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string) {
    return this.prisma.user.findMany({
      where: UsersPolicy.listWhere(companyId),
      select: UsersPolicy.selectPublicUser(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(companyId: string, dto: CreateUserDto) {
    const email = (dto.email ?? '').trim().toLowerCase();
    const password = (dto.password ?? '').trim();

    if (!email) {
      throw new BadRequestException('Email is required');
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

    return this.prisma.user.create({
      data: UsersPolicy.createData(companyId, {
        email,
        password: passwordHash,
        role: dto.role,
      }),
      select: UsersPolicy.selectPublicUser(),
    });
  }

  async update(companyId: string, userId: string, dto: UpdateUserDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: UsersPolicy.byIdWhere(companyId, userId),
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const nextEmail =
      dto.email !== undefined ? dto.email.trim().toLowerCase() : undefined;

    if (dto.email !== undefined && !nextEmail) {
      throw new BadRequestException('Email is required');
    }

    if (nextEmail && nextEmail !== existingUser.email) {
      const emailOwner = await this.prisma.user.findUnique({
        where: { email: nextEmail },
      });

      if (emailOwner) {
        throw new BadRequestException('Email already registered');
      }
    }

    let passwordHash: string | undefined = undefined;

    if (dto.password !== undefined) {
      const password = dto.password.trim();

      if (!password) {
        throw new BadRequestException('Password is required');
      }

      passwordHash = await bcrypt.hash(password, 10);
    }

    return this.prisma.user.update({
      where: { id: existingUser.id },
      data: UsersPolicy.updateData({
        email: nextEmail,
        password: passwordHash,
        role: dto.role,
        isActive: dto.isActive,
      }),
      select: UsersPolicy.selectPublicUser(),
    });
  }
}
