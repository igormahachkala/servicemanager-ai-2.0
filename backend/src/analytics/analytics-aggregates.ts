/**
 * SMA-ANALYTICS-V2-PHASE2 — городские агрегаты (A1) и показатели SLA (A3).
 *
 * Чистый модуль: ни Prisma, ни Nest, ни сети. Сюда вынесены все решения о том,
 * что считается реакцией, решением и соблюдением SLA, чтобы их можно было
 * проверить исполнением, а не чтением.
 *
 * Прав модуль не выдаёт и не отнимает. На вход приходят строки, которые бэкенд
 * УЖЕ сузил областью видимости (companyId + location scope + сужение
 * SECONDARY). Ни одна заявка, которой не было в выборке, здесь появиться не
 * может, и область запроса отсюда не меняется.
 *
 * Почему агрегаты по городу считаются здесь, а не на фронтенде: заявка
 * принадлежит ровно одной точке (Ticket.locationId обязателен), поэтому сумма
 * по точкам города — корректное разбиение, а не оценка. Но часть заявок не
 * получает строки вовсе: строки берутся с isActive: true, а summary считается
 * по всем заявкам области, плюс строки может отбросить порог minTickets.
 * Фронтенд этого расхождения объяснить не может, бэкенд — может: см.
 * ticketsOutsideRows в summary и reconcileCityTotals ниже.
 */

/** Город не заполнен. Отдельная понятная группа, а не «прочее». */
export const NO_CITY_KEY = '__no_city__'
export const NO_CITY_LABEL = 'Город не указан'

/**
 * Ключ группировки города.
 *
 * Нормализуется ТОЛЬКО ключ: пробелы по краям, внутренние пробелы в один,
 * регистр вниз. Данные в базе не меняются — «Москва», «москва» и « Москва  »
 * попадают в одну группу. Правило намеренно повторяет фронтендовое
 * web/src/lib/locationAnalyticsGrouping.ts, чтобы группы на экране и в
 * агрегатах совпадали.
 */
export function normalizeCityKey(city?: string | null): string {
  const collapsed = (city || '').replace(/\s+/g, ' ').trim()
  if (!collapsed) return NO_CITY_KEY
  return collapsed.toLocaleLowerCase('ru-RU')
}

/** Подпись города: как в данных, но без лишних пробелов. */
export function cityLabel(city?: string | null): string {
  const collapsed = (city || '').replace(/\s+/g, ' ').trim()
  return collapsed || NO_CITY_LABEL
}

// ─── A3. SLA ────────────────────────────────────────────────────────────────

/**
 * Источники времени (зафиксированы по коду, а не по догадке):
 *
 * - createdAt       — Ticket.createdAt, момент появления заявки;
 * - firstResponseAt — МИНИМАЛЬНЫЙ TicketStatusHistory.createdAt с toStatus
 *                     из SLA_RESPONSE_STATUSES. Именно первый перевод в работу,
 *                     а не последний: statusUpdatedAt на заявке — это последнее
 *                     изменение, для реакции он не годится;
 * - canceled        — заявка отменена. closedAt у отменённой не ставится
 *                     (ticket-close-tree), поэтому по одному closedAt она
 *                     неотличима от открытой;
 * - closedAt        — Ticket.closedAt. Ставится при переходе в DONE
 *                     (tickets.status.service, tickets.acceptance.service,
 *                     ticket-close-tree). Канонический момент завершения;
 * - slaDueAt        — срок по SLA, если он задан;
 * - slaBreachedAt   — канонический признак нарушения; им же считается
 *                     overdueTickets в остальной аналитике.
 */
/**
 * Статусы, переход в которые считается реакцией на заявку.
 *
 * Workflow разрешает NEW → IN_PROGRESS напрямую, минуя ASSIGNED
 * (workflow/ticket.workflow.ts). Если считать реакцию только по ASSIGNED,
 * такие заявки выпадают из среднего, хотя их взяли в работу.
 */
export const SLA_RESPONSE_STATUSES = ['ASSIGNED', 'IN_PROGRESS'] as const

