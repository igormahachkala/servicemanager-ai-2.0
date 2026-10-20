// backend/src/common/permissions-matrix.ts
//
// Phase 1.5 — единый источник истины для дефолтной матрицы прав.
// Ключ гранта: (role, companyType). companyType = null → wildcard (любой тип компании).
//
// ВАЖНО: ADMIN общий для CLIENT и PROVIDER компаний, поэтому у него ДВЕ строки.
// Решения бизнес-логики (одобрено):
//  - ADMIN+CLIENT: НЕ assign, НЕ claim, НЕ view_available, НЕ status_change
//                  (клиентский админ не управляет операционным статусом),
//                  но управляет своими локациями и своим штатом (scope ограничивает арендатором).
//  - ADMIN+PROVIDER: полный операционный набор.
//  - NETWORK_DIRECTOR (client-side oversight): НЕ assign/claim/change-executor;
//                  status_change также убран как операционное действие провайдера.
//
// Эта матрица не заменяет scope-слой: видимость/изоляция арендатора остаётся в сервисах.

import { CompanyType, UserRole } from '@prisma/client';
import { PERMISSIONS, type PermissionCode } from './permissions.constants';

export type PermissionBlockSeed = {
  code: PermissionCode;
  name: string;
  group: string;
  description?: string;
};

export type RoleGrant = {
  role: UserRole;
  /** null = wildcard (применяется к любому типу компании) */
  companyType: CompanyType | null;
  codes: PermissionCode[];
};

/** Каталог permission-блоков (= PermissionBlock.code). */
export const PERMISSION_BLOCKS: PermissionBlockSeed[] = [
  { code: PERMISSIONS.TICKETS_VIEW, group: 'TICKETS', name: 'View tickets', description: 'Доска/список/карточка/таймлайн/комментарии' },
  { code: PERMISSIONS.TICKETS_CREATE, group: 'TICKETS', name: 'Create tickets', description: 'Создание заявок и дочерних' },
  { code: PERMISSIONS.TICKETS_VIEW_AVAILABLE, group: 'TICKETS', name: 'View available tickets', description: 'Доступные NEW для claim' },
  { code: PERMISSIONS.TICKETS_EDIT, group: 'TICKETS', name: 'Edit tickets', description: 'Редактирование полей заявки' },
  { code: PERMISSIONS.TICKETS_ASSIGN, group: 'TICKETS', name: 'Assign tickets', description: 'Назначение исполнителя' },
  { code: PERMISSIONS.TICKETS_CLAIM, group: 'TICKETS', name: 'Claim tickets', description: 'Взять/запросить назначение' },
  { code: PERMISSIONS.TICKETS_STATUS_CHANGE, group: 'TICKETS', name: 'Change ticket status', description: 'Смена статуса' },
  { code: PERMISSIONS.TICKETS_VIEW_ALL_COMPANY, group: 'TICKETS', name: 'View all company tickets', description: 'Toggle (per-user override)' },
  { code: PERMISSIONS.LOCATIONS_VIEW, group: 'LOCATIONS', name: 'View locations', description: 'Просмотр точек/оборудования/категорий/карты' },
  { code: PERMISSIONS.LOCATIONS_MANAGE, group: 'LOCATIONS', name: 'Manage locations', description: 'Управление точками/оборудованием' },
  { code: PERMISSIONS.USERS_MANAGE, group: 'EMPLOYEES', name: 'Manage users', description: 'Управление сотрудниками/привязками' },
  { code: PERMISSIONS.ANALYTICS_VIEW, group: 'ANALYTICS', name: 'View analytics', description: 'Аналитика' },
  { code: PERMISSIONS.COMPANY_SETTINGS_EDIT, group: 'MANAGEMENT', name: 'Edit company settings', description: 'Категории проблем / настройки' },
];

const P = PERMISSIONS;

/**
 * Дефолтная матрица грантов (role, companyType) → codes.
 * Toggle TICKETS_VIEW_ALL_COMPANY НЕ выдаётся ни одной роли (только per-user UserPermission).
 */
