import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CompanyType, ServiceContractRole, UserAccessLocationMode, UserRole } from '@prisma/client';

import { PERMISSIONS } from '../common/permissions.constants';
import { PERMISSION_BLOCKS, ROLE_GRANTS } from '../common/permissions-matrix';
import {
  ConstructorLocationMode,
  interpretUserAccessLocationScope,
  isFailClosedLocationScope,
  resolveConstructorLocationMode,
} from '../common/user-access-scope-mode.utils';
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

type EffectiveLocationBindingState = {
  effective: LocationBindingRecord[];
  stale: LocationBindingRecord[];
  locationMode: ConstructorLocationMode;
  explicitLocationMode: UserAccessLocationMode | null;
};

type AccessSummaryContext = ActorContext & {
  q?: string;
  role?: string;
  status?: string;
  issue?: string;
  skip?: string;
  take?: string;
};

type DraftPreviewContext = ActorContext & {
  userId: string;
  additivePermissionCodes?: string[];
  locationIds?: string[];
  selectedClientContourIds?: string[];
};

type ReplaceAllLocationBindingsContext = ActorContext & {
  userId: string;
  groups: Array<{
    mode: 'REPLACE_SELECTED' | 'CLEAR_RESTRICTED_EMPTY' | 'NO_CHANGE';
    clientCompanyId?: string;
    locationIds?: string[];
  }>;
};

type LocationOptionsContext = ActorContext & {
  clientCompanyIds: string | string[];
};

