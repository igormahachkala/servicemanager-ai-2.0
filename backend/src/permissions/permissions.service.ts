import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { CompanyType, UserRole } from '@prisma/client'

import { isExecutorCapableRole } from '../common/executor.utils'
import { PERMISSIONS } from '../common/permissions.constants'
import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { resolveTechnicianOperationalScope } from '../tickets/ticket-access.utils'

import { readUserPermissionAuditHistory } from './permissions-audit.read'

type Actor = {
  id: string
  role: UserRole
  companyId: string
}

type ListUsersInput = {
  companyId?: string
  q?: string
  role?: string
  isActive?: string
  hasOverrides?: string
  take?: string
  skip?: string
}

type ScopeMode = 'tenant_wide' | 'bound_locations'

type UpdateUserOverridesInput = {
  grantPermissionCodes?: string[]
  reason?: string
}

@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serviceContractsService: ServiceContractsService,
  ) {}

  async listUsers(actor: Actor, input: ListUsersInput) {
    const scopeCompanyId = await this.resolveReadableCompanyId(actor, input.companyId)
    const company = await this.getCompany(scopeCompanyId)
    const roleFilter = this.parseRole(input.role)
    const isActiveFilter = this.parseBoolean(input.isActive)
    const hasOverridesFilter = this.parseBoolean(input.hasOverrides)
    const take = this.parseTake(input.take)
    const skip = this.parseSkip(input.skip)
    const q = (input.q || '').trim()

    const where = {
      companyId: scopeCompanyId,
      ...(roleFilter ? { role: roleFilter } : {}),
      ...(typeof isActiveFilter === 'boolean' ? { isActive: isActiveFilter } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' as const } },
              { firstName: { contains: q, mode: 'insensitive' as const } },
              { lastName: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ role: 'asc' }, { email: 'asc' }],
        take,
        skip,
      }),
      this.prisma.user.count({ where }),
    ])

    if (users.length === 0) {
      return {
        items: [],
        meta: {
          total,
          take,
          skip,
          companyId: scopeCompanyId,
          companyType: company.type,
        },
      }
    }

    const userIds = users.map((user) => user.id)
    const roles = Array.from(new Set(users.map((user) => user.role)))

    const [rolePermissions, userPermissions, bindingCounts, linkedScope] = await Promise.all([
      this.getRolePermissionsMap(roles),
      this.getUserPermissionsMap(userIds),
      this.getLocationBindingCounts(userIds, scopeCompanyId),
      this.getLinkedScopeSnapshot(scopeCompanyId, company.type),
    ])

    const items = users
      .map((user) => {
        const roleCodes = rolePermissions.get(user.role) || []
        const userCodes = userPermissions.get(user.id) || []
        const effective = Array.from(new Set([...roleCodes, ...userCodes]))
        const hasOverrides = userCodes.length > 0

        if (hasOverridesFilter === true && !hasOverrides) return null
        if (hasOverridesFilter === false && hasOverrides) return null

        const bindingCount = bindingCounts.get(user.id) ?? 0

        return {
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          effectivePermissionsCount: effective.length,
          overridesCount: userCodes.length,
          scopeSummary: {
            mode: (bindingCount > 0 ? 'bound_locations' : 'tenant_wide') as ScopeMode,
            linkedClientCount: linkedScope.allLinkedClientIds.length,
          },
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }
      })
      .filter((row): row is NonNullable<typeof row> => !!row)

    return {
      items,
      meta: {
        total,
        take,
        skip,
        companyId: scopeCompanyId,
        companyType: company.type,
      },
    }
  }

  async getEffectivePermissions(actor: Actor, userId: string, requestedCompanyId?: string) {
    const scopeCompanyId = await this.resolveReadableCompanyId(actor, requestedCompanyId)
    const user = await this.getReadableUser(scopeCompanyId, userId)

    const [roleCodes, userCodes, roleDetails, userDetails] = await Promise.all([
      this.getRolePermissionCodes(user.role),
      this.getUserPermissionCodes(user.id),
      this.getRolePermissionDetails(user.role),
      this.getUserPermissionDetails(user.id),
    ])

    const effective = Array.from(new Set([...roleCodes, ...userCodes])).sort()
    const accessFlags = this.buildAccessFlags(userCodes)

    return {
      subject: {
        userId: user.id,
        companyId: user.companyId,
        role: user.role,
        isActive: user.isActive,
      },
      grants: {
        rolePermissions: roleCodes,
        userPermissions: userCodes,
        effectivePermissions: effective,
      },
      details: {
        rolePermissions: roleDetails,
        userPermissions: userDetails,
      },
      accessFlags,
      meta: {
        generatedAt: new Date().toISOString(),
      },
    }
  }

  async getUserOverrides(actor: Actor, userId: string, requestedCompanyId?: string) {
    const scopeCompanyId = await this.resolveReadableCompanyId(actor, requestedCompanyId)
    const user = await this.getReadableUser(scopeCompanyId, userId)

    const overrides = await this.prisma.userPermission.findMany({
      where: { userId: user.id },
      select: {
        createdAt: true,
        permissionBlock: {
          select: {
            code: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    })

    return {
      userId: user.id,
      companyId: user.companyId,
      overrides: overrides.map((row) => ({
        code: row.permissionBlock.code,
        name: row.permissionBlock.name,
        description: row.permissionBlock.description,
        grantedAt: row.createdAt,
      })),
      meta: {
        generatedAt: new Date().toISOString(),
      },
    }
  }

  async updateUserOverrides(
    actor: Actor,
    userId: string,
    input: UpdateUserOverridesInput,
    requestedCompanyId?: string,
  ) {
    const scopeCompanyId = await this.resolveReadableCompanyId(actor, requestedCompanyId)
    const user = await this.getReadableUser(scopeCompanyId, userId)
    const reason = (input.reason || '').trim()
    if (!reason) {
      throw new BadRequestException('reason is required')
    }

    const grantPermissionCodes = this.parseGrantPermissionCodes(input.grantPermissionCodes)
    const permissionBlocksByCode = await this.getPermissionBlocksByCodes(grantPermissionCodes)
    const permissionBlockIds = grantPermissionCodes.map((code) => permissionBlocksByCode.get(code)!.id)
    const previousPermissionCodes = await this.getUserPermissionCodes(user.id)

    await this.prisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({
        where: { userId: user.id },
      })

      if (permissionBlockIds.length > 0) {
        await tx.userPermission.createMany({
          data: permissionBlockIds.map((permissionBlockId) => ({
            userId: user.id,
            permissionBlockId,
          })),
          skipDuplicates: true,
        })
      }

      await tx.domainEvent.create({
        data: {
          companyId: user.companyId,
          entityType: 'User',
          entityId: user.id,
          type: 'user.permission_overrides_updated',
          actorUserId: actor.id,
          payload: {
            reason,
            grantPermissionCodes,
            previousPermissionCodes,
          },
        },
      })
    })

    const overrides = await this.getUserPermissionDetails(user.id)

    return {
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      reason,
      overrides,
      meta: {
        generatedAt: new Date().toISOString(),
      },
    }
  }

  async getUserScopes(actor: Actor, userId: string, requestedCompanyId?: string) {
    const scopeCompanyId = await this.resolveReadableCompanyId(actor, requestedCompanyId)
    const user = await this.getReadableUser(scopeCompanyId, userId)
    const company = await this.getCompany(user.companyId)

    const [userPermissionCodes, linkedScope] = await Promise.all([
      this.getUserPermissionCodes(user.id),
      this.getLinkedScopeSnapshot(user.companyId, company.type),
    ])

    const bindingCompanyIds = Array.from(new Set([user.companyId, ...linkedScope.allLinkedClientIds]))
    const bindings = await this.prisma.userLocationBinding.findMany({
      where: {
        userId: user.id,
        companyId: { in: bindingCompanyIds },
      },
      select: {
        companyId: true,
        locationId: true,
      },
      orderBy: [{ companyId: 'asc' }, { locationId: 'asc' }],
    })

    const locationScopeByCompany = new Map<string, Set<string>>()
    for (const binding of bindings) {
      const bucket = locationScopeByCompany.get(binding.companyId) || new Set<string>()
      bucket.add(binding.locationId)
      locationScopeByCompany.set(binding.companyId, bucket)
    }

    const companies = bindingCompanyIds.map((companyId) => {
      const ids = Array.from(locationScopeByCompany.get(companyId) || [])
      return {
        companyId,
        mode: (ids.length > 0 ? 'bound_locations' : 'tenant_wide') as ScopeMode,
        locationIds: ids,
      }
    })

    const baseScope = {
      companyId: user.companyId,
      companyType: company.type,
      linkedClientCompanyIds: linkedScope.allLinkedClientIds,
      locationBindings: {
        companies,
      },
      accessFlags: this.buildAccessFlags(userPermissionCodes),
    }

    if (!isExecutorCapableRole(user.role) || !user.isExecutor) {
      return {
        userId: user.id,
        role: user.role,
        isExecutor: user.isExecutor,
        scope: {
          ...baseScope,
          operational: null,
        },
        meta: {
          generatedAt: new Date().toISOString(),
        },
      }
    }

    try {
      const operational = await resolveTechnicianOperationalScope({
        prisma: this.prisma,
        serviceContractsService: this.serviceContractsService,
        actor: {
          id: user.id,
          role: user.role,
          companyId: user.companyId,
          accessFlags: this.buildAccessFlags(userPermissionCodes),
        },
      })

      return {
        userId: user.id,
        role: user.role,
        isExecutor: user.isExecutor,
        scope: {
          ...baseScope,
          operational,
        },
        meta: {
          generatedAt: new Date().toISOString(),
        },
      }
    } catch (error) {
      return {
        userId: user.id,
        role: user.role,
        isExecutor: user.isExecutor,
        scope: {
          ...baseScope,
          operational: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
        meta: {
          generatedAt: new Date().toISOString(),
        },
      }
    }
  }

  async getUserPermissionAuditHistory(
    actor: Actor,
    userId: string,
    input: { companyId?: string; take?: string; skip?: string },
  ) {
    const scopeCompanyId = await this.resolveReadableCompanyId(actor, input.companyId)
    const user = await this.getReadableUser(scopeCompanyId, userId)

    return readUserPermissionAuditHistory(this.prisma, user, {
      take: this.parseTake(input.take),
      skip: this.parseSkip(input.skip),
    })
  }

  private async resolveReadableCompanyId(actor: Actor, requestedCompanyId?: string) {
    const requested = (requestedCompanyId || '').trim()
    if (!requested || requested === actor.companyId) {
      return actor.companyId
    }

    if (actor.role !== UserRole.PLATFORM_ADMIN) {
      throw new ForbiddenException('Cross-tenant permissions read is not allowed')
    }

    const company = await this.prisma.company.findUnique({
      where: { id: requested },
      select: { id: true },
    })
    if (!company) {
      throw new NotFoundException('Company not found')
    }
    return requested
  }

  private parseRole(value?: string) {
    const normalized = (value || '').trim()
    if (!normalized) return undefined
    if (!Object.values(UserRole).includes(normalized as UserRole)) return undefined
    return normalized as UserRole
  }

  private parseBoolean(value?: string) {
    const normalized = (value || '').trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
    return undefined
  }

  private parseGrantPermissionCodes(value?: string[]) {
    if (!Array.isArray(value)) {
      throw new BadRequestException('grantPermissionCodes must be an array')
    }

    const normalized = value
      .map((code) => String(code || '').trim().toUpperCase())
      .filter((code) => code.length > 0)

    return Array.from(new Set(normalized)).sort()
  }

  private parseTake(value?: string) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return 50
    return Math.max(1, Math.min(200, Math.trunc(parsed)))
  }

  private parseSkip(value?: string) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return 0
    return Math.max(0, Math.trunc(parsed))
  }

  private async getCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        type: true,
      },
    })
    if (!company) {
      throw new NotFoundException('Company not found')
    }
    return company
  }

  private async getReadableUser(companyId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
      },
      select: {
        id: true,
        companyId: true,
        role: true,
        isActive: true,
        isExecutor: true,
      },
    })
    if (!user) {
      throw new NotFoundException('User not found')
    }
    return user
  }

  private async getRolePermissionsMap(roles: UserRole[]) {
    const rows = await this.prisma.rolePermission.findMany({
      where: {
        role: { in: roles },
      },
      select: {
        role: true,
        permissionBlock: {
          select: { code: true },
        },
      },
    })

    const out = new Map<UserRole, string[]>()
    for (const role of roles) {
      out.set(role, [])
    }
    for (const row of rows) {
      const existing = out.get(row.role) || []
      existing.push(row.permissionBlock.code)
      out.set(row.role, existing)
    }
    for (const [role, codes] of out.entries()) {
      out.set(role, Array.from(new Set(codes)).sort())
    }
    return out
  }

  private async getUserPermissionsMap(userIds: string[]) {
    const rows = await this.prisma.userPermission.findMany({
      where: {
        userId: { in: userIds },
      },
      select: {
        userId: true,
        permissionBlock: {
          select: { code: true },
        },
      },
    })

    const out = new Map<string, string[]>()
    for (const userId of userIds) {
      out.set(userId, [])
    }
    for (const row of rows) {
      const existing = out.get(row.userId) || []
      existing.push(row.permissionBlock.code)
      out.set(row.userId, existing)
    }
    for (const [userId, codes] of out.entries()) {
      out.set(userId, Array.from(new Set(codes)).sort())
    }
    return out
  }

  private async getLocationBindingCounts(userIds: string[], companyId: string) {
    const grouped = await this.prisma.userLocationBinding.groupBy({
      by: ['userId'],
      where: {
        companyId,
        userId: { in: userIds },
      },
      _count: { _all: true },
    })
    const out = new Map<string, number>()
    for (const row of grouped) {
      out.set(row.userId, row._count._all)
    }
    return out
  }

  private async getRolePermissionCodes(role: UserRole) {
    const rows = await this.prisma.rolePermission.findMany({
      where: { role },
      select: {
        permissionBlock: {
          select: { code: true },
        },
      },
    })
    return Array.from(new Set(rows.map((row) => row.permissionBlock.code))).sort()
  }

  private async getUserPermissionCodes(userId: string) {
    const rows = await this.prisma.userPermission.findMany({
      where: { userId },
      select: {
        permissionBlock: {
          select: { code: true },
        },
      },
    })
    return Array.from(new Set(rows.map((row) => row.permissionBlock.code))).sort()
  }

  private async getRolePermissionDetails(role: UserRole) {
    const rows = await this.prisma.rolePermission.findMany({
      where: { role },
      select: {
        permissionBlock: {
          select: {
            code: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: [{ permissionBlock: { code: 'asc' } }],
    })
    return rows.map((row) => ({
      code: row.permissionBlock.code,
      name: row.permissionBlock.name,
      description: row.permissionBlock.description,
    }))
  }

  private async getUserPermissionDetails(userId: string) {
    const rows = await this.prisma.userPermission.findMany({
      where: { userId },
      select: {
        createdAt: true,
        permissionBlock: {
          select: {
            code: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: [{ permissionBlock: { code: 'asc' } }],
    })
    return rows.map((row) => ({
      code: row.permissionBlock.code,
      name: row.permissionBlock.name,
      description: row.permissionBlock.description,
      grantedAt: row.createdAt,
    }))
  }

  private async getPermissionBlocksByCodes(codes: string[]) {
    if (codes.length === 0) return new Map<string, { id: string; code: string }>()

    const rows = await this.prisma.permissionBlock.findMany({
      where: {
        code: { in: codes },
      },
      select: {
        id: true,
        code: true,
      },
    })

    const map = new Map(rows.map((row) => [row.code, row]))
    const unknown = codes.filter((code) => !map.has(code))
    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown permission codes: ${unknown.join(', ')}`)
    }
    return map
  }

  private async getLinkedScopeSnapshot(companyId: string, companyType: CompanyType) {
    if (companyType !== CompanyType.PROVIDER) {
      return {
        primaryLinkedClientIds: [] as string[],
        secondaryLinkedClientIds: [] as string[],
        allLinkedClientIds: [] as string[],
      }
    }

    const [primaryLinkedClientIds, secondaryLinkedClientIds] = await Promise.all([
      this.serviceContractsService.listPrimaryLinkedClientIds(companyId),
      this.serviceContractsService.listSecondaryLinkedClientIds(companyId),
    ])
    const allLinkedClientIds = Array.from(new Set([...primaryLinkedClientIds, ...secondaryLinkedClientIds]))
    return {
      primaryLinkedClientIds,
      secondaryLinkedClientIds,
      allLinkedClientIds,
    }
  }

  private buildAccessFlags(permissionCodes: string[]) {
    return {
      canTechnicianViewAllCompanyTickets: permissionCodes.includes(PERMISSIONS.TICKETS_VIEW_ALL_COMPANY),
    }
  }
}
