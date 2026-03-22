import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CompanyType, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { UsersPolicy } from '../policy/users.policy';

import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateCompanyAdminDto } from './dto/create-company-admin.dto';

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  async get(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: this.companySelect(),
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  async update(companyId: string, dto: UpdateCompanyDto) {
    return this.prisma.company.update({
      where: { id: companyId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.autoAssignEnabled !== undefined ? { autoAssignEnabled: dto.autoAssignEnabled } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone.trim() } : {}),
        ...(dto.allowTechnicianClaim !== undefined ? { allowTechnicianClaim: dto.allowTechnicianClaim } : {}),
        ...(dto.slaStrictMode !== undefined ? { slaStrictMode: dto.slaStrictMode } : {}),
      },
      select: this.companySelect(),
    });
  }

  async setAutoAssign(companyId: string, enabled: boolean) {
    return this.prisma.company.update({
      where: { id: companyId },
      data: { autoAssignEnabled: enabled },
      select: this.companySelect(),
    });
  }

  async listAll() {
    const companies = await this.prisma.company.findMany({
      orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
      select: this.platformCompanySelect(),
    });

    return companies.map((company) => this.toPlatformCompany(company));
  }

  async createPlatformCompany(dto: CreateCompanyDto) {
    const name = dto.name.trim();
    const timezone = dto.timezone?.trim() || 'UTC';

    if (!name) {
      throw new BadRequestException('Company name is required');
    }

    const company = await this.prisma.company.create({
      data: {
        name,
        type: dto.type ?? CompanyType.CLIENT,
        timezone,
      },
      select: this.platformCompanySelect(),
    });

    return this.toPlatformCompany(company);
  }

  async createFirstAdmin(companyId: string, dto: CreateCompanyAdminDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const existingAdmins = await this.prisma.user.count({
      where: {
        companyId,
        role: UserRole.ADMIN,
      },
    });

    if (existingAdmins > 0) {
      throw new BadRequestException('Company already has an admin');
    }

    const email = dto.email.trim().toLowerCase();
    const password = dto.password.trim();
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();

    if (!email) throw new BadRequestException('Email is required');
    if (!password) throw new BadRequestException('Password is required');
    if (!firstName) throw new BadRequestException('First name is required');
    if (!lastName) throw new BadRequestException('Last name is required');

    const emailOwner = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (emailOwner) {
      throw new BadRequestException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const created = await this.prisma.user.create({
      data: UsersPolicy.createData(companyId, {
        email,
        password: passwordHash,
        role: UserRole.ADMIN,
        firstName,
        lastName,
        avatarUrl: null,
      }),
      select: UsersPolicy.selectPublicUser(),
    });

    return {
      ...created,
      companyName: company.name,
    };
  }

  private companySelect() {
    return {
      id: true,
      name: true,
      type: true,
      autoAssignEnabled: true,
      timezone: true,
      allowTechnicianClaim: true,
      slaStrictMode: true,
      createdAt: true,
      updatedAt: true,
    };
  }

  private platformCompanySelect() {
    return {
      ...this.companySelect(),
      users: {
        where: { role: UserRole.ADMIN },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      },
    };
  }

  private toPlatformCompany(company: any) {
    return {
      id: company.id,
      name: company.name,
      type: company.type,
      autoAssignEnabled: company.autoAssignEnabled,
      timezone: company.timezone,
      allowTechnicianClaim: company.allowTechnicianClaim,
      slaStrictMode: company.slaStrictMode,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      admins: company.users ?? [],
    };
  }
}