const PRODUCT_PERMISSION_META: Record<string, {
  businessLabel: string;
  productDomain: string;
  riskLevel: 'low' | 'medium' | 'high';
  recommendedRoles: string[];
}> = {
  [PERMISSIONS.TICKETS_VIEW]: {
    businessLabel: 'Просмотр заявок',
    productDomain: 'Заявки',
    riskLevel: 'low',
    recommendedRoles: ['ADMIN', 'DISPATCHER', 'MASTER', 'TECHNICIAN', 'CLIENT'],
  },
  [PERMISSIONS.TICKETS_CREATE]: {
    businessLabel: 'Создание заявок',
    productDomain: 'Заявки',
    riskLevel: 'low',
    recommendedRoles: ['ADMIN', 'DISPATCHER', 'MASTER', 'TECHNICIAN', 'CLIENT'],
  },
  [PERMISSIONS.TICKETS_VIEW_AVAILABLE]: {
    businessLabel: 'Просмотр доступных заявок',
    productDomain: 'Заявки',
    riskLevel: 'medium',
    recommendedRoles: ['DISPATCHER', 'MASTER', 'TECHNICIAN'],
  },
  [PERMISSIONS.TICKETS_EDIT]: {
    businessLabel: 'Редактирование заявок',
    productDomain: 'Заявки',
    riskLevel: 'medium',
    recommendedRoles: ['ADMIN', 'DISPATCHER', 'MASTER'],
  },
  [PERMISSIONS.TICKETS_ASSIGN]: {
    businessLabel: 'Назначение исполнителей',
    productDomain: 'Заявки',
    riskLevel: 'medium',
    recommendedRoles: ['ADMIN', 'DISPATCHER', 'MASTER'],
  },
  [PERMISSIONS.TICKETS_CLAIM]: {
    businessLabel: 'Взять заявку в работу',
    productDomain: 'Заявки',
    riskLevel: 'low',
    recommendedRoles: ['TECHNICIAN', 'MASTER'],
  },
  [PERMISSIONS.TICKETS_STATUS_CHANGE]: {
    businessLabel: 'Изменение статуса заявки',
    productDomain: 'Заявки',
    riskLevel: 'medium',
    recommendedRoles: ['TECHNICIAN', 'DISPATCHER', 'MASTER'],
  },
  [PERMISSIONS.TICKETS_VIEW_ALL_COMPANY]: {
    businessLabel: 'Просмотр всех заявок компании',
    productDomain: 'Заявки',
    riskLevel: 'high',
    recommendedRoles: ['ADMIN', 'MASTER'],
  },
  [PERMISSIONS.USERS_MANAGE]: {
    businessLabel: 'Управление сотрудниками',
    productDomain: 'Сотрудники',
    riskLevel: 'high',
    recommendedRoles: ['ADMIN'],
  },
  [PERMISSIONS.LOCATIONS_VIEW]: {
    businessLabel: 'Просмотр объектов',
    productDomain: 'Объекты',
    riskLevel: 'low',
    recommendedRoles: ['ADMIN', 'DISPATCHER', 'MASTER', 'TECHNICIAN', 'CLIENT'],
  },
  [PERMISSIONS.LOCATIONS_MANAGE]: {
    businessLabel: 'Управление объектами',
    productDomain: 'Объекты',
    riskLevel: 'high',
    recommendedRoles: ['ADMIN', 'MASTER'],
  },
  [PERMISSIONS.ANALYTICS_VIEW]: {
    businessLabel: 'Просмотр аналитики',
    productDomain: 'Аналитика',
    riskLevel: 'medium',
    recommendedRoles: ['ADMIN', 'MASTER', 'NETWORK_DIRECTOR'],
  },
  [PERMISSIONS.COMPANY_SETTINGS_EDIT]: {
    businessLabel: 'Управление настройками компании',
    productDomain: 'Настройки',
    riskLevel: 'high',
    recommendedRoles: ['ADMIN'],
  },
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
      ...(PRODUCT_PERMISSION_META[b.code] ?? {}),
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

  async getAccessSummary(ctx: AccessSummaryContext) {
    if (ctx.actorRole === UserRole.PLATFORM_ADMIN && !ctx.requestedCompanyId?.trim()) {
      throw new BadRequestException('companyId is required for PLATFORM_ADMIN access summary');
    }
    if (ctx.actorRole === UserRole.ADMIN) {
      await this.assertActorHasUsersManage(ctx);
    }

    const { companyId, company } = await this.resolveReadableCompany(ctx);
    const users = await this.prisma.user.findMany({
      where: UsersPolicy.listWhere(companyId),
      select: UsersPolicy.selectPublicUser(),
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
    });
    const permissions = await this.loadPermissionContext(
      users.map((user) => ({ id: user.id, role: user.role, companyType: company.type })),
    );
    const contours = await this.listAvailableClientContoursForCompany(company);
    const bindingStateByUser = await this.loadEffectiveLocationBindingStateForUsers({
      companyId,
      company,
      users,
      contours,
    });

    let rows = await Promise.all(users.map(async (user) => {
      const roleCodes = permissions.roleCodesByUser.get(user.id) ?? [];
      const overrideCodes = permissions.overrideCodesByUser.get(user.id) ?? [];
      const effectiveCodes = this.combineCodes(roleCodes, overrideCodes);
      const bindingState = bindingStateByUser.get(user.id) ?? {
        effective: [],
        stale: [],
        locationMode: 'LEGACY_AUTO' as ConstructorLocationMode,
        explicitLocationMode: null,
      };
      const accessibleCompanyIds = this.estimateAccessibleCompanyIdsForMode({
        company,
        contours,
        locationBindings: bindingState.effective,
        locationMode: bindingState.locationMode,
      });
      const accessibleLocationCount = await this.estimateAccessibleLocationCountForMode({
        company,
        contours,
        locationBindings: bindingState.effective,
        locationMode: bindingState.locationMode,
      });
      const issueFlags = this.buildIssueFlags({
        effectiveLocationCount: bindingState.effective.length,
        staleBindingCount: bindingState.stale.length,
        overrideCodes,
        locationMode: bindingState.locationMode,
      });

      return {
        user,
        role: user.role,
        company,
        companyType: company.type,
        isActive: user.isActive,
        additiveOverrideCount: overrideCodes.length,
        effectiveLocationBindingCount: bindingState.effective.length,
        staleBindingCount: bindingState.stale.length,
        availableClientContourCount: contours.length,
        accessibleCompanyCount: accessibleCompanyIds.length,
        accessibleLocationCount,
        locationMode: bindingState.locationMode,
        ticketVisibilityMode: this.estimateTicketVisibilityMode({
          role: user.role,
          companyType: company.type,
          contours,
          effectiveCodes,
          locationBindingCount: bindingState.effective.length,
          locationMode: bindingState.locationMode,
        }),
        issueFlags,
        permissions: {
          roleCodes,
          overrideCodes,
          effectiveCodes,
        },
      };
    }));

    rows = this.filterAccessSummaryRows(rows, ctx);
    const total = rows.length;
    const skip = this.parseNonNegativeInt(ctx.skip, 0);
    const take = Math.min(this.parsePositiveInt(ctx.take, 100), 250);

    return {
      company,
      page: {
        total,
        skip,
        take,
      },
      users: rows.slice(skip, skip + take),
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
      throw new BadRequestException('locationIds must be a non-empty array for selected-location replacement');
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
      await tx.userLocationBinding.deleteMany({
        where: {
          userId: target.user.id,
          locationId: { in: locationIds },
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
      await tx.userAccessScope.upsert({
        where: { userId_companyId: { userId: target.user.id, companyId: target.companyId } },
        update: { locationMode: UserAccessLocationMode.SELECTED_LOCATIONS },
        create: {
          userId: target.user.id,
          companyId: target.companyId,
          locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
        },
      });
    });

    return this.buildLocationBindingsResponse(target);
  }

  async removeLocationBindings(ctx: ActorContext & { userId: string; locationIds: string[]; clientCompanyId?: string }) {
    const target = await this.resolveTargetUserForManagement(ctx, { requireUsersManage: true, allowSelf: false });
    const locationIds = this.normalizeIdList(ctx.locationIds, 'locationIds');
    const clientCompanyId = await this.resolveAllowedClientCompanyId(target.company, locationIds, ctx.clientCompanyId);
    await this.assertLocationsAllowedForClient(locationIds, clientCompanyId);

    await this.prisma.$transaction(async (tx) => {
      await tx.userLocationBinding.deleteMany({
        where: {
          userId: target.user.id,
          companyId: target.companyId,
          locationId: { in: locationIds },
        },
      });
      const remaining = await tx.userLocationBinding.count({
        where: {
          userId: target.user.id,
          companyId: target.companyId,
        },
      });
      await tx.userAccessScope.upsert({
        where: { userId_companyId: { userId: target.user.id, companyId: target.companyId } },
        update: {
          locationMode: remaining === 0
            ? UserAccessLocationMode.RESTRICTED_EMPTY
            : UserAccessLocationMode.SELECTED_LOCATIONS,
        },
        create: {
          userId: target.user.id,
          companyId: target.companyId,
          locationMode: remaining === 0
            ? UserAccessLocationMode.RESTRICTED_EMPTY
            : UserAccessLocationMode.SELECTED_LOCATIONS,
        },
      });
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
    const contours = await this.listAvailableClientContoursForCompany(target.company);
    return this.buildAccessPreviewPayload({
      target,
      roleCodes: effective.permissions.codes.role,
      overrideCodes: effective.permissions.codes.overrides,
      locationBindings: locationBindingState.effective,
      staleBindings: locationBindingState.stale,
      locationMode: locationBindingState.locationMode,
      contours,
    });
  }

  async previewDraft(ctx: DraftPreviewContext) {
    const target = await this.resolveTargetUserForManagement(ctx, { requireUsersManage: true, allowSelf: false });
    const currentEffective = await this.buildEffectivePermissionsResponse(target.company, target.user);
    const currentBindingState = await this.loadEffectiveLocationBindingState(target);
    const contours = await this.listAvailableClientContoursForCompany(target.company);

    const proposedOverrideCodes = ctx.additivePermissionCodes === undefined
      ? currentEffective.permissions.codes.overrides
      : this.normalizeCodeListAllowEmpty(ctx.additivePermissionCodes);
    const changedPermissionCodes = this.combineCodes(currentEffective.permissions.codes.overrides, proposedOverrideCodes);
    if (changedPermissionCodes.length > 0) {
      await this.validatePermissionCodes(changedPermissionCodes);
      if (ctx.actorRole === UserRole.ADMIN) {
        const actorCodes = await this.loadEffectiveCodesForUser({
          userId: ctx.actorId,
          companyId: ctx.actorCompanyId,
        });
        const missing = changedPermissionCodes.filter((code) => !actorCodes.includes(code));
        if (missing.length > 0) {
          throw new ForbiddenException(`Cannot manage permissions the acting ADMIN does not have: ${missing.join(', ')}`);
        }
      }
    }

    const removedCodes = currentEffective.permissions.codes.overrides.filter((code) => !proposedOverrideCodes.includes(code));
    await this.assertAccessManagementContinuityAfterPermissionRemoval(target, removedCodes);

    const requestedClientIds = this.normalizeIdListAllowEmpty(ctx.selectedClientContourIds ?? []);
    const allowedClientIds = new Set(contours.map((contour) => contour.id));
    const unavailableClientIds = requestedClientIds.filter((clientId) => !allowedClientIds.has(clientId));
    if (unavailableClientIds.length > 0) {
      throw new ForbiddenException(`Client contours are not available: ${unavailableClientIds.join(', ')}`);
    }

    const draftLocationResult = await this.resolveDraftLocationBindings({
      target,
      contours,
      requestedLocationIds: ctx.locationIds,
      selectedClientContourIds: requestedClientIds,
      fallbackLocationBindings: currentBindingState.effective,
      fallbackLocationMode: currentBindingState.locationMode,
    });
    const proposedPreview = await this.buildAccessPreviewPayload({
      target,
      roleCodes: currentEffective.permissions.codes.role,
      overrideCodes: proposedOverrideCodes,
      locationBindings: draftLocationResult.locationBindings,
      staleBindings: currentBindingState.stale,
      locationMode: draftLocationResult.locationMode,
      contours,
    });
    const currentPreview = await this.buildAccessPreviewPayload({
      target,
      roleCodes: currentEffective.permissions.codes.role,
      overrideCodes: currentEffective.permissions.codes.overrides,
      locationBindings: currentBindingState.effective,
      staleBindings: currentBindingState.stale,
      locationMode: currentBindingState.locationMode,
      contours,
    });
    const saveBlockers = [...draftLocationResult.saveBlockers];

    return {
      company: target.company,
      user: target.user,
      current: {
        additiveOverrideCount: currentEffective.permissions.codes.overrides.length,
        locationCount: currentPreview.estimates.accessibleLocationCount,
        companyCount: currentPreview.estimates.accessibleCompanyCount,
        ticketVisibilityMode: currentPreview.ticketVisibilityMode,
      },
      proposed: {
        additiveOverrideCount: proposedOverrideCodes.length,
        locationCount: proposedPreview.estimates.accessibleLocationCount,
        companyCount: proposedPreview.estimates.accessibleCompanyCount,
        ticketVisibilityMode: proposedPreview.ticketVisibilityMode,
      },
      addedCapabilities: proposedOverrideCodes.filter((code) => !currentEffective.permissions.codes.overrides.includes(code)),
      removedCapabilities: removedCodes,
      invalidSelections: draftLocationResult.invalidSelections,
      warnings: this.buildDraftWarnings({
        proposedOverrideCodes,
        locationCount: proposedPreview.estimates.accessibleLocationCount,
        staleBindingCount: currentBindingState.stale.length,
        invalidSelectionCount: draftLocationResult.invalidSelections.length,
      }),
      saveRejected: saveBlockers.length > 0,
      saveBlockers,
      preview: proposedPreview,
    };
  }

  async replaceAllLocationBindings(ctx: ReplaceAllLocationBindingsContext) {
    const target = await this.resolveTargetUserForManagement(ctx, { requireUsersManage: true, allowSelf: false });
    if (!Array.isArray(ctx.groups) || ctx.groups.length === 0) {
      throw new BadRequestException('groups must be a non-empty array');
    }

    const clearRestrictedEmpty = ctx.groups.filter((group) => group.mode === 'CLEAR_RESTRICTED_EMPTY');
    if (clearRestrictedEmpty.length > 0) {
      if (clearRestrictedEmpty.length !== ctx.groups.length) {
        throw new BadRequestException('CLEAR_RESTRICTED_EMPTY cannot be mixed with selected-location replacement');
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.userLocationBinding.deleteMany({
          where: {
            userId: target.user.id,
            companyId: target.companyId,
          },
        });
        await tx.userAccessScope.upsert({
          where: { userId_companyId: { userId: target.user.id, companyId: target.companyId } },
          update: { locationMode: UserAccessLocationMode.RESTRICTED_EMPTY },
          create: {
            userId: target.user.id,
            companyId: target.companyId,
            locationMode: UserAccessLocationMode.RESTRICTED_EMPTY,
          },
        });
      });
      return this.buildLocationBindingsResponse(target);
    }

    const seenClientIds = new Set<string>();
    const replacements: Array<{ clientCompanyId: string; locationIds: string[] }> = [];

    for (const group of ctx.groups) {
      if (group.mode === 'NO_CHANGE') continue;
      const locationIds = this.normalizeIdList(group.locationIds ?? [], 'locationIds');
      const clientCompanyId = await this.resolveAllowedClientCompanyId(target.company, locationIds, group.clientCompanyId);
      if (seenClientIds.has(clientCompanyId)) {
        throw new BadRequestException(`Duplicate replacement group for clientCompanyId: ${clientCompanyId}`);
      }
      seenClientIds.add(clientCompanyId);
      await this.assertLocationsAllowedForClient(locationIds, clientCompanyId);
      replacements.push({ clientCompanyId, locationIds });
    }

    if (replacements.length === 0) {
      return this.buildLocationBindingsResponse(target);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const replacement of replacements) {
        await tx.userLocationBinding.deleteMany({
          where: {
            userId: target.user.id,
            companyId: target.companyId,
            location: { clientCompanyId: replacement.clientCompanyId },
          },
        });
        await tx.userLocationBinding.deleteMany({
          where: {
            userId: target.user.id,
            locationId: { in: replacement.locationIds },
          },
        });
        await tx.userLocationBinding.createMany({
          data: replacement.locationIds.map((locationId) => ({
            userId: target.user.id,
            companyId: target.companyId,
            locationId,
          })),
          skipDuplicates: true,
        });
      }
      await tx.userAccessScope.upsert({
        where: { userId_companyId: { userId: target.user.id, companyId: target.companyId } },
        update: { locationMode: UserAccessLocationMode.SELECTED_LOCATIONS },
        create: {
          userId: target.user.id,
          companyId: target.companyId,
          locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
        },
      });
    });

    return this.buildLocationBindingsResponse(target);
  }

  async getLocationOptions(ctx: LocationOptionsContext) {
    const targetCompany = await this.resolveCompanyForContour(ctx);
    const contours = await this.listAvailableClientContoursForCompany(targetCompany);
    const contourById = new Map(contours.map((contour) => [contour.id, contour]));
    const requestedClientIds = this.normalizeQueryIdList(ctx.clientCompanyIds);
    if (requestedClientIds.length === 0) {
      throw new BadRequestException('clientCompanyIds must be a non-empty list');
    }
    const forbiddenClientIds = requestedClientIds.filter((clientId) => !contourById.has(clientId));
    if (forbiddenClientIds.length > 0) {
      throw new ForbiddenException(`Client contours are not available: ${forbiddenClientIds.join(', ')}`);
    }

    const locations = await this.prisma.location.findMany({
      where: {
        clientCompanyId: { in: requestedClientIds },
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        clientCompanyId: true,
        name: true,
        platformCode: true,
        city: true,
        region: true,
        address: true,
        isActive: true,
      },
      orderBy: [{ clientCompanyId: 'asc' }, { city: 'asc' }, { name: 'asc' }],
    });

    return {
      company: targetCompany,
      clients: requestedClientIds.map((clientId) => {
        const contour = contourById.get(clientId)!;
        const clientLocations = locations.filter((location) => location.clientCompanyId === clientId);
        const cityNames = Array.from(new Set(clientLocations.map((location) => location.city || 'Город не указан'))).sort();
        return {
          client: contour,
          cities: cityNames.map((city) => ({
            city,
            locations: clientLocations
              .filter((location) => (location.city || 'Город не указан') === city)
              .map((location) => ({
                id: location.id,
                displayName: location.name || location.platformCode,
                name: location.name,
                platformCode: location.platformCode,
                address: location.address,
                region: location.region,
                active: location.isActive,
                available: true,
              })),
          })),
        };
      }),
    };
  }

  private async buildAccessPreviewPayload(params: {
    target: TargetUserContext;
    roleCodes: string[];
    overrideCodes: string[];
    locationBindings: LocationBindingRecord[];
    staleBindings: LocationBindingRecord[];
    locationMode: ConstructorLocationMode;
    contours: AvailableClientContour[];
  }) {
    const effectiveCodes = this.combineCodes(params.roleCodes, params.overrideCodes);
    const constructorLocationScope = this.buildConstructorPreviewLocationScope(params.locationBindings, params.locationMode);
    const accessibleCompanyIds = this.estimateAccessibleCompanyIdsForMode({
      company: params.target.company,
      contours: params.contours,
      locationBindings: params.locationBindings,
      locationMode: params.locationMode,
    });
    const accessibleLocationCount = await this.estimateAccessibleLocationCountForMode({
      company: params.target.company,
      contours: params.contours,
      locationBindings: params.locationBindings,
      locationMode: params.locationMode,
    });

    return {
      company: params.target.company,
      user: params.target.user,
      baseRole: params.target.user.role,
      companyType: params.target.company.type,
      permissions: {
        effectiveCodes,
        roleCodes: params.roleCodes,
        userAdditiveOverrideCodes: params.overrideCodes,
      },
      locationBindings: {
        mode: constructorLocationScope.mode,
        locationMode: params.locationMode,
        explicitMode: params.locationMode === 'LEGACY_AUTO' ? null : params.locationMode,
        selected: params.locationBindings,
        selectedCount: params.locationBindings.length,
        stale: params.staleBindings,
        staleCount: params.staleBindings.length,
        emptyBindingSemantics:
          params.locationBindings.length === 0
            ? params.locationMode === 'LEGACY_AUTO'
              ? 'LEGACY_AUTO_SCOPE; no explicit access scope row exists'
              : params.locationMode === 'RESTRICTED_EMPTY'
              ? 'RESTRICTED_EMPTY_SCOPE; explicit empty access is fail-closed'
              : 'SELECTED_LOCATIONS_SCOPE; no selected locations is fail-closed'
            : 'BOUND_LOCATIONS',
      },
      availableLinkedClientContours: params.contours,
      estimates: {
        accessibleCompanyCount: accessibleCompanyIds.length,
        accessibleLocationCount,
      },
      ticketVisibilityMode: this.estimateTicketVisibilityMode({
        role: params.target.user.role,
        companyType: params.target.company.type,
        contours: params.contours,
        effectiveCodes,
        locationBindingCount: params.locationBindings.length,
        locationMode: params.locationMode,
      }),
    };
  }

  private async loadEffectiveLocationBindingStateForUsers(params: {
    companyId: string;
    company: CompanySummary;
    users: ReadableUser[];
    contours: AvailableClientContour[];
  }) {
    const userIds = params.users.map((user) => user.id);
    const bindings = userIds.length
      ? await this.prisma.userLocationBinding.findMany({
          where: {
            userId: { in: userIds },
            companyId: params.companyId,
          },
          select: {
            id: true,
            companyId: true,
            locationId: true,
            createdAt: true,
            userId: true,
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
        })
      : [];
    const accessScopes = userIds.length
      ? await this.prisma.userAccessScope.findMany({
          where: {
            userId: { in: userIds },
            companyId: params.companyId,
          },
          select: {
            userId: true,
            locationMode: true,
          },
        })
      : [];
    const explicitModeByUser = new Map(accessScopes.map((scope) => [scope.userId, scope.locationMode]));
    const activeClientIds = new Set(params.contours.map((contour) => contour.id));
    const out = new Map<string, EffectiveLocationBindingState>();
    for (const user of params.users) {
      const explicitLocationMode = explicitModeByUser.get(user.id) ?? null;
      out.set(user.id, {
        effective: [],
        stale: [],
        locationMode: explicitLocationMode ?? 'LEGACY_AUTO',
        explicitLocationMode,
      });
    }

    for (const binding of bindings as Array<LocationBindingRecord & { userId: string }>) {
      const target = out.get(binding.userId);
      if (!target) continue;
      const record: LocationBindingRecord = {
        id: binding.id,
        companyId: binding.companyId,
        locationId: binding.locationId,
        createdAt: binding.createdAt,
        location: binding.location,
      };
      const isActiveBinding =
        activeClientIds.has(record.location.clientCompanyId) &&
        record.location.deletedAt === null;
      if (isActiveBinding && target.explicitLocationMode !== UserAccessLocationMode.RESTRICTED_EMPTY) {
        target.effective.push(record);
      }
      else target.stale.push(record);
    }
    for (const state of out.values()) {
      state.locationMode = resolveConstructorLocationMode({
        explicitLocationMode: state.explicitLocationMode,
        effectiveLocationCount: state.effective.length,
        staleLocationCount: state.stale.length,
      });
      if (state.locationMode === 'RESTRICTED_EMPTY') {
        state.effective = [];
      }
    }
    return out;
  }

  private filterAccessSummaryRows<T extends {
    user: ReadableUser;
    role: UserRole;
    issueFlags: string[];
  }>(rows: T[], ctx: AccessSummaryContext): T[] {
    const q = (ctx.q || '').trim().toLowerCase();
    const role = (ctx.role || '').trim();
    const status = (ctx.status || '').trim();
    const issue = (ctx.issue || '').trim();
    return rows.filter((row) => {
      if (q) {
        const haystack = [
          row.user.email,
          row.user.firstName,
          row.user.lastName,
          row.user.phone,
          row.user.role,
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (role && row.role !== role) return false;
      if (status === 'active' && !row.user.isActive) return false;
      if (status === 'inactive' && row.user.isActive) return false;
      if (issue && !row.issueFlags.includes(issue)) return false;
      return true;
    });
  }

  private buildIssueFlags(params: {
    effectiveLocationCount: number;
    staleBindingCount: number;
    overrideCodes: string[];
    locationMode: ConstructorLocationMode;
  }) {
    const flags: string[] = [];
    if (
      params.locationMode === 'RESTRICTED_EMPTY' ||
      (params.locationMode === 'SELECTED_LOCATIONS' && params.effectiveLocationCount === 0)
    ) {
      flags.push('no_locations', 'restricted_empty');
    }
    if (params.staleBindingCount > 0) flags.push('stale_bindings');
    if (params.overrideCodes.length > 0 || this.hasElevatedPermission(params.overrideCodes)) flags.push('elevated_overrides');
    return Array.from(new Set(flags));
  }

  private hasElevatedPermission(codes: string[]) {
    return codes.some((code) => PRODUCT_PERMISSION_META[code]?.riskLevel === 'high');
  }

  private parseNonNegativeInt(value: string | undefined, fallback: number) {
    const parsed = Number.parseInt(value ?? '', 10);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return parsed;
  }

  private parsePositiveInt(value: string | undefined, fallback: number) {
    const parsed = Number.parseInt(value ?? '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
  }

  private normalizeCodeListAllowEmpty(codes: string[] | undefined) {
    return Array.from(
      new Set(
        (codes ?? [])
          .map((code) => (typeof code === 'string' ? code.trim() : ''))
          .filter((code) => code.length > 0),
      ),
    );
  }

  private normalizeQueryIdList(value: string | string[] | undefined) {
    const raw = Array.isArray(value) ? value.flatMap((item) => item.split(',')) : (value ?? '').split(',');
    return this.normalizeIdListAllowEmpty(raw);
  }

  private async resolveDraftLocationBindings(params: {
    target: TargetUserContext;
    contours: AvailableClientContour[];
    requestedLocationIds?: string[];
    selectedClientContourIds: string[];
    fallbackLocationBindings: LocationBindingRecord[];
    fallbackLocationMode: ConstructorLocationMode;
  }) {
    if (params.requestedLocationIds === undefined) {
      return {
        locationBindings: params.fallbackLocationBindings,
        invalidSelections: [] as string[],
        saveBlockers: [] as Array<{ code: string; message: string; minimumMigration?: string }>,
        locationMode: params.fallbackLocationMode,
      };
    }

    const requestedLocationIds = this.normalizeIdListAllowEmpty(params.requestedLocationIds);
    if (requestedLocationIds.length === 0) {
      return {
        locationBindings: [] as LocationBindingRecord[],
        invalidSelections: [] as string[],
        saveBlockers: [] as Array<{ code: string; message: string; minimumMigration?: string }>,
        locationMode: 'RESTRICTED_EMPTY' as ConstructorLocationMode,
      };
    }

    const allowedClientIds = new Set(params.contours.map((contour) => contour.id));
    const selectedClientIds = new Set(params.selectedClientContourIds);
    const locations = await this.prisma.location.findMany({
      where: {
        id: { in: requestedLocationIds },
        deletedAt: null,
      },
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
    });
    const validLocations = locations.filter((location) => {
      if (!allowedClientIds.has(location.clientCompanyId)) return false;
      if (selectedClientIds.size > 0 && !selectedClientIds.has(location.clientCompanyId)) return false;
      return location.isActive !== false && location.deletedAt === null;
    });
    const validIds = new Set(validLocations.map((location) => location.id));
    const invalidSelections = requestedLocationIds.filter((locationId) => !validIds.has(locationId));
    return {
      locationBindings: validLocations.map((location) => ({
        id: `draft:${location.id}`,
        companyId: params.target.companyId,
        locationId: location.id,
        createdAt: new Date(0),
        location,
      })),
      invalidSelections,
      saveBlockers: invalidSelections.length > 0
        ? [{ code: 'invalid_location_selection', message: 'Some selected locations are inactive, unavailable, or outside the allowed client contours.' }]
        : [],
      locationMode: 'SELECTED_LOCATIONS' as ConstructorLocationMode,
    };
  }

  private buildDraftWarnings(params: {
    proposedOverrideCodes: string[];
    locationCount: number;
    staleBindingCount: number;
    invalidSelectionCount: number;
  }) {
    const warnings: string[] = [];
    if (params.locationCount === 0) warnings.push('no_locations');
    if (params.staleBindingCount > 0) warnings.push('stale_bindings');
    if (this.hasElevatedPermission(params.proposedOverrideCodes)) warnings.push('elevated_overrides');
    if (params.invalidSelectionCount > 0) warnings.push('invalid_location_selection');
    return warnings;
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
      locationMode: bindingState.locationMode,
      explicitLocationMode: bindingState.explicitLocationMode,
      emptyBindingSemantics:
        bindings.length === 0
          ? bindingState.locationMode === 'LEGACY_AUTO'
            ? 'LEGACY_AUTO_SCOPE; no explicit access scope row exists'
            : 'RESTRICTED_EMPTY_SCOPE; explicit empty access is fail-closed'
          : 'BOUND_LOCATIONS',
    };
  }

  private async loadEffectiveLocationBindingState(target: TargetUserContext): Promise<EffectiveLocationBindingState> {
    const [bindings, contours, accessScope] = await Promise.all([
      this.loadLocationBindings(target),
      this.listAvailableClientContoursForCompany(target.company),
      this.prisma.userAccessScope.findUnique({
        where: { userId_companyId: { userId: target.user.id, companyId: target.companyId } },
        select: { locationMode: true },
      }),
    ]);
    const activeClientIds = new Set(contours.map((contour) => contour.id));
    const effective: LocationBindingRecord[] = [];
    const stale: LocationBindingRecord[] = [];
    const explicitLocationMode = accessScope?.locationMode ?? null;

    for (const binding of bindings) {
      const isActiveBinding =
        activeClientIds.has(binding.location.clientCompanyId) &&
        binding.location.deletedAt === null;
      if (isActiveBinding && explicitLocationMode !== UserAccessLocationMode.RESTRICTED_EMPTY) {
        effective.push(binding);
      } else {
        stale.push(binding);
      }
    }

    const locationMode = resolveConstructorLocationMode({
      explicitLocationMode,
      effectiveLocationCount: effective.length,
      staleLocationCount: stale.length,
    });

    if (locationMode === 'RESTRICTED_EMPTY') {
      return {
        effective: [],
        stale,
        locationMode,
        explicitLocationMode,
      };
    }

    return {
      effective,
      stale,
      locationMode,
      explicitLocationMode,
    };
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
    return linked
      .map((contract: any) => ({
        id: contract.linkedClientCompanyId ?? contract.clientCompany?.id ?? contract.id,
        name: contract.name ?? contract.clientCompany?.name ?? 'Client company',
        type: CompanyType.CLIENT,
        serviceContractId: contract.serviceContractId ?? contract.id,
        role: contract.role ?? contract.type,
        status: contract.status ?? 'ACTIVE',
      }))
      .filter((contract: AvailableClientContour) => contract.status === 'ACTIVE');
  }

  private estimateAccessibleCompanyIds(company: CompanySummary, contours: AvailableClientContour[]) {
    if (company.type === CompanyType.CLIENT) return [company.id];
    return Array.from(new Set([company.id, ...contours.map((contour) => contour.id)]));
  }

  private estimateAccessibleCompanyIdsForMode(params: {
    company: CompanySummary;
    contours: AvailableClientContour[];
    locationBindings: LocationBindingRecord[];
    locationMode: ConstructorLocationMode;
  }) {
    if (isFailClosedLocationScope({
      locationMode: params.locationMode,
      locationIds: params.locationBindings.map((binding) => binding.locationId),
    })) {
      return [];
    }
    if (params.locationMode === 'SELECTED_LOCATIONS') {
      return Array.from(new Set(params.locationBindings.map((binding) => binding.location.clientCompanyId)));
    }
    return this.estimateAccessibleCompanyIds(params.company, params.contours);
  }

  private async estimateAccessibleLocationCountForMode(params: {
    company: CompanySummary;
    contours: AvailableClientContour[];
    locationBindings: Array<{ locationId: string }>;
    locationMode: ConstructorLocationMode;
  }) {
    if (params.locationMode === 'RESTRICTED_EMPTY') return 0;
    if (params.locationMode === 'SELECTED_LOCATIONS') {
      return new Set(params.locationBindings.map((binding) => binding.locationId)).size;
    }

    const companyIds = this.estimateAccessibleCompanyIds(params.company, params.contours);
    if (companyIds.length === 0) return 0;
    return this.prisma.location.count({
      where: {
        clientCompanyId: { in: companyIds },
        deletedAt: null,
        isActive: true,
      },
    });
  }

  private buildConstructorPreviewLocationScope(
    locationBindings: Array<{ locationId: string }>,
    locationMode: ConstructorLocationMode,
  ) {
    const interpreted = interpretUserAccessLocationScope({
      explicitLocationMode:
        locationMode === 'LEGACY_AUTO'
          ? null
          : locationMode === 'RESTRICTED_EMPTY'
            ? UserAccessLocationMode.RESTRICTED_EMPTY
            : UserAccessLocationMode.SELECTED_LOCATIONS,
      locationIds: locationBindings.map((binding) => binding.locationId),
    });
    if (interpreted.runtimeMode === 'tenant_wide') return { mode: 'legacy_auto' as const, locationIds: [] as string[] };
    if (interpreted.runtimeMode === 'restricted_empty') return { mode: 'restricted_empty' as const, locationIds: [] as string[] };
    if (isFailClosedLocationScope({ locationMode, locationIds: interpreted.locationIds })) {
      return { mode: 'restricted_empty' as const, locationIds: [] as string[] };
    }
    return { mode: 'bound_locations' as const, locationIds: interpreted.locationIds };
  }

  private estimateTicketVisibilityMode(params: {
    role: UserRole;
    companyType: CompanyType;
    contours: AvailableClientContour[];
    effectiveCodes: string[];
    locationBindingCount: number;
    locationMode: ConstructorLocationMode;
  }) {
    if (
      params.locationMode === 'RESTRICTED_EMPTY' ||
      (params.locationMode === 'SELECTED_LOCATIONS' && params.locationBindingCount === 0)
    ) {
      return 'restricted_empty_scope';
    }
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