export const ROLE_GRANTS: RoleGrant[] = [
  // Кросс-тип роли → wildcard (null)
  {
    role: UserRole.PLATFORM_ADMIN,
    companyType: null,
    codes: [P.TICKETS_VIEW, P.LOCATIONS_VIEW, P.USERS_MANAGE, P.ANALYTICS_VIEW],
  },
  { role: UserRole.STAFF, companyType: null, codes: [P.TICKETS_VIEW] },

  // ADMIN — РАЗДЕЛЁН по типу компании
  {
    role: UserRole.ADMIN,
    companyType: CompanyType.CLIENT,
    codes: [
      P.TICKETS_VIEW,
      P.TICKETS_CREATE,
      P.TICKETS_EDIT,
      P.LOCATIONS_VIEW,
      P.LOCATIONS_MANAGE,
      P.USERS_MANAGE,
      P.ANALYTICS_VIEW,
      P.COMPANY_SETTINGS_EDIT,
      // НЕТ: ASSIGN, CLAIM, VIEW_AVAILABLE, STATUS_CHANGE
    ],
  },
  {
    role: UserRole.ADMIN,
    companyType: CompanyType.PROVIDER,
    codes: [
      P.TICKETS_VIEW,
      P.TICKETS_CREATE,
      P.TICKETS_VIEW_AVAILABLE,
      P.TICKETS_EDIT,
      P.TICKETS_ASSIGN,
      P.TICKETS_CLAIM,
      P.TICKETS_STATUS_CHANGE,
      P.LOCATIONS_VIEW,
      P.LOCATIONS_MANAGE,
      P.USERS_MANAGE,
      P.ANALYTICS_VIEW,
      P.COMPANY_SETTINGS_EDIT,
    ],
  },

  // Провайдерские операционные роли
  {
    role: UserRole.MASTER,
    companyType: CompanyType.PROVIDER,
    codes: [
      P.TICKETS_VIEW,
      P.TICKETS_CREATE,
      P.TICKETS_VIEW_AVAILABLE,
      P.TICKETS_EDIT,
      P.TICKETS_ASSIGN,
      P.TICKETS_CLAIM,
      P.TICKETS_STATUS_CHANGE,
      P.LOCATIONS_VIEW,
      P.LOCATIONS_MANAGE,
      P.USERS_MANAGE,
      P.ANALYTICS_VIEW,
    ],
  },
  {
    role: UserRole.DISPATCHER,
    companyType: CompanyType.PROVIDER,
    codes: [
      P.TICKETS_VIEW,
      P.TICKETS_CREATE,
      P.TICKETS_VIEW_AVAILABLE,
      P.TICKETS_EDIT,
      P.TICKETS_ASSIGN,
      P.TICKETS_CLAIM,
      P.TICKETS_STATUS_CHANGE,
      P.LOCATIONS_VIEW,
      P.LOCATIONS_MANAGE,
      P.USERS_MANAGE,
      P.ANALYTICS_VIEW,
    ],
  },
  {
    role: UserRole.TECHNICIAN,
    companyType: CompanyType.PROVIDER,
    codes: [
      P.TICKETS_VIEW,
      P.TICKETS_CREATE,
      P.TICKETS_VIEW_AVAILABLE,
      P.TICKETS_CLAIM,
      P.TICKETS_STATUS_CHANGE,
      P.LOCATIONS_VIEW,
    ],
  },

  // Клиентские роли
  {
    role: UserRole.NETWORK_DIRECTOR,
    companyType: CompanyType.CLIENT,
    codes: [
      P.TICKETS_VIEW,
      P.TICKETS_CREATE,
      P.TICKETS_EDIT,
      P.LOCATIONS_VIEW,
      P.USERS_MANAGE,
      P.ANALYTICS_VIEW,
      // НЕТ: ASSIGN/CLAIM (decision), STATUS_CHANGE (client-side принцип)
    ],
  },
  {
    role: UserRole.TERRITORIAL_MANAGER,
    companyType: CompanyType.CLIENT,
    codes: [P.TICKETS_VIEW, P.TICKETS_CREATE, P.TICKETS_EDIT, P.LOCATIONS_VIEW],
  },
  {
    role: UserRole.CLIENT,
    companyType: CompanyType.CLIENT,
    codes: [P.TICKETS_VIEW, P.TICKETS_CREATE, P.TICKETS_EDIT, P.LOCATIONS_VIEW],
  },
];
