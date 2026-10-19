/**
 * SMA-DB-READINESS-P1 — разделение liveness и readiness (issue #378).
 *
 * Чистый модуль: ни Prisma, ни Nest, ни сети. Сюда вынесены решения о том,
 * что считать готовностью, какой отдавать код ответа и что именно попадает в
 * тело, — чтобы проверять это исполнением, а не чтением.
 *
 * Зачем вообще отдельная готовность. `/health` отвечает `{status:'ok'}`
 * безусловно и к базе не обращается. Это корректный liveness: процесс жив,
 * его не надо перезапускать. Но тот же `/health` используется как проверка
 * приёмки в канонических скиллах выкладки (sma-deploy-prod, sma-deploy-stage
 * ожидают 200), и значит выкладка проходит даже при недоступной базе.
 * `/health` не меняется — он остаётся дешёвым и нужен как liveness, —
 * а готовность получает отдельный маршрут.
 *
 * Тело ответа НИКОГДА не содержит текста ошибки, строки подключения, хоста,
 * имени базы и учётных данных: endpoint публичный, как и `/health`.
 */

/**
 * Таймаут проверки по умолчанию.
 *
 * Две секунды: проверка должна успеть ответить раньше, чем её оборвёт
 * probe-клиент, и при этом не висеть, когда база недоступна по сети.
 */
export const DEFAULT_READINESS_TIMEOUT_MS = 2000

/** Границы таймаута: ошибка в конфигурации не должна снимать ограничение. */
export const MIN_READINESS_TIMEOUT_MS = 100
export const MAX_READINESS_TIMEOUT_MS = 10_000

/**
 * Срок жизни кэша результата.
 *
 * Endpoint публичный, поэтому его можно опрашивать сколь угодно часто. Кэш на
 * секунду превращает любую частоту обращений в не более одного запроса к базе
 * в секунду — это и есть «без лишней нагрузки на базу». Цена — результат
 * может отставать от реальности не более чем на секунду, что для проверки
 * готовности несущественно.
 */
export const DEFAULT_READINESS_CACHE_MS = 1000

export type ProbeOutcome =
  | { kind: 'up'; latencyMs: number }
  | { kind: 'timeout'; timeoutMs: number }
  | { kind: 'down' }

export type ReadinessBody = {
  status: 'ready' | 'not_ready'
  database: 'up' | 'down' | 'timeout'
  /** Задержка проверки в миллисекундах. Только при успехе. */
  latencyMs?: number
  /** Какой таймаут был применён. Только при его срабатывании. */
  timeoutMs?: number
}

export type ReadinessResponse = {
  /** 200 — готов, 503 — не готов. Иной код не предусмотрен. */
  httpStatus: 200 | 503
  body: ReadinessBody
}

/**
 * Привести таймаут из конфигурации к допустимому.
 *
 * Непарсящееся значение, ноль, отрицательное и отсутствующее дают значение по
 * умолчанию; слишком большое и слишком малое — зажимаются. Неограниченного
 * таймаута получить нельзя ни при какой конфигурации.
 */
export function resolveReadinessTimeoutMs(raw: string | undefined): number {
  const parsed = Number.parseInt((raw || '').trim(), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_READINESS_TIMEOUT_MS
  if (parsed < MIN_READINESS_TIMEOUT_MS) return MIN_READINESS_TIMEOUT_MS
  if (parsed > MAX_READINESS_TIMEOUT_MS) return MAX_READINESS_TIMEOUT_MS
  return parsed
}

/**
 * Ответ по результату проверки.
 *
 * Недоступность и таймаут различаются в поле `database`, но оба дают 503:
 * для probe-клиента это одинаково «не готов», а различие нужно дежурному,
 * чтобы понимать, сеть это или отказ.
 */
export function buildReadinessResponse(outcome: ProbeOutcome): ReadinessResponse {
  if (outcome.kind === 'up') {
    return {
      httpStatus: 200,
      body: { status: 'ready', database: 'up', latencyMs: outcome.latencyMs },
    }
  }

  if (outcome.kind === 'timeout') {
    return {
      httpStatus: 503,
      body: { status: 'not_ready', database: 'timeout', timeoutMs: outcome.timeoutMs },
    }
  }

  return { httpStatus: 503, body: { status: 'not_ready', database: 'down' } }
}

/**
 * Классифицировать сбой проверки.
 *
 * Текст ошибки сюда не попадает и наружу не уходит: сообщения драйвера и
 * Prisma содержат хост, имя базы, а иногда и пользователя. Наружу уходит
 * только категория.
 */
export function classifyProbeFailure(error: unknown): 'timeout' | 'down' {
  if (error && typeof error === 'object' && (error as { isReadinessTimeout?: unknown }).isReadinessTimeout === true) {
    return 'timeout'
  }
  return 'down'
}

/** Маркер внутреннего таймаута. Наружу не отдаётся, нужен только для классификации. */
export class ReadinessTimeoutError extends Error {
  readonly isReadinessTimeout = true

  constructor(readonly timeoutMs: number) {
    super('readiness probe timed out')
    this.name = 'ReadinessTimeoutError'
  }
}
