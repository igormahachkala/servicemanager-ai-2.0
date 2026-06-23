/** UI catalog for PBAC constructor (read-only until SMA-PERM-CONSTRUCTOR-013). */

/** @deprecated use usePermissionsWriteCapability — kept false as safe default */
export const PERMISSIONS_OVERRIDES_WRITE_ENABLED = false

export type PermissionModuleId =
  | 'tickets'
  | 'users'
  | 'locations'
  | 'contractors'
  | 'settings'
  | 'analytics'

export type PermissionGrantState = 'allowed' | 'inherited' | 'override' | 'denied'

export type PermissionCatalogEntry = {
  code: string
  label: string
  description?: string
}

export type PermissionModuleDefinition = {
  id: PermissionModuleId
  title: string
  hint: string
  codes: PermissionCatalogEntry[]
}

export const PERMISSION_MODULES: PermissionModuleDefinition[] = [
  {
    id: 'tickets',
    title: 'Заявки',
    hint: 'Создание, просмотр, назначение и смена статусов',
    codes: [
      { code: 'TICKETS_CREATE', label: 'Создание заявок' },
      { code: 'TICKETS_VIEW', label: 'Просмотр заявок' },
      { code: 'TICKETS_VIEW_AVAILABLE', label: 'Доступные заявки' },
      { code: 'TICKETS_EDIT', label: 'Редактирование заявок' },
      { code: 'TICKETS_ASSIGN', label: 'Назначение исполнителя' },
      { code: 'TICKETS_CLAIM', label: 'Самовзятие заявки' },
      { code: 'TICKETS_STATUS_CHANGE', label: 'Смена статуса' },
      { code: 'TICKETS_VIEW_ALL_COMPANY', label: 'Все заявки компании (override)' },
    ],
  },
  {
    id: 'users',
    title: 'Пользователи',
    hint: 'Управление сотрудниками и доступом',
    codes: [{ code: 'USERS_MANAGE', label: 'Управление пользователями' }],
  },
  {
    id: 'locations',
    title: 'Локации',
    hint: 'Точки обслуживания и объекты клиента',
    codes: [
      { code: 'LOCATIONS_VIEW', label: 'Просмотр локаций' },
      { code: 'LOCATIONS_MANAGE', label: 'Управление локациями' },
    ],
  },
  {
    id: 'contractors',
    title: 'Подрядчики',
    hint: 'Контуры provider / subcontractor (каталог PBAC в разработке)',
    codes: [],
  },
  {
    id: 'settings',
    title: 'Настройки',
    hint: 'Параметры компании',
    codes: [{ code: 'COMPANY_SETTINGS_EDIT', label: 'Редактирование настроек компании' }],
  },
  {
    id: 'analytics',
    title: 'Аналитика',
    hint: 'Отчёты и сводные показатели',
    codes: [{ code: 'ANALYTICS_VIEW', label: 'Просмотр аналитики' }],
  },
]

export type PermissionCounters = {
  allowed: number
  denied: number
  inherited: number
  overrides: number
}

export type ResolvedPermissionRow = {
  code: string
  label: string
  description?: string
  state: PermissionGrantState
}

export type ResolvedPermissionModule = {
  module: PermissionModuleDefinition
  rows: ResolvedPermissionRow[]
  grantedCount: number
  totalCount: number
}

function catalogByCode(): Map<string, PermissionCatalogEntry> {
  const map = new Map<string, PermissionCatalogEntry>()
  for (const mod of PERMISSION_MODULES) {
    for (const entry of mod.codes) {
      map.set(entry.code, entry)
    }
  }
  return map
}

const CATALOG = catalogByCode()

export function permissionLabel(code: string): string {
  return CATALOG.get(code)?.label || code
}

export function resolvePermissionState(
  code: string,
  roleCodes: Set<string>,
  overrideCodes: Set<string>,
): PermissionGrantState {
  if (overrideCodes.has(code)) return 'override'
  if (roleCodes.has(code)) return 'inherited'
  return 'denied'
}

export function buildPermissionCounters(
  roleCodes: string[],
  overrideCodes: string[],
  effectiveCodes: string[],
): PermissionCounters {
  const roleSet = new Set(roleCodes)
  const overrideSet = new Set(overrideCodes)
  const effectiveSet = new Set(effectiveCodes)
  const allCatalogCodes = PERMISSION_MODULES.flatMap((m) => m.codes.map((c) => c.code))

  let inherited = 0
  let overrides = 0
  let denied = 0

  for (const code of allCatalogCodes) {
    const state = resolvePermissionState(code, roleSet, overrideSet)
    if (state === 'override') overrides += 1
    else if (state === 'inherited') inherited += 1
    else denied += 1
  }

  return {
    allowed: effectiveSet.size,
    denied,
    inherited,
    overrides,
  }
}

export function buildPermissionModules(
  roleCodes: string[],
  overrideCodes: string[],
  effectiveCodes: string[],
  details?: {
    roleDetails?: Array<{ code: string; name?: string; description?: string }>
    overrideDetails?: Array<{ code: string; name?: string; description?: string }>
  },
): ResolvedPermissionModule[] {
  const roleSet = new Set(roleCodes)
  const overrideSet = new Set(overrideCodes)
  const effectiveSet = new Set(effectiveCodes)
  const detailMap = new Map<string, { name?: string; description?: string }>()

  for (const row of details?.roleDetails || []) {
    detailMap.set(row.code, { name: row.name, description: row.description })
  }
  for (const row of details?.overrideDetails || []) {
    detailMap.set(row.code, { name: row.name, description: row.description })
  }

  return PERMISSION_MODULES.map((module) => {
    const rows: ResolvedPermissionRow[] = module.codes.map((entry) => {
      const state = resolvePermissionState(entry.code, roleSet, overrideSet)
      const extra = detailMap.get(entry.code)
      const isAllowed = effectiveSet.has(entry.code)
      return {
        code: entry.code,
        label: extra?.name || entry.label,
        description: extra?.description,
        state: isAllowed ? state : state === 'override' ? 'override' : state === 'inherited' ? 'inherited' : 'denied',
      }
    })

    const grantedCount = rows.filter((r) => r.state !== 'denied').length

    return {
      module,
      rows,
      grantedCount,
      totalCount: rows.length,
    }
  })
}

export function extractRoleCodes(payload: any): string[] {
  const raw =
    payload?.grants?.rolePermissions ||
    payload?.permissions?.roleCodes ||
    payload?.rolePermissions ||
    []
  return Array.isArray(raw) ? raw.map(String).filter(Boolean) : []
}

export function permissionStateLabel(state: PermissionGrantState): string {
  if (state === 'allowed') return 'Разрешено'
  if (state === 'inherited') return 'От роли'
  if (state === 'override') return 'Override'
  return 'Не выдано'
}
