import * as api from '../lib/api'
import { getMobileRouteRoot } from './mobileRoute'

/**
 * SMA-EQUIPMENT-REACHABILITY-088, E2.
 *
 * Карточка оборудования на телефоне существовала и была недостижима: маршруты
 * /m/equipment и /m/equipment/:id объявлены, а ссылки на них не было нигде.
 *
 * Решение вынесено из компонента отдельной чистой функцией по двум причинам.
 * Первая — окружение тестов node, отрисовать экран нечем, а правило нужно
 * проверять исполнением. Вторая важнее: здесь легко ошибиться молча.
 * Соседние пункты строятся через mobilePath(), который подставляет корень
 * текущего контура, и такой пункт появился бы заодно в /max. Для оборудования
 * это прямо запрещено, поэтому контур проверяется явно, а путь пишется целиком.
 */

export type EquipmentMobileNavLink = {
  id: 'equipment'
  label: string
  hint: string
  to: string
}

export function equipmentMobileNavLink(params: {
  role?: api.Role | null
  pathname?: string | null
}): EquipmentMobileNavLink | null {
  // Тот же круг лиц, что у «Точек»: оборудование принадлежит точке.
  if (!api.isFullAdminDesktopNavRole(params.role)) return null

  // Только мобильный контур. В MAX пункт не показывается, маршрут там
  // остаётся как был — этой задачей поведение /max не меняется.
  if (getMobileRouteRoot(params.pathname) !== '/m') return null

  return {
    id: 'equipment',
    label: 'Оборудование',
    hint: 'Паспорт, установленные детали и история обслуживания',
    to: '/m/equipment',
  }
}
