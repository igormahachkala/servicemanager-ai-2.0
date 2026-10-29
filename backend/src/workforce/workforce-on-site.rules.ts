import { haversineMeters } from '../tickets/ticket-route.service'

/** Радиус, внутри которого точка считается у заявки. 100 м включительно. */
export const ON_SITE_RADIUS_M = 100

/** Свежая точка не старше 10 минут в момент приёма. */
export const ON_SITE_FRESH_MS = 10 * 60 * 1000

/**
 * Точность не хуже 100 м подтверждает переход.
 * Хуже 100 м или отсутствующая точность переход не подтверждает.
 */
export const ON_SITE_ACCURACY_M = 100

export type ArrivalThresholds = {
  accuracyMeters: number
  freshnessMs: number
  radiusMeters: number
}

export const DEFAULT_ARRIVAL_THRESHOLDS: ArrivalThresholds = {
  accuracyMeters: ON_SITE_ACCURACY_M,
  freshnessMs: ON_SITE_FRESH_MS,
  radiusMeters: ON_SITE_RADIUS_M,
}

/** Нет строки PlatformArrivalSettings. Автомат остаётся на 100 м, 10 минутах и 100 м. */
export function toArrivalThresholds(
  row: { accuracyMeters: number; freshnessMinutes: number; radiusMeters: number } | null,
): ArrivalThresholds {
  if (!row) {
    return {
      accuracyMeters: ON_SITE_ACCURACY_M,
      freshnessMs: ON_SITE_FRESH_MS,
      radiusMeters: ON_SITE_RADIUS_M,
    }
  }
  return {
    accuracyMeters: row.accuracyMeters,
    freshnessMs: row.freshnessMinutes * 60_000,
    radiusMeters: row.radiusMeters,
  }
}

export const ON_SITE_OUTCOMES = [
  'no_coordinates',
  'not_arrived',
  'no_fresh',
  'arrived',
  'departed',
] as const

export type OnSiteOutcome = (typeof ON_SITE_OUTCOMES)[number]

export type OnSiteSort = 'state' | 'name' | 'lastPoint' | 'distance'

export type OnSiteShiftFilter = 'open' | 'closed'

const CLOSED_SHIFT_NOTE = 'Смена закрыта. Наблюдение не ведётся.'

export function outcomeRank(state: OnSiteOutcome): number {
  return ON_SITE_OUTCOMES.indexOf(state)
}

/** Пустой или неизвестный пояс даёт UTC, как safeTimeZone в workforce-time.ts. */
export function providerTimeZone(timezone?: string | null): string {
  const candidate = (timezone || '').trim() || 'UTC'
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: candidate })
    return candidate
  } catch {
    return 'UTC'
  }
}

export function formatProviderClock(date: Date, timezone?: string | null): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: providerTimeZone(timezone),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  return `${parts.hour}:${parts.minute}`
}

