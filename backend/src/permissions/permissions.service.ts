import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { CompanyType, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { PERMISSION_BLOCKS, ROLE_GRANTS } from '../common/permissions-matrix';
import { PermissionCatalogItemDto } from './dto/permission-catalog.dto';
import { RoleMatrixEntryDto } from './dto/role-matrix.dto';
import { MatrixChangeDto } from './dto/update-matrix.dto';

type CompanyTypeOrNull = CompanyType | null;

/** PLATFORM_ADMIN-гранты, которые нельзя снимать через editor (lockout-protection). */
const PROTECTED_PLATFORM_ADMIN_CODES = new Set<string>(['TICKETS_VIEW', 'USERS_MANAGE']);

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
}
