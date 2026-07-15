import { UserRole } from '@prisma/client';

export const EXECUTOR_CAPABLE_ROLES = new Set<UserRole>([
  UserRole.TECHNICIAN,
  UserRole.MASTER,
  UserRole.DISPATCHER,
  UserRole.ADMIN,
]);

export function isExecutorCapableRole(role: UserRole): boolean {
  return EXECUTOR_CAPABLE_ROLES.has(role);
}

export function isExecutorEligible(user: { role: UserRole; isExecutor: boolean }): boolean {
  return user.isExecutor === true && isExecutorCapableRole(user.role);
}
