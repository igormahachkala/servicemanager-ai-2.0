// backend/src/common/permissions.guard.ts

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS_KEY } from './permissions.decorator';
import type { PermissionCode } from './permissions.constants';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

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
    const user = req.user as { id?: string; role?: UserRole | string } | undefined;

    const userId = user?.id;
    const role = user?.role as UserRole | undefined;

    if (!userId || !role) return false;

    // 1) Права через роль (RolePermission -> PermissionBlock.code)
    // 2) Индивидуальные права (UserPermission -> PermissionBlock.code)
    // Достаточно совпадения хотя бы по одному коду (OR)
    const [roleHit, userHit] = await Promise.all([
      this.prisma.rolePermission.findFirst({
        where: {
          role,
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

    return !!roleHit || !!userHit;
  }
}
