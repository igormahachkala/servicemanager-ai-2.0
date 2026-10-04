import * as api from '../lib/api'
import { getMobileRouteRoot } from './mobileRoute'

/**
 * SMA-MATERIALS-V0 — переход к «Моим материалам» на телефоне.
 *
 * Вынесено отдельной чистой функцией по двум причинам. Первая: окружение
 * тестов node, и достижимость экрана нужно проверять исполнением. Вторая
 * важнее — соседние пункты экрана настроек строятся через mobilePath(),
 * который подставляет корень текущего контура, и такой пункт появился бы
 * заодно в /max. Материалов в /max нет, поэтому контур проверяется явно,
 * а путь пишется целиком.
 */

export type MaterialsMobileNavLink = {
  id: 'materials'
  label: string
  hint: string
  to: string
}

/** Материалы на руках есть у исполнителя — ему и нужен экран. */
const MATERIALS_MOBILE_ROLES = new Set<api.Role>(['TECHNICIAN'])

export function materialsMobileNavLink(params: {
  role?: api.Role | null
  pathname?: string | null
}): MaterialsMobileNavLink | null {
  if (!params.role || !MATERIALS_MOBILE_ROLES.has(params.role)) return null
  if (getMobileRouteRoot(params.pathname) !== '/m') return null

  return {
    id: 'materials',
    label: 'Мои материалы',
    hint: 'Остатки, покупки и списания',
    to: '/m/materials',
  }
}
