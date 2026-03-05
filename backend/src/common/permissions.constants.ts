// backend/src/common/permissions.constants.ts

/**
 * Единый контракт permission codes (One Source of Truth).
 * Эти значения = PermissionBlock.code в PBAC.
 *
 * Правило: НЕ используем строковые коды по проекту.
 * Только PERMISSIONS.* (и тип PermissionCode).
 */
export const PERMISSIONS = {
  // Tickets
  TICKETS_CREATE: 'TICKETS_CREATE',
  TICKETS_VIEW: 'TICKETS_VIEW',
  TICKETS_VIEW_AVAILABLE: 'TICKETS_VIEW_AVAILABLE',
  TICKETS_ASSIGN: 'TICKETS_ASSIGN',
  TICKETS_CLAIM: 'TICKETS_CLAIM',
  TICKETS_STATUS_CHANGE: 'TICKETS_STATUS_CHANGE',

  /**
   * Override-флаг для “TECHNICIAN видит всё company”.
   * По умолчанию: техник видит “мои + доступные”.
   * Если выдать пользователю UserPermission с этим кодом — тогда может видеть всё company.
   */
  TICKETS_VIEW_ALL_COMPANY: 'TICKETS_VIEW_ALL_COMPANY',

  // Analytics
  ANALYTICS_VIEW: 'ANALYTICS_VIEW',

  // Users / Company
  USERS_MANAGE: 'USERS_MANAGE',
  COMPANY_SETTINGS_EDIT: 'COMPANY_SETTINGS_EDIT',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