export type SlaSourceTicket = {
  locationId: string | null
  createdAt: Date
  firstResponseAt: Date | null
  canceled: boolean
  closedAt: Date | null
  slaDueAt: Date | null
  slaBreachedAt: Date | null
}

export type SlaMetrics = {
  /** Среднее время реакции в минутах. null — нечего считать. */
  avgResponseMinutes: number | null
  /** Среднее время решения в минутах, только по завершённым. null — нечего считать. */
  avgResolutionMinutes: number | null
  /** Доля в SLA, 0..1. null — не было ни одной заявки, которую можно оценить. */
  withinSlaRatio: number | null
  /** Завершено в срок. */
  withinSlaCount: number
  /** Знаменатель доли: завершённые заявки, у которых задан slaDueAt. */
  slaEvaluatedCount: number
  /**
   * ИСТОРИЧЕСКИЕ нарушения: признак slaBreachedAt, записанный системой.
   *
   * Это факт из прошлого, он остаётся у заявки навсегда — в том числе у уже
   * закрытой. С текущей просрочкой НЕ смешивается: та считается от срока и
   * «сейчас», и у закрытой заявки её не бывает по определению. Две разные
   * величины и два разных поля.
   */
  slaBreaches: number
  /** Открытые заявки: не завершены и не отменены. Знаменатель для текущей просрочки. */
  openCount: number
  /**
   * ТЕКУЩАЯ просрочка: открытые заявки, у которых срок уже прошёл.
   *
   * Считается как closedAt === null && slaDueAt < now, а не по slaBreachedAt:
   * признак мог быть не записан, а мог остаться от закрытой заявки. Открытая
   * заявка без срока сюда не попадает — просрочить нечего.
   */
  openOverdueCount: number
  /**
   * Отменённые заявки. Не открыты и не завершены: в текущую просрочку, время
   * решения и долю SLA не входят. Исторические нарушения (slaBreaches) и
   * реакция у них остаются — это факты, которые уже случились.
   */
  canceledCount: number
  /** Сколько заявок получили реакцию (участвуют в avgResponseMinutes). */
  respondedCount: number
  /** Сколько заявок завершено (участвуют в avgResolutionMinutes). */
  resolvedCount: number
  /**
   * Завершённые заявки БЕЗ slaDueAt.
   *
   * Отдельное поле, а не молчаливое включение в «в срок»: отсутствие данных
   * не является соблюдением SLA. Эти заявки не входят ни в числитель, ни в
   * знаменатель доли, и их видно отдельно.
   */
  withoutSlaCount: number
}

const MINUTE_MS = 60_000

/**
 * Длительность в минутах между двумя моментами.
 *
 * Отрицательная разница означает битые данные (закрыто раньше создания) и
 * приводится к нулю: иначе одна такая заявка утянула бы среднее ниже нуля.
 */
