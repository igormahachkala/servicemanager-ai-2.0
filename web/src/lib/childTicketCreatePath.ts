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
 * Тот же маршрут, что обычное создание заявки. Родитель и точка едут
 * в query, область карточки добавляется тем же `appendScopeToPath`.
 */
export function childTicketCreatePath(input: ChildTicketCreatePathInput): string {
  const parentId = (input.parentId || '').trim()
  const locationId = (input.locationId || '').trim()
  if (!parentId || !locationId) return ''

  const surface = input.surface === 'mobile' ? 'mobile' : 'desktop'
  const mobileRoot = input.mobileRoot === '/max' ? '/max' : '/m'
  const base = surface === 'mobile' ? `${mobileRoot}/tickets/new` : '/tickets/new'
  const query = new URLSearchParams()
  query.set('parentId', parentId)
  query.set('locationId', locationId)
  return appendScopeToPath(`${base}?${query.toString()}`, input.scope, input.owner)
}
