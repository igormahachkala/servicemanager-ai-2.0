// backend/src/common/permissions-context.guard.ts

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { PERMISSIONS, type PermissionCode } from './permissions.constants';

/**
 * Guard контекста: подготавливает req.accessFlags (scope toggles),
 * которые потом использует Policy.
 *
 * Важно:
 * - НИЧЕГО не блокирует сам по себе (это делает PermissionsGuard / RolesGuard / Policy)
 * - просто собирает флаги из UserPermission (например, “техник видит всё”)
 */
@Injectable()
export class PermissionsContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // если на handler/class вообще нет permissions — смысла лезть в БД нет
    const required = this.reflector.getAllAndOverride<PermissionCode[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as { id?: string } | undefined;

    const userId = user?.id;
    if (!userId) return true;

    // собираем “toggle” флаги
    const toggles: PermissionCode[] = [PERMISSIONS.TICKETS_VIEW_ALL_COMPANY];

    const hit = await this.prisma.userPermission.findFirst({
      where: { userId, permissionBlock: { code: { in: toggles } } },
      select: { permissionBlock: { select: { code: true } } },
    });

    req.accessFlags = {
      ...(req.accessFlags ?? {}),
      canTechnicianViewAllCompanyTickets: hit?.permissionBlock?.code === PERMISSIONS.TICKETS_VIEW_ALL_COMPANY,
    };

    return true;
  }
}
