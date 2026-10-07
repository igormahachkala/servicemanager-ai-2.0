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

import type { ScopeParams } from './equipmentCard'

/**
 * Область переносится ТЕМ параметром, которым пришла.
 *
 * Инвариант карточки точки: переход не меняет контур пользователя. Shell на
 * каждом переходе перезаписывает сохранённую пару областей, поэтому отдать
 * провайдеру «?companyId=…» значило бы затереть ему linkedClientCompanyId —
 * ровно тот дефект Equipment V2, который повторять нельзя.
 */
function scopeQuery(scope?: ScopeParams | null): URLSearchParams {
  const params = new URLSearchParams()
  const companyId = (scope?.companyId || '').trim()
  const linkedClientCompanyId = (scope?.linkedClientCompanyId || '').trim()
  if (companyId) params.set('companyId', companyId)
  if (linkedClientCompanyId) params.set('linkedClientCompanyId', linkedClientCompanyId)
  return params
}

function withParams(path: string, params: URLSearchParams): string {
  const query = params.toString()
  return query ? `${path}?${query}` : path
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
}): LocationSectionLinks {
  const locationId = (input.locationId || '').trim()

  const build = (path: string) => {
    const params = scopeQuery(input.scope)
    if (locationId) params.set('locationId', locationId)
    return withParams(path, params)
  }

  return {
    equipment: build('/equipment'),
    rounds: build('/inspection/schedules'),
    analytics: input.canViewAnalytics ? build('/analytics/locations') : null,
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
