import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CompanyType, ServiceContractRole, UserRole } from '@prisma/client';

import { PERMISSIONS } from '../common/permissions.constants';
import { PERMISSION_BLOCKS, ROLE_GRANTS } from '../common/permissions-matrix';
import { UsersPolicy } from '../policy/users.policy';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceContractsService } from '../service-contracts/service-contracts.service';

import { PermissionCatalogItemDto } from './dto/permission-catalog.dto';
import { RoleMatrixEntryDto } from './dto/role-matrix.dto';
import { MatrixChangeDto } from './dto/update-matrix.dto';

type CompanyTypeOrNull = CompanyType | null;

/** PLATFORM_ADMIN-grants that cannot be removed through the matrix editor. */
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

type CompanySummary = {
  id: string;
  name: string;
  type: CompanyType;
};

type PermissionContextUser = {
  id: string;
  role: UserRole;
  companyType: CompanyType;
};

type LoadedPermissionContext = {
  blockByCode: Map<string, PermissionMeta>;
  roleCodesByUser: Map<string, string[]>;
  overrideCodesByUser: Map<string, string[]>;
};

type TargetUserContext = {
  companyId: string;
  company: CompanySummary;
  user: ReadableUser;
  isObserverScope: boolean;
};

type AvailableClientContour = {
  id: string;
  name: string;
  type: CompanyType;
  serviceContractId: string | null;
  role: ServiceContractRole | 'OWN_CLIENT';
  status: string;
};

type LocationBindingRecord = {
  id: string;
  companyId: string;
  locationId: string;
  createdAt: Date;
  location: {
    id: string;
    clientCompanyId: string;
    name: string;
    platformCode: string;
    city: string | null;
    region: string | null;
    address: string | null;
    isActive: boolean;
    deletedAt: Date | null;
  };
};

