import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Ограничение доступа по ролям.
 * Если декоратора @Roles(...) нет — RolesGuard пропускает (см. roles.guard.ts).
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
