import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, UserRole } from '@prisma/client'
import * as bcrypt from 'bcrypt'

import { PrismaService } from '../prisma/prisma.service'
import { UsersPolicy } from '../policy/users.policy'
import { resolveObserverScopeCompanyId } from '../policy/policy.utils'
import { resolveUserLocationScope } from '../policy/location-scope.utils'

import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actorCompanyId: string, actorRole: UserRole, requestedCompanyId?: string) {
    const companyId = await this.resolveReadableCompanyId(actorCompanyId, actorRole, requestedCompanyId)

    const rows = await this.prisma.user.findMany({
      where: UsersPolicy.listWhere(companyId),
      select: UsersPolicy.selectPublicUser(companyId),
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
    })
    return rows.map((row) => this.mapUserOutput(row))
  }

  async create(companyId: string, actorUserId: string, actorRole: UserRole, dto: CreateUserDto) {
    this.assertTenantManagedRole(dto.role)
    this.assertUserManagementAllowed(actorRole, dto.role)

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
    const actorLocationScope = await resolveUserLocationScope({
      prisma: this.prisma,
      actorCompanyId: companyId,
      userId: actorUserId,
      role: actorRole,
      scopeCompanyId: companyId,
    })
    const locationIds = await this.normalizeScopedRoleLocationIds({
      companyId,
      targetRole: dto.role,
      actorRole,
      actorLocationScope,
      requestedLocationIds: dto.locationIds,
    })

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
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

      await this.replaceSelfScopeBindingsTx(tx, companyId, user.id, locationIds)
      return user
    })

    return this.getPublicUserById(companyId, created.id)
  }

  async update(companyId: string, actorUserId: string, actorRole: UserRole, userId: string, dto: UpdateUserDto) {
    const existingUser = await this.findCompanyUser(companyId, userId)
    this.assertUserManagementAllowed(actorRole, existingUser.role)
    await this.assertTargetWithinActorScope(companyId, actorUserId, actorRole, existingUser.id)

    if (dto.role !== undefined) {
      this.assertTenantManagedRole(dto.role)
      this.assertUserManagementAllowed(actorRole, dto.role)
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
    const actorLocationScope = await resolveUserLocationScope({
      prisma: this.prisma,
      actorCompanyId: companyId,
      userId: actorUserId,
      role: actorRole,
      scopeCompanyId: companyId,
    })
    const locationIds = await this.normalizeScopedRoleLocationIds({
      companyId,
      targetRole: nextRole,
      actorRole,
      actorLocationScope,
      requestedLocationIds: dto.locationIds,
      existingUserId: existingUser.id,
    })

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
      await this.replaceSelfScopeBindingsTx(tx, companyId, existingUser.id, locationIds)

      if (existingUser.role === UserRole.TECHNICIAN && nextRole !== UserRole.TECHNICIAN) {
        await tx.technicianSpecialization.deleteMany({
          where: { userId: existingUser.id },
        })
      }
    })

    return this.getPublicUserById(companyId, existingUser.id)
  }

  async deactivate(companyId: string, actorUserId: string, actorRole: UserRole, userId: string) {
    const existingUser = await this.findCompanyUser(companyId, userId)
    this.assertUserManagementAllowed(actorRole, existingUser.role)
    await this.assertTargetWithinActorScope(companyId, actorUserId, actorRole, existingUser.id)

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

  async activate(companyId: string, actorUserId: string, actorRole: UserRole, userId: string) {
    const existingUser = await this.findCompanyUser(companyId, userId)
    this.assertUserManagementAllowed(actorRole, existingUser.role)
    await this.assertTargetWithinActorScope(companyId, actorUserId, actorRole, existingUser.id)

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
      select: UsersPolicy.selectPublicUser(companyId),
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return this.mapUserOutput(user)
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

  private assertUserManagementAllowed(actorRole: UserRole, targetRole: UserRole) {
    if (actorRole === UserRole.ADMIN) return
    if (actorRole === UserRole.NETWORK_DIRECTOR) {
      if (targetRole === UserRole.CLIENT) return
      throw new ForbiddenException('NETWORK_DIRECTOR can manage only CLIENT users')
    }
    if (actorRole === UserRole.TERRITORIAL_MANAGER) {
      if (targetRole === UserRole.CLIENT || targetRole === UserRole.NETWORK_DIRECTOR) return
      throw new ForbiddenException('TERRITORIAL_MANAGER can manage only CLIENT and NETWORK_DIRECTOR users')
    }
    throw new ForbiddenException('Role cannot manage users')
  }

  private async assertTargetWithinActorScope(
    companyId: string,
    actorUserId: string,
    actorRole: UserRole,
    targetUserId: string,
  ) {
    if (actorRole === UserRole.ADMIN) return
    const actorScope = await resolveUserLocationScope({
      prisma: this.prisma,
      actorCompanyId: companyId,
      userId: actorUserId,
      role: actorRole,
      scopeCompanyId: companyId,
    })
    if (!actorScope.enabled || actorScope.allowAll) return
    const targetLocationIds = await this.findSelfScopeLocationIds(companyId, targetUserId)
    if (targetLocationIds.length === 0) {
      throw new ForbiddenException('Target user is outside of your location scope')
    }
    const outside = targetLocationIds.some((locationId) => !actorScope.locationIds.includes(locationId))
    if (outside) {
      throw new ForbiddenException('Target user is outside of your location scope')
    }
  }

  private async normalizeScopedRoleLocationIds(params: {
    companyId: string
    targetRole: UserRole
    actorRole: UserRole
    actorLocationScope: { enabled: boolean; allowAll: boolean; locationIds: string[] }
    requestedLocationIds?: string[]
    existingUserId?: string
  }) {
    const targetRole = params.targetRole
    const isScopedRole =
      targetRole === UserRole.CLIENT ||
      targetRole === UserRole.NETWORK_DIRECTOR ||
      targetRole === UserRole.TERRITORIAL_MANAGER

    if (!isScopedRole) {
      if ((params.requestedLocationIds ?? []).length > 0) {
        throw new BadRequestException('locationIds are allowed only for CLIENT, NETWORK_DIRECTOR or TERRITORIAL_MANAGER')
      }
      return [] as string[]
    }

    const rawLocationIds =
      params.requestedLocationIds !== undefined
        ? params.requestedLocationIds
        : params.existingUserId
          ? await this.findSelfScopeLocationIds(params.companyId, params.existingUserId)
          : []
    const locationIds = Array.from(
      new Set((rawLocationIds ?? []).map((id) => (id ?? '').trim()).filter(Boolean)),
    )

    if (targetRole === UserRole.CLIENT && locationIds.length !== 1) {
      throw new BadRequestException('CLIENT must be bound to exactly one location')
    }
    if (targetRole === UserRole.NETWORK_DIRECTOR && locationIds.length !== 1) {
      throw new BadRequestException('NETWORK_DIRECTOR must be bound to exactly one location')
    }
    if (targetRole === UserRole.TERRITORIAL_MANAGER && locationIds.length < 1) {
      throw new BadRequestException('TERRITORIAL_MANAGER must be bound to at least one location')
    }

    const locations = await this.prisma.location.findMany({
      where: {
        id: { in: locationIds },
        clientCompanyId: params.companyId,
        isActive: true,
      },
      select: { id: true },
    })
    if (locations.length !== locationIds.length) {
      throw new BadRequestException('Some locationIds are invalid')
    }

    if (
      params.actorRole !== UserRole.ADMIN &&
      params.actorLocationScope.enabled &&
      !params.actorLocationScope.allowAll
    ) {
      const outside = locationIds.some((locationId) => !params.actorLocationScope.locationIds.includes(locationId))
      if (outside) {
        throw new ForbiddenException('Cannot bind user to locations outside of your scope')
      }
    }

    return locationIds
  }

  private async findSelfScopeLocationIds(companyId: string, userId: string) {
    const bindings = await this.prisma.technicianClientBinding.findMany({
      where: {
        providerCompanyId: companyId,
        clientCompanyId: companyId,
        technicianUserId: userId,
      },
      select: { locationId: true },
    })
    return Array.from(new Set(bindings.map((binding) => binding.locationId).filter(Boolean))) as string[]
  }

  private async replaceSelfScopeBindingsTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    userId: string,
    locationIds: string[],
  ) {
    await tx.technicianClientBinding.deleteMany({
      where: {
        providerCompanyId: companyId,
        clientCompanyId: companyId,
        technicianUserId: userId,
      },
    })
    if (!locationIds.length) return
    await tx.technicianClientBinding.createMany({
      data: locationIds.map((locationId) => ({
        providerCompanyId: companyId,
        clientCompanyId: companyId,
        technicianUserId: userId,
        locationId,
      })),
    })
  }

  private mapUserOutput(user: any) {
    const bindings = Array.isArray(user.technicianClientBindings) ? user.technicianClientBindings : []
    return {
      ...user,
      locationBindings: bindings
        .filter((binding: any) => !!binding.location?.id)
        .map((binding: any) => ({
          locationId: binding.location.id,
          location: binding.location,
        })),
    }
  }

  private normalizeOptionalText(value?: string | null) {
    if (value === undefined) return undefined
    const normalized = value?.trim() ?? ''
    return normalized.length > 0 ? normalized : null
  }
}