@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serviceContractsService: ServiceContractsService,
  ) {}

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

  /** Static fallback matrix used only before PBAC is seeded. */
  private staticMatrix(): RoleMatrixEntryDto[] {
    return ROLE_GRANTS.map((g) => ({
      role: g.role,
      companyType: g.companyType,
      permissions: [...g.codes],
    }));
  }

  /**
   * Matrix from DB. Source of truth is RolePermission, matching PermissionsGuard.
   * Falls back to the static matrix only while PBAC has not been seeded.
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
   * Apply role-matrix add/remove deltas in one transaction.
   * Validates input, protects PLATFORM_ADMIN lockout, and writes best-effort audit.
   */
  async applyChanges(
    changes: MatrixChangeDto[],
    actor: { id: string; companyId: string },
  ): Promise<RoleMatrixEntryDto[]> {
    if (!Array.isArray(changes) || changes.length === 0) {
      throw new BadRequestException('changes must be a non-empty array');
    }

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
      /* best-effort audit */
    }

    return this.getMatrix();
  }

  async listUsers(ctx: ActorContext) {
    const { companyId, company } = await this.resolveReadableCompany(ctx);
    const users = await this.prisma.user.findMany({
      where: UsersPolicy.listWhere(companyId),
      select: UsersPolicy.selectPublicUser(),
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
    });

    const data = await this.loadPermissionContext(
      users.map((user) => ({ id: user.id, role: user.role, companyType: company.type })),
    );

    return {
      company,
      users: users.map((user) => this.buildListEntry(user, data, user.id)),
    };
  }

  async getEffectivePermissions(ctx: ActorContext & { userId: string }) {
    const { companyId, company } = await this.resolveReadableCompany(ctx);
    const user = await this.findUserInScope(companyId, ctx.userId);
    return this.buildEffectivePermissionsResponse(company, user);
  }

  async getOverrides(ctx: ActorContext & { userId: string }) {
    const { companyId, company } = await this.resolveReadableCompany(ctx);
    const user = await this.findUserInScope(companyId, ctx.userId);
    const data = await this.loadPermissionContext([{ id: user.id, role: user.role, companyType: company.type }]);
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
    const data = await this.loadPermissionContext([{ id: user.id, role: user.role, companyType: company.type }]);
    const roleCodes = data.roleCodesByUser.get(user.id) ?? [];
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
        canViewAllCompanyTickets: effectiveCodes.includes(PERMISSIONS.TICKETS_VIEW_ALL_COMPANY),
        canManageUsers: effectiveCodes.includes(PERMISSIONS.USERS_MANAGE),
        canManageLocations: effectiveCodes.includes(PERMISSIONS.LOCATIONS_MANAGE),
        canViewAnalytics: effectiveCodes.includes(PERMISSIONS.ANALYTICS_VIEW),
        canCreateTickets: effectiveCodes.includes(PERMISSIONS.TICKETS_CREATE),
        canAssignTickets: effectiveCodes.includes(PERMISSIONS.TICKETS_ASSIGN),
        canClaimTickets: effectiveCodes.includes(PERMISSIONS.TICKETS_CLAIM),
        canChangeTicketStatus: effectiveCodes.includes(PERMISSIONS.TICKETS_STATUS_CHANGE),
      },
      permissions: {
        roleCodes,
        overrideCodes,
        effectiveCodes,
      },
    };
  }

  async grantUserPermissions(ctx: ActorContext & { userId: string; codes: string[] }) {
    const codes = this.normalizeCodeList(ctx.codes);
    const { target, codeToId } = await this.assertCanManageUserPermissions(ctx, codes);

    await this.prisma.userPermission.createMany({
      data: codes.map((code) => ({
        userId: target.user.id,
        permissionBlockId: codeToId.get(code)!,
      })),
      skipDuplicates: true,
    });

    return this.buildEffectivePermissionsResponse(target.company, target.user);
  }

  async removeUserPermissions(ctx: ActorContext & { userId: string; codes: string[] }) {
    const codes = this.normalizeCodeList(ctx.codes);
    const { target } = await this.assertCanManageUserPermissions(ctx, codes);
    await this.assertAccessManagementContinuityAfterPermissionRemoval(target, codes);

    await this.prisma.userPermission.deleteMany({
      where: {
        userId: target.user.id,
        permissionBlock: { code: { in: codes } },
      },
    });

    return this.buildEffectivePermissionsResponse(target.company, target.user);
  }

  async getLocationBindings(ctx: ActorContext & { userId: string }) {
    const target = await this.resolveTargetUserForManagement(ctx, { requireUsersManage: true, allowSelf: true });
    return this.buildLocationBindingsResponse(target);
  }

  async replaceLocationBindings(ctx: ActorContext & { userId: string; locationIds: string[]; clientCompanyId?: string }) {
    const target = await this.resolveTargetUserForManagement(ctx, { requireUsersManage: true, allowSelf: false });
    const locationIds = this.normalizeIdListAllowEmpty(ctx.locationIds);
    if (locationIds.length === 0) {
      throw new ConflictException(
        'Empty location bindings are not persisted in V1A because no-binding currently means tenant-wide access. Keep at least one binding or add explicit scope-mode storage in V1B.',
      );
    }

    const clientCompanyId = await this.resolveAllowedClientCompanyId(target.company, locationIds, ctx.clientCompanyId);
    await this.assertLocationsAllowedForClient(locationIds, clientCompanyId);

    await this.prisma.$transaction(async (tx) => {
      await tx.userLocationBinding.deleteMany({
        where: {
          userId: target.user.id,
          companyId: target.companyId,
          location: { clientCompanyId },
        },
      });
      await tx.userLocationBinding.createMany({
        data: locationIds.map((locationId) => ({
          userId: target.user.id,
          companyId: target.companyId,
          locationId,
        })),
        skipDuplicates: true,
      });
    });

    return this.buildLocationBindingsResponse(target);
  }

  async removeLocationBindings(ctx: ActorContext & { userId: string; locationIds: string[]; clientCompanyId?: string }) {
    const target = await this.resolveTargetUserForManagement(ctx, { requireUsersManage: true, allowSelf: false });
    const locationIds = this.normalizeIdList(ctx.locationIds, 'locationIds');
    const clientCompanyId = await this.resolveAllowedClientCompanyId(target.company, locationIds, ctx.clientCompanyId);
    await this.assertLocationsAllowedForClient(locationIds, clientCompanyId);

    const remaining = await this.prisma.userLocationBinding.count({
      where: {
        userId: target.user.id,
        companyId: target.companyId,
        location: { clientCompanyId },
        locationId: { notIn: locationIds },
      },
    });
    if (remaining === 0) {
      throw new ConflictException(
        'Removing the last location binding is blocked in V1A because no-binding currently means tenant-wide access.',
      );
    }

    await this.prisma.userLocationBinding.deleteMany({
      where: {
        userId: target.user.id,
        companyId: target.companyId,
        locationId: { in: locationIds },
      },
    });

    return this.buildLocationBindingsResponse(target);
  }

  async getClientContours(ctx: ActorContext) {
    const targetCompany = await this.resolveCompanyForContour(ctx);
    const contours = await this.listAvailableClientContoursForCompany(targetCompany);
    return {
      company: targetCompany,
      contours,
      count: contours.length,
    };
  }

  async getAccessPreview(ctx: ActorContext & { userId: string }) {
    const target = await this.resolveTargetUserForManagement(ctx, { requireUsersManage: true, allowSelf: true });
    const effective = await this.buildEffectivePermissionsResponse(target.company, target.user);
    const locationBindingState = await this.loadEffectiveLocationBindingState(target);
    const locationBindings = locationBindingState.effective;
    const contours = await this.listAvailableClientContoursForCompany(target.company);
    const constructorLocationScope = this.buildConstructorPreviewLocationScope(locationBindings);
    const accessibleCompanyIds = constructorLocationScope.mode === 'restricted_empty'
      ? []
      : this.estimateAccessibleCompanyIds(target.company, contours);
    const accessibleLocationCount = this.estimateAccessibleLocationCount(locationBindings);

    return {
      company: target.company,
      user: target.user,
      baseRole: target.user.role,
      companyType: target.company.type,
      permissions: {
        effectiveCodes: effective.permissions.codes.effective,
        roleCodes: effective.permissions.codes.role,
        userAdditiveOverrideCodes: effective.permissions.codes.overrides,
      },
      locationBindings: {
        mode: constructorLocationScope.mode,
        selected: locationBindings,
        selectedCount: locationBindings.length,
        stale: locationBindingState.stale,
        staleCount: locationBindingState.stale.length,
        emptyBindingSemantics:
          locationBindings.length === 0
            ? 'RESTRICTED_EMPTY_SCOPE; constructor preview is fail-closed and does not estimate tenant-wide access'
            : 'BOUND_LOCATIONS',
      },
      availableLinkedClientContours: contours,
      estimates: {
        accessibleCompanyCount: accessibleCompanyIds.length,
        accessibleLocationCount,
      },
      ticketVisibilityMode: this.estimateTicketVisibilityMode({
        role: target.user.role,
        companyType: target.company.type,
        contours,
        effectiveCodes: effective.permissions.codes.effective,
        locationBindingCount: locationBindings.length,
      }),
    };
  }

  private async buildEffectivePermissionsResponse(company: CompanySummary, user: ReadableUser) {
    const data = await this.loadPermissionContext([{ id: user.id, role: user.role, companyType: company.type }]);
    const roleCodes = data.roleCodesByUser.get(user.id) ?? [];
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

  private async resolveCompanyForContour(ctx: ActorContext): Promise<CompanySummary> {
    if (ctx.actorRole !== UserRole.PLATFORM_ADMIN && ctx.actorRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only ADMIN and PLATFORM_ADMIN can read client contours');
    }

    const companyId =
      ctx.actorRole === UserRole.PLATFORM_ADMIN && ctx.requestedCompanyId?.trim()
        ? ctx.requestedCompanyId.trim()
        : ctx.actorCompanyId;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, type: true },
    });
    if (!company) throw new NotFoundException('Company not found');

    if (ctx.actorRole === UserRole.ADMIN) {
      await this.assertActorHasUsersManage(ctx);
    }

    return company;
  }

  private async resolveTargetUserForManagement(
    ctx: ActorContext & { userId: string },
    opts: { requireUsersManage: boolean; allowSelf: boolean },
  ): Promise<TargetUserContext> {
    if (ctx.actorRole !== UserRole.PLATFORM_ADMIN && ctx.actorRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only ADMIN and PLATFORM_ADMIN can manage user access');
    }
    if (!opts.allowSelf && ctx.actorId === ctx.userId) {
      throw new ForbiddenException('Self access changes are not allowed');
    }
    if (opts.requireUsersManage && ctx.actorRole === UserRole.ADMIN) {
      await this.assertActorHasUsersManage(ctx);
    }

    if (ctx.actorRole === UserRole.PLATFORM_ADMIN) {
      const requestedCompanyId = ctx.requestedCompanyId?.trim() || null;
      const userWithCompany = await this.prisma.user.findFirst({
        where: {
          id: ctx.userId,
          deletedAt: null,
          ...(requestedCompanyId ? { companyId: requestedCompanyId } : {}),
        },
        select: {
          ...UsersPolicy.selectPublicUser(),
          company: {
            select: { id: true, name: true, type: true },
          },
        },
      });
      if (!userWithCompany) throw new NotFoundException('User not found');

      const { company, ...user } = userWithCompany;

      return {
        companyId: company.id,
        company,
        user,
        isObserverScope: company.id !== ctx.actorCompanyId,
      };
    }

    const company = await this.prisma.company.findUnique({
      where: { id: ctx.actorCompanyId },
      select: { id: true, name: true, type: true },
    });
    if (!company) throw new NotFoundException('Company not found');

    const user = await this.findUserInScope(ctx.actorCompanyId, ctx.userId);
    if (user.role === UserRole.PLATFORM_ADMIN) {
      throw new ForbiddenException('PLATFORM_ADMIN cannot be managed from tenant access flow');
    }

    return {
      companyId: ctx.actorCompanyId,
      company,
      user,
      isObserverScope: false,
    };
  }

  private async findUserInScope(companyId: string, userId: string): Promise<ReadableUser> {
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

  private async assertCanManageUserPermissions(ctx: ActorContext & { userId: string }, codes: string[]) {
    const target = await this.resolveTargetUserForManagement(ctx, { requireUsersManage: true, allowSelf: false });
    const codeToId = await this.validatePermissionCodes(codes);

    if (ctx.actorRole === UserRole.ADMIN) {
      const actorCodes = await this.loadEffectiveCodesForUser({
        userId: ctx.actorId,
        companyId: ctx.actorCompanyId,
      });
      const missing = codes.filter((code) => !actorCodes.includes(code));
      if (missing.length > 0) {
        throw new ForbiddenException(`Cannot manage permissions the acting ADMIN does not have: ${missing.join(', ')}`);
      }
    }

    return { target, codeToId };
  }

  private async assertActorHasUsersManage(ctx: ActorContext) {
    const effective = await this.loadEffectiveCodesForUser({
      userId: ctx.actorId,
      companyId: ctx.actorCompanyId,
    });
    if (!effective.includes(PERMISSIONS.USERS_MANAGE)) {
      throw new ForbiddenException(`Missing permission: ${PERMISSIONS.USERS_MANAGE}`);
    }
  }

  private async loadEffectiveCodesForUser(params: { userId: string; companyId: string }) {
    const user = await this.prisma.user.findFirst({
      where: { id: params.userId, companyId: params.companyId, deletedAt: null },
      select: UsersPolicy.selectPublicUser(),
    });
    if (!user) throw new NotFoundException('User not found');

    const company = await this.prisma.company.findUnique({
      where: { id: params.companyId },
      select: { id: true, name: true, type: true },
    });
    if (!company) throw new NotFoundException('Company not found');

    const data = await this.loadPermissionContext([{ id: user.id, role: user.role, companyType: company.type }]);
    return this.combineCodes(data.roleCodesByUser.get(user.id) ?? [], data.overrideCodesByUser.get(user.id) ?? []);
  }

  private async assertAccessManagementContinuityAfterPermissionRemoval(target: TargetUserContext, removedCodes: string[]) {
    if (!removedCodes.includes(PERMISSIONS.USERS_MANAGE)) return;
    if (target.user.role !== UserRole.ADMIN || !target.user.isActive) return;

    const data = await this.loadPermissionContext([
      { id: target.user.id, role: target.user.role, companyType: target.company.type },
    ]);
    const roleCodes = data.roleCodesByUser.get(target.user.id) ?? [];
    const overrideCodes = data.overrideCodesByUser.get(target.user.id) ?? [];
    const afterRemovalOverrides = overrideCodes.filter((code) => !removedCodes.includes(code));
    const targetKeepsUsersManage = this.combineCodes(roleCodes, afterRemovalOverrides).includes(PERMISSIONS.USERS_MANAGE);
    if (targetKeepsUsersManage) return;

    const otherAdmins = await this.prisma.user.findMany({
      where: {
        companyId: target.companyId,
        role: UserRole.ADMIN,
        isActive: true,
        deletedAt: null,
        id: { not: target.user.id },
      },
      select: UsersPolicy.selectPublicUser(),
    });
    if (otherAdmins.length === 0) {
      throw new ConflictException('Cannot remove USERS_MANAGE from the last active admin with user-management capability');
    }

    const otherData = await this.loadPermissionContext(
      otherAdmins.map((admin) => ({ id: admin.id, role: admin.role, companyType: target.company.type })),
    );
    const hasOtherManager = otherAdmins.some((admin) =>
      this.combineCodes(
        otherData.roleCodesByUser.get(admin.id) ?? [],
        otherData.overrideCodesByUser.get(admin.id) ?? [],
      ).includes(PERMISSIONS.USERS_MANAGE),
    );
    if (!hasOtherManager) {
      throw new ConflictException('Cannot remove USERS_MANAGE from the last active admin with user-management capability');
    }
  }

  private async validatePermissionCodes(codes: string[]) {
    const blocks = await this.prisma.permissionBlock.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true },
    });
    const found = new Set(blocks.map((block) => block.code));
    const missing = codes.filter((code) => !found.has(code));
    if (missing.length > 0) {
      throw new BadRequestException(`Unknown permission code: ${missing.join(', ')}`);
    }
    return new Map(blocks.map((block) => [block.code, block.id]));
  }

  private async loadPermissionContext(users: PermissionContextUser[]): Promise<LoadedPermissionContext> {
    const uniqueUsers = Array.from(new Map(users.map((user) => [user.id, user])).values());
    const roleValues = Array.from(new Set(uniqueUsers.map((user) => user.role)));
    const companyTypes = Array.from(new Set(uniqueUsers.map((user) => user.companyType)));
    const userIds = uniqueUsers.map((user) => user.id);

    const [blocks, roleGrants, userGrants] = await Promise.all([
      this.prisma.permissionBlock.findMany({
        orderBy: [{ code: 'asc' }],
        select: { code: true, name: true, description: true },
      }),
      roleValues.length
        ? this.prisma.rolePermission.findMany({
            where: {
              role: { in: roleValues },
              OR: [{ companyType: { in: companyTypes } }, { companyType: null }],
            },
            select: {
              role: true,
              companyType: true,
              permissionBlock: { select: { code: true, name: true, description: true } },
            },
          })
        : Promise.resolve([] as Array<{ role: UserRole; companyType: CompanyType | null; permissionBlock: PermissionMeta }>),
      userIds.length
        ? this.prisma.userPermission.findMany({
            where: { userId: { in: userIds } },
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

    const roleCodesByKey = new Map<string, string[]>();
    for (const grant of roleGrants) {
      const key = this.roleGrantKey(grant.role, grant.companyType);
      const codes = roleCodesByKey.get(key) || [];
      codes.push(grant.permissionBlock.code);
      roleCodesByKey.set(key, codes);
      if (!blockByCode.has(grant.permissionBlock.code)) {
        blockByCode.set(grant.permissionBlock.code, {
          code: grant.permissionBlock.code,
          name: grant.permissionBlock.name,
          description: grant.permissionBlock.description || null,
        });
      }
    }

    const roleCodesByUser = new Map<string, string[]>();
    for (const user of uniqueUsers) {
      roleCodesByUser.set(
        user.id,
        this.combineCodes(
          roleCodesByKey.get(this.roleGrantKey(user.role, null)) ?? [],
          roleCodesByKey.get(this.roleGrantKey(user.role, user.companyType)) ?? [],
        ),
      );
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

    for (const userId of userIds) {
      if (!overrideCodesByUser.has(userId)) overrideCodesByUser.set(userId, []);
      if (!roleCodesByUser.has(userId)) roleCodesByUser.set(userId, []);
    }

    return {
      blockByCode,
      roleCodesByUser,
      overrideCodesByUser: new Map(
        Array.from(overrideCodesByUser.entries()).map(([userId, codes]) => [userId, Array.from(new Set(codes)).sort()]),
      ),
    };
  }

  private roleGrantKey(role: UserRole, companyType: CompanyType | null) {
    return `${role}:${companyType ?? 'ANY'}`;
  }

  private buildListEntry(
    user: ReadableUser,
    data: LoadedPermissionContext,
    userId: string,
  ) {
    const roleCodes = data.roleCodesByUser.get(userId) || [];
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

  private normalizeCodeList(codes: string[]) {
    const normalized = Array.from(
      new Set(
        (codes ?? [])
          .map((code) => (typeof code === 'string' ? code.trim() : ''))
          .filter((code) => code.length > 0),
      ),
    );
    if (normalized.length === 0) throw new BadRequestException('codes must be a non-empty array');
    return normalized;
  }

  private normalizeIdList(values: string[], label: string) {
    const normalized = Array.from(
      new Set(
        (values ?? [])
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter((value) => value.length > 0),
      ),
    );
    if (normalized.length === 0) throw new BadRequestException(`${label} must be a non-empty array`);
    return normalized;
  }

  private normalizeIdListAllowEmpty(values: string[]) {
    return Array.from(
      new Set(
        (values ?? [])
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter((value) => value.length > 0),
      ),
    );
  }

  private async resolveAllowedClientCompanyId(company: CompanySummary, locationIds: string[], requestedClientCompanyId?: string) {
    const requested = requestedClientCompanyId?.trim() || null;
    const allowedContours = await this.listAvailableClientContoursForCompany(company);
    const allowedClientIds = new Set(allowedContours.map((contour) => contour.id));

    if (requested) {
      if (!allowedClientIds.has(requested)) {
        throw new ForbiddenException('Client contour is not available to the target company');
      }
      return requested;
    }

    if (company.type === CompanyType.CLIENT) {
      return company.id;
    }

    const locations = await this.prisma.location.findMany({
      where: { id: { in: locationIds }, deletedAt: null },
      select: { clientCompanyId: true },
    });
    const inferred = Array.from(new Set(locations.map((location) => location.clientCompanyId)));
    if (inferred.length !== 1) {
      throw new BadRequestException('clientCompanyId is required when locations span multiple client contours');
    }
    if (!allowedClientIds.has(inferred[0])) {
      throw new ForbiddenException('Client contour is not available to the target company');
    }
    return inferred[0];
  }

  private async assertLocationsAllowedForClient(locationIds: string[], clientCompanyId: string) {
    const locations = await this.prisma.location.findMany({
      where: {
        id: { in: locationIds },
        clientCompanyId,
        deletedAt: null,
      },
      select: { id: true },
    });
    const found = new Set(locations.map((location) => location.id));
    const missing = locationIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new ForbiddenException(`Locations are outside the allowed client contour: ${missing.join(', ')}`);
    }
  }

  private async buildLocationBindingsResponse(target: TargetUserContext) {
    const bindingState = await this.loadEffectiveLocationBindingState(target);
    const bindings = bindingState.effective;
    return {
      company: target.company,
      user: target.user,
      bindings,
      count: bindings.length,
      staleBindings: bindingState.stale,
      staleCount: bindingState.stale.length,
      emptyBindingSemantics:
        bindings.length === 0
          ? 'RESTRICTED_EMPTY_SCOPE; constructor read/preview is fail-closed and does not treat no bindings as tenant-wide'
          : 'BOUND_LOCATIONS',
    };
  }

  private async loadEffectiveLocationBindingState(target: TargetUserContext) {
    const [bindings, contours] = await Promise.all([
      this.loadLocationBindings(target),
      this.listAvailableClientContoursForCompany(target.company),
    ]);
    const activeClientIds = new Set(contours.map((contour) => contour.id));
    const effective: LocationBindingRecord[] = [];
    const stale: LocationBindingRecord[] = [];

    for (const binding of bindings) {
      const isActiveBinding =
        activeClientIds.has(binding.location.clientCompanyId) &&
        binding.location.deletedAt === null;
      if (isActiveBinding) {
        effective.push(binding);
      } else {
        stale.push(binding);
      }
    }

    return { effective, stale };
  }

  private async loadLocationBindings(target: TargetUserContext): Promise<LocationBindingRecord[]> {
    return this.prisma.userLocationBinding.findMany({
      where: {
        userId: target.user.id,
        companyId: target.companyId,
      },
      select: {
        id: true,
        companyId: true,
        locationId: true,
        createdAt: true,
        location: {
          select: {
            id: true,
            clientCompanyId: true,
            name: true,
            platformCode: true,
            city: true,
            region: true,
            address: true,
            isActive: true,
            deletedAt: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  private async listAvailableClientContoursForCompany(company: CompanySummary): Promise<AvailableClientContour[]> {
    if (company.type === CompanyType.CLIENT) {
      return [
        {
          id: company.id,
          name: company.name,
          type: CompanyType.CLIENT,
          serviceContractId: null,
          role: 'OWN_CLIENT',
          status: 'ACTIVE',
        },
      ];
    }

    const linked = await this.serviceContractsService.listLinkedClients(company.id);
    return linked.map((contract: any) => ({
      id: contract.linkedClientCompanyId ?? contract.clientCompany?.id ?? contract.id,
      name: contract.name ?? contract.clientCompany?.name ?? 'Client company',
      type: CompanyType.CLIENT,
      serviceContractId: contract.serviceContractId ?? contract.id,
      role: contract.role ?? contract.type,
      status: contract.status ?? 'ACTIVE',
    }));
  }

  private estimateAccessibleCompanyIds(company: CompanySummary, contours: AvailableClientContour[]) {
    if (company.type === CompanyType.CLIENT) return [company.id];
    return Array.from(new Set([company.id, ...contours.map((contour) => contour.id)]));
  }

  private estimateAccessibleLocationCount(locationBindings: Array<{ locationId: string }>) {
    if (locationBindings.length > 0) {
      return new Set(locationBindings.map((binding) => binding.locationId)).size;
    }
    return 0;
  }

  private buildConstructorPreviewLocationScope(locationBindings: Array<{ locationId: string }>) {
    if (locationBindings.length === 0) {
      return {
        mode: 'restricted_empty' as const,
        locationIds: [] as string[],
      };
    }

    return {
      mode: 'bound_locations' as const,
      locationIds: Array.from(new Set(locationBindings.map((binding) => binding.locationId))),
    };
  }

  private estimateTicketVisibilityMode(params: {
    role: UserRole;
    companyType: CompanyType;
    contours: AvailableClientContour[];
    effectiveCodes: string[];
    locationBindingCount: number;
  }) {
    if (params.locationBindingCount === 0) return 'restricted_empty_scope';
    if (params.role === UserRole.PLATFORM_ADMIN) return 'platform_observer';
    if (params.role === UserRole.TECHNICIAN && !params.effectiveCodes.includes(PERMISSIONS.TICKETS_VIEW_ALL_COMPANY)) {
      return params.locationBindingCount > 0 ? 'assigned_and_available_bound_locations' : 'assigned_and_available';
    }
    if (params.companyType === CompanyType.PROVIDER && params.contours.length > 0) {
      const hasPrimary = params.contours.some((contour) => contour.role === ServiceContractRole.PRIMARY);
      const hasSecondary = params.contours.some((contour) => contour.role === ServiceContractRole.SECONDARY);
      if (hasPrimary && hasSecondary) return 'provider_primary_and_secondary_operational';
      if (hasSecondary) return 'provider_secondary_operational';
      return 'provider_primary';
    }
    if (params.locationBindingCount > 0) return 'tenant_bound_locations';
    return 'tenant';
  }
}
