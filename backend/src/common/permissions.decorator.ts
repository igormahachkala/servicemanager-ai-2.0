// backend/src/common/permissions.decorator.ts

import { SetMetadata } from '@nestjs/common';
import type { PermissionCode } from './permissions.constants';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Требование permission-блока(ов).
 * Семантика: достаточно иметь хотя бы один из указанных permissions (OR).
 * (Если нужно будет AND — введём отдельный декоратор позже.)
 */
export const RequirePermission = (...permissions: PermissionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
