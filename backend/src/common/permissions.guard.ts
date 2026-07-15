// backend/src/common/permissions.guard.ts

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CompanyType, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS_KEY } from './permissions.decorator';
import type { PermissionCode } from './permissions.constants';

/** Лёгкий кэш companyId -> CompanyType (тип компании меняется крайне редко). */
const COMPANY_TYPE_TTL_MS = 5 * 60 * 1000;
const companyTypeCache = new Map<string, { type: CompanyType; at: number }>();

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  private async resolveCompanyType(companyId?: string): Promise<CompanyType | null> {
    if (!companyId) return null;
    const cached = companyTypeCache.get(companyId);
    if (cached && Date.now() - cached.at < COMPANY_TYPE_TTL_MS) return cached.type;
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { type: true },
    });
    if (!company) return null;
    companyTypeCache.set(companyId, { type: company.type, at: Date.now() });
    return company.type;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<PermissionCode[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Если permissions не заданы — пропускаем любого авторизованного пользователя
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    // Переходный режим:
    // Если в системе еще нет ни одного PermissionBlock, значит PBAC не "включен" (не засеян).
    // В этом случае не блокируем работу — опираемся на RolesGuard + service-scope.
    const blocksCount = await this.prisma.permissionBlock.count();
    if (blocksCount === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as { id?: string; role?: UserRole | string; companyId?: string } | undefined;

    const userId = user?.id;
    const role = user?.role as UserRole | undefined;

    if (!userId || !role) {
      const requiredPermission = requiredPermissions[0];
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: `Missing permission: ${requiredPermission}`,
      });
    }

    // Phase 1.5: гранты ключуются по (role, companyType). Тип компании резолвим
    // по companyId пользователя (его нет в JWT), с кэшем.
    const companyType = await this.resolveCompanyType(user?.companyId);

    // 1) Права через роль (RolePermission -> PermissionBlock.code), матч по типу
    //    компании ИЛИ wildcard (companyType IS NULL).
    // 2) Индивидуальные права (UserPermission -> PermissionBlock.code)
    // Достаточно совпадения хотя бы по одному коду (OR).
    const [roleHit, userHit] = await Promise.all([
      this.prisma.rolePermission.findFirst({
        where: {
          role,
          OR: [{ companyType }, { companyType: null }],
          permissionBlock: { code: { in: requiredPermissions } },
        },
        select: { id: true },
      }),
      this.prisma.userPermission.findFirst({
        where: {
          userId,
          permissionBlock: { code: { in: requiredPermissions } },
        },
        select: { id: true },
      }),
    ]);

    if (!!roleHit || !!userHit) {
      return true;
    }

    const requiredPermission = requiredPermissions[0];
    throw new ForbiddenException({
      code: 'PERMISSION_DENIED',
      message: `Missing permission: ${requiredPermission}`,
    });
  }
}
