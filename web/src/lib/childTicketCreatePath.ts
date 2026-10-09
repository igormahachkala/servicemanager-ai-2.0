import { appendScopeToPath, type TicketScopeParams } from './api'

export type ChildTicketCreateSurface = 'desktop' | 'mobile'

export type ChildTicketCreatePathInput = {
  parentId: string
  locationId: string
  surface?: ChildTicketCreateSurface
  /** Для mobile: `/m` по умолчанию, `/max` если карточка открыта там. */
  mobileRoot?: '/m' | '/max'
  scope?: TicketScopeParams
  owner?: Parameters<typeof appendScopeToPath>[2]
}

/**
 * Путь полной формы создания подзадачи.
 *
 * Родитель и точка едут в query, область карточки добавляется тем же
 * `appendScopeToPath`. На кабинете форма живёт на `/tickets/new`.
 * На /m и /max форма подзадачи живёт на `/tickets/create-subtask`.
 * Этот путь объявлен в router отдельно и раньше `tickets/:id`.
 * Обычное создание на /m остаётся `/create`.
 */
export function childTicketCreatePath(input: ChildTicketCreatePathInput): string {
  const parentId = (input.parentId || '').trim()
  const locationId = (input.locationId || '').trim()
  if (!parentId || !locationId) return ''

  const surface = input.surface === 'mobile' ? 'mobile' : 'desktop'
  const mobileRoot = input.mobileRoot === '/max' ? '/max' : '/m'
  const base = surface === 'mobile' ? `${mobileRoot}/tickets/create-subtask` : '/tickets/new'
  const query = new URLSearchParams()
  query.set('parentId', parentId)
  query.set('locationId', locationId)
  return appendScopeToPath(`${base}?${query.toString()}`, input.scope, input.owner)
}
