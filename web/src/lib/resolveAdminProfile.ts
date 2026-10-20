import type { CompanyType, Role } from './api'

/** Runtime-профиль tenant ADMIN после split по companyType (backend role остаётся ADMIN). */
export type AdminRuntimeProfile = 'CLIENT_ADMIN' | 'PROVIDER_ADMIN'

export type ResolvedAdminProfile = {
  /** Исходная роль с бэкенда — на P0 не меняется. */
  backendRole: Role
  /**
   * CLIENT_ADMIN / PROVIDER_ADMIN — role=ADMIN и известен companyType.
   * LEGACY_ADMIN — role=ADMIN, companyType неизвестен (safe fallback).
   * null — не admin-split кейс.
   */
  profile: AdminRuntimeProfile | 'LEGACY_ADMIN' | null
}

const ADMIN_PROFILE_LABELS: Record<AdminRuntimeProfile | 'LEGACY_ADMIN', string> = {
  CLIENT_ADMIN: 'Администратор (клиент)',
  PROVIDER_ADMIN: 'Администратор (провайдер)',
  LEGACY_ADMIN: 'Администратор',
}

/**
 * Резолвит runtime admin profile по паре (role, companyType).
 * Backend по-прежнему отдаёт role=ADMIN; split только на frontend.
 */
export function resolveAdminProfile(input: {
  role?: Role | string | null
  companyType?: CompanyType | null
}): ResolvedAdminProfile | null {
  const role = (input.role || '').trim()
  if (!role) return null

  if (role === 'ADMIN') {
    if (input.companyType === 'CLIENT') {
      return { backendRole: 'ADMIN', profile: 'CLIENT_ADMIN' }
    }
    if (input.companyType === 'PROVIDER') {
      return { backendRole: 'ADMIN', profile: 'PROVIDER_ADMIN' }
    }
    return { backendRole: 'ADMIN', profile: 'LEGACY_ADMIN' }
  }

  return { backendRole: role as Role, profile: null }
}

/** Человекочитаемая подпись роли; учитывает runtime admin profile при наличии companyType. */
export function getRoleDisplayLabel(input: {
  role?: Role | string | null
  companyType?: CompanyType | null
}): string {
  const role = (input.role || '').trim()
  if (!role) return '—'

  const resolved = resolveAdminProfile(input)
  if (resolved?.profile) {
    return ADMIN_PROFILE_LABELS[resolved.profile]
  }

  if (role === 'PLATFORM_ADMIN') return 'Администратор платформы'
  if (role === 'ADMIN_PROVIDER') return 'Администратор (провайдер)'
  if (role === 'DISPATCHER') return 'Диспетчер'
  if (role === 'MASTER') return 'Мастер'
  if (role === 'TECHNICIAN') return 'Техник'
  if (role === 'CLIENT') return 'Клиент'
  if (role === 'TERRITORIAL_MANAGER') return 'Территориальный менеджер'
  if (role === 'NETWORK_DIRECTOR') return 'Сетевой директор'
  if (role === 'STAFF') return 'Сотрудник'
  return role
}
