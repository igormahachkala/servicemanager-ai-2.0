import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { UsersPolicy } from '../policy/users.policy';

type ActorContext = {
  actorId: string;
  actorCompanyId: string;
  actorRole: UserRole;
  requestedCompanyId?: string;
};

type PermissionMeta = {
  code: string;
  name: string;
  description: string | null;
};

type PermissionEntry = PermissionMeta & {
  source: 'role' | 'override';
};

type ReadableUser = {
  id: string;
  role: UserRole;
  isActive: boolean;
  isExecutor: boolean;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  technicianSpecializations: Array<unknown>;
};

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(ctx: ActorContext) {
    const { companyId, company } = await this.resolveReadableCompany(ctx);
    const users = await this.prisma.user.findMany({
      where: UsersPolicy.listWhere(companyId),
      select: UsersPolicy.selectPublicUser(),
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
    });

    const data = await this.loadPermissionContext(users.map((user) => user.id), users.map((user) => user.role));

    return {
      company,
      users: users.map((user) => this.buildListEntry(user, data, user.id)),
    };
  }

  async getEffectivePermissions(ctx: ActorContext & { userId: string }) {
    const { companyId, company } = await this.resolveReadableCompany(ctx);
    const user = await this.findUserInScope(companyId, ctx.userId);
    const data = await this.loadPermissionContext([user.id], [user.role]);
    const roleCodes = data.roleCodesByRole.get(user.role) ?? [];
    const overrideCodes = data.overrideCodesByUser.get(user.id) ?? [];
    const effective = this.combineCodes(roleCodes, overrideCodes);
    const permissions = this.buildDetailedPermissions(roleCodes, overrideCodes, data.blockByCode);

    return {
      company,
      user,
      permissions: {
        role: permissions.filter((item) => item.source === 'role'),
        overrides: permissions.filter((item) => item.source === 'override'),
        effective: permissions,
        codes: {
          role: roleCodes,
          overrides: overrideCodes,
          effective,
        },
      },
    };
  }

  async getOverrides(ctx: ActorContext & { userId: string }) {
    const { companyId, company } = await this.resolveReadableCompany(ctx);
    const user = await this.findUserInScope(companyId, ctx.userId);
    const data = await this.loadPermissionContext([user.id], [user.role]);
    const overrideCodes = data.overrideCodesByUser.get(user.id) ?? [];
    const overrides = overrideCodes.map((code) => this.toPermissionMeta(code, data.blockByCode));

    return {
      company,
      user,
      overrides,
      codes: overrideCodes,
      count: overrides.length,
    };
  }

  async getScopes(ctx: ActorContext & { userId: string }) {
    const { companyId, company, isObserverScope } = await this.resolveReadableCompany(ctx);
    const user = await this.findUserInScope(companyId, ctx.userId);
    const data = await this.loadPermissionContext([user.id], [user.role]);
    const roleCodes = data.roleCodesByRole.get(user.role) ?? [];
    const overrideCodes = data.overrideCodesByUser.get(user.id) ?? [];
    const effectiveCodes = this.combineCodes(roleCodes, overrideCodes);

    return {
      company,
      user,
      scope: {
        companyId,
        companyType: company.type,
        role: user.role,
        isActive: user.isActive,
        isExecutor: user.isExecutor,
        isObserverScope,
        canReadOwnCompany: true,
        canObserveOtherCompany: ctx.actorRole === UserRole.PLATFORM_ADMIN,
        canViewAllCompanyTickets: effectiveCodes.includes('TICKETS_VIEW_ALL_COMPANY'),
        canManageUsers: effectiveCodes.includes('USERS_MANAGE'),
        canManageLocations: effectiveCodes.includes('LOCATIONS_MANAGE'),
        canViewAnalytics: effectiveCodes.includes('ANALYTICS_VIEW'),
        canCreateTickets: effectiveCodes.includes('TICKETS_CREATE'),
        canAssignTickets: effectiveCodes.includes('TICKETS_ASSIGN'),
        canClaimTickets: effectiveCodes.includes('TICKETS_CLAIM'),
        canChangeTicketStatus: effectiveCodes.includes('TICKETS_STATUS_CHANGE'),
      },
      permissions: {
        roleCodes,
        overrideCodes,
        effectiveCodes,
      },
    };
  }

  private async resolveReadableCompany(ctx: ActorContext) {
    const requestedCompanyId = ctx.requestedCompanyId?.trim() || null;
    const isObserverRequest = !!requestedCompanyId && requestedCompanyId !== ctx.actorCompanyId;

    if (isObserverRequest && ctx.actorRole !== UserRole.PLATFORM_ADMIN) {
      throw new ForbiddenException('Only PLATFORM_ADMIN can read another company');
    }

    const companyId = requestedCompanyId && ctx.actorRole === UserRole.PLATFORM_ADMIN ? requestedCompanyId : ctx.actorCompanyId;
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        type: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return {
      companyId,
      company,
      isObserverScope: ctx.actorRole === UserRole.PLATFORM_ADMIN && companyId !== ctx.actorCompanyId,
    };
  }

  private async findUserInScope(companyId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
        deletedAt: null,
      },
      select: UsersPolicy.selectPublicUser(),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async loadPermissionContext(userIds: string[], roles: UserRole[]) {
    const [blocks, roleGrants, userGrants] = await Promise.all([
      this.prisma.permissionBlock.findMany({
        orderBy: [{ code: 'asc' }],
        select: { code: true, name: true, description: true },
      }),
      roles.length
        ? this.prisma.rolePermission.findMany({
            where: { role: { in: Array.from(new Set(roles)) } },
            select: {
              role: true,
              permissionBlock: { select: { code: true, name: true, description: true } },
            },
          })
        : Promise.resolve([] as Array<{ role: UserRole; permissionBlock: PermissionMeta }>),
      userIds.length
        ? this.prisma.userPermission.findMany({
            where: { userId: { in: Array.from(new Set(userIds)) } },
            select: {
              userId: true,
              permissionBlock: { select: { code: true, name: true, description: true } },
            },
          })
        : Promise.resolve([] as Array<{ userId: string; permissionBlock: PermissionMeta }>),
    ]);

    const blockByCode = new Map<string, PermissionMeta>();
    for (const block of blocks) {
      blockByCode.set(block.code, {
        code: block.code,
        name: block.name,
        description: block.description || null,
      });
    }

    const roleCodesByRole = new Map<UserRole, string[]>();
    for (const grant of roleGrants) {
      const codes = roleCodesByRole.get(grant.role) || [];
      codes.push(grant.permissionBlock.code);
      roleCodesByRole.set(grant.role, codes);
      if (!blockByCode.has(grant.permissionBlock.code)) {
        blockByCode.set(grant.permissionBlock.code, {
          code: grant.permissionBlock.code,
          name: grant.permissionBlock.name,
          description: grant.permissionBlock.description || null,
        });
      }
    }

    const overrideCodesByUser = new Map<string, string[]>();
    for (const grant of userGrants) {
      const codes = overrideCodesByUser.get(grant.userId) || [];
      codes.push(grant.permissionBlock.code);
      overrideCodesByUser.set(grant.userId, codes);
      if (!blockByCode.has(grant.permissionBlock.code)) {
        blockByCode.set(grant.permissionBlock.code, {
          code: grant.permissionBlock.code,
          name: grant.permissionBlock.name,
          description: grant.permissionBlock.description || null,
        });
      }
    }

    for (const role of Array.from(new Set(roles))) {
      if (!roleCodesByRole.has(role)) roleCodesByRole.set(role, []);
    }
    for (const userId of Array.from(new Set(userIds))) {
      if (!overrideCodesByUser.has(userId)) overrideCodesByUser.set(userId, []);
    }

    return {
      blockByCode,
      roleCodesByRole,
      overrideCodesByUser,
    };
  }

  private buildListEntry(
    user: ReadableUser,
    data: {
      blockByCode: Map<string, PermissionMeta>;
      roleCodesByRole: Map<UserRole, string[]>;
      overrideCodesByUser: Map<string, string[]>;
    },
    userId: string,
  ) {
    const roleCodes = data.roleCodesByRole.get(user.role) || [];
    const overrideCodes = data.overrideCodesByUser.get(userId) || [];
    const effectiveCodes = this.combineCodes(roleCodes, overrideCodes);

    return {
      user,
      permissions: {
        roleCodes,
        overrideCodes,
        effectiveCodes,
        counts: {
          role: roleCodes.length,
          overrides: overrideCodes.length,
          effective: effectiveCodes.length,
        },
      },
    };
  }

  private buildDetailedPermissions(roleCodes: string[], overrideCodes: string[], blockByCode: Map<string, PermissionMeta>) {
    const effectiveCodes = this.combineCodes(roleCodes, overrideCodes);
    const byCode = new Map<string, PermissionEntry>();

    for (const code of roleCodes) {
      byCode.set(code, {
        ...this.toPermissionMeta(code, blockByCode),
        source: 'role',
      });
    }

    for (const code of overrideCodes) {
      byCode.set(code, {
        ...this.toPermissionMeta(code, blockByCode),
        source: 'override',
      });
    }

    return effectiveCodes.map((code) => byCode.get(code) || { ...this.toPermissionMeta(code, blockByCode), source: overrideCodes.includes(code) ? 'override' : 'role' });
  }

  private combineCodes(roleCodes: string[], overrideCodes: string[]) {
    return Array.from(new Set([...roleCodes, ...overrideCodes])).sort();
  }

  private toPermissionMeta(code: string, blockByCode: Map<string, PermissionMeta>): PermissionMeta {
    return blockByCode.get(code) || {
      code,
      name: code,
      description: null,
    };
  }
}
