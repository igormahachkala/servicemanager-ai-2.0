import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import * as bcrypt from 'bcrypt'

import { PrismaService } from '../prisma/prisma.service'
import { UsersPolicy } from '../policy/users.policy'
import { resolveObserverScopeCompanyId } from '../policy/policy.utils'

import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actorCompanyId: string, actorRole: UserRole, requestedCompanyId?: string) {
    const companyId = await this.resolveReadableCompanyId(actorCompanyId, actorRole, requestedCompanyId)

    return this.prisma.user.findMany({
      where: UsersPolicy.listWhere(companyId),
      select: UsersPolicy.selectPublicUser(),
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
    })
  }

  async create(companyId: string, dto: CreateUserDto) {
    this.assertTenantManagedRole(dto.role)

    const email = (dto.email ?? '').trim().toLowerCase()
    const password = (dto.password ?? '').trim()
    const firstName = this.normalizeOptionalText(dto.firstName)
    const lastName = this.normalizeOptionalText(dto.lastName)
    const avatarUrl = this.normalizeOptionalText(dto.avatarUrl)

    if (!email) {
      throw new BadRequestException('Email is required')
    }

    if (!password) {
      throw new BadRequestException('Password is required')
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
    })

    if (existing) {
      throw new BadRequestException('Email already registered')
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const created = await this.prisma.user.create({
      data: UsersPolicy.createData(companyId, {
        email,
        password: passwordHash,
        role: dto.role,
        firstName,
        lastName,
        avatarUrl,
      }),
      select: { id: true },
    })

    return this.getPublicUserById(companyId, created.id)
  }

  async update(companyId: string, actorUserId: string, userId: string, dto: UpdateUserDto) {
    const existingUser = await this.findCompanyUser(companyId, userId)

    if (dto.role !== undefined) {
      this.assertTenantManagedRole(dto.role)
    }

    const nextEmail = dto.email !== undefined ? dto.email.trim().toLowerCase() : undefined
    const firstName = dto.firstName !== undefined ? this.normalizeOptionalText(dto.firstName) : undefined
    const lastName = dto.lastName !== undefined ? this.normalizeOptionalText(dto.lastName) : undefined
    const avatarUrl = dto.avatarUrl !== undefined ? this.normalizeOptionalText(dto.avatarUrl) : undefined

    if (dto.email !== undefined && !nextEmail) {
      throw new BadRequestException('Email is required')
    }

    if (nextEmail && nextEmail !== existingUser.email) {
      const emailOwner = await this.prisma.user.findUnique({
        where: { email: nextEmail },
      })

      if (emailOwner) {
        throw new BadRequestException('Email already registered')
      }
    }

    let passwordHash: string | undefined
    if (dto.password !== undefined) {
      const password = dto.password.trim()

      if (!password) {
        throw new BadRequestException('Password is required')
      }

      passwordHash = await bcrypt.hash(password, 10)
    }

    const nextRole = dto.role ?? existingUser.role
    const nextIsActive = dto.isActive ?? existingUser.isActive

    await this.assertSafeUserStateChange({
      companyId,
      actorUserId,
      existingUser,
      nextRole,
      nextIsActive,
    })

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existingUser.id },
        data: UsersPolicy.updateData({
          email: nextEmail,
          password: passwordHash,
          role: dto.role,
          isActive: dto.isActive,
          firstName,
          lastName,
          avatarUrl,
        }),
      })

      if (existingUser.role === UserRole.TECHNICIAN && nextRole !== UserRole.TECHNICIAN) {
        await tx.technicianSpecialization.deleteMany({
          where: { userId: existingUser.id },
        })
      }
    })

    return this.getPublicUserById(companyId, existingUser.id)
  }

  async deactivate(companyId: string, actorUserId: string, userId: string) {
    const existingUser = await this.findCompanyUser(companyId, userId)

    await this.assertSafeUserStateChange({
      companyId,
      actorUserId,
      existingUser,
      nextRole: existingUser.role,
      nextIsActive: false,
    })

    await this.prisma.user.update({
      where: { id: existingUser.id },
      data: { isActive: false },
    })

    return this.getPublicUserById(companyId, existingUser.id)
  }

  async activate(companyId: string, userId: string) {
    const existingUser = await this.findCompanyUser(companyId, userId)

    await this.prisma.user.update({
      where: { id: existingUser.id },
      data: { isActive: true },
    })

    return this.getPublicUserById(companyId, existingUser.id)
  }

  async updateSpecializations(companyId: string, userId: string, specializationIds: string[]) {
    const existingUser = await this.findCompanyUser(companyId, userId)

    if (existingUser.role !== UserRole.TECHNICIAN) {
      throw new BadRequestException('Specializations can be assigned only to technicians')
    }

    const normalizedIds = [
      ...new Set(
        (specializationIds ?? [])
          .map((id) => (id ?? '').trim())
          .filter((id) => id.length > 0),
      ),
    ]

    const specs = await this.prisma.specialization.findMany({
      where: {
        companyId,
        isActive: true,
        id: { in: normalizedIds },
      },
      select: { id: true },
    })

    if (specs.length !== normalizedIds.length) {
      throw new BadRequestException('Some specializationIds are invalid')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.technicianSpecialization.deleteMany({
        where: { userId: existingUser.id },
      })

      if (normalizedIds.length > 0) {
        await tx.technicianSpecialization.createMany({
          data: normalizedIds.map((specializationId) => ({
            userId: existingUser.id,
            specializationId,
          })),
        })
      }
    })

    return this.getPublicUserById(companyId, existingUser.id)
  }

  private async resolveReadableCompanyId(actorCompanyId: string, actorRole: UserRole, requestedCompanyId?: string) {
    const companyId = resolveObserverScopeCompanyId({
      actorCompanyId,
      actorRole,
      requestedCompanyId,
    })

    if (companyId !== actorCompanyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true },
      })

      if (!company) {
        throw new NotFoundException('Company not found')
      }
    }

    return companyId
  }

  private async getPublicUserById(companyId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: UsersPolicy.byIdWhere(companyId, userId),
      select: UsersPolicy.selectPublicUser(),
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return user
  }

  private async findCompanyUser(companyId: string, userId: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: UsersPolicy.byIdWhere(companyId, userId),
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: true,
        isActive: true,
      },
    })

    if (!existingUser) {
      throw new NotFoundException('User not found')
    }

    return existingUser
  }

  private async assertSafeUserStateChange(params: {
    companyId: string
    actorUserId: string
    existingUser: { id: string; role: UserRole; isActive: boolean }
    nextRole: UserRole
    nextIsActive: boolean
  }) {
    const { companyId, actorUserId, existingUser, nextRole, nextIsActive } = params

    if (existingUser.id === actorUserId && !nextIsActive) {
      throw new BadRequestException('You cannot deactivate your own account')
    }

    const removesAdminAccess =
      existingUser.role === UserRole.ADMIN &&
      existingUser.isActive &&
      (!nextIsActive || nextRole !== UserRole.ADMIN)

    if (!removesAdminAccess) return

    const otherActiveAdmins = await this.prisma.user.count({
      where: {
        companyId,
        role: UserRole.ADMIN,
        isActive: true,
        id: { not: existingUser.id },
      },
    })

    if (otherActiveAdmins === 0) {
      throw new BadRequestException('Cannot deactivate or demote the last active admin')
    }
  }

  private assertTenantManagedRole(role: UserRole) {
    if (role === UserRole.PLATFORM_ADMIN) {
      throw new BadRequestException('PLATFORM_ADMIN cannot be managed from tenant users flow')
    }
  }

  private normalizeOptionalText(value?: string | null) {
    if (value === undefined) return undefined
    const normalized = value?.trim() ?? ''
    return normalized.length > 0 ? normalized : null
  }
}