import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CompanyType, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { PERMISSION_BLOCKS, ROLE_GRANTS } from '../common/permissions-matrix';
import { UsersPolicy } from '../policy/users.policy';
import { PermissionCatalogItemDto } from './dto/permission-catalog.dto';
import { RoleMatrixEntryDto } from './dto/role-matrix.dto';
import { MatrixChangeDto } from './dto/update-matrix.dto';

type CompanyTypeOrNull = CompanyType | null;

/** PLATFORM_ADMIN-гранты, которые нельзя снимать через editor (lockout-protection). */
const PROTECTED_PLATFORM_ADMIN_CODES = new Set<string>(['TICKETS_VIEW', 'USERS_MANAGE']);

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

  private categoryLabel(group: string): string {
    const map: Record<string, string> = {
      TICKETS: 'Tickets',
      LOCATIONS: 'Locations',
      EMPLOYEES: 'Employees',
      ANALYTICS: 'Analytics',
      MANAGEMENT: 'Management',
    };
    return map[group] ?? group;
  }

  getCatalog(): PermissionCatalogItemDto[] {
    return PERMISSION_BLOCKS.map((b) => ({
      code: b.code,
      name: b.name,
      category: this.categoryLabel(b.group),
      description: b.description ?? null,
    }));
  }

  /** Статическая матрица (fallback, когда PBAC ещё не засеян). */
  private staticMatrix(): RoleMatrixEntryDto[] {
    return ROLE_GRANTS.map((g) => ({
      role: g.role,
      companyType: g.companyType,
      permissions: [...g.codes],
    }));
  }

  /**
   * Матрица из БД (источник истины — RolePermission, как и у guard).
   * Fallback на статическую матрицу только если PBAC не засеян (нет блоков/грантов).
   */
  async getMatrix(): Promise<RoleMatrixEntryDto[]> {
    const blocksCount = await this.prisma.permissionBlock.count();
    if (blocksCount === 0) return this.staticMatrix();

    const grants = await this.prisma.rolePermission.findMany({
      select: { role: true, companyType: true, permissionBlock: { select: { code: true } } },
    });
    if (grants.length === 0) return this.staticMatrix();

    const map = new Map<string, RoleMatrixEntryDto>();
    for (const g of grants) {
      const key = `${g.role}:${g.companyType ?? 'ANY'}`;
      if (!map.has(key)) map.set(key, { role: g.role, companyType: g.companyType, permissions: [] });
      map.get(key)!.permissions.push(g.permissionBlock.code);
    }
    return [...map.values()].map((e) => ({ ...e, permissions: e.permissions.sort() }));
  }

  private async matrixSubset(keys: Set<string>): Promise<RoleMatrixEntryDto[]> {
    const all = await this.getMatrix();
    return all.filter((e) => keys.has(`${e.role}:${e.companyType ?? 'ANY'}`));
  }

  /**
   * Применить дельты (add/remove) к матрице в одной транзакции.
   * Валидация, lockout-protection, аудит. Идемпотентно.
   */
  async applyChanges(
    changes: MatrixChangeDto[],
    actor: { id: string; companyId: string },
  ): Promise<RoleMatrixEntryDto[]> {
    if (!Array.isArray(changes) || changes.length === 0) {
      throw new BadRequestException('changes must be a non-empty array');
    }

    // PBAC должен быть засеян — иначе редактирование бессмысленно (guard в fallback).
    const blocksCount = await this.prisma.permissionBlock.count();
    if (blocksCount === 0) {
      throw new ConflictException('PBAC is not initialized (no PermissionBlocks). Run seed:permissions first.');
    }

    const blocks = await this.prisma.permissionBlock.findMany({ select: { id: true, code: true } });
    const codeToId = new Map(blocks.map((b) => [b.code, b.id]));

    const roleValues = new Set(Object.values(UserRole) as string[]);
    const seenKeys = new Set<string>();

    for (const ch of changes) {
      if (!roleValues.has(ch.role)) throw new BadRequestException(`Unknown role: ${ch.role}`);
      if (ch.companyType !== null && ch.companyType !== CompanyType.CLIENT && ch.companyType !== CompanyType.PROVIDER) {
        throw new BadRequestException(`Invalid companyType: ${String(ch.companyType)}`);
      }
      const key = `${ch.role}:${ch.companyType ?? 'ANY'}`;
      if (seenKeys.has(key)) throw new BadRequestException(`Duplicate change for ${key}`);
      seenKeys.add(key);

      const add = ch.add ?? [];
      const remove = ch.remove ?? [];
      for (const code of [...add, ...remove]) {
        if (!codeToId.has(code)) throw new BadRequestException(`Unknown permission code: ${code}`);
      }
      const overlap = add.filter((c) => remove.includes(c));
      if (overlap.length) throw new BadRequestException(`add/remove overlap: ${overlap.join(', ')}`);

      // Lockout-protection: нельзя снимать защищённые гранты у PLATFORM_ADMIN.
      if (ch.role === UserRole.PLATFORM_ADMIN) {
        const blocked = remove.filter((c) => PROTECTED_PLATFORM_ADMIN_CODES.has(c));
        if (blocked.length) {
          throw new ConflictException(`Cannot remove protected PLATFORM_ADMIN permissions: ${blocked.join(', ')}`);
        }
      }
    }

    const before = await this.matrixSubset(seenKeys);

    await this.prisma.$transaction(async (tx) => {
      for (const ch of changes) {
        const companyType = (ch.companyType ?? null) as CompanyTypeOrNull;
        const add = ch.add ?? [];
        const remove = ch.remove ?? [];

        if (remove.length) {
          await tx.rolePermission.deleteMany({
            where: { role: ch.role as UserRole, companyType, permissionBlock: { code: { in: remove } } },
          });
        }
        if (add.length) {
          const existing = await tx.rolePermission.findMany({
            where: { role: ch.role as UserRole, companyType },
            select: { permissionBlock: { select: { code: true } } },
          });
          const have = new Set(existing.map((e) => e.permissionBlock.code));
          const toAdd = add.filter((c) => !have.has(c));
          if (toAdd.length) {
            await tx.rolePermission.createMany({
              data: toAdd.map((c) => ({ role: ch.role as UserRole, companyType, permissionBlockId: codeToId.get(c)! })),
            });
          }
        }
      }
    });

    const after = await this.matrixSubset(seenKeys);

    // Аудит (best-effort): не валим запрос, если запись аудита не удалась.
    try {
      await this.prisma.domainEvent.create({
        data: {
          companyId: actor.companyId,
          entityType: 'Permissions',
          entityId: 'matrix',
          type: 'permissions.matrix_updated',
          actorUserId: actor.id,
          payload: { changes, before, after } as any,
        },
      });
    } catch {
      /* аудит best-effort */
    }

    return this.getMatrix();
  }

  // ── Read-only эффективные права по пользователю (readonly perm API) ──
  // TODO(companyType-aware): getEffectivePermissions / loadPermissionContext читают RolePermission
  // companyType-слепо (where: { role }). Сейчас ОК — все гранты companyType=NULL. Если появятся
  // company-type-специфичные гранты, фильтровать по типу компании пользователя (как в getMatrix).
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
