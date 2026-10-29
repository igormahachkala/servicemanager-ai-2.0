import type { Role } from './api'

/**
 * Область карточки заявки (desktop TicketPage и MobileTicketPage): что уходит
 * в GET /tickets/:id и в действия как companyId / linkedClientCompanyId.
 *
 * Раньше каждый ключ брался отдельно: «из адреса, иначе из localStorage».
 * Провайдер, заходивший на страницу с `?companyId=клиент` (обход с карточки
 * объекта), сохранял этот companyId (persistScopeFromSearchParams обновляет
 * область поключево). Потом ссылка `/tickets/:id?linkedClientCompanyId=клиент`
 * получала companyId из хранилища, API — оба ключа, а карточка — режим
 * наблюдения с отключёнными действиями исполнителя.
 *
 * Правила:
 *  1. Явная область в адресе (хотя бы один ключ) — единственный источник;
 *     сохранённая область к ней не подмешивается.
 *  2. Без области в адресе — сохранённая область, как раньше (прямые ссылки).
 *  3. Режим наблюдения (companyId) есть только у PLATFORM_ADMIN: сервер
 *     учитывает companyId лишь для него (resolveObserverScopeCompanyId).
 *     Если у другой известной роли есть linkedClientCompanyId, companyId
 *     отбрасывается — иначе карточка ложно уходит в наблюдение, а у TECHNICIAN
 *     одно присутствие companyId выключает операционную область на сервере.
 *     Пока роль неизвестна, companyId не трогаем.
 *
 * Прав это не даёт и не отнимает: функция только убирает лишний ключ,
 * доступ к заявке по-прежнему решает сервер.
 */

export type TicketPageScope = {
  companyId: string
  linkedClientCompanyId: string
}

export function resolveTicketPageScope(input: {
  urlCompanyId: string | null | undefined
  urlLinkedClientCompanyId: string | null | undefined
  persistedCompanyId: string | null | undefined
  persistedLinkedClientCompanyId: string | null | undefined
  role: Role | string | null | undefined
}): TicketPageScope {
  const urlCompanyId = (input.urlCompanyId || '').trim()
  const urlLinked = (input.urlLinkedClientCompanyId || '').trim()
  const explicit = !!(urlCompanyId || urlLinked)

  const linkedClientCompanyId = explicit ? urlLinked : (input.persistedLinkedClientCompanyId || '').trim()
  let companyId = explicit ? urlCompanyId : (input.persistedCompanyId || '').trim()

  if (companyId && linkedClientCompanyId && dropsObserverWithLinked(input.role)) companyId = ''

  return { companyId, linkedClientCompanyId }
}

/** companyId рядом с linkedClientCompanyId у этой роли — лишний ключ. */
export function dropsObserverWithLinked(role: Role | string | null | undefined): boolean {
  const r = (role || '').trim()
  return !!r && r !== 'PLATFORM_ADMIN'
}
