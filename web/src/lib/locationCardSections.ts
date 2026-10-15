/**
 * SMA-LOCATION-CARD-V2 Phase 1 — переходы карточки точки.
 *
 * Чистый модуль: ни React, ни сети. Окружение тестов node, DOM нет, поэтому
 * решения о переходах вынесены сюда и проверяются исполнением.
 *
 * Карточка точки — узел существующих разделов, а не новая подсистема.
 * Оборудование, заявки, обходы и аналитика уже есть в продукте со своими
 * маршрутами и правами; здесь только собираются ссылки на них.
 *
 * Прав этот модуль не выдаёт. Видимость раздела аналитики решает тот же
 * гейт, что и пункт меню (Navigation V2), а доступ — бэкенд.
 */

import { appendScopeToPath } from './api'
import type { ScopeParams } from './equipmentCard'

/**
 * Область переносится ТЕМ параметром, которым пришла, — КАНОНИЧЕСКИМ
 * помощником appendScopeToPath, а не собственной сборкой query.
 *
 * Инвариант карточки точки: переход не меняет контур пользователя. Shell на
 * каждом переходе перезаписывает сохранённую пару областей, поэтому отдать
 * провайдеру «?companyId=…» значило бы затереть ему linkedClientCompanyId —
 * ровно тот дефект Equipment V2, который повторять нельзя.
 *
 * Область передаётся ВСЕГДА явным объектом: тогда appendScopeToPath не
 * читает ни адрес, ни localStorage, и модуль остаётся чистым (окружение
 * тестов node, DOM нет). Пустая область даёт чистый путь.
 */
function withScope(path: string, scope?: ScopeParams | null): string {
  return appendScopeToPath(path, {
    linkedClientCompanyId: (scope?.linkedClientCompanyId || '').trim() || undefined,
    companyId: (scope?.companyId || '').trim() || undefined,
  })
}

/**
 * Сужение до точки добавляется к уже готовому пути.
 *
 * Путь может уже нести область, поэтому разделитель выбирается по наличию
 * «?» — тем же правилом, что и в appendScopeToPath. Без точки путь не
 * меняется: пустой locationId означает «без сужения», а не «?locationId=».
 */
function withLocation(path: string, locationId: string): string {
  if (!locationId) return path
  return `${path}${path.includes('?') ? '&' : '?'}locationId=${encodeURIComponent(locationId)}`
}

export type LocationSectionLinks = {
  /** Список оборудования, суженный до этой точки. */
  equipment: string
  /** План обходов этой точки. */
  rounds: string
  /** Аналитика по этой точке; null — раздел роли не показывается. */
  analytics: string | null
}

/**
 * Ссылки разделов карточки точки.
 *
 * Каждая несёт и саму точку (locationId), и область. Без locationId переход
 * открывал бы полный список и терял контекст точки, из которой пришли, —
 * раньше так и было: ссылки вели на «/equipment» и «/inspection/schedules»
 * без параметров вовсе.
 *
 * Заявки сюда не входят: у доски свой канонический контракт переноса
 * фильтров (boardContext), и второго механизма не заводится.
 */
export function locationSectionLinks(input: {
  locationId: string
  scope?: ScopeParams | null
  canViewAnalytics: boolean
  /**
   * Путь списка оборудования — готовый, от КАНОНИЧЕСКОГО equipmentListPath.
   *
   * Второго построителя «/equipment» здесь не появляется: область в этот
   * путь уже вложена вызывающим, карточке остаётся добавить только сужение
   * по точке. Не передан — путь собирается тем же каноническим правилом
   * переноса области.
   */
  equipmentPath?: string
}): LocationSectionLinks {
  const locationId = (input.locationId || '').trim()
  const equipmentPath = (input.equipmentPath || '').trim() || withScope('/equipment', input.scope)

  return {
    equipment: withLocation(equipmentPath, locationId),
    rounds: withLocation(withScope('/inspection/schedules', input.scope), locationId),
    analytics: input.canViewAnalytics
      ? withLocation(withScope('/analytics/locations', input.scope), locationId)
      : null,
  }
}

/**
 * Прочитать точку из адреса.
 *
 * Нужен принимающим страницам: фильтр у них живёт в состоянии, и без чтения
 * адреса ссылка с карточки была бы украшением — список открывался бы
 * полным. Значение нормализуется, пустое означает «без сужения».
 */
export function readLocationFilterFromSearch(search: URLSearchParams | null | undefined): string {
  return (search?.get('locationId') || '').trim()
}

/**
 * Область для исходящих ссылок — тем параметром, которым она пришла.
 *
 * Phase 2: обратные переходы (оборудование → точка, обход → точка,
 * аналитика → точка) обязаны сохранять контур. Своей области принимающие
 * страницы не выводят, поэтому «угадывать» параметр нельзя: пришедший
 * параметр и есть контур пользователя.
 *
 * Отсутствующий ключ ничего не затирает: возвращается ровно один,
 * и пустая область даёт чистый путь.
 */
export function readOutboundScopeFromSearch(
  search: URLSearchParams | null | undefined,
): { companyId?: string; linkedClientCompanyId?: string } {
  const companyId = (search?.get('companyId') || '').trim()
  if (companyId) return { companyId }
  const linkedClientCompanyId = (search?.get('linkedClientCompanyId') || '').trim()
  if (linkedClientCompanyId) return { linkedClientCompanyId }
  return {}
}

/**
 * Подпись активного фильтра по точке.
 *
 * Идентификатор пользователю не показывается: если названия нет, подпись
 * остаётся общей. Показывать UUID в интерфейсе нельзя.
 */
export function locationFilterChipLabel(input: {
  locationId: string
  locationName?: string | null
}): string | null {
  const locationId = (input.locationId || '').trim()
  if (!locationId) return null
  const name = (input.locationName || '').trim()
  return name ? `Точка: ${name}` : 'Фильтр по точке'
}

/**
 * Путь без сужения по точке — для действия «очистить фильтр».
 *
 * Остальные параметры сохраняются: снимается только точка, а не контур.
 * Доступ этим не расширяется — список и так ограничен бэкендом.
 */
export function clearLocationFilterPath(
  pathname: string,
  search: URLSearchParams | null | undefined,
): string {
  const next = new URLSearchParams(search ? search.toString() : '')
  next.delete('locationId')
  const query = next.toString()
  return query ? `${pathname}?${query}` : pathname
}
