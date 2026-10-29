import * as api from '../../lib/api'
import { mobilePath } from '../../mobile/mobileRoute'

export const ON_SITE_STATE_OPTIONS: Array<{ value: api.OnSiteArrivalState; label: string }> = [
  { value: 'no_coordinates', label: 'У точки нет координат' },
  { value: 'not_arrived', label: 'Не прибыл' },
  { value: 'no_fresh', label: 'Нет свежих данных' },
  { value: 'arrived', label: 'Прибыл' },
  { value: 'departed', label: 'Убыл' },
]

export const ON_SITE_SORT_OPTIONS: Array<{ value: api.OnSiteSort; label: string }> = [
  { value: 'state', label: 'По состоянию' },
  { value: 'name', label: 'По имени техника' },
  { value: 'lastPoint', label: 'По времени последней точки' },
  { value: 'distance', label: 'По расстоянию' },
]

export const ON_SITE_EMPTY_UNFILTERED = 'Активных назначений сейчас нет.'
export const ON_SITE_EMPTY_FILTERED = 'По фильтру никого не осталось.'

export function onSiteTicketHref(
  row: Pick<api.OnSiteLine, 'ticketId' | 'linkedClientCompanyId'>,
  surface: 'desktop' | 'mobile',
  pathname: string,
): string {
  const base = surface === 'mobile'
    ? mobilePath(pathname, `/tickets/${row.ticketId}`)
    : `/tickets/${row.ticketId}`
  return api.appendScopeToPath(base, {
    linkedClientCompanyId: row.linkedClientCompanyId || undefined,
  })
}

export function onSiteTicketNumberLabel(ticketNumber: api.OnSiteLine['ticketNumber']): string {
  if (ticketNumber == null) return 'Заявка'
  return `Заявка #${ticketNumber}`
}

export function onSiteErrorText(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Не удалось загрузить данные'
}

export function formatOnSiteInstant(value?: string | null): string {
  if (!value) return 'факта не было'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
