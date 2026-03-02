import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Требование permission-блока(ов).
 * Семантика: достаточно иметь хотя бы один из указанных permissions (OR).
 * (Если нужно будет AND — введём отдельный декоратор позже.)
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