function durationMinutes(from: Date, to: Date): number {
  const raw = (to.getTime() - from.getTime()) / MINUTE_MS
  return raw > 0 ? raw : 0
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

export function emptySlaMetrics(): SlaMetrics {
  return {
    avgResponseMinutes: null,
    avgResolutionMinutes: null,
    withinSlaRatio: null,
    withinSlaCount: 0,
    slaEvaluatedCount: 0,
    slaBreaches: 0,
    openCount: 0,
    openOverdueCount: 0,
    canceledCount: 0,
    respondedCount: 0,
    resolvedCount: 0,
    withoutSlaCount: 0,
  }
}

/**
 * Показатели SLA по набору заявок.
 *
 * Правила, которые здесь закреплены:
 *
 * 1. Реакция считается только по заявкам, которые реально взяли в работу:
 *    первый переход в ASSIGNED или сразу в IN_PROGRESS. Неназначенная заявка
 *    не даёт нулевой реакции — она не участвует вовсе.
 * 2. Решение считается только по завершённым. Открытые заявки не смешиваются
 *    с завершёнными: иначе среднее росло бы само по себе с каждым днём, пока
 *    заявка висит.
 * 3. Доля в SLA считается ТОЛЬКО по закрытым заявкам, у которых задан срок.
 *    Заявка без срока не считается выполненной в срок — она уходит в
 *    withoutSlaCount и в знаменатель не попадает.
 * 4. Исторические нарушения берутся из slaBreachedAt, а не пересчитываются:
 *    это тот же признак, по которому остальная аналитика считает просрочку.
 * 5. Текущая просрочка открытых заявок считается ОТДЕЛЬНО, от срока и «сейчас»,
 *    и с историческим признаком не смешивается. Закрытая заявка в текущую
 *    просрочку не попадает никогда, даже если была просрочена.
 * 6. Отменённая заявка не открыта и не завершена. closedAt у неё нет, поэтому
 *    без отдельной проверки она считалась бы открытой и, при прошедшем сроке,
 *    просроченной сейчас. Она уходит в canceledCount.
 *
 * `now` передаётся параметром, а не берётся внутри: иначе разрезы по
 * организации, городу и точке могли бы посчитаться по разным моментам, и
 * цифры в одном ответе не сошлись бы между собой.
 */
export function computeSlaMetrics(
  tickets: readonly SlaSourceTicket[],
  now: Date = new Date(),
): SlaMetrics {
  const result = emptySlaMetrics()

  let responseSum = 0
  let resolutionSum = 0
  const nowMs = now.getTime()

  for (const ticket of tickets) {
    if (ticket.slaBreachedAt) result.slaBreaches += 1

    if (ticket.firstResponseAt) {
      result.respondedCount += 1
      responseSum += durationMinutes(ticket.createdAt, ticket.firstResponseAt)
    }

    if (ticket.canceled) {
      result.canceledCount += 1
      continue
    }

    if (!ticket.closedAt) {
      result.openCount += 1
      if (ticket.slaDueAt && ticket.slaDueAt.getTime() < nowMs) {
        result.openOverdueCount += 1
      }
      continue
    }

    result.resolvedCount += 1
    resolutionSum += durationMinutes(ticket.createdAt, ticket.closedAt)

    if (!ticket.slaDueAt) {
      result.withoutSlaCount += 1
      continue
    }

    result.slaEvaluatedCount += 1
    if (ticket.closedAt.getTime() <= ticket.slaDueAt.getTime()) {
      result.withinSlaCount += 1
    }
  }

  if (result.respondedCount > 0) {
    result.avgResponseMinutes = round1(responseSum / result.respondedCount)
  }
  if (result.resolvedCount > 0) {
    result.avgResolutionMinutes = round1(resolutionSum / result.resolvedCount)
  }
  if (result.slaEvaluatedCount > 0) {
    result.withinSlaRatio = round1((result.withinSlaCount / result.slaEvaluatedCount) * 100) / 100
  }

  return result
}

/** Разложить заявки по точкам и посчитать SLA в каждой. */
export function computeSlaByLocation(
  tickets: readonly SlaSourceTicket[],
  now: Date = new Date(),
): Map<string, SlaMetrics> {
  const byLocation = new Map<string, SlaSourceTicket[]>()
  for (const ticket of tickets) {
    if (!ticket.locationId) continue
    const bucket = byLocation.get(ticket.locationId)
    if (bucket) bucket.push(ticket)
    else byLocation.set(ticket.locationId, [ticket])
  }

  const result = new Map<string, SlaMetrics>()
  for (const [locationId, bucket] of byLocation) {
    result.set(locationId, computeSlaMetrics(bucket, now))
  }
  return result
}

// ─── A1. Городские агрегаты ─────────────────────────────────────────────────

/** Минимум, который нужен для агрегата: точка, город и её канонические счётчики. */
export type AggregableLocation = {
  locationId: string
  city: string | null
  totalTickets: number
  newTickets: number
  inProgressTickets: number
  awaitingAcceptanceTickets: number
  doneTickets: number
  canceledTickets: number
  overdueTickets: number
}

export type CityAggregate = {
  cityKey: string
  cityLabel: string
  /** Мощность группы: сколько точек города попало в выборку. */
  locationsCount: number
  totalTickets: number
  newTickets: number
  inProgressTickets: number
  awaitingAcceptanceTickets: number
  doneTickets: number
  canceledTickets: number
  overdueTickets: number
  /** SLA по городу: считается по заявкам точек города, а не усреднением средних. */
  sla: SlaMetrics
}

/**
 * Собрать агрегаты по городам.
 *
 * Счётчики складываются из канонических значений точек: каждая заявка
 * относится ровно к одной точке, поэтому сумма по точкам города — это
 * разбиение, а не приблизительная оценка.
 *
 * SLA по городу считается заново по заявкам города. Усреднять средние по
 * точкам нельзя: точка с одной заявкой весила бы столько же, сколько точка
 * с пятьюстами.
 *
 * Порядок: города по убыванию числа заявок (как и строки точек у бэкенда),
 * «Город не указан» всегда последним.
 */
export function buildCityAggregates(
  locations: readonly AggregableLocation[],
  slaTickets: readonly SlaSourceTicket[] = [],
  now: Date = new Date(),
): CityAggregate[] {
  const cityKeyByLocation = new Map<string, string>()
  const groups = new Map<string, CityAggregate>()

  for (const location of locations) {
    const cityKey = normalizeCityKey(location.city)
    cityKeyByLocation.set(location.locationId, cityKey)

    let group = groups.get(cityKey)
    if (!group) {
      group = {
        cityKey,
        cityLabel: cityLabel(location.city),
        locationsCount: 0,
        totalTickets: 0,
        newTickets: 0,
        inProgressTickets: 0,
        awaitingAcceptanceTickets: 0,
        doneTickets: 0,
        canceledTickets: 0,
        overdueTickets: 0,
        sla: emptySlaMetrics(),
      }
      groups.set(cityKey, group)
    }

    group.locationsCount += 1
    group.totalTickets += location.totalTickets
    group.newTickets += location.newTickets
    group.inProgressTickets += location.inProgressTickets
    group.awaitingAcceptanceTickets += location.awaitingAcceptanceTickets
    group.doneTickets += location.doneTickets
    group.canceledTickets += location.canceledTickets
    group.overdueTickets += location.overdueTickets
  }

  // SLA по городу — по заявкам тех точек, что попали в выборку.
  const ticketsByCity = new Map<string, SlaSourceTicket[]>()
  for (const ticket of slaTickets) {
    if (!ticket.locationId) continue
    const cityKey = cityKeyByLocation.get(ticket.locationId)
    if (!cityKey) continue
    const bucket = ticketsByCity.get(cityKey)
    if (bucket) bucket.push(ticket)
    else ticketsByCity.set(cityKey, [ticket])
  }
  for (const [cityKey, bucket] of ticketsByCity) {
    const group = groups.get(cityKey)
    if (group) group.sla = computeSlaMetrics(bucket, now)
  }

  return Array.from(groups.values()).sort((left, right) => {
    if (left.cityKey === NO_CITY_KEY) return 1
    if (right.cityKey === NO_CITY_KEY) return -1
    if (right.totalTickets !== left.totalTickets) return right.totalTickets - left.totalTickets
    return left.cityLabel.localeCompare(right.cityLabel, 'ru-RU')
  })
}

/**
 * Сверка городских сумм с итогами бэкенда.
 *
 * Тождество, которое должно держаться всегда:
 *
 *   сумма по городам + ticketsOutsideRows === summary.totalTickets
 *
 * ticketsOutsideRows — это заявки, которым не досталось строки: точка
 * деактивирована или удалена (строки берутся с isActive: true, а summary — нет),
 * либо строка отброшена порогом minTickets. Заявок «без точки» не бывает:
 * Ticket.locationId обязателен.
 *
 * Расхождение означает потерянную точку или двойной учёт, и проверяется
 * тестом, а не предположением.
 */
export function reconcileCityTotals(
  cities: readonly CityAggregate[],
  ticketsOutsideRows: number,
): number {
  return cities.reduce((sum, city) => sum + city.totalTickets, 0) + ticketsOutsideRows
}
