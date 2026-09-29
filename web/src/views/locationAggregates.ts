import type * as api from '../lib/api'

/**
 * SMA-LOCATION-CARD-L2-AGGREGATES-102.
 *
 * Сводка по объекту. Здесь только арифметика над ответами уже существующих
 * авторизованных endpoint'ов: своего доступа этот модуль не заводит и в сеть
 * не ходит. Область (компания и локация) задаётся вызывающей стороной
 * и уходит в запрос параметрами — сужение считает сервер, не страница.
 *
 * Решения вынесены сюда, потому что окружение тестов node: отрисовать карточку
 * нечем, а считать надо проверяемо.
 */

/**
 * «В работе» и «На приёмке» — решение владельца задачи, а не выбор страницы.
 *
 * В проекте живут два несогласованных определения открытой заявки: фронтовое
 * OPEN_TICKET_STATUSES включает AWAITING_ACCEPTANCE, а аналитика бэкенда
 * (resolveOpenStatuses) его исключает. Карточка не примыкает ни к одному
 * молча: приёмка показывается отдельным показателем, поэтому число «в работе»
 * здесь сходится с аналитикой, а приёмка не теряется.
 */
export const LOCATION_IN_PROGRESS_TICKET_STATUSES: api.TicketStatus[] = [
  'NEW',
  'ASSIGNED',
  'IN_PROGRESS',
]

export const LOCATION_AWAITING_TICKET_STATUS: api.TicketStatus = 'AWAITING_ACCEPTANCE'

export type EquipmentSummary = {
  total: number
  active: number
}

export type TicketSummary = {
  inProgress: number
  awaitingAcceptance: number
}

export type ScheduleSummary = {
  activeCount: number
  next: api.InspectionSchedule | null
}

/**
 * Оборудование объекта.
 *
 * Считается по строкам, которые вернул сервер на запрос с этим locationId:
 * он же и отфильтровал их по компании и по области видимости актора.
 * ACTIVE — каноническое значение из EQUIPMENT_STATUSES; прочие статусы
 * (REPAIR, INACTIVE, DECOMMISSIONED) в «в работе» не попадают.
 */
export function summarizeEquipment(
  items: ReadonlyArray<Pick<api.EquipmentListItem, 'status'>> | undefined | null,
): EquipmentSummary {
  const rows = items ?? []
  return {
    total: rows.length,
    active: rows.filter((row) => row.status === 'ACTIVE').length,
  }
}

/**
 * Заявки объекта.
 *
 * Берутся готовые server-side итоги из Location Analytics. Доска здесь
 * намеренно не используется: её карточки могут быть ограниченным срезом,
 * а provider linked-client scope передаётся отдельным параметром.
 */
export function summarizeTickets(
  analytics: Pick<api.LocationAnalyticsResponse, 'items'> | undefined | null,
): TicketSummary {
  const rows = analytics?.items ?? []

  return {
    inProgress: rows.reduce((sum, row) => sum + (row.newTickets || 0) + (row.inProgressTickets || 0), 0),
    awaitingAcceptance: rows.reduce((sum, row) => sum + (row.awaitingAcceptanceTickets || 0), 0),
  }
}

/**
 * Ближайший будущий обход.
 *
 * Именно будущий: просроченный план остаётся в выборке с прошедшим nextDueAt,
 * и показать его как «следующий» значило бы соврать о плане. Сортировка сервера
 * здесь не принимается на веру — порядок восстанавливается по дате.
 */
export function pickNextSchedule(
  schedules: ReadonlyArray<api.InspectionSchedule> | undefined | null,
  now: Date = new Date(),
): api.InspectionSchedule | null {
  const upcoming = (schedules ?? [])
    .filter((schedule) => {
      const at = Date.parse(schedule.nextDueAt)
      return Number.isFinite(at) && at >= now.getTime()
    })
    .sort((a, b) => Date.parse(a.nextDueAt) - Date.parse(b.nextDueAt))

  return upcoming[0] ?? null
}

/**
 * Планы обходов объекта.
 *
 * Активность не пересчитывается по флагу: запрос уходит с active=true, и всё
 * пришедшее уже активно. Двойная фильтрация только создала бы второе,
 * расходящееся определение.
 */
export function summarizeSchedules(
  schedules: ReadonlyArray<api.InspectionSchedule> | undefined | null,
  now: Date = new Date(),
): ScheduleSummary {
  const rows = schedules ?? []
  return {
    activeCount: rows.length,
    next: pickNextSchedule(rows, now),
  }
}

/** Склонение для счётчиков: «1 единица», «2 единицы», «5 единиц». */
export function pluralizeRu(count: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(count) % 100
  const mod10 = mod100 % 10
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}