export function formatDistanceMeters(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} м`
  return `${(meters / 1000).toFixed(1).replace('.', ',')} км`
}

export function formatAgeMinutes(lastGeoAt: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - lastGeoAt.getTime()) / 60_000))
  return `${minutes} мин назад`
}

export function hasFiniteCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): boolean {
  return (
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude)
  )
}

export function isFreshPoint(lastGeoAt: Date | null | undefined, now: Date): boolean {
  if (!lastGeoAt || !Number.isFinite(lastGeoAt.getTime())) return false
  return now.getTime() - lastGeoAt.getTime() <= ON_SITE_FRESH_MS
}

export function confirmsTransition(
  accuracy: number | null | undefined,
  capturedAt: Date,
  receivedAt: Date,
  thresholds: ArrivalThresholds = DEFAULT_ARRIVAL_THRESHOLDS,
): boolean {
  if (
    accuracy == null ||
    !Number.isFinite(accuracy) ||
    accuracy < 0 ||
    accuracy > thresholds.accuracyMeters
  ) {
    return false
  }
  if (!Number.isFinite(capturedAt.getTime()) || !Number.isFinite(receivedAt.getTime())) return false
  return receivedAt.getTime() - capturedAt.getTime() <= thresholds.freshnessMs
}

export function pointSide(distanceMeters: number, radiusMeters: number = ON_SITE_RADIUS_M): 'INSIDE' | 'OUTSIDE' {
  return distanceMeters <= radiusMeters ? 'INSIDE' : 'OUTSIDE'
}

export function presenceOf(
  arrivedAt: Date | null | undefined,
  departedAt: Date | null | undefined,
): 'arrived' | 'departed' | 'none' {
  if (arrivedAt && departedAt) {
    if (departedAt.getTime() > arrivedAt.getTime()) return 'departed'
    return 'arrived'
  }
  if (arrivedAt) return 'arrived'
  if (departedAt) return 'departed'
  return 'none'
}

export type DisplayedCorrection = {
  createdAt: Date
  correctedArrivedAt: Date | null
  correctedDepartedAt: Date | null
}

/**
 * Времена на экране. Правка новее последнего события автомата заменяет оба факта.
 * Пустое время в такой правке убирает факт. Более позднее событие автомата
 * снова показывает колонки arrivedAt и departedAt.
 */
export function displayedFacts(input: {
  arrivedAt: Date | null
  departedAt: Date | null
  lastAutoEventAt: Date | null
  correction: DisplayedCorrection | null
} | null): { arrivedAt: Date | null; departedAt: Date | null } {
  if (!input) return { arrivedAt: null, departedAt: null }
  const correction = input.correction
  if (correction && (input.lastAutoEventAt == null || correction.createdAt.getTime() > input.lastAutoEventAt.getTime())) {
    return {
      arrivedAt: correction.correctedArrivedAt,
      departedAt: correction.correctedDepartedAt,
    }
  }
  return { arrivedAt: input.arrivedAt, departedAt: input.departedAt }
}

export function resolveOutcome(input: {
  hasLocationCoordinates: boolean
  arrivedAt: Date | null
  departedAt: Date | null
  fresh: boolean
}): OnSiteOutcome {
  if (!input.hasLocationCoordinates) return 'no_coordinates'
  const presence = presenceOf(input.arrivedAt, input.departedAt)
  if (presence === 'arrived') return 'arrived'
  if (presence === 'departed') return 'departed'
  if (input.fresh) return 'not_arrived'
  return 'no_fresh'
}

export function silenceNote(lastGeoAt: Date | null, timezone?: string | null): string {
  if (!lastGeoAt) {
    return 'Нет свежих данных. Приложение не открыто или телефон в спящем режиме.'
  }
  const clock = formatProviderClock(lastGeoAt, timezone)
  return `Нет свежих данных с ${clock}. Приложение не открыто или телефон в спящем режиме.`
}

export function outcomeLabel(input: {
  outcome: OnSiteOutcome
  arrivedAt: Date | null
  departedAt: Date | null
  distanceMeters: number | null
  lastGeoAt: Date | null
  now: Date
  timezone?: string | null
}): string {
  if (input.outcome === 'no_coordinates') return 'У точки нет координат'
  if (input.outcome === 'no_fresh') return 'Нет свежих данных'
  if (input.outcome === 'arrived' && input.arrivedAt) {
    return `Прибыл в ${formatProviderClock(input.arrivedAt, input.timezone)}`
  }
  if (input.outcome === 'departed' && input.departedAt) {
    return `Убыл в ${formatProviderClock(input.departedAt, input.timezone)}`
  }
  const age = input.lastGeoAt ? formatAgeMinutes(input.lastGeoAt, input.now) : ''
  if (input.distanceMeters == null) return age ? `Не прибыл, точка ${age}` : 'Не прибыл'
  return `Не прибыл, ${formatDistanceMeters(input.distanceMeters)}, точка ${age}`
}

export function lineNotes(input: {
  outcome: OnSiteOutcome
  fresh: boolean
  shiftOpen: boolean
  lastGeoAt: Date | null
  timezone?: string | null
}): string[] {
  const notes: string[] = []
  if ((input.outcome === 'arrived' || input.outcome === 'departed') && !input.fresh) {
    notes.push(silenceNote(input.lastGeoAt, input.timezone))
  }
  if (!input.shiftOpen) notes.push(CLOSED_SHIFT_NOTE)
  return notes
}

export function staffName(
  user?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null,
): string {
  const name = [user?.firstName, user?.lastName]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
    .trim()
  return name || user?.email || 'Сотрудник'
}

/**
 * Та же строка, что appendScopeToPath(`/tickets/${ticketId}`, { linkedClientCompanyId }).
 * linkedClientCompanyId равен Ticket.companyId, чтобы карточка провайдера открыла заявку в контуре клиента.
 */
export function arrivalTicketHref(ticketId: string, linkedClientCompanyId: string): string {
  const path = `/tickets/${ticketId}`
  const search = new URLSearchParams()
  search.set('linkedClientCompanyId', linkedClientCompanyId)
  const suffix = search.toString()
  return suffix ? `${path}?${suffix}` : path
}

export function distanceToLocation(
  phoneLatitude: number | null | undefined,
  phoneLongitude: number | null | undefined,
  locationLatitude: number | null | undefined,
  locationLongitude: number | null | undefined,
): number | null {
  if (!hasFiniteCoordinates(phoneLatitude, phoneLongitude)) return null
  if (!hasFiniteCoordinates(locationLatitude, locationLongitude)) return null
  return haversineMeters(
    { lat: phoneLatitude as number, lon: phoneLongitude as number },
    { lat: locationLatitude as number, lon: locationLongitude as number },
  )
}
