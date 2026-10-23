import { appendScopeToPath, type Me, type Role, type TicketScopeParams } from './api'

/**
 * TUX-01: ссылка на заявку из desktop-обхода (полный экран, быстрый режим,
 * отчёт) несёт область владельца заявки.
 *
 * Раньше ссылка была голой `/tickets/:id`: карточка брала сохранённую
 * область, а она могла быть от другого клиента. Хуже того, пришедший
 * в обход `?companyId=` (с карточки объекта) провайдер переносил бы
 * в карточку заявки как режим наблюдения.
 *
 * Владелец заявки по проблемному пункту — клиент площадки
 * (Location.clientCompanyId), иначе компания обхода: так его выводит
 * TicketsService и так же считает отчёт обхода (document.clientCompany).
 *
 * Параметр выбирается по роли, как его читает получатель:
 *  - PLATFORM_ADMIN — режим наблюдения, companyId (из адреса, иначе владелец);
 *  - операторские роли, заявка чужой компании — linkedClientCompanyId владельца;
 *  - своя компания — без параметров, область своей компании.
 * Прав ссылка не даёт: доступ к заявке проверяет сервер.
 */

const LINKED_SCOPE_ROLES: readonly Role[] = [
  'ADMIN',
  'MASTER',
  'DISPATCHER',
  'NETWORK_DIRECTOR',
  'TERRITORIAL_MANAGER',
  'TECHNICIAN',
  'STAFF',
]

export function roundTicketScope(input: {
  me: Pick<Me, 'companyId' | 'role'> | null | undefined
  outboundScope: TicketScopeParams
  ownerCompanyId: string | null | undefined
}): TicketScopeParams {
  const { me, outboundScope } = input
  const owner = (input.ownerCompanyId || '').trim()
  if (!me?.role) return {}
  if (me.role === 'PLATFORM_ADMIN') {
    const companyId = (outboundScope.companyId || '').trim() || owner
    return companyId ? { companyId } : {}
  }
  const own = (me.companyId || '').trim()
  if (owner && own && owner !== own && LINKED_SCOPE_ROLES.includes(me.role)) {
    return { linkedClientCompanyId: owner }
  }
  return {}
}

export function roundTicketPath(
  ticketId: string,
  input: Parameters<typeof roundTicketScope>[0],
): string {
  return appendScopeToPath(`/tickets/${encodeURIComponent(ticketId)}`, roundTicketScope(input))
